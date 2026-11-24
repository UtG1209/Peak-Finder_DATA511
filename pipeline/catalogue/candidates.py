"""Data-gate table for the hike list (lane 1): one row per hike, one column per check.

Checks: park has NPS visits, weather station within 50 km (80% days), county has an AQI monitor,
an OSM trailhead and named paths near the trailhead, and open-licence Commons photos for the hike.
`nps_page` is left empty on purpose: the hike's own NPS page is found by hand.

Run from the repo root:  .venv/Scripts/python.exe pipeline/catalogue/candidates.py
Output: pipeline/catalogue/candidates.csv
"""

import csv
import json
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ghcn  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DIR = ROOT / "data" / "raw" / "catalogue"
PROCESSED = ROOT / "data" / "processed"
HIKES_FILE = ROOT / "app" / "public" / "data" / "hikes.json"
OUT_FILE = Path(__file__).resolve().parent / "candidates.csv"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
COMMONS_URL = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "PeakFinderDATA511/0.1 (student project)"

TRAILHEAD_RADIUS_M = 3000
PATH_RADIUS_M = 2000
MIN_PHOTO_WIDTH = 900
ALLOWED_LICENCE = re.compile(r"^(CC0|PDM|Public domain|CC BY(-SA)?)( [0-9.]+)?( .*)?$", re.IGNORECASE)
BLOCKED_LICENCE = re.compile(r"-NC|-ND|GFDL|fair use", re.IGNORECASE)

COLUMNS = [
    "id", "name", "park_code", "visits", "station", "station_id", "station_km", "aqi", "aqi_county",
    "osm_trailhead", "osm_trailhead_name", "osm_trailhead_m", "osm_named_paths", "commons_photos",
    "commons_best", "nps_page", "complete",
]


def allowed_licence(name):
    if not name or BLOCKED_LICENCE.search(name):
        return False
    return bool(ALLOWED_LICENCE.match(name.strip()))


def cached(key, fetch):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"{key}.json"
    if not path.exists():
        for attempt in range(4):
            try:
                path.write_text(json.dumps(fetch()), encoding="utf-8")
                break
            except requests.HTTPError:
                if attempt == 3:
                    raise
                time.sleep(10 * (attempt + 1))
        time.sleep(1)
    return json.loads(path.read_text(encoding="utf-8"))


def overpass_near(hike):
    lat, lon = hike["trailhead"]["lat"], hike["trailhead"]["lon"]
    query = (
        "[out:json][timeout:60];("
        f'node["highway"="trailhead"](around:{TRAILHEAD_RADIUS_M},{lat},{lon});'
        f'way["highway"~"path|footway|track"]["name"](around:{PATH_RADIUS_M},{lat},{lon});'
        ");out center tags;"
    )

    def fetch():
        response = requests.post(OVERPASS_URL, data={"data": query}, headers={"User-Agent": USER_AGENT}, timeout=120)
        response.raise_for_status()
        return response.json()

    return cached(f"osm_{hike['id']}", fetch)["elements"]


def nearest_trailhead(hike, elements):
    lat, lon = hike["trailhead"]["lat"], hike["trailhead"]["lon"]
    heads = [e for e in elements if e["type"] == "node"]
    if not heads:
        return None, None
    metres = lambda e: 1000 * ghcn.haversine_km(lat, lon, e["lat"], e["lon"])
    best = min(heads, key=metres)
    return best.get("tags", {}).get("name", ""), round(metres(best))


def search_name(name):
    name = re.sub(r"\(.*?\)", "", name)
    return re.split(r" via | to ", name)[0].strip()


def commons_photos(hike):
    params = {
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrlimit": 30,
        "gsrsearch": f"{search_name(hike['name'])} {hike['park_name'].replace(' National Park', '')}", "prop": "imageinfo",
        "iiprop": "size|extmetadata", "iiextmetadatafilter": "LicenseShortName",
    }

    def fetch():
        response = requests.get(COMMONS_URL, params=params, headers={"User-Agent": USER_AGENT}, timeout=60)
        response.raise_for_status()
        return response.json()

    pages = cached(f"commons_{hike['id']}", fetch).get("query", {}).get("pages", {})
    good = []
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        licence = info.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "")
        is_photo = page["title"].lower().endswith((".jpg", ".jpeg"))
        if is_photo and info.get("width", 0) >= MIN_PHOTO_WIDTH and allowed_licence(licence):
            good.append(page["title"])
    return good


def row_for(hike, crowds, weather, aqi):
    park = crowds["parks"].get(hike["park_code"], {})
    station = weather["hikes"].get(hike["id"], {}).get("station")
    county = aqi["hikes"].get(hike["id"], {})
    elements = overpass_near(hike)
    head_name, head_m = nearest_trailhead(hike, elements)
    photos = commons_photos(hike)

    row = {
        "id": hike["id"], "name": hike["name"], "park_code": hike["park_code"],
        "visits": bool(park.get("months")),
        "station": station is not None, "station_id": station["id"] if station else "",
        "station_km": station["dist_km"] if station else "",
        "aqi": bool(county) and not county["missing"], "aqi_county": county.get("county", {}).get("name", ""),
        "osm_trailhead": head_m is not None, "osm_trailhead_name": head_name or "",
        "osm_trailhead_m": head_m if head_m is not None else "",
        "osm_named_paths": sum(1 for e in elements if e["type"] == "way"),
        "commons_photos": len(photos), "commons_best": photos[0] if photos else "",
        "nps_page": "",
    }
    row["complete"] = all([row["visits"], row["station"], row["aqi"], row["osm_trailhead"], row["osm_named_paths"] > 0, row["commons_photos"] > 0])
    return row


def main():
    hikes = json.loads(HIKES_FILE.read_text(encoding="utf-8"))
    crowds = json.loads((PROCESSED / "crowds.json").read_text(encoding="utf-8"))
    weather = json.loads((PROCESSED / "weather.json").read_text(encoding="utf-8"))
    aqi = json.loads((PROCESSED / "aqi.json").read_text(encoding="utf-8"))

    rows = []
    for hike in hikes:
        row = row_for(hike, crowds, weather, aqi)
        rows.append(row)
        print(f"{hike['id']}: complete={row['complete']} photos={row['commons_photos']} trailhead_m={row['osm_trailhead_m']}")

    with OUT_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {OUT_FILE.relative_to(ROOT)}: {sum(r['complete'] for r in rows)} of {len(rows)} complete")


if __name__ == "__main__":
    main()
