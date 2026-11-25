"""Keep only the hikes in pipeline/catalogue/final_hikes.csv (docs/work/final-23/). Idempotent.

Filters the per-hike data files, and removes the profiles and photos of the cut hikes.
Run from the repo root: python3 pipeline/cut_to_final.py && python3 pipeline/meta.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "app" / "public" / "data"
PHOTOS = ROOT / "app" / "public" / "photos"
keep = {r["id"] for r in csv.DictReader((ROOT / "pipeline" / "catalogue" / "final_hikes.csv").open(encoding="utf-8"))}

for name, key in [("hikes.json", "id"), ("hike_month.json", "hike_id"), ("travel.json", "hike_id"), ("cost.json", "hike_id"), ("advice.json", "hike_id")]:
    path = DATA / name
    rows = json.loads(path.read_text(encoding="utf-8"))
    kept = [r for r in rows if r[key] in keep]
    path.write_text(json.dumps(kept, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{name}: {len(rows)} -> {len(kept)}")
for f in (DATA / "profiles").glob("*.json"):
    if f.stem not in keep:
        f.unlink()
for f in PHOTOS.glob("*"):
    if f.stem not in keep:
        f.unlink()
missing = keep - {r["id"] for r in json.loads((DATA / "hikes.json").read_text(encoding="utf-8"))}
assert not missing, f"final hikes missing from hikes.json: {missing}"

# The pipeline's own inputs and outputs, so its checks (CI) agree with the app data.
CAT = ROOT / "pipeline" / "catalogue"
for name in ("candidates", "hike_fields", "nps_facts", "nps_pages", "photo_choices", "photos", "geo_facts", "drive_points", "loop_waypoints", "closed_months", "end_points"):
    path = CAT / f"{name}.csv"
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        cols, rows = reader.fieldnames, list(reader)
    key = "id" if "id" in cols else "hike_id"
    with path.open("w", encoding="utf-8", newline="") as handle:
        w = csv.DictWriter(handle, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        w.writerows(r for r in rows if r[key] in keep)
PROC = ROOT / "data" / "processed"
for name, key in (("hikes.json", "id"), ("hike_month.json", "hike_id"), ("advice.json", "hike_id")):
    rows = json.loads((PROC / name).read_text(encoding="utf-8"))
    (PROC / name).write_text(json.dumps([r for r in rows if r[key] in keep], separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
parks = {h["park_code"] for h in json.loads((DATA / "hikes.json").read_text(encoding="utf-8"))}
for name, field in (("weather.json", "hikes"), ("aqi.json", "hikes"), ("daylight.json", "hikes"), ("crowds.json", "parks")):
    d = json.loads((PROC / name).read_text(encoding="utf-8"))
    ok = parks if field == "parks" else keep
    d[field] = {k: v for k, v in d[field].items() if k in ok} if isinstance(d[field], dict) else [r for r in d[field] if r.get("hike_id", r.get("id")) in ok]
    (PROC / name).write_text(json.dumps(d, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
