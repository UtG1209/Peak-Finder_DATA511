import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import meta  # noqa: E402


def built():
    return json.loads(meta.OUT_FILE.read_text(encoding="utf-8"))


def test_the_data_stays_marked_fake_while_files_are_placeholders_and_has_the_right_hike_count():
    result = built()
    assert result["fake"] is True
    assert result["hike_count"] == len(json.loads(meta.HIKES_FILE.read_text(encoding="utf-8")))


def test_every_lane_1_source_has_a_link_and_a_real_date():
    by_name = {source["name"]: source for source in built()["sources"]}
    for name, url, _ in meta.LANE_1_SOURCES:
        assert by_name[name]["url"] == url
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", by_name[name]["as_of"]), name


def test_lane_2_sources_and_cost_sources_are_carried_over_unchanged():
    previous = json.loads(meta.APP_META.read_text(encoding="utf-8"))
    result = built()
    assert result["cost_sources"] == previous["cost_sources"]
    own = {name for name, _, _ in meta.LANE_1_SOURCES}
    carried = [source for source in previous["sources"] if source["name"] not in own]
    assert [source for source in result["sources"] if source["name"] not in own] == carried
