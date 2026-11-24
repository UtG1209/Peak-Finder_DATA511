"""Checks for pipeline/advice.py: the cards carry the known answers in docs/ai-vs-data-check.md."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import advice  # noqa: E402


@pytest.fixture(scope="module")
def cards():
    return {card["claim"]: card for card in advice.build()}


def test_between_5_and_10_cards(cards):
    assert 5 <= len(cards) <= 10


def test_zion_june_2023(cards):
    card = cards["Zion is busiest in summer, in August"]
    assert card["numbers"] == {"June 2023": 564_036, "Year 2023": 4_623_238}
    assert "12.20%" in card["finding"]


def test_glacier_september_share_of_july(cards):
    assert cards["Go in September for quiet"]["numbers"] == {"2010": 0.446, "2023": 0.766}


def test_acadia_fall_share(cards):
    assert cards["Acadia is quiet once summer ends"]["numbers"] == {"2010": 0.288, "2023": 0.305}


def test_mariposa_august_air(cards):
    numbers = cards["Bad air in Yosemite means wildfire smoke"]["numbers"]
    assert numbers == {"AQI>100 days": 71, "PM2.5 (smoke) days": 33, "Ozone days": 38}


def test_flathead_august_smoke(cards):
    assert cards["Glacier's air is always clean"]["numbers"] == {"2005-14": 4, "2015-24": 38}


def test_springdale_august_heat(cards):
    numbers = cards["Zion summers are hot but not that hot"]["numbers"]
    assert numbers == {"Station mean Aug high (F)": 97.9, "Days >= 100 F per August": 13.0}


def test_every_card_has_a_source_and_a_known_hike(cards):
    hikes = {hike["id"] for hike in json.loads((advice.ROOT / "app/public/data/hikes.json").read_text("utf-8"))}
    for card in cards.values():
        assert card["hike_id"] in hikes
        assert card["source"] and card["url"].startswith("https://")
