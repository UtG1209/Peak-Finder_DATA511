"""Import photos saved by the browser fallback (use when the sandbox cannot reach Commons).

Each part is a JSON object {"photos": {<photo key>: {"data": "<data:image/jpeg;base64,...>",
"credit": {"artist", "license", "license_url", "page"}}}}. The browser side did what s4 does:
asked the Commons API for the 1280 px rendition, resized it to 900 px, and read artist and licence
from the file's metadata. This script writes cache/<id>/photos/<key>.jpg and merges credits.json,
refusing any licence that s4 would also refuse.

Run WITHOUT python -I (it imports common.py from this folder).
Usage: python pipeline/import_browser_photos.py north_cascades "/path/to/nc_photos_*.json"
"""
import base64
import glob
import json
import sys

from common import cache_dir, exists, load_config, read_json, write_json

OK_LICENCES = ("Public domain", "CC0", "CC BY", "CC BY-SA", "No restrictions")


def main(trail_id, pattern):
    cfg = load_config(trail_id)
    cdir = cache_dir(trail_id)
    credits_path = cdir / "credits.json"
    credits = read_json(credits_path) if exists(credits_path) else {}
    got = {}
    for path in sorted(glob.glob(pattern)):
        got.update(json.load(open(path, encoding="utf-8"))["photos"])
    wanted = [s["photo"] for s in cfg["stops"]]
    for key in wanted:
        if key not in got:
            if (cdir / "photos" / f"{key}.jpg").exists() and key in credits:
                continue  # already imported earlier; a later part may replace only some photos
            raise SystemExit(f"[photos] missing from the parts and not cached: {key}")
        lic = got[key]["credit"]["license"]
        if not lic.startswith(OK_LICENCES):
            raise SystemExit(f"[photos] licence not allowed for {key}: {lic}")
        out = cdir / "photos" / f"{key}.jpg"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(base64.b64decode(got[key]["data"].split(",")[-1]))
        credits[key] = got[key]["credit"]
        print(f"[photos] {key}: {lic}, {credits[key]['artist']}")
    # Season photos: keys named <stop photo key>_<season> (e.g. peaks_winter) are written too.
    extra = []
    for key in sorted(set(got) - set(wanted)):
        lic = got[key]["credit"]["license"]
        base, _, season = key.rpartition("_")
        if base in wanted and season in ("autumn", "winter", "spring", "summer"):
            if not lic.startswith(OK_LICENCES):
                raise SystemExit(f"[photos] licence not allowed for {key}: {lic}")
            out = cdir / "photos" / f"{key}.jpg"
            out.write_bytes(base64.b64decode(got[key]["data"].split(",")[-1]))
            credits[key] = got[key]["credit"]
            print(f"[photos] {key}: {lic}, {credits[key]['artist']}")
        else:
            extra.append(key)
    if extra:
        print(f"[photos] note: parts hold photos no stop uses: {extra}")
    write_json(credits_path, credits)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
