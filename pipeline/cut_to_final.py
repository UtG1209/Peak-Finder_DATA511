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
