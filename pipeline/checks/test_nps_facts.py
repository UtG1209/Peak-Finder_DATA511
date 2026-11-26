import csv
import json
from pathlib import Path

CATALOGUE = Path(__file__).resolve().parent.parent / "catalogue"
HIKES_FILE = CATALOGUE.parent.parent / "app" / "public" / "data" / "hikes.json"
LENGTH_TYPES = {"round-trip", "one-way", "loop"}


def read(name):
    with (CATALOGUE / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def test_one_row_per_hike_in_list_order():
    hikes = json.loads(HIKES_FILE.read_text(encoding="utf-8"))
    assert [row["id"] for row in read("nps_facts.csv")] == [hike["id"] for hike in hikes]


def test_each_row_cites_an_nps_page():
    pages = {row["id"]: row["nps_page"] for row in read("nps_pages.csv")}
    for row in read("nps_facts.csv"):
        assert row["source_url"].startswith(("https://www.nps.gov/", "https://home.nps.gov/")), row["id"]
        if row["source_url"] != pages[row["id"]]:
            assert row["length_mi"] or row["gain_ft"], row["id"]


def test_numbers_are_numbers_and_length_has_a_type():
    for row in read("nps_facts.csv"):
        for column in ("length_mi", "max_elev_ft"):
            if row[column]:
                assert float(row[column]) > 0, (row["id"], column)
        # A flat trail (Anhinga) really has 0 ft of gain.
        if row["gain_ft"]:
            assert float(row["gain_ft"]) >= 0, (row["id"], "gain_ft")
        assert bool(row["length_mi"]) == bool(row["length_type"]), row["id"]
        if row["length_type"]:
            assert row["length_type"] in LENGTH_TYPES, row["id"]


def test_a_row_without_a_length_is_flagged_for_a_check():
    for row in read("nps_facts.csv"):
        if not row["length_mi"]:
            assert row["needs_check"] == "yes", row["id"]
            assert row["note"], row["id"]


def test_no_row_has_extra_columns():
    for row in read("nps_facts.csv"):
        assert None not in row, row["id"]
        assert all(value is not None for value in row.values()), row["id"]
