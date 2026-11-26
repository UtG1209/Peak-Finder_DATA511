"""Assemble hikes.json from the lane 1 staging tables (lane 1).

Each field takes the sourced value where one exists and keeps the placeholder from the
fake hike list otherwise. hikes_coverage.csv says which it was, hike by hike and field by field.

Run from the repo root:  .venv/Scripts/python.exe pipeline/hikes.py [--publish]
Output: data/processed/hikes.json and pipeline/catalogue/hikes_coverage.csv
--publish also copies hikes.json into app/public/data/ (scripts/make_fake_data.py then leaves it alone).
"""

import csv
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = ROOT / "pipeline" / "catalogue"
PROCESSED = ROOT / "data" / "processed"
BASE_FILE = ROOT / "app" / "public" / "data" / "hikes.json"
OUT_FILE = PROCESSED / "hikes.json"
COVERAGE_FILE = CATALOGUE / "hikes_coverage.csv"

LENGTH_TYPE_FOR_ROUTE = {"loop": "loop", "out-and-back": "round-trip", "point-to-point": "one-way"}
COVERAGE_FIELDS = [
    "nps_url", "length", "gain", "max_elev", "difficulty", "route_type", "description", "permit_note",
    "closure_note", "gear", "photo", "station", "aqi_county", "trailhead", "end",
]


def read_csv(name):
    with (CATALOGUE / name).open(encoding="utf-8", newline="") as handle:
        return {row["id"]: row for row in csv.DictReader(handle)}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def closed_months():
    """{(hike_id, month)} from closed_months.csv: months an official notice says the hike is not available."""
    with (CATALOGUE / "closed_months.csv").open(encoding="utf-8", newline="") as handle:
        return {(row["id"], int(row["month"])) for row in csv.DictReader(handle)}


def number(text):
    value = float(text)
    return int(value) if value == int(value) and "." not in text else value


def length_fields(facts, route_type):
    """(length_mi, length_type) in the shape of hikes.json: round trip for out-and-back routes."""
    length = float(facts["length_mi"])
    if facts["length_type"] == "one-way" and route_type == "out-and-back":
        length = length * 2
    return round(length, 1), LENGTH_TYPE_FOR_ROUTE[route_type]


def walk_paths():
    """hike id -> 'walks/<walk>/' from walks/manifest.json, the single source of truth for featured and walk_path."""
    manifest = read_json(ROOT / "walks" / "manifest.json")
    return {w["hike_id"]: f"walks/{wid}/" for wid, w in manifest["walks"].items()}


def build_hike(base, pages, facts, fields, photos, ends, weather, aqi, geo=None):
    hike = dict(base)
    source = {name: "placeholder" for name in COVERAGE_FIELDS}

    hike["nps_url"], source["nps_url"] = pages[base["id"]]["nps_page"], "nps"

    own = fields[base["id"]]
    hike["route_type"], source["route_type"] = own["route_type"], "judgement"
    hike["difficulty"] = own["difficulty"]
    source["difficulty"] = "nps" if own["difficulty_basis"].startswith("NPS") else "rule"
    hike["description"], source["description"] = own["description"], "judgement"
    hike["permit_note"], source["permit_note"] = own["permit_note"] or None, "judgement"
    hike["closure_note"], source["closure_note"] = own["closure_note"] or None, "judgement"
    hike["gear"], source["gear"] = [item for item in own["gear"].split(";") if item], "judgement"

    row = facts[base["id"]]
    if row["length_mi"]:
        hike["length_mi"], hike["length_type"] = length_fields(row, own["route_type"])
        source["length"] = "nps"
    if row["gain_ft"]:
        hike["gain_ft"], source["gain"] = number(row["gain_ft"]), "nps"
    if own["max_elev_ft"]:
        hike["max_elev_ft"], source["max_elev"] = number(own["max_elev_ft"]), "nps"

    place = (geo or {}).get(base["id"])
    if place:
        # Sourced coordinates and elevations (geo_facts.csv); a blank cell leaves the placeholder.
        if place["trailhead_lat"]:
            hike["trailhead"] = {"name": place["trailhead_name"], "lat": float(place["trailhead_lat"]), "lon": float(place["trailhead_lon"])}
            source["trailhead"] = place["trailhead_source"]
        if place["max_elev_ft"]:
            hike["max_elev_ft"], source["max_elev"] = number(place["max_elev_ft"]), place["max_elev_source"]
        if place["gain_ft"]:
            hike["gain_ft"], source["gain"] = number(place["gain_ft"]), place["gain_source"]

    if base["id"] in photos:
        credit = photos[base["id"]]
        hike["photo"] = {key: credit[key] for key in ("file", "author", "license", "license_url", "page")}
        hike["photo"]["license"] = re.sub(r"\s+\d.*$", "", credit["license"])
        source["photo"] = "commons"
    else:
        source["photo"] = "walk"

    if base["id"] in ends:
        end = ends[base["id"]]
        hike["end"] = {"name": end["end_name"], "lat": float(end["end_lat"]), "lon": float(end["end_lon"])}
        source["end"] = "walk"
    elif place and place["end_lat"]:
        hike["end"] = {"name": place["end_name"], "lat": float(place["end_lat"]), "lon": float(place["end_lon"])}
        source["end"] = place["end_source"]

    station = weather["hikes"][base["id"]]["station"]
    hike["station"], source["station"] = station, "pipeline"
    hike["aqi_county"], source["aqi_county"] = aqi["hikes"][base["id"]]["county"], "pipeline"
    return hike, source


def main():
    base_hikes = read_json(BASE_FILE)
    pages, facts, fields, photos, ends, geo = (
        read_csv(name) for name in ("nps_pages.csv", "nps_facts.csv", "hike_fields.csv", "photos.csv", "end_points.csv", "geo_facts.csv")
    )
    weather, aqi = read_json(PROCESSED / "weather.json"), read_json(PROCESSED / "aqi.json")

    walks = walk_paths()
    hikes, coverage = [], []
    for base in base_hikes:
        hike, source = build_hike(base, pages, facts, fields, photos, ends, weather, aqi, geo)
        hike["featured"], hike["walk_path"] = base["id"] in walks, walks.get(base["id"])
        hikes.append(hike)
        coverage.append({"id": base["id"], **source})

    OUT_FILE.write_text(json.dumps(hikes, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    with COVERAGE_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", *COVERAGE_FIELDS], lineterminator="\n")
        writer.writeheader()
        writer.writerows(coverage)

    print(f"Wrote {OUT_FILE.relative_to(ROOT)}: {len(hikes)} hikes")
    for name in COVERAGE_FIELDS:
        placeholders = sum(1 for row in coverage if row[name] == "placeholder")
        if placeholders:
            print(f"  still placeholder: {name} for {placeholders} hikes")

    if "--publish" in sys.argv:
        shutil.copyfile(OUT_FILE, BASE_FILE)
        print("Copied to app/public/data/hikes.json")


if __name__ == "__main__":
    main()
