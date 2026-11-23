"""Checks for pipeline/ghcn.py.

Known answers come from docs/ai-vs-data-check.md. Station data is cached in data/raw/ghcn/,
so these run offline after the first pipeline run.
"""

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ghcn  # noqa: E402

SPRINGDALE = "USC00429717"  # "Zion National Park" station


def daily_frame(rows):
    """rows: list of (date, tmax, prcp, snow)."""
    frame = pd.DataFrame(rows, columns=["date", "TMAX", "PRCP", "SNOW"])
    frame["date"] = pd.to_datetime(frame["date"])
    return frame


def test_springdale_has_13_august_days_at_or_above_100f():
    daily = ghcn.fetch_daily(SPRINGDALE)
    august = daily[daily["date"].dt.month == 8]
    assert (august["TMAX"] >= 100).sum() == 130  # 130 days over 2015-24, 2020 included
    # The doc's 13.0 is that 130 over 10 years. Typical values leave 2020 out, so they differ.
    assert round(ghcn.heat_days_in_month(daily, 8, include_2020=True), 1) == 13.0
    assert ghcn.heat_days_in_month(daily, 8) < 13.0


def test_springdale_august_mean_high_is_97_9():
    daily = ghcn.fetch_daily(SPRINGDALE)
    august = daily[daily["date"].dt.month == 8]
    assert round(august["TMAX"].mean(), 1) == 97.9


def test_zion_hike_gets_the_springdale_station():
    stations = ghcn.load_stations()
    station, _ = ghcn.pick_station(stations, 37.25897, -112.95097)  # The Grotto
    assert station["id"] == SPRINGDALE
    assert station["dist_km"] <= ghcn.MAX_DISTANCE_KM


def test_station_far_from_everything_is_missing():
    stations = ghcn.load_stations()
    station, daily = ghcn.pick_station(stations, 30.0, -135.0)  # open Pacific
    assert station is None and daily is None


def test_2020_is_left_out_of_typical_years():
    assert 2020 not in ghcn.typical_years()
    assert 2020 in ghcn.typical_years(include_2020=True)


def test_incomplete_station_is_rejected():
    days = pd.date_range("2015-01-01", "2024-12-31")
    sparse = daily_frame([(day, 70.0, 0.0, 0.0) for day in days[::3]])  # one day in three
    assert not ghcn.is_complete(sparse)
    full = daily_frame([(day, 70.0, 0.0, 0.0) for day in days])
    assert ghcn.is_complete(full)


def test_a_month_with_too_many_missing_days_is_skipped():
    rows = [("2023-07-%02d" % day, 105.0, 0.0, 0.0) for day in range(1, 11)]  # 10 of 31 days
    daily = daily_frame(rows)
    assert ghcn.heat_days_in_month(daily, 7) is None


def test_partly_missing_month_is_scaled_to_a_full_month():
    rows = [("2023-07-%02d" % day, 105.0 if day <= 13 else 80.0, 0.0, 0.0) for day in range(1, 27)]  # 26 of 31 days
    daily = daily_frame(rows)
    # 13 hot days of 26 present -> 6.5 per 13 days -> 15.5 over 31 days
    assert round(ghcn.heat_days_in_month(daily, 7), 1) == 15.5


def test_summit_estimate_drops_3_5f_per_1000_ft():
    assert ghcn.summit_drop(5000, 4000) == 3.5
    assert ghcn.summit_drop(4000, 4000) == 0


def test_output_file_is_complete_when_a_station_exists():
    output = json.loads(ghcn.OUT_FILE.read_text(encoding="utf-8"))
    for hike_id, hike in output["hikes"].items():
        if hike["station"] is None:
            assert hike["missing"] == ["temp", "wet"] and hike["months"] == []
            continue
        assert hike["station"]["dist_km"] <= ghcn.MAX_DISTANCE_KM, hike_id
        assert [month["month"] for month in hike["months"]] == list(range(1, 13)), hike_id
        for month in hike["months"]:
            assert month["tmax_p25"] <= month["tmax_p50"] <= month["tmax_p75"], hike_id
