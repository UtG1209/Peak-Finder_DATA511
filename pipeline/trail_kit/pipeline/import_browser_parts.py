"""Import the small 'part' files the browser fallback saves (works with the 1.5 MB upload limit).

tools/browser_fetch.js style bundles can be 10+ MB, and file staging tools often fail above
about 1.5 MB. Save the data as parts instead. Each part is a JSON object whose keys look like
  "dem|z/x/y"  or  "img|z/x/y"  (value = base64 data URL)
plus optionally one part {"osm": <overpass json>} whose elements are merged into cache/<id>/osm.json
(union by type+id, so you can add a second area later without losing the first).

Run WITHOUT python -I (it needs to import common.py from this folder).

Usage: python pipeline/import_browser_parts.py grand_canyon "/path/to/parts/*.json"
"""
import base64
import glob
import json
import sys

from common import cache_dir


def main(trail_id, pattern):
    cdir = cache_dir(trail_id)
    n = {"dem": 0, "img": 0}
    osm_new = []
    for path in sorted(glob.glob(pattern)):
        part = json.load(open(path))
        if "osm" in part:
            osm_new += part["osm"]["elements"]
            continue
        for key, data in part.items():
            if "|" not in key:
                continue
            kind, zxy = key.split("|")
            z, x, y = zxy.split("/")
            dst = cdir / kind / z / x / f"{y}.{'png' if kind == 'dem' else 'jpg'}"
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(base64.b64decode(data.split(",")[-1]))
            n[kind] += 1
    print(f"[import] tiles written: {n}")
    if osm_new:
        osm_path = cdir / "osm.json"
        old = json.load(open(osm_path)) if osm_path.exists() else {"elements": []}
        seen = {(e["type"], e["id"]) for e in old["elements"]}
        add = [e for e in osm_new if (e["type"], e["id"]) not in seen]
        old["elements"] += add
        json.dump(old, open(osm_path, "w"))
        print(f"[import] osm.json: {len(add)} new elements, {len(old['elements'])} total")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
