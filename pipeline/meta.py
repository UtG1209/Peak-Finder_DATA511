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


def as_of(folder):
    files = [path for path in (RAW / folder).glob("*") if path.is_file()]
    newest = max(path.stat().st_mtime for path in files)
    return date.fromtimestamp(newest).isoformat()


def build(previous, hike_count):
    own = {name for name, _, _ in LANE_1_SOURCES}
    sources = [{"name": name, "url": url, "as_of": as_of(folder)} for name, url, folder in LANE_1_SOURCES]
    sources += [source for source in previous["sources"] if source["name"] not in own]
    return {
        "fake": False,
        "pipeline_version": PIPELINE_VERSION,
        "generated": date.today().isoformat(),
        "typical_years": previous["typical_years"],
        "hike_count": hike_count,
        "cost_sources": previous["cost_sources"],
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
