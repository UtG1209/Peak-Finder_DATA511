import csv
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "catalogue"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import candidates  # noqa: E402
import photos  # noqa: E402


def read(path):
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def test_every_hike_without_a_walk_photo_has_a_choice_and_a_credit():
    hikes = json.loads(photos.HIKES_FILE.read_text(encoding="utf-8"))
    wanted = [hike["id"] for hike in hikes if hike["id"] not in photos.SKIP]
    assert [row["id"] for row in read(photos.CHOICES_FILE)] == wanted
    assert [row["id"] for row in read(photos.OUT_FILE)] == wanted


def test_every_licence_is_an_allowed_open_licence():
    for row in read(photos.OUT_FILE):
        assert candidates.allowed_licence(row["license"]), (row["id"], row["license"])


def test_every_photo_has_a_full_credit():
    for row in read(photos.OUT_FILE):
        for column in ("title", "author", "license", "license_url", "page"):
            assert row[column], (row["id"], column)
        assert row["page"].startswith("https://commons.wikimedia.org/wiki/File:"), row["id"]
        assert row["license_url"].startswith("https://creativecommons.org/"), row["id"]


def test_files_are_900_px_wide_jpegs():
    for row in read(photos.OUT_FILE):
        with Image.open(photos.ROOT / "app" / "public" / row["file"]) as image:
            assert image.format == "JPEG", row["id"]
            assert image.width == photos.FINAL_WIDTH, row["id"]
            assert image.width >= image.height, row["id"]


def test_no_photo_is_used_twice():
    rows = read(photos.OUT_FILE)
    assert len({row["title"] for row in rows}) == len(rows)


def test_clean_html_strips_tags_and_entities():
    assert photos.clean_html('<a href="x">Jane &amp; Co</a>  <br>Doe') == "Jane & Co Doe"


def test_search_name_drops_route_words_and_brackets():
    assert candidates.search_name("Mount Washburn via Dunraven Pass") == "Mount Washburn"
    assert candidates.search_name("Fairy Falls (without Grand Prismatic Overlook)") == "Fairy Falls"
