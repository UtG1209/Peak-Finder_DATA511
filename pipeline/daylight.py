"""Daylight hours, sunrise and sunset per hike and month (lane 1).

Computed, not downloaded: the NOAA solar formulas from the trailhead's latitude and longitude,
for the 15th of each month, shown on the local clock (daylight saving included where the zone has it).

Run from the repo root:  .venv/Scripts/python.exe pipeline/daylight.py
Output: data/processed/daylight.json
"""

import json
import math
from datetime import date, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "data" / "processed" / "daylight.json"
HIKES_FILE = ROOT / "app" / "public" / "data" / "hikes.json"

YEAR = 2025  # any ordinary year: sunrise moves by a minute or two between years
SUNRISE_ZENITH_DEG = 90.833  # the sun's edge at the horizon, with atmospheric refraction

# State to time zone. Each state in the 40 hikes must be here, so a new state fails loudly.
STATE_ZONE = {
    "AZ": "America/Phoenix",  # no daylight saving, also at the Grand Canyon
    "UT": "America/Denver", "CO": "America/Denver", "NM": "America/Denver",
    "WY": "America/Denver", "MT": "America/Denver",
    "CA": "America/Los_Angeles", "OR": "America/Los_Angeles", "WA": "America/Los_Angeles",
    "NV": "America/Los_Angeles",
    "TX": "America/Chicago",
    "ME": "America/New_York", "TN": "America/New_York", "NC": "America/New_York",
    "VA": "America/New_York", "FL": "America/New_York", "SC": "America/New_York",
}
# Parks that sit in a different zone from the rest of their state.
PARK_ZONE = {"GUMO": "America/Denver"}  # Guadalupe Mountains, West Texas


def zone_for(state, park_code):
    return ZoneInfo(PARK_ZONE.get(park_code, STATE_ZONE[state]))


def solar_minutes_utc(lat, lon, day):
    """Sunrise and sunset as minutes after midnight UTC, by the NOAA general solar position formulas."""
    doy = day.timetuple().tm_yday
    gamma = 2 * math.pi / 365 * (doy - 1)  # fractional year, at noon

    equation_of_time = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.040849 * math.sin(2 * gamma)
    )
    declination = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )

    phi = math.radians(lat)
    cos_hour_angle = math.cos(math.radians(SUNRISE_ZENITH_DEG)) / (math.cos(phi) * math.cos(declination)) - math.tan(
        phi
    ) * math.tan(declination)
    cos_hour_angle = max(-1.0, min(1.0, cos_hour_angle))  # polar day or night: clamp
    hour_angle_deg = math.degrees(math.acos(cos_hour_angle))

    sunrise = 720 - 4 * (lon + hour_angle_deg) - equation_of_time
    sunset = 720 - 4 * (lon - hour_angle_deg) - equation_of_time
    return sunrise, sunset


def clock_text(minutes):
    total = round(minutes) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def day_summary(lat, lon, zone, month):
    """{daylight_hr, sunrise, sunset} for the 15th of a month, on the local clock."""
    day = date(YEAR, month, 15)
    sunrise_utc, sunset_utc = solar_minutes_utc(lat, lon, day)

    noon_local = datetime.combine(day, time(12), tzinfo=zone)
    offset_minutes = noon_local.utcoffset().total_seconds() / 60

    return {
        "month": month,
        "daylight_hr": round((sunset_utc - sunrise_utc) / 60, 1),
        "sunrise": clock_text(sunrise_utc + offset_minutes),
        "sunset": clock_text(sunset_utc + offset_minutes),
    }


def build(hikes):
    result = {}
    for hike in hikes:
        trailhead = hike["trailhead"]
        zone = zone_for(hike["state"], hike["park_code"])
        result[hike["id"]] = [day_summary(trailhead["lat"], trailhead["lon"], zone, month) for month in range(1, 13)]
    return result


def main():
    hikes = json.loads(HIKES_FILE.read_text(encoding="utf-8"))
    output = {
        "source": "Computed from trailhead latitude and longitude (NOAA solar formulas), 15th of each month",
        "hikes": build(hikes),
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(output, indent=1), encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)} for {len(hikes)} hikes")


if __name__ == "__main__":
    main()
