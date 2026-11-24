import csv
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import hikes  # noqa: E402

GEAR = {"chains", "exposure", "no-shade", "steep", "snow-gear", "bear-spray", "water-crossing", "scramble", "extra-water", "headlamp", "bug-spray"}
LICENCES = {"Public domain", "CC0", "CC BY", "CC BY-SA"}


@pytest.fixture(scope="module")
def built():
    return json.loads(hikes.OUT_FILE.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def base():
    return json.loads(hikes.BASE_FILE.read_text(encoding="utf-8"))


def test_same_hikes_and_fields_as_the_list_it_replaces(built, base):
    assert [h["id"] for h in built] == [h["id"] for h in base]
    for new, old in zip(built, base):
        assert list(new) == list(old), new["id"]


def test_enums_and_gear_follow_the_app_shape(built):
    for hike in built:
        assert hike["difficulty"] in {"easy", "moderate", "hard"}, hike["id"]
        assert hike["route_type"] in {"out-and-back", "loop", "point-to-point"}, hike["id"]
        assert hike["length_type"] in {"round-trip", "loop", "one-way"}, hike["id"]
        assert set(hike["gear"]) <= GEAR, hike["id"]


def test_length_type_follows_the_route(built):
    expected = hikes.LENGTH_TYPE_FOR_ROUTE
    sourced = {row["id"] for row in csv.DictReader(hikes.COVERAGE_FILE.open(encoding="utf-8")) if row["length"] == "nps"}
    for hike in built:
        if hike["id"] in sourced:
            assert hike["length_type"] == expected[hike["route_type"]], hike["id"]


def test_a_one_way_nps_length_is_doubled_for_an_out_and_back_hike():
    facts = {"length_mi": "5.0", "length_type": "one-way"}
    assert hikes.length_fields(facts, "out-and-back") == (10.0, "round-trip")
    assert hikes.length_fields(facts, "point-to-point") == (5.0, "one-way")
    assert hikes.length_fields({"length_mi": "6.7", "length_type": "loop"}, "loop") == (6.7, "loop")


def test_numbers_are_positive_and_notes_are_text_or_null(built):
    for hike in built:
        assert hike["length_mi"] > 0 and hike["max_elev_ft"] > 0, hike["id"]
        assert hike["gain_ft"] >= 0, hike["id"]
        for field in ("permit_note", "closure_note"):
            assert hike[field] is None or hike[field].strip(), (hike["id"], field)
        assert hike["description"].strip(), hike["id"]


def test_photos_have_a_full_credit_and_an_allowed_licence(built):
    for hike in built:
        photo = hike["photo"]
        assert photo["license"] in LICENCES, hike["id"]
        assert photo["author"] and photo["license_url"] and photo["page"], hike["id"]


def test_station_and_county_come_from_the_pipeline_files(built):
    weather = json.loads((hikes.PROCESSED / "weather.json").read_text(encoding="utf-8"))["hikes"]
    for hike in built:
        assert hike["station"] == weather[hike["id"]]["station"], hike["id"]
        assert hike["aqi_county"]["fips"], hike["id"]


def test_nps_pages_are_the_ones_in_the_catalogue(built):
    with (hikes.CATALOGUE / "nps_pages.csv").open(encoding="utf-8", newline="") as handle:
        pages = {row["id"]: row["nps_page"] for row in csv.DictReader(handle)}
    for hike in built:
        assert hike["nps_url"] == pages[hike["id"]], hike["id"]


def test_coverage_names_every_placeholder_field(built):
    with hikes.COVERAGE_FILE.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert [row["id"] for row in rows] == [hike["id"] for hike in built]
    ends = hikes.read_csv("end_points.csv")
    assert all(row["trailhead"] == "placeholder" for row in rows)
    assert all(row["end"] == ("walk" if row["id"] in ends else "placeholder") for row in rows)
    assert all(set(row) == {"id", *hikes.COVERAGE_FIELDS} for row in rows)


def test_a_hike_with_a_walk_ends_where_the_walk_route_ends(built):
    ends = hikes.read_csv("end_points.csv")
    for hike in built:
        if hike["id"] in ends:
            assert hike["end"]["lat"] == float(ends[hike["id"]]["end_lat"]), hike["id"]
            assert hike["end"]["lon"] == float(ends[hike["id"]]["end_lon"]), hike["id"]
