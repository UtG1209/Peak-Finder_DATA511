#!/usr/bin/env python3
"""Build travel.json from HeiGIT routing and DOT Consumer Airfare data.

Usage: python3 pipeline/travel.py [--hikes app/public/data/hikes.json]
The matrix responses and DOT source rows are cached in data/raw/lane2/.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
from datetime import date
from pathlib import Path
from typing import Any

import requests

from lane2_common import DATA, RAW, ensure_finite, hikes, read_json, require_key, write_json

ORS_MATRIX = "https://api.heigit.org/openrouteservice/v2/matrix/driving-car"
DOT_TABLE6 = "https://data.transportation.gov/resource/yj5y-b2ir.json"
ORS_CALLS = 0

# Coordinates are airport reference points (WGS84). City airports are the consistent fare origins;
# the destination set includes the commercial airports commonly serving the 40 selected parks.
AIRPORTS: dict[str, tuple[float, float]] = {
    "SEA": (47.4502, -122.3088), "PDX": (45.5898, -122.5951), "SFO": (37.6213, -122.3790),
    "SJC": (37.3639, -121.9289), "LAX": (33.9416, -118.4085), "LAS": (36.0840, -115.1537),
    "PHX": (33.4342, -112.0116), "DEN": (39.8561, -104.6737), "DFW": (32.8998, -97.0403),
    "ORD": (41.9742, -87.9073), "ATL": (33.6407, -84.4277), "JFK": (40.6413, -73.7781),
    "DCA": (38.8512, -77.0402), "BZN": (45.7775, -111.1530), "FCA": (48.3105, -114.2560),
    "JAC": (43.6073, -110.7377), "SLC": (40.7899, -111.9791), "BIL": (45.8077, -108.5429),
    "COS": (38.8058, -104.7008), "ABQ": (35.0402, -106.6090), "FLG": (35.1385, -111.6712),
    "SGU": (37.0906, -113.5931), "RDM": (44.2541, -121.1500), "MFR": (42.3742, -122.8735),
    "EUG": (44.1246, -123.2119), "RDD": (40.5089, -122.2934), "FAT": (36.7762, -119.7181),
    "MMH": (37.6241, -118.8378), "BIH": (37.3731, -118.3636), "ASE": (39.2232, -106.8688),
    "GJT": (39.1224, -108.5267), "CNY": (38.7550, -109.7548), "CDC": (37.7009, -113.0988),
    "SBA": (34.4262, -119.8404), "ONT": (34.0560, -117.6012), "RNO": (39.4991, -119.7681),
    "EGE": (39.6426, -106.9177), "HDN": (40.4812, -107.2177), "CPR": (42.9080, -106.4644),
    "TWF": (42.4818, -114.4877), "ELP": (31.8072, -106.3776), "SAF": (35.6171, -106.0894),
}
CITY_AIRPORT = {"SEA": "SEA", "SFO": "SFO", "LAX": "LAX", "PHX": "PHX", "DEN": "DEN", "DFW": "DFW", "ORD": "ORD", "ATL": "ATL", "NYC": "JFK", "DCA": "DCA"}
CITY_COORDS = {
    "SEA": (-122.3321, 47.6062), "SFO": (-122.4194, 37.7749), "LAX": (-118.2437, 34.0522),
    "PHX": (-112.0740, 33.4484), "DEN": (-104.9903, 39.7392), "DFW": (-96.7970, 32.7767),
    "ORD": (-87.6298, 41.8781), "ATL": (-84.3880, 33.7490), "NYC": (-74.0060, 40.7128), "DCA": (-77.0369, 38.9072),
}
AIRPORT_CITY = {
    "SEA": "Seattle, WA", "SFO": "San Francisco, CA", "LAX": "Los Angeles, CA", "PHX": "Phoenix, AZ",
    "DEN": "Denver, CO", "DFW": "Dallas/Fort Worth, TX", "ORD": "Chicago, IL", "ATL": "Atlanta, GA",
    "JFK": "New York City, NY", "DCA": "Washington, DC", "LAS": "Las Vegas, NV", "BZN": "Bozeman, MT",
    "FCA": "Kalispell, MT", "JAC": "Jackson, WY", "SLC": "Salt Lake City, UT", "BIL": "Billings, MT",
    "COS": "Colorado Springs, CO", "ABQ": "Albuquerque, NM", "FLG": "Flagstaff, AZ", "SGU": "St. George, UT",
    "RDM": "Bend/Redmond, OR", "MFR": "Medford, OR", "EUG": "Eugene, OR", "RDD": "Redding, CA",
    "FAT": "Fresno, CA", "MMH": "Mammoth Lakes, CA", "BIH": "Bishop, CA", "ASE": "Aspen, CO",
    "GJT": "Grand Junction, CO", "CNY": "Moab, UT", "CDC": "Cedar City, UT", "SBA": "Santa Barbara, CA",
    "ONT": "Ontario, CA", "RNO": "Reno, NV", "EGE": "Eagle, CO", "HDN": "Hayden, CO", "CPR": "Casper, WY",
    "TWF": "Twin Falls, ID", "ELP": "El Paso, TX", "SAF": "Santa Fe, NM",
}


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1 = a; lon2, lat2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def _locations_hash(locations: list[list[float]]) -> str:
    raw = json.dumps(locations, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()[:20]


def ors_matrix(locations: list[list[float]], sources: list[int], destinations: list[int]) -> dict[str, Any]:
    global ORS_CALLS
    cache = RAW / f"ors-matrix-{_locations_hash(locations)}-{sources[0]}-{destinations[0]}.json"
    if cache.exists():
        return read_json(cache)
    key = require_key("ORS_API_KEY")
    r = requests.post(ORS_MATRIX, json={"locations": locations, "sources": sources, "destinations": destinations,
                                          "metrics": ["duration", "distance"], "units": "m"},
                      headers={"Authorization": key, "Content-Type": "application/json"}, timeout=180)
    if r.status_code >= 400:
        raise RuntimeError(f"HeiGIT matrix request failed ({r.status_code}): {r.text[:400]}")
    data = r.json()
    if "durations" not in data or "distances" not in data:
        raise RuntimeError(f"HeiGIT matrix response lacks durations/distances: {data}")
    RAW.mkdir(parents=True, exist_ok=True)
    write_json(cache, data)
    ORS_CALLS += 1
    return data


def dot_rows() -> list[dict[str, Any]]:
    path = RAW / "dot-table6.json"
    if path.exists():
        return read_json(path)
    url = os.environ.get("DOT_TABLE6_URL", DOT_TABLE6)
    headers = {"X-App-Token": os.environ["SOCRATA_APP_TOKEN"]} if os.environ.get("SOCRATA_APP_TOKEN") else {}
    data: list[dict[str, Any]] = []
    # Request four recent years, newest first. Socrata caps a page at 50k rows;
    # offset paging avoids silently missing an older quarter when the newest
    # years collectively exceed that cap.
    first_year = date.today().year - 3
    page_size = 50_000
    offset = 0
    while True:
        r = requests.get(url, params={"$where": f"year >= {first_year}", "$limit": page_size,
                                      "$offset": offset, "$order": "year DESC,quarter DESC"},
                         headers=headers, timeout=180)
        if r.status_code >= 400:
            raise RuntimeError(f"DOT Table 6 download failed ({r.status_code}); set DOT_TABLE6_URL to its official CSV/API download.")
        page = r.json()
        if not isinstance(page, list):
            raise RuntimeError("DOT Table 6 returned an unexpected response; check its public API URL")
        data.extend(page)
        if len(page) < page_size:
            break
        offset += len(page)
    if not data:
        raise RuntimeError("DOT Table 6 returned no rows; check its public API URL")
    RAW.mkdir(parents=True, exist_ok=True)
    write_json(path, data)
    return data


def normalize(s: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(s).lower())


def _first(row: dict[str, Any], names: tuple[str, ...], default: Any = None) -> Any:
    keys = {normalize(k): v for k, v in row.items()}
    for name in names:
        if normalize(name) in keys:
            return keys[normalize(name)]
    return default


def fare_lookup(rows: list[dict[str, Any]], origin: str, destination: str, quarter: int) -> tuple[float, int]:
    """Select the latest available Table 6 average fare for a directionless city-pair market."""
    om, dm = normalize(AIRPORT_CITY[origin]), normalize(AIRPORT_CITY[destination])
    matches: list[tuple[int, int, float]] = []
    for row in rows:
        year = _first(row, ("year", "data_year"))
        q = _first(row, ("quarter", "qtr"))
        fare = _first(row, ("fare", "average_fare", "avg_fare", "market_fare"))
        a = normalize(_first(row, ("city1", "city_1", "origin_city", "market1", "city_market_1"), ""))
        b = normalize(_first(row, ("city2", "city_2", "destination_city", "market2", "city_market_2"), ""))
        try:
            y, qn, value = int(float(year)), int(float(q)), float(str(fare).replace("$", "").replace(",", ""))
        except (TypeError, ValueError):
            continue
        pair = (om in a or a in om) and (dm in b or b in dm) or (dm in a or a in dm) and (om in b or b in om)
        if pair and qn == quarter and value > 0:
            matches.append((y, qn, value))
    if not matches:
        raise ValueError(f"DOT Table 6 has no fare row for {origin}–{destination}, Q{quarter}")
    year, _, fare = max(matches)
    return round(fare, 2), year


def build_travel(hike_rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[tuple[str, str], float], dict[str, str]]:
    city_codes = list(CITY_COORDS)
    hikes_local = [h for h in hike_rows if h.get("trailhead")]
    hcoords = [[float(h["trailhead"]["lon"]), float(h["trailhead"]["lat"])] for h in hikes_local]
    city_locs = [[CITY_COORDS[c][0], CITY_COORDS[c][1]] for c in city_codes]
    matrix = ors_matrix(city_locs + hcoords, list(range(len(city_codes))), list(range(len(city_codes), len(city_codes) + len(hcoords))))
    drive_dur, drive_dist = {}, {}
    for i, city in enumerate(city_codes):
        for j, h in enumerate(hikes_local):
            duration = matrix["durations"][i][j]
            distance = matrix["distances"][i][j]
            if duration is None or distance is None:
                raise ValueError(f"HeiGIT cannot route {city} to {h['id']}")
            drive_dur[(h["id"], city)] = float(duration) / 3600
            drive_dist[(h["id"], city)] = float(distance) / 1609.344

    airport_by_hike = {h["id"]: min(AIRPORTS, key=lambda code: haversine_m((h["trailhead"]["lon"], h["trailhead"]["lat"]), (AIRPORTS[code][1], AIRPORTS[code][0]))) for h in hikes_local}
    unique_airports = sorted(set(airport_by_hike.values()))
    airport_drive: dict[tuple[str, str], float] = {}
    for start in range(0, len(unique_airports), 10):
        chunk = unique_airports[start:start + 10]
        locations = [[AIRPORTS[c][1], AIRPORTS[c][0]] for c in chunk] + hcoords
        result = ors_matrix(locations, list(range(len(chunk))), list(range(len(chunk), len(chunk) + len(hcoords))))
        for i, airport in enumerate(chunk):
            for j, h in enumerate(hikes_local):
                seconds = result["durations"][i][j]
                if seconds is not None:
                    airport_drive[(h["id"], airport)] = float(seconds) / 3600

    rows = []
    for h in hikes_local:
        dest = airport_by_hike[h["id"]]
        for city in city_codes:
            origin = CITY_AIRPORT[city]
            air_miles = haversine_m((AIRPORTS[origin][1], AIRPORTS[origin][0]), (AIRPORTS[dest][1], AIRPORTS[dest][0])) / 1609.344
            # 1.5 h for airport processes plus 1 h ground travel to the origin airport.
            fly_hours = 1.0 + 1.5 + air_miles / 500 + airport_drive.get((h["id"], dest), 0)
            drive_hours = drive_dur[(h["id"], city)]
            rows.append({"hike_id": h["id"], "city": city, "drive_hr": round(drive_hours, 1),
                         "drive_mi": round(drive_dist[(h["id"], city)]), "airport": dest,
                         "fly_drive_hr": round(fly_hours, 1), "default_mode": "fly" if fly_hours < drive_hours else "drive"})
    ensure_finite(rows, ("drive_hr", "drive_mi", "fly_drive_hr"))
    return rows, drive_dist, airport_by_hike


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hikes", type=Path, default=DATA / "hikes.json")
    args = parser.parse_args()
    hike_rows = read_json(args.hikes)
    rows, _, _ = build_travel(hike_rows)
    write_json(DATA / "travel.json", rows)
    print(f"Wrote {len(rows)} travel rows to {DATA / 'travel.json'}")


if __name__ == "__main__":
    main()
