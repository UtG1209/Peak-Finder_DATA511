"""meta.json: sources with links and as-of dates (lane 1).

The as-of date of each lane 1 source is the date of its newest download in data/raw/.
Lane 2's sources and cost_sources are carried over from the app's current meta.json untouched.

Run from the repo root:  .venv/Scripts/python.exe pipeline/meta.py [--publish]
Output: data/processed/meta.json; --publish also copies it into app/public/data/.
"""

import json
import shutil
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
APP_META = ROOT / "app" / "public" / "data" / "meta.json"
OUT_FILE = ROOT / "data" / "processed" / "meta.json"
HIKES_FILE = ROOT / "data" / "processed" / "hikes.json"

PIPELINE_VERSION = "0.1.0"

LANE_1_SOURCES = [
    ("NPS Visitor Use Statistics (IRMA)", "https://irma.nps.gov/STATS/", "nps"),
    ("NOAA GHCN-Daily", "https://www.ncei.noaa.gov/access/search/data-search/daily-summaries", "ghcn"),
    ("EPA AirData daily AQI by county", "https://aqs.epa.gov/aqsweb/airdata/download_files.html", "epa"),
    ("NPS park pages (trail length, gain, difficulty, permits)", "https://www.nps.gov/", "nps_pages"),
    ("Wikimedia Commons (hike photos, open licences)", "https://commons.wikimedia.org/", "catalogue"),
    ("FCC Area API (trailhead county)", "https://geo.fcc.gov/api/census/", "fcc"),
]

# Point lookups recorded by hand in pipeline/catalogue/geo_facts.csv: no raw cache, so the date is the last lookup.
LOOKUP_SOURCES = [
    ("OpenStreetMap via Nominatim (trailheads and end points), © OpenStreetMap contributors, ODbL",
     "https://www.openstreetmap.org/copyright", "2026-11-25"),
    ("NPS Data API, places (trailheads and end points)", "https://www.nps.gov/subjects/developer/api-documentation.htm", "2026-11-25"),
    ("USGS 3DEP Elevation Point Query Service (summit elevations, net gains)", "https://epqs.nationalmap.gov/v1/docs", "2026-11-25"),
    ("USGS GNIS (summit points)", "https://www.usgs.gov/tools/geographic-names-information-system-gnis", "2026-11-24"),
]


def as_of(folder, fallback=None):
    files = [path for path in (RAW / folder).glob("*") if path.is_file()]
    if not files and fallback:  # raw cache not on this machine: keep the date already published
        return fallback
    newest = date.fromtimestamp(max(path.stat().st_mtime for path in files)).isoformat()
    # Another machine may have published from newer downloads; never move the date back.
    return max(newest, fallback) if fallback else newest


LANE_2_SOURCES = ("DOT Consumer Airfare Report, Table 6", "GSA per diem", "EIA gasoline prices", "OpenRouteService")


def cost_sources(previous):
    """Lane 2's cost_sources.json (written by cost.py) when it exists, else what the app already has."""
    path = ROOT / "data" / "processed" / "lane2" / "cost_sources.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else previous["cost_sources"]


def build(previous, hike_count):
    own = {name for name, _, _ in LANE_1_SOURCES + LOOKUP_SOURCES}
    old_dates = {s["name"]: s["as_of"] for s in previous["sources"]}
    sources = [{"name": name, "url": url, "as_of": as_of(folder, old_dates.get(name))} for name, url, folder in LANE_1_SOURCES]
    sources += [{"name": name, "url": url, "as_of": looked_up} for name, url, looked_up in LOOKUP_SOURCES]
    sources += [dict(source, as_of=date.today().isoformat()) if source["name"] in LANE_2_SOURCES and "fake" in source["as_of"] and (ROOT / "data" / "processed" / "lane2" / "cost_sources.json").exists() else source for source in previous["sources"] if source["name"] not in own]
    return {
        "fake": True,  # stays True until every data file is real (cost and profiles of 8 hikes are still placeholders); Plan 4 flips it
        "pipeline_version": PIPELINE_VERSION,
        "generated": date.today().isoformat(),
        "typical_years": previous["typical_years"],
        "hike_count": hike_count,
        "cost_sources": cost_sources(previous),
        "sources": sources,
    }


def main():
    previous = json.loads(APP_META.read_text(encoding="utf-8"))
    hike_count = len(json.loads(HIKES_FILE.read_text(encoding="utf-8")))
    meta = build(previous, hike_count)
    OUT_FILE.write_text(json.dumps(meta, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)}: {len(meta['sources'])} sources")
    if "--publish" in sys.argv:
        shutil.copyfile(OUT_FILE, APP_META)
        print("Copied to app/public/data/meta.json")


if __name__ == "__main__":
    main()
