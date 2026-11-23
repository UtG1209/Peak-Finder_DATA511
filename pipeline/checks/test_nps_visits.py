"""Checks for pipeline/nps_visits.py.

The known answers come from docs/ai-vs-data-check.md (NPS IRMA, pulled 26-27 Oct 2026).
Raw downloads are cached in data/raw/nps/, so these run offline after the first pipeline run.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import nps_visits  # noqa: E402


def visits(code):
    """{(year, month): visits} for one park."""
    rows = nps_visits.parse_visits(nps_visits.fetch_park_xml(code))
    return {(row["year"], row["month"]): row["visits"] for row in rows}


def year_total(table, year):
    return sum(table[(year, month)] for month in range(1, 13))


def share(part, whole):
    return round(100 * part / whole, 1)


def test_zion_june_2023_is_the_busiest_month():
    zion = visits("ZION")
    assert zion[(2023, 6)] == 564_036
    assert year_total(zion, 2023) == 4_623_238
    assert share(zion[(2023, 6)], year_total(zion, 2023)) == 12.2
    busiest = max(range(1, 13), key=lambda month: zion[(2023, month)])
    assert busiest == 6


def test_acadia_september_and_october_share():
    acadia = visits("ACAD")
    sep_oct_2010 = acadia[(2010, 9)] + acadia[(2010, 10)]
    sep_oct_2023 = acadia[(2023, 9)] + acadia[(2023, 10)]
    assert sep_oct_2010 == 720_115
    assert sep_oct_2023 == 1_184_573
    assert share(sep_oct_2010, year_total(acadia, 2010)) == 28.8
    assert share(sep_oct_2023, year_total(acadia, 2023)) == 30.5


def test_glacier_summer_2023_and_september_vs_july():
    glacier = visits("GLAC")
    assert glacier[(2023, 7)] == 722_535
    assert glacier[(2023, 8)] == 652_866
    assert glacier[(2023, 9)] == 553_565
    assert share(glacier[(2010, 9)], glacier[(2010, 7)]) == 44.6
    assert share(glacier[(2023, 9)], glacier[(2023, 7)]) == 76.6


def test_sequoia_uses_the_irma_code_for_the_park_our_hikes_are_in():
    assert nps_visits.IRMA_CODES["SEKI"] == "SEQU"
    assert len(visits("SEKI")) == 180


def test_2020_is_never_used_in_a_typical_value():
    # Same visits every year, except a huge 2020 that must be ignored.
    rows = []
    for year in range(2015, 2025):
        for month in range(1, 13):
            visits_in_month = 10_000_000 if year == 2020 else 100 * month
            rows.append({"year": year, "month": month, "visits": visits_in_month})
    result = nps_visits.typical_crowds(rows)
    assert result[0]["median_visits"] == 100
    assert result[11]["crowd_level"] == 1.0
    assert result[0]["crowd_level"] == round(1 / 12, 2)


def test_years_before_2015_are_not_used_either():
    rows = []
    for year in range(2010, 2025):
        for month in range(1, 13):
            visits_in_month = 5_000_000 if year < 2015 else 100
            rows.append({"year": year, "month": month, "visits": visits_in_month})
    result = nps_visits.typical_crowds(rows)
    assert all(month["median_visits"] == 100 for month in result)


def test_missing_months_give_no_result():
    rows = [{"year": 2023, "month": 6, "visits": 10}]
    assert nps_visits.typical_crowds(rows) is None


def test_bands_follow_the_app_cutoffs():
    assert nps_visits.band(0.39) == "quiet"
    assert nps_visits.band(0.4) == "moderate"
    assert nps_visits.band(0.69) == "moderate"
    assert nps_visits.band(0.7) == "busy"
    assert nps_visits.band(1.0) == "busy"


def test_output_file_is_complete_and_scaled_to_the_busiest_month():
    output = json.loads(nps_visits.OUT_FILE.read_text(encoding="utf-8"))
    assert output["parks"], "no parks in crowds.json"
    hike_parks = set(nps_visits.park_codes_from_hikes())
    assert hike_parks == set(output["parks"])

    for code, park in output["parks"].items():
        if park["missing"]:
            assert park["missing"] == ["crowd"]
            assert park["months"] == []
            continue
        months = park["months"]
        assert [month["month"] for month in months] == list(range(1, 13)), code
        levels = [month["crowd_level"] for month in months]
        assert all(0 <= level <= 1 for level in levels), code
        assert max(levels) == 1.0, code
        for month in months:
            assert month["crowd_band"] == nps_visits.band(month["crowd_level"]), code
