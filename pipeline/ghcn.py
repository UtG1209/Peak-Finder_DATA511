"""Weather per hike from NOAA GHCN-Daily (lane 1).

For each hike: find the nearest station within 50 km that has enough daily highs and rain,
then summarise each month over 2015-2024 (2020 excluded).
Do not swap this for Open-Meteo: it reports 1.5 days >= 100 F in a Zion August, the station says 13.0.

Run from the repo root:  .venv/Scripts/python.exe pipeline/ghcn.py
Output: data/processed/weather.json
"""

import calendar
import json
import math
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "ghcn"
OUT_FILE = ROOT / "data" / "processed" / "weather.json"
HIKES_FILE = ROOT / "app" / "public" / "data" / "hikes.json"

GHCN_BASE = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/"
DATA_API = "https://www.ncei.noaa.gov/access/services/data/v1"
USER_AGENT = "PeakFinderDATA511/0.1 (student project)"

FIRST_YEAR = 2015
LAST_YEAR = 2024
EXCLUDED_YEARS = {2020}  # Covid year, left out of every typical value
MAX_DISTANCE_KM = 50
MIN_DAYS_PRESENT = 0.80  # of all days in the typical years, for both highs and rain
MIN_MONTH_PRESENT = 0.80  # a single month with fewer days than this is skipped for that year

WET_DAY_INCHES = 0.1
SNOW_DAY_INCHES = 0.1
HEAT_DAY_F = 100
LAPSE_F_PER_1000_FT = 3.5  # summit estimate: cooler by this much per 1,000 ft above the station

M_TO_FT = 3.28084


def haversine_km(lat1, lon1, lat2, lon2):
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_lat = p2 - p1
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lon / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def download(name):
    """Download a GHCN file once into the raw cache and return its text."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / name
    if not path.exists():
        response = requests.get(GHCN_BASE + name, headers={"User-Agent": USER_AGENT}, timeout=300)
        response.raise_for_status()
        path.write_text(response.text, encoding="utf-8")
    return path.read_text(encoding="utf-8")


def load_stations():
    """Stations that report both TMAX and PRCP through the typical years: {id: {name, lat, lon, elev_ft}}."""
    complete_span = set()
    seen = {}
    for line in download("ghcnd-inventory.txt").splitlines():
        element = line[31:35].strip()
        if element not in ("TMAX", "PRCP"):
            continue
        first_year, last_year = int(line[36:40]), int(line[41:45])
        if first_year <= FIRST_YEAR and last_year >= LAST_YEAR:
            seen.setdefault(line[0:11], set()).add(element)
    for station_id, elements in seen.items():
        if elements == {"TMAX", "PRCP"}:
            complete_span.add(station_id)

    stations = {}
    for line in download("ghcnd-stations.txt").splitlines():
        station_id = line[0:11]
        if station_id not in complete_span:
            continue
        elevation_m = float(line[31:37])
        if elevation_m < -900:  # GHCN uses -999.9 for unknown
            continue
        stations[station_id] = {
            "id": station_id,
            "name": line[41:71].strip().title(),
            "lat": float(line[12:20]),
            "lon": float(line[21:30]),
            "elev_ft": round(elevation_m * M_TO_FT),
        }
    return stations


def nearby_stations(stations, lat, lon):
    """Stations within the distance limit, nearest first."""
    found = []
    for station in stations.values():
        if abs(station["lat"] - lat) > 0.6 or abs(station["lon"] - lon) > 0.8:
            continue  # cheap box test before the exact distance
        distance = haversine_km(lat, lon, station["lat"], station["lon"])
        if distance <= MAX_DISTANCE_KM:
            found.append({**station, "dist_km": round(distance, 1)})
    return sorted(found, key=lambda s: s["dist_km"])


def fetch_daily(station_id):
    """Daily highs (F), rain and snow (inches) for one station, 2015-2024. Cached."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"{station_id}_{FIRST_YEAR}-{LAST_YEAR}.json"
    if not path.exists():
        params = {
            "dataset": "daily-summaries",
            "stations": station_id,
            "startDate": f"{FIRST_YEAR}-01-01",
            "endDate": f"{LAST_YEAR}-12-31",
            "dataTypes": "TMAX,PRCP,SNOW",
            "format": "json",
            "units": "standard",
        }
        response = requests.get(DATA_API, params=params, headers={"User-Agent": USER_AGENT}, timeout=180)
        response.raise_for_status()
        path.write_text(response.text, encoding="utf-8")
    return parse_daily(path.read_text(encoding="utf-8"))


def parse_daily(text):
    rows = json.loads(text) if text.strip() else []
    frame = pd.DataFrame(rows)
    if frame.empty:
        return pd.DataFrame(columns=["date", "TMAX", "PRCP", "SNOW"])
    frame["date"] = pd.to_datetime(frame["DATE"])
    for column in ("TMAX", "PRCP", "SNOW"):
        if column not in frame:
            frame[column] = None
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    return frame[["date", "TMAX", "PRCP", "SNOW"]]


def typical_years(include_2020=False):
    years = range(FIRST_YEAR, LAST_YEAR + 1)
    return [year for year in years if include_2020 or year not in EXCLUDED_YEARS]


def days_in_years(years):
    return sum(366 if calendar.isleap(year) else 365 for year in years)


def is_complete(daily):
    """True when highs and rain are both present on at least 80% of days in the typical years."""
    years = typical_years()
    in_years = daily[daily["date"].dt.year.isin(years)]
    total = days_in_years(years)
    return (
        in_years["TMAX"].notna().sum() / total >= MIN_DAYS_PRESENT
        and in_years["PRCP"].notna().sum() / total >= MIN_DAYS_PRESENT
    )


def pick_station(stations, lat, lon):
    """The nearest station within 50 km that passes the completeness check, with its daily data."""
    for station in nearby_stations(stations, lat, lon):
        daily = fetch_daily(station["id"])
        if is_complete(daily):
            return station, daily
    return None, None


def monthly_count(daily, month, year_filter, test):
    """Average number of days per year in this month where test(days) is true.

    `daily` must already be limited to days that have the value being tested. A year's month is skipped if too many days are missing; otherwise its count is scaled up to the full month.
    """
    counts = []
    in_month = daily[(daily["date"].dt.month == month) & daily["date"].dt.year.isin(year_filter)]
    for year, days in in_month.groupby(in_month["date"].dt.year):
        length = calendar.monthrange(year, month)[1]
        if len(days) / length < MIN_MONTH_PRESENT:
            continue
        counts.append(test(days).sum() * length / len(days))
    if not counts:
        return None
    return sum(counts) / len(counts)


def heat_days_in_month(daily, month, include_2020=False):
    """Average days per year at or above 100 F in this month, from days that have a high."""
    with_high = daily.dropna(subset=["TMAX"])
    return monthly_count(with_high, month, typical_years(include_2020), lambda d: d["TMAX"] >= HEAT_DAY_F)


def month_summary(daily, month, summit_drop_f):
    years = typical_years()
    in_month = daily[(daily["date"].dt.month == month) & daily["date"].dt.year.isin(years)]
    highs = in_month["TMAX"].dropna()

    with_rain = daily.dropna(subset=["PRCP"])
    wet = monthly_count(with_rain, month, years, lambda d: d["PRCP"] >= WET_DAY_INCHES)
    with_snow = daily.dropna(subset=["SNOW"])
    snow = monthly_count(with_snow, month, years, lambda d: d["SNOW"] >= SNOW_DAY_INCHES)
    heat = heat_days_in_month(daily, month)

    p25, p50, p75 = (float(highs.quantile(q)) for q in (0.25, 0.5, 0.75))
    return {
        "month": month,
        "tmax_p25": round(p25, 1),
        "tmax_p50": round(p50, 1),
        "tmax_p75": round(p75, 1),
        "tmax_summit_est": round(p50 - summit_drop_f, 1),
        "wet_days": None if wet is None else round(wet, 1),
        "snow_days": None if snow is None else round(snow, 1),
        "heat_days": None if heat is None else round(heat, 1),
    }


def summit_drop(max_elev_ft, station_elev_ft):
    return LAPSE_F_PER_1000_FT * (max_elev_ft - station_elev_ft) / 1000


def build(hikes):
    stations = load_stations()
    result = {}
    for hike in hikes:
        trailhead = hike["trailhead"]
        station, daily = pick_station(stations, trailhead["lat"], trailhead["lon"])
        if station is None:
            print(f"{hike['id']}: no usable station within {MAX_DISTANCE_KM} km")
            result[hike["id"]] = {"station": None, "missing": ["temp", "wet"], "months": []}
            continue
        drop = summit_drop(hike["max_elev_ft"], station["elev_ft"])
        months = [month_summary(daily, month, drop) for month in range(1, 13)]
        print(f"{hike['id']}: {station['id']} {station['name']} ({station['dist_km']} km)")
        result[hike["id"]] = {
            "station": {
                "id": station["id"],
                "name": station["name"],
                "dist_km": station["dist_km"],
                "elev_ft": station["elev_ft"],
            },
            "missing": [],
            "months": months,
        }
    return result


def main():
    hikes = json.loads(HIKES_FILE.read_text(encoding="utf-8"))
    wanted = sys.argv[1:]
    if wanted:
        hikes = [hike for hike in hikes if hike["id"] in wanted]

    output = {
        "source": "NOAA GHCN-Daily via the NCEI access API",
        "typical_years": f"{FIRST_YEAR}-{LAST_YEAR}, excluding {sorted(EXCLUDED_YEARS)}",
        "hikes": build(hikes),
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(output, indent=1), encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
