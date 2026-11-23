"""Crowd levels from NPS recreation visits (lane 1).

For every park that has a hike: download monthly recreation visits, drop 2020, take each
month's median over 2015-2024, and divide by the park's busiest month.
Park level, not trail level: the app says so.

Run from the repo root:  .venv/Scripts/python.exe pipeline/nps_visits.py
Output: data/processed/crowds.json (one row per park and month).
"""

import json
import statistics
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "nps"
OUT_FILE = ROOT / "data" / "processed" / "crowds.json"
HIKES_FILE = ROOT / "app" / "public" / "data" / "hikes.json"

# IRMA stats service: free, no key, XML. Source of the monthly "Recreation Visitors" table.
API_URL = "https://irmaservices.nps.gov/v3/rest/stats/visitation"
USER_AGENT = "PeakFinderDATA511/0.1 (student project)"

# 2010 is fetched only for the known-answer checks (Acadia, Glacier). Typical values use 2015-2024.
FIRST_YEAR = 2010
LAST_YEAR = 2024
TYPICAL_YEARS = range(2015, 2025)
EXCLUDED_YEARS = {2020}  # Covid closures make the year unrepresentative

# Our park_code -> the code IRMA uses, where they differ. IRMA counts Sequoia and Kings Canyon
# separately; both SEKI hikes (Moro Rock, General Sherman Tree) are in Sequoia.
IRMA_CODES = {"SEKI": "SEQU"}

QUIET_BELOW = 0.4
MODERATE_BELOW = 0.7


def park_codes_from_hikes():
    hikes = json.loads(HIKES_FILE.read_text(encoding="utf-8"))
    return sorted({hike["park_code"] for hike in hikes})


def fetch_park_xml(code):
    """Return the raw XML for one park, downloading it only if it is not cached."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = RAW_DIR / f"{code}_{FIRST_YEAR}-{LAST_YEAR}.xml"
    if cache_file.exists():
        return cache_file.read_text(encoding="utf-8")

    params = {
        "unitCodes": IRMA_CODES.get(code, code),
        "startMonth": 1,
        "startYear": FIRST_YEAR,
        "endMonth": 12,
        "endYear": LAST_YEAR,
    }
    response = requests.get(API_URL, params=params, headers={"User-Agent": USER_AGENT}, timeout=60)
    response.raise_for_status()
    # An unknown unit code returns an empty list, not an error. Do not cache it.
    if parse_visits(response.text):
        cache_file.write_text(response.text, encoding="utf-8")
    return response.text


def parse_visits(xml_text):
    """XML -> list of {year, month, visits}."""
    rows = []
    for item in ET.fromstring(xml_text):
        # Tags carry an XML namespace, so match on the local name.
        fields = {child.tag.split("}")[-1]: child.text for child in item}
        rows.append(
            {
                "year": int(fields["Year"]),
                "month": int(fields["Month"]),
                "visits": int(fields["RecreationVisitors"]),
            }
        )
    return rows


def band(level):
    if level < QUIET_BELOW:
        return "quiet"
    if level < MODERATE_BELOW:
        return "moderate"
    return "busy"


def typical_crowds(rows):
    """Median visits per month over the typical years, scaled so the busiest month is 1.0."""
    by_month = {month: [] for month in range(1, 13)}
    for row in rows:
        if row["year"] in TYPICAL_YEARS and row["year"] not in EXCLUDED_YEARS:
            by_month[row["month"]].append(row["visits"])

    if any(len(values) == 0 for values in by_month.values()):
        return None

    medians = {month: statistics.median(values) for month, values in by_month.items()}
    busiest = max(medians.values())
    if busiest == 0:
        return None

    result = []
    for month in range(1, 13):
        level = round(medians[month] / busiest, 2)
        result.append(
            {
                "month": month,
                "median_visits": round(medians[month]),
                "crowd_level": level,
                "crowd_band": band(level),
            }
        )
    return result


def build(codes):
    parks = {}
    for code in codes:
        print(f"{code}: ", end="", flush=True)
        rows = parse_visits(fetch_park_xml(code))
        months = typical_crowds(rows)
        if months is None:
            print("no usable data, flagged as missing")
            parks[code] = {"missing": ["crowd"], "months": []}
        else:
            print(f"{len(rows)} month rows")
            parks[code] = {"missing": [], "months": months}
    return parks


def main():
    codes = sys.argv[1:] or park_codes_from_hikes()
    parks = build(codes)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "source": "NPS IRMA Visitor Use Statistics, recreation visits by month",
        "typical_years": f"{TYPICAL_YEARS.start}-{TYPICAL_YEARS.stop - 1}, excluding {sorted(EXCLUDED_YEARS)}",
        "parks": parks,
    }
    OUT_FILE.write_text(json.dumps(output, indent=1), encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
