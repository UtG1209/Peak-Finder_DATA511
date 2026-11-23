"""Checks for pipeline/daylight.py."""

import json
import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import daylight  # noqa: E402


def test_denver_summer_solstice_matches_published_times():
    # Published: sunrise 05:32, sunset 20:31 MDT (UTC-6), 14 h 59 min.
    sunrise, sunset = daylight.solar_minutes_utc(39.74, -104.99, date(2025, 6, 21))
    assert daylight.clock_text(sunrise - 6 * 60) == "05:32"
    assert daylight.clock_text(sunset - 6 * 60) == "20:31"
    assert (sunset - sunrise) / 60 == pytest.approx(14.98, abs=0.05)


def test_days_are_longer_in_summer_than_winter():
    zone = daylight.zone_for("UT", "ZION")
    june = daylight.day_summary(37.26, -112.95, zone, 6)
    december = daylight.day_summary(37.26, -112.95, zone, 12)
    assert june["daylight_hr"] > december["daylight_hr"] + 3


def test_daylight_saving_shifts_the_clock_by_one_hour():
    # Arizona has no daylight saving, Utah does: same longitude, same sun, different clock in summer.
    arizona = daylight.day_summary(36.9, -112.5, daylight.zone_for("AZ", "GRCA"), 7)
    utah = daylight.day_summary(36.9, -112.5, daylight.zone_for("UT", "ZION"), 7)
    assert arizona["daylight_hr"] == utah["daylight_hr"]
    assert utah["sunrise"] > arizona["sunrise"]  # "HH:MM" strings compare in clock order
    assert utah["sunrise"][:2] == f"{int(arizona['sunrise'][:2]) + 1:02d}"


def test_an_unknown_state_fails_loudly():
    with pytest.raises(KeyError):
        daylight.zone_for("ZZ", "NONE")


def test_every_hike_has_twelve_months_in_the_output():
    hikes = json.loads(daylight.HIKES_FILE.read_text(encoding="utf-8"))
    result = daylight.build(hikes)
    assert set(result) == {hike["id"] for hike in hikes}
    for rows in result.values():
        assert [row["month"] for row in rows] == list(range(1, 13))
        assert all(0 < row["daylight_hr"] < 24 for row in rows)
