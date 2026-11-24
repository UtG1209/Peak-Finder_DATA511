"""Checks for pipeline/build.py: the merged hike_month.json matches the app's data shape."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build  # noqa: E402

FIELDS = [
    "hike_id", "month", "crowd_level", "crowd_band", "tmax_p25", "tmax_p50", "tmax_p75", "tmax_summit_est",
    "wet_days", "snow_days", "smoky_days", "ozone_days", "heat_days", "daylight_hr", "sunrise", "sunset",
    "closed", "missing",
]  # the fields of HikeMonthSchema in app/src/data/schema.ts, in the same order


@pytest.fixture(scope="module")
def rows():
    return json.loads((build.PROCESSED / "hike_month.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def hikes():
    return json.loads((build.APP_DATA / "hikes.json").read_text(encoding="utf-8"))


def test_twelve_rows_per_hike_with_the_schema_fields(rows, hikes):
    assert len(rows) == 12 * len(hikes)
    for row in rows:
        assert list(row) == FIELDS


def test_a_hike_without_a_station_has_null_weather_and_a_missing_flag(rows):
    for row in rows:
        has_null_weather = row["tmax_p50"] is None
        assert has_null_weather == ("temp" in row["missing"]), row["hike_id"]
        assert has_null_weather == ("wet" in row["missing"]), row["hike_id"]
        if has_null_weather:
            assert row["wet_days"] is None and row["heat_days"] is None and row["snow_days"] is None


def test_missing_flags_use_the_schema_names_in_order(rows):
    order = ["temp", "wet", "smoky", "crowd"]
    for row in rows:
        assert row["missing"] == [name for name in order if name in row["missing"]]


def test_zion_august_carries_the_real_numbers(rows):
    august = next(r for r in rows if r["hike_id"] == "angels-landing" and r["month"] == 8)
    assert august["crowd_band"] == "busy"
    assert august["tmax_p50"] == 98.0
    assert august["missing"] == []
