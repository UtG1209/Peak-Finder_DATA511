"""Smoky and ozone days per hike from EPA AirData daily AQI by county (lane 1).

Smoky day = AQI over 100 where PM2.5 is the defining pollutant. Ozone day = AQI over 100 where ozone is.
AQI over 100 alone is not smoke: Mariposa in August had 71 days over 100, only 33 of them PM2.5.
County level, not trail level: the app says so.

Run from the repo root:  .venv/Scripts/python.exe pipeline/epa_aqi.py
Output: data/processed/aqi.json
"""

import json
import sys
import zipfile
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "epa"
COUNTY_CACHE = ROOT / "data" / "raw" / "fcc" / "counties.json"
OUT_FILE = ROOT / "data" / "processed" / "aqi.json"
HIKES_FILE = ROOT / "app" / "public" / "data" / "hikes.json"

AIRDATA_URL = "https://aqs.epa.gov/aqsweb/airdata/daily_aqi_by_county_{year}.zip"
FCC_URL = "https://geo.fcc.gov/api/census/area"
USER_AGENT = "PeakFinderDATA511/0.1 (student project)"

# 2005 to 2014 are fetched only for the Flathead known answer. Typical values use 2015-2024.
FIRST_YEAR = 2005
LAST_YEAR = 2024
TYPICAL_YEARS = [year for year in range(2015, 2025) if year != 2020]  # 2020: Covid year, left out

UNHEALTHY_AQI = 100
SMOKE_POLLUTANT = "PM2.5"
OZONE_POLLUTANT = "Ozone"


def county_for(lat, lon):
    """{fips, name} of the county containing a point, from the FCC area API. Cached by coordinates."""
    COUNTY_CACHE.parent.mkdir(parents=True, exist_ok=True)
    cache = json.loads(COUNTY_CACHE.read_text(encoding="utf-8")) if COUNTY_CACHE.exists() else {}
    key = f"{lat:.5f},{lon:.5f}"
    if key not in cache:
        params = {"lat": lat, "lon": lon, "format": "json", "censusYear": 2020}
        response = requests.get(FCC_URL, params=params, headers={"User-Agent": USER_AGENT}, timeout=60)
        response.raise_for_status()
        found = response.json()["results"][0]
        cache[key] = {"fips": found["county_fips"], "name": f"{found['county_name']}, {found['state_code']}"}
        COUNTY_CACHE.write_text(json.dumps(cache, indent=1), encoding="utf-8")
    return cache[key]


def download_year(year):
    """Path of the cached AirData zip for one year, downloading it first if needed."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"daily_aqi_by_county_{year}.zip"
    if not path.exists():
        response = requests.get(AIRDATA_URL.format(year=year), headers={"User-Agent": USER_AGENT}, timeout=300)
        response.raise_for_status()
        path.write_bytes(response.content)
    return path


def load_counties(fips_codes):
    """One table of daily AQI rows for the wanted counties, all years."""
    frames = []
    for year in range(FIRST_YEAR, LAST_YEAR + 1):
        with zipfile.ZipFile(download_year(year)) as archive:
            with archive.open(archive.namelist()[0]) as csv_file:
                frame = pd.read_csv(csv_file, dtype={"State Code": str, "County Code": str})
        frame["fips"] = frame["State Code"].str.zfill(2) + frame["County Code"].str.zfill(3)
        frames.append(frame[frame["fips"].isin(fips_codes)])
    table = pd.concat(frames, ignore_index=True)
    table["date"] = pd.to_datetime(table["Date"])
    table["AQI"] = pd.to_numeric(table["AQI"], errors="coerce")
    return table[["fips", "date", "AQI", "Defining Parameter"]].rename(columns={"Defining Parameter": "parameter"})


def unhealthy_days(table, fips, month, years, pollutant=None):
    """Days with AQI over 100 in one month, summed over the given years.

    pollutant=None counts every pollutant (the "AQI over 100" figure, which is not smoke).
    """
    rows = table[(table["fips"] == fips) & (table["date"].dt.month == month) & table["date"].dt.year.isin(years)]
    rows = rows[rows["AQI"] > UNHEALTHY_AQI]
    if pollutant is not None:
        rows = rows[rows["parameter"] == pollutant]
    return len(rows)


def days_reported(table, fips, month, years):
    rows = table[(table["fips"] == fips) & (table["date"].dt.month == month) & table["date"].dt.year.isin(years)]
    return len(rows)


def month_summary(table, fips, month):
    """Typical smoky and ozone days in this month: the average per year over the typical years."""
    years = TYPICAL_YEARS
    smoky = unhealthy_days(table, fips, month, years, SMOKE_POLLUTANT)
    ozone = unhealthy_days(table, fips, month, years, OZONE_POLLUTANT)
    return {
        "month": month,
        "smoky_days": round(smoky / len(years), 1),
        "ozone_days": round(ozone / len(years), 1),
    }


def has_data(table, fips):
    typical = table[(table["fips"] == fips) & table["date"].dt.year.isin(TYPICAL_YEARS)]
    return len(typical) > 0


def build(hikes):
    counties = {}
    for hike in hikes:
        trailhead = hike["trailhead"]
        counties[hike["id"]] = county_for(trailhead["lat"], trailhead["lon"])

    table = load_counties({county["fips"] for county in counties.values()})

    result = {}
    for hike in hikes:
        county = counties[hike["id"]]
        if not has_data(table, county["fips"]):
            print(f"{hike['id']}: no AQI monitor data for {county['name']}")
            result[hike["id"]] = {"county": county, "missing": ["smoky"], "months": []}
            continue
        months = [month_summary(table, county["fips"], month) for month in range(1, 13)]
        print(f"{hike['id']}: {county['name']}")
        result[hike["id"]] = {"county": county, "missing": [], "months": months}
    return result


def main():
    hikes = json.loads(HIKES_FILE.read_text(encoding="utf-8"))
    wanted = sys.argv[1:]
    if wanted:
        hikes = [hike for hike in hikes if hike["id"] in wanted]

    output = {
        "source": "EPA AirData, daily AQI by county",
        "typical_years": "2015-2024, excluding 2020",
        "hikes": build(hikes),
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(output, indent=1), encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
