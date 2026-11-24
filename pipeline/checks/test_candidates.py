import csv
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "catalogue"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import candidates  # noqa: E402


@pytest.mark.parametrize(
    "licence",
    ["CC0", "Public domain", "PDM", "CC BY 2.0", "CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 4.0", "CC BY-SA 2.5 Generic"],
)
def test_open_licences_are_allowed(licence):
    assert candidates.allowed_licence(licence)


@pytest.mark.parametrize(
    "licence",
    ["", "CC BY-NC 2.0", "CC BY-ND 4.0", "CC BY-NC-SA 3.0", "GFDL", "Fair use", "All rights reserved"],
)
def test_other_licences_are_rejected(licence):
    assert not candidates.allowed_licence(licence)


@pytest.fixture(scope="module")
def rows():
    with candidates.OUT_FILE.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def test_one_row_per_hike_with_every_column(rows):
    hikes = json.loads(candidates.HIKES_FILE.read_text(encoding="utf-8"))
    assert [row["id"] for row in rows] == [hike["id"] for hike in hikes]
    assert list(rows[0]) == candidates.COLUMNS


def test_complete_means_every_check_passed(rows):
    for row in rows:
        checks = [
            row["visits"] == "True", row["station"] == "True", row["aqi"] == "True",
            row["osm_trailhead"] == "True", int(row["osm_named_paths"]) > 0, int(row["commons_photos"]) > 0,
        ]
        assert (row["complete"] == "True") == all(checks), row["id"]
