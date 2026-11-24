"""Merge the lane 1 outputs into hike_month.json (lane 1).

Inputs (in data/processed/, one script each): crowds.json, weather.json, aqi.json, daylight.json.
Output: data/processed/hike_month.json, 12 rows per hike, in the shape of app/src/data/schema.ts.

Not real yet, kept from the existing app file: `closed` (seasonal closures need the hike catalogue).

Run from the repo root:  .venv/Scripts/python.exe pipeline/build.py [--publish]
--publish also copies hike_month.json into app/public/data/. Only do that when CI allows real data there
(CI currently regenerates the fake data and fails on any difference).
"""

import json
import shutil
import sys
from pathlib import Path

import hikes as hikes_catalogue

ROOT = Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data" / "processed"
APP_DATA = ROOT / "app" / "public" / "data"

# Order of the schema's MissingFactor list, so the output is stable.
MISSING_ORDER = ["temp", "wet", "smoky", "crowd"]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def month_rows(hike, crowds, weather, aqi, daylight, closed_months):
    """The 12 hike_month rows for one hike."""
    park = crowds["parks"].get(hike["park_code"], {"missing": ["crowd"], "months": []})
    wx = weather["hikes"].get(hike["id"], {"missing": ["temp", "wet"], "months": []})
    air = aqi["hikes"].get(hike["id"], {"missing": ["smoky"], "months": []})
    sun = daylight["hikes"][hike["id"]]

    rows = []
    for index in range(12):
        month = index + 1
        missing = set(wx["missing"]) | set(air["missing"]) | set(park["missing"])
        # A missing factor gets a neutral value; the app leaves it out of the match because of `missing`.
        crowd = park["months"][index] if park["months"] else {"crowd_level": 0, "crowd_band": "quiet"}
        weather_month = wx["months"][index] if wx["months"] else {}
        air_month = air["months"][index] if air["months"] else {"smoky_days": 0, "ozone_days": 0}
        sun_month = sun[index]

        rows.append(
            {
                "hike_id": hike["id"],
                "month": month,
                "crowd_level": crowd["crowd_level"],
                "crowd_band": crowd["crowd_band"],
                "tmax_p25": weather_month.get("tmax_p25"),
                "tmax_p50": weather_month.get("tmax_p50"),
                "tmax_p75": weather_month.get("tmax_p75"),
                "tmax_summit_est": weather_month.get("tmax_summit_est"),
                "wet_days": weather_month.get("wet_days"),
                "snow_days": weather_month.get("snow_days"),
                "smoky_days": air_month["smoky_days"],
                "ozone_days": air_month["ozone_days"],
                "heat_days": weather_month.get("heat_days"),
                "daylight_hr": sun_month["daylight_hr"],
                "sunrise": sun_month["sunrise"],
                "sunset": sun_month["sunset"],
                "closed": (hike["id"], month) in closed_months,
                "missing": [factor for factor in MISSING_ORDER if factor in missing],
            }
        )
    return rows


def closed_from_existing():
    path = APP_DATA / "hike_month.json"
    if not path.exists():
        return set()
    return {(row["hike_id"], row["month"]) for row in read_json(path) if row["closed"]}


def main():
    publish = "--publish" in sys.argv

    hikes = read_json(APP_DATA / "hikes.json")
    crowds = read_json(PROCESSED / "crowds.json")
    weather = read_json(PROCESSED / "weather.json")
    aqi = read_json(PROCESSED / "aqi.json")
    daylight = read_json(PROCESSED / "daylight.json")
    closed_months = hikes_catalogue.closed_months()

    rows = []
    for hike in hikes:
        rows.extend(month_rows(hike, crowds, weather, aqi, daylight, closed_months))

    out_file = PROCESSED / "hike_month.json"
    out_file.write_text(json.dumps(rows, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {out_file.relative_to(ROOT)}: {len(rows)} rows for {len(hikes)} hikes")

    flagged = sorted({row["hike_id"] for row in rows if row["missing"]})
    if flagged:
        print("Hikes with a missing factor:", ", ".join(flagged))

    if publish:
        shutil.copyfile(out_file, APP_DATA / "hike_month.json")
        print("Copied to app/public/data/hike_month.json")
        shutil.copyfile(PROCESSED / "advice.json", APP_DATA / "advice.json")
        print("Copied to app/public/data/advice.json")


if __name__ == "__main__":
    main()
