#!/usr/bin/env python3
"""Build cost.json unit inputs from DOT Table 6, GSA FY2026, EIA and park fees.

Usage: python3 pipeline/cost.py
Inputs/cache: data/raw/lane2; output: app/public/data/cost.json and
data/processed/lane2/cost_sources.json (merged into meta.json by lane 1).
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
from datetime import date
from pathlib import Path
from typing import Any

import requests

from lane2_common import DATA, RAW, ensure_finite, hikes, read_json, require_key, write_json
from travel import CITY_AIRPORT, AIRPORT_CITY, dot_rows, fare_lookup

EIA_SERIES = "https://api.eia.gov/v2/seriesid/EMM_EPM0_PTE_{region}_DPG/data/"
GSA_RATES = "https://api.gsa.gov/travel/perdiem/v2/rates/conus/lodging/2026"
FY = 2026
CITY_PADD = {"SEA": "R50", "SFO": "R50", "LAX": "R50", "PHX": "R40", "DEN": "R40",
             "DFW": "R30", "ORD": "R20", "ATL": "R10", "NYC": "R10", "DCA": "R10"}
CITY_STATE = {"SEA": "WA", "SFO": "CA", "LAX": "CA", "PHX": "AZ", "DEN": "CO", "DFW": "TX",
              "ORD": "IL", "ATL": "GA", "NYC": "NY", "DCA": "DC"}
MONTHS_BY_QUARTER = {1: (1, 2, 3), 2: (4, 5, 6), 3: (7, 8, 9), 4: (10, 11, 12)}
# Calendar months covered by FY2026. GSA calls its periods July-June for seasonal rates.
MONTHS_FY2026 = {q: tuple(((m - 1) % 12) + 1 for m in months) for q, months in MONTHS_BY_QUARTER.items()}
MEAL_ASSUMPTION = 68.0  # use when GSA returns no locality M&IE rate; source explicitly labels this assumption
CAR_PER_DAY = 60.0
MPG = 25.0


def fetch_eia(region: str, key: str) -> tuple[float, str]:
    cache = RAW / f"eia-{region}-gas.json"
    if cache.exists():
        data = read_json(cache)
    else:
        r = requests.get(EIA_SERIES.format(region=region), params={"api_key": key, "frequency": "weekly",
                         "data[]": "value", "length": 52, "sort[0][column]": "period",
                         "sort[0][direction]": "desc"}, timeout=90)
        if r.status_code >= 400:
            raise RuntimeError(f"EIA request failed ({r.status_code}): {r.text[:300]}")
        data = r.json()
        if not data.get("response", {}).get("data"):
            raise RuntimeError(f"EIA returned no weekly gasoline values for {region}: {data}")
        RAW.mkdir(parents=True, exist_ok=True)
        write_json(cache, data)
    entries = data["response"]["data"]
    values = [float(row["value"]) for row in entries if row.get("value") not in (None, "", "-")]
    if not values:
        raise ValueError(f"No usable EIA gasoline values for {region}")
    latest = str(entries[0].get("period", "past 52 available weeks"))
    earliest = str(entries[-1].get("period", ""))
    return round(sum(values) / len(values), 2), f"average of {len(values)} weekly values, {earliest} through {latest}"


def fetch_gsa() -> Any:
    cache = RAW / "gsa-fy2026.json"
    if cache.exists():
        return read_json(cache)
    key = require_key("GSA_API_KEY")
    r = requests.get(GSA_RATES, params={"api_key": key}, timeout=90)
    if r.status_code >= 400:
        raise RuntimeError(f"GSA FY2026 rates request failed ({r.status_code}): {r.text[:300]}")
    data = r.json()
    RAW.mkdir(parents=True, exist_ok=True)
    write_json(cache, data)
    return data


def _flatten_gsa(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("rates", "perdiem", "data", "items"):
            if isinstance(data.get(key), list):
                return data[key]
    raise ValueError("Unrecognized GSA response: expected a list of locality rates")


def gsa_rates_for_hike(hike: dict[str, Any], rows: list[dict[str, Any]], quarter: int) -> tuple[float, float, str]:
    county = str(hike.get("aqi_county", {}).get("name", "")).split(",", 1)[0].lower().replace(" county", "").strip()
    state = hike.get("state", "").lower()
    park = str(hike.get("park_name", "")).lower()
    candidates = []
    for r in rows:
        text = " ".join(str(v) for v in r.values()).lower()
        if state and state not in text:
            continue
        if county and county in text:
            candidates.append(r)
    if not candidates:
        candidates = [r for r in rows if state and state in " ".join(str(v) for v in r.values()).lower() and park.split()[0] in " ".join(str(v) for v in r.values()).lower()]
    if not candidates:
        raise ValueError(f"No GSA FY2026 locality rate for {hike['id']} ({county}, {state})")
    row = candidates[0]
    month_names = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun", 7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"}
    month_values = []
    for month in MONTHS_BY_QUARTER[quarter]:
        value = next((row[k] for k in row if k.lower() == month_names[month].lower()), None)
        if value is not None:
            month_values.append(float(value))
    lodging = sum(month_values) / len(month_values) if month_values else next((row[k] for k in row if k.lower() in ("lodging", "lodgingrate", "lodging_rate")), None)
    mie = next((row[k] for k in row if k.lower() in ("meals", "mie", "mealsrate", "meals_rate", "mealsandincidentals")), None)
    if lodging is None:
        raise ValueError(f"GSA response has no lodging amount for {hike['id']}: {row}")
    try:
        lodging_value = float(lodging)
        mie_value = float(mie) if mie is not None else MEAL_ASSUMPTION
    except (TypeError, ValueError):
        raise ValueError(f"Invalid GSA rates for {hike['id']}: {row}")
    return lodging_value, mie_value, str(row.get("city", row.get("county", county)))


def read_manual_fees() -> dict[str, Any]:
    path = RAW / "nps-fees.json"
    if not path.exists():
        raise RuntimeError("Missing data/raw/lane2/nps-fees.json. Add manually verified NPS entrance and permit fees; do not substitute fake values.")
    return read_json(path)


def build_cost(hike_rows: list[dict[str, Any]], travel_rows: list[dict[str, Any]], dot: list[dict[str, Any]],
               gsa_rows: list[dict[str, Any]], gas: dict[str, tuple[float, str]], fees: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    by_hike = {h["id"]: h for h in hike_rows}
    travel = {(r["hike_id"], r["city"]): r for r in travel_rows}
    costs = []
    fare_periods: set[int] = set()
    gsa_localities: set[str] = set()
    for hike in hike_rows:
        hid = hike["id"]
        fee = fees.get("parks", {}).get(hike.get("park_code"), {})
        if "entry_fee_vehicle" not in fee:
            raise ValueError(f"No verified entry_fee_vehicle for {hike.get('park_code')} in nps-fees.json")
        permit = fees.get("permits", {}).get(hid)
        if permit is None:
            permit = 0
        for city in CITY_AIRPORT:
            t = travel.get((hid, city))
            if not t:
                raise ValueError(f"Missing travel row for {hid}/{city}; run travel.py first")
            origin, destination = CITY_AIRPORT[city], t["airport"]
            fare_rows: dict[int, tuple[float, int]] = {}
            for quarter in range(1, 5):
                fare_rows[quarter] = fare_lookup(dot, origin, destination, quarter)
                fare_periods.add(fare_rows[quarter][1])
            # GSA lodging may change by month; average the three calendar months in this quarter.
            lodging, meals, locality = gsa_rates_for_hike(hike, gsa_rows, 3)
            gsa_localities.add(locality)
            gas_value, _ = gas[CITY_PADD[city]]
            for quarter in range(1, 5):
                fare, _ = fare_rows[quarter]
                quarter_months = MONTHS_FY2026[quarter]
                # If the locality has date-sensitive months, use the mean of its listed month rates.
                quarter_lodging, meals, locality = gsa_rates_for_hike(hike, gsa_rows, quarter)
                if isinstance(fee.get("quarter_lodging"), dict) and str(quarter) in fee["quarter_lodging"]:
                    quarter_lodging = float(fee["quarter_lodging"][str(quarter)])
                costs.append({"hike_id": hid, "city": city, "quarter": quarter,
                              "fare_one_way": fare, "car_per_day": CAR_PER_DAY, "drive_mi": float(t["drive_mi"]),
                              "gas_per_gal": gas_value, "mpg": MPG, "lodging_per_night": round(quarter_lodging),
                              "meals_per_day": meals, "entry_fee_vehicle": float(fee["entry_fee_vehicle"]),
                              "permit_fee": float(permit)})
    ensure_finite(costs, ("fare_one_way", "car_per_day", "drive_mi", "gas_per_gal", "mpg", "lodging_per_night", "meals_per_day", "entry_fee_vehicle", "permit_fee"))
    sources = {
        "fare": {"label": "U.S. DOT Consumer Airfare Report, Table 6", "detail": f"Latest available annual quarter-pair averages; years {min(fare_periods)}–{max(fare_periods)}. Average one-way city-pair fare.", "url": "https://data.transportation.gov/d/yj5y-b2ir"},
        "lodging": {"label": "GSA per diem, FY2026", "detail": "County/locality lodging and meals rates; nightly lodging and M&IE are typical unit inputs.", "url": "https://www.gsa.gov/travel/plan-a-trip/per-diem-rates"},
        "gas": {"label": "EIA weekly retail gasoline prices", "detail": "Mean of the latest 52 available weekly regular-gasoline observations by PADD region; 25 mpg assumed.", "url": "https://www.eia.gov/petroleum/gasdiesel/"},
        "fees": {"label": "National Park Service entrance and permit fees", "detail": "Manually verified per-vehicle park entrance and per-party hike permit amounts. See source notes in data/raw/lane2/nps-fees.json.", "url": "https://www.nps.gov/planyourvisit/fees.htm"},
        "assumed": {"label": "Team assumption", "detail": "Rental car $60 per day, one car for a fly trip; fuel economy 25 mpg.", "url": ""},
    }
    return costs, sources


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fees", type=Path, default=RAW / "nps-fees.json")
    args = parser.parse_args()
    hikes_rows = hikes()
    travel_rows = read_json(DATA / "travel.json")
    dot = dot_rows()
    gsa = _flatten_gsa(fetch_gsa())
    key = require_key("EIA_API_KEY")
    gas = {region: fetch_eia(region, key) for region in sorted(set(CITY_PADD.values()))}
    fees = read_json(args.fees)
    costs, sources = build_cost(hikes_rows, travel_rows, dot, gsa, gas, fees)
    write_json(DATA / "cost.json", costs)
    write_json(ROOT / "data" / "processed" / "lane2" / "cost_sources.json", sources)
    print(f"Wrote {len(costs)} cost rows; lane 1 should merge cost_sources.json into meta.json")


if __name__ == "__main__":
    main()
