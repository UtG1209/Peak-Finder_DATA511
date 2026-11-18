"""Unpack JSON bundles saved by tools/browser_fetch.js into the cache.

Use this only when your machine can't download from the data hosts directly (school or
work networks that block them, sandboxed environments). The browser script saves
<trail>_dem.json, <trail>_img.json and <trail>_osm.json; this puts them where steps 2-3 expect.

Usage: python pipeline/import_browser_bundle.py angels_landing ~/Downloads
"""
import base64
import json
import shutil
import sys
from pathlib import Path

from common import cache_dir


def main(trail_id, folder):
    folder = Path(folder).expanduser()
    cdir = cache_dir(trail_id)
    for kind, ext in (("dem", "png"), ("img", "jpg")):
        p = folder / f"{trail_id}_{kind}.json"
        if not p.exists():
            print(f"[import] skip {p.name} (not found)")
            continue
        bundle = json.loads(p.read_text())
        for key, b64 in bundle.items():           # key = "z/x/y"
            z, x, y = key.split("/")
            dst = cdir / kind / z / x / f"{y}.{ext}"
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(base64.b64decode(b64.split(",")[-1]))
        print(f"[import] {kind}: {len(bundle)} tiles")
    osm = folder / f"{trail_id}_osm.json"
    if osm.exists():
        shutil.copy(osm, cdir / "osm.json")
        print("[import] osm.json")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "~/Downloads")
