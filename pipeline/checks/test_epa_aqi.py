"""Checks for pipeline/epa_aqi.py.

Known answers come from docs/ai-vs-data-check.md (EPA AirData daily AQI by county).
The yearly zips are cached in data/raw/epa/, so these run offline after the first pipeline run.
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import epa_aqi  # noqa: E402

MARIPOSA = "06043"
FLATHEAD = "30029"
ALL_TEN_YEARS = range(2015, 2025)  # the doc's counts include 2020


@pytest.fixture(scope="module")
def table():
    return epa_aqi.load_counties({MARIPOSA, FLATHEAD})


def test_mariposa_august_71_days_over_100_but_only_33_are_smoke(table):
    assert epa_aqi.days_reported(table, MARIPOSA, 8, ALL_TEN_YEARS) == 310
    assert epa_aqi.unhealthy_days(table, MARIPOSA, 8, ALL_TEN_YEARS) == 71
    assert epa_aqi.unhealthy_days(table, MARIPOSA, 8, ALL_TEN_YEARS, "PM2.5") == 33
    assert epa_aqi.unhealthy_days(table, MARIPOSA, 8, ALL_TEN_YEARS, "Ozone") == 38


def test_flathead_august_went_from_4_to_38_days_all_smoke(table):
    assert epa_aqi.unhealthy_days(table, FLATHEAD, 8, range(2005, 2015)) == 4
    assert epa_aqi.unhealthy_days(table, FLATHEAD, 8, ALL_TEN_YEARS) == 38
    assert epa_aqi.unhealthy_days(table, FLATHEAD, 8, ALL_TEN_YEARS, "PM2.5") == 38


def test_typical_years_leave_out_2020():
    assert 2020 not in epa_aqi.TYPICAL_YEARS
    assert len(epa_aqi.TYPICAL_YEARS) == 9


def test_typical_smoky_days_are_a_yearly_average_without_2020(table):
    summary = epa_aqi.month_summary(table, MARIPOSA, 8)
    smoke = epa_aqi.unhealthy_days(table, MARIPOSA, 8, epa_aqi.TYPICAL_YEARS, "PM2.5")
    assert summary["smoky_days"] == round(smoke / 9, 1)
    assert summary["smoky_days"] < 33 / 10 + 5  # sanity: a few days a year, not the ten-year total


def test_hike_county_comes_from_the_trailhead_not_the_park_name():
    zion = epa_aqi.county_for(37.25897, -112.95097)
    assert zion == {"fips": "49053", "name": "Washington County, UT"}


def test_output_file_has_twelve_months_or_a_missing_flag():
    output = json.loads(epa_aqi.OUT_FILE.read_text(encoding="utf-8"))
    for hike_id, hike in output["hikes"].items():
        if hike["missing"]:
            assert hike["missing"] == ["smoky"] and hike["months"] == [], hike_id
            continue
        assert [month["month"] for month in hike["months"]] == list(range(1, 13)), hike_id
