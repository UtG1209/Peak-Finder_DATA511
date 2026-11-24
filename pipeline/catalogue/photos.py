"""One open-licence Wikimedia Commons photo per hike (lane 1).

Steps, run in order from the repo root:
  1. photos.py candidates   list open-licence JPEG candidates per hike (cached in data/raw/catalogue/)
  2. photos.py sheets       one contact sheet per hike in data/raw/photo_sheets/, to choose by eye
  3. photos.py fetch        download the choices in photo_choices.csv at 900 px into app/public/photos/
                            and write photos.csv with the credit for each

Allowed licences: public domain, CC0, CC BY, CC BY-SA. Never Google Images or travel sites.
"""

import csv
import html
import json
import re
import sys
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

import candidates as gate  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
CATALOGUE = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data" / "raw" / "catalogue"
SHEET_DIR = ROOT / "data" / "raw" / "photo_sheets"
PHOTO_DIR = ROOT / "app" / "public" / "photos"
HIKES_FILE = ROOT / "app" / "public" / "data" / "hikes.json"
CHOICES_FILE = CATALOGUE / "photo_choices.csv"
OUT_FILE = CATALOGUE / "photos.csv"

COMMONS_URL = gate.COMMONS_URL
USER_AGENT = gate.USER_AGENT
FINAL_WIDTH = 900
THUMB_WIDTH = 300
PER_SHEET = 9
PUBLIC_DOMAIN_URL = "https://creativecommons.org/publicdomain/mark/1.0/"
SKIP = {"angels-landing", "bright-angel-trail", "cascade-pass-sahale"}  # already have real photos from their walks

QUERY_OVERRIDES = {
    "navajo-loop-queens-garden": "Navajo Loop Bryce Canyon",
    "lady-bird-johnson-grove": "Lady Bird Johnson Grove",
    "cadillac-north-ridge": "Cadillac Mountain Acadia",
    "old-rag": "Old Rag Mountain",
    "zion-narrows": "Zion Narrows",
    "longs-peak": "Longs Peak",
    "moro-rock": "Moro Rock",
    "pinnacles-high-peaks": "Pinnacles High Peaks",
    "inspiration-point": "Inspiration Point Grand Teton",
    "general-sherman-tree": "General Sherman tree",
    "devils-garden": "Landscape Arch Arches",
}


def query_for(hike):
    if hike["id"] in QUERY_OVERRIDES:
        return QUERY_OVERRIDES[hike["id"]]
    park = hike["park_name"].replace(" National Park", "").replace(" National Parks", "")
    return f"{gate.search_name(hike['name'])} {park}"


def commons_query(hike, width):
    params = {
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrlimit": 40,
        "gsrsearch": query_for(hike), "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": width, "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist",
    }

    def fetch():
        response = requests.get(COMMONS_URL, params=params, headers={"User-Agent": USER_AGENT}, timeout=60)
        response.raise_for_status()
        return response.json()

    return gate.cached(f"photos_{hike['id']}_{width}", fetch).get("query", {}).get("pages", {})


def usable(pages):
    """Open-licence landscape JPEGs at least 900 px wide, best search match first."""
    found = []
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        licence = meta.get("LicenseShortName", {}).get("value", "")
        if info.get("mime") != "image/jpeg" or info.get("width", 0) < FINAL_WIDTH:
            continue
        if info.get("width", 0) < info.get("height", 1) or not gate.allowed_licence(licence):
            continue
        found.append({
            "title": page["title"], "rank": page.get("index", 999), "licence": licence,
            "licence_url": meta.get("LicenseUrl", {}).get("value", ""),
            "author": clean_html(meta.get("Artist", {}).get("value", "")),
            "thumb": info.get("thumburl", ""), "page": info.get("descriptionurl", ""),
        })
    return sorted(found, key=lambda c: c["rank"])


def clean_html(text):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text))).strip()


def hikes_to_do():
    hikes = json.loads(HIKES_FILE.read_text(encoding="utf-8"))
    return [hike for hike in hikes if hike["id"] not in SKIP]


def cmd_candidates():
    for hike in hikes_to_do():
        found = usable(commons_query(hike, THUMB_WIDTH))
        print(f"{hike['id']}: {len(found)} candidates for '{query_for(hike)}'")


def cmd_sheets():
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    for hike in hikes_to_do():
        found = usable(commons_query(hike, THUMB_WIDTH))[:PER_SHEET]
        if not found:
            print(f"{hike['id']}: no candidates")
            continue
        cell_h = round(THUMB_WIDTH * 0.75)
        sheet = Image.new("RGB", (THUMB_WIDTH * 3, (cell_h + 18) * ((len(found) + 2) // 3)), "white")
        draw = ImageDraw.Draw(sheet)
        for i, candidate in enumerate(found):
            x, y = (i % 3) * THUMB_WIDTH, (i // 3) * (cell_h + 18)
            image = Image.open(BytesIO(requests.get(candidate["thumb"], headers={"User-Agent": USER_AGENT}, timeout=60).content))
            image.thumbnail((THUMB_WIDTH, cell_h))
            sheet.paste(image.convert("RGB"), (x, y + 18))
            draw.text((x + 4, y + 3), f"{i + 1}  {candidate['title'][5:48]}", fill="black")
            time.sleep(0.3)
        sheet.save(SHEET_DIR / f"{hike['id']}.jpg", quality=80)
        print(f"{hike['id']}: sheet with {len(found)} photos")


def read_choices():
    with CHOICES_FILE.open(encoding="utf-8", newline="") as handle:
        return {row["id"]: int(row["pick"]) for row in csv.DictReader(handle)}


def download(url, out):
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=120)
    response.raise_for_status()
    image = Image.open(BytesIO(response.content)).convert("RGB")
    height = round(image.height * FINAL_WIDTH / image.width)
    image.resize((FINAL_WIDTH, height), Image.LANCZOS).save(out, "JPEG", quality=85, optimize=True)


def cmd_fetch():
    choices = read_choices()
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for hike in hikes_to_do():
        pick = choices.get(hike["id"])
        if not pick:
            print(f"{hike['id']}: no choice yet")
            continue
        title = usable(commons_query(hike, THUMB_WIDTH))[pick - 1]["title"]
        pages = commons_query(hike, FINAL_WIDTH)
        match = next((c for c in usable(pages) if c["title"] == title), None)
        if match is None:
            print(f"{hike['id']}: '{title}' is not an open-licence candidate")
            continue
        out = PHOTO_DIR / f"{hike['id']}.jpg"
        if not out.exists():
            download(match["thumb"], out)
            time.sleep(1)
        licence_url = (match["licence_url"] or (PUBLIC_DOMAIN_URL if match["licence"].lower().startswith("public domain") else "")).replace("http://", "https://", 1)
        rows.append({
            "id": hike["id"], "file": f"photos/{hike['id']}.jpg", "title": title, "author": match["author"],
            "license": match["licence"], "license_url": licence_url, "page": match["page"],
        })
        print(f"{hike['id']}: saved ({match['licence']})")
    with OUT_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", "file", "title", "author", "license", "license_url", "page"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {OUT_FILE.relative_to(ROOT)}: {len(rows)} photos")


if __name__ == "__main__":
    {"candidates": cmd_candidates, "sheets": cmd_sheets, "fetch": cmd_fetch}[sys.argv[1]]()
