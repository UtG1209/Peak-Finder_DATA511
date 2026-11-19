"""Step 4: download each stop's photo from Wikimedia Commons, with its credit and licence.

For every stop in the config, `commons_file` (and every entry of `season_photo_files`) is the exact Commons file name (without "File:").
The script asks the Commons API for a 1280 px rendition (Commons only serves standard thumbnail
widths; arbitrary sizes like 640 px return HTTP 400), resizes it to 900 px, and records
artist, licence and links in cache/<trail>/credits.json.

Only openly licensed files belong here: public domain, CC0, CC BY or CC BY-SA. Never use photos
from Google Images or travel sites, which are usually all-rights-reserved.
Usage: python pipeline/s4_fetch_photos.py angels_landing
"""
import io
import re
import sys

from PIL import Image

from common import COMMONS_API, cache_dir, exists, http_get, load_config, read_json, write_json

OK_LICENCES = ("Public domain", "CC0", "CC BY", "CC BY-SA", "No restrictions")


def clean(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()


def main(trail_id):
    cfg = load_config(trail_id)
    cdir = cache_dir(trail_id)
    credits_path = cdir / "credits.json"
    credits = read_json(credits_path) if exists(credits_path) else {}
    # one photo per stop, plus the season photos (config key season_photo_files: {file stem: Commons file name})
    jobs = [(stop["photo"], stop["commons_file"]) for stop in cfg["stops"]]
    jobs += sorted(cfg.get("season_photo_files", {}).items())
    for key, commons_file in jobs:
        out = cdir / "photos" / f"{key}.jpg"
        if exists(out) and key in credits:
            print(f"[photos] cached: {key}")
            continue
        r = http_get(COMMONS_API, params={
            "action": "query", "format": "json", "titles": "File:" + commons_file,
            "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1280,
            "iiextmetadatafilter": "Artist|LicenseShortName|LicenseUrl"})
        page = next(iter(r.json()["query"]["pages"].values()))
        if "imageinfo" not in page:
            raise SystemExit(f"[photos] not found on Commons: {commons_file}")
        info = page["imageinfo"][0]
        meta = info.get("extmetadata", {})
        lic = clean(meta.get("LicenseShortName", {}).get("value"))
        if not lic.startswith(OK_LICENCES):
            raise SystemExit(f"[photos] licence not allowed for {key}: {lic}")
        img = http_get(info.get("thumburl") or info["url"]).content
        im = Image.open(io.BytesIO(img)).convert("RGB")
        im.thumbnail((900, 900))
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, quality=80, optimize=True, progressive=True)
        credits[key] = {
            "artist": clean(meta.get("Artist", {}).get("value"))[:80],
            "license": lic,
            "license_url": clean(meta.get("LicenseUrl", {}).get("value")),
            "page": info["descriptionurl"],
        }
        print(f"[photos] {key}: {lic}, {credits[key]['artist']}")
    write_json(credits_path, credits)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "angels_landing")
