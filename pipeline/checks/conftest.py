"""Run the weather checks on a small committed copy of the NOAA data (Springdale only), so CI never calls NOAA."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ghcn  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "ghcn"


@pytest.fixture(autouse=True)
def noaa_fixtures(monkeypatch):
    monkeypatch.setattr(ghcn, "RAW_DIR", FIXTURES)
