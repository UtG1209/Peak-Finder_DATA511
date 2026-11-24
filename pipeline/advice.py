"""Advice vs data cards (lane 1): common travel advice checked against the official numbers.

Every figure is computed from the cached downloads of nps_visits.py, ghcn.py and epa_aqi.py,
except the fare card, which is lane 2's known answer from docs/ai-vs-data-check.md.

Run from the repo root:  .venv/Scripts/python.exe pipeline/advice.py
Output: data/processed/advice.json
"""

import json
from pathlib import Path

import epa_aqi
import ghcn
import nps_visits

ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "data" / "processed" / "advice.json"

IRMA = ("NPS IRMA, Recreation Visits by Month", "https://irma.nps.gov/STATS/")
GHCN = ("NOAA GHCN-Daily, station USC00429717", "https://www.ncei.noaa.gov/access/search/data-search/daily-summaries")
AIRDATA = ("EPA AirData, daily AQI by county", "https://aqs.epa.gov/aqsweb/airdata/download_files.html")
FARES = (
    "DOT Consumer Airfare Report, Table 6",
    "https://www.transportation.gov/policy/aviation-policy/domestic-airline-consumer-airfare-report",
)

SPRINGDALE_STATION = "USC00429717"
MARIPOSA = "06043"
FLATHEAD = "30029"
TEN_YEARS = range(2015, 2025)  # the doc's counts include 2020


def card(hike_id, claim, finding, numbers, source):
    return {
        "hike_id": hike_id,
        "claim": claim,
        "finding": finding,
        "numbers": numbers,
        "source": source[0],
        "url": source[1],
    }


def visits(code):
    rows = nps_visits.parse_visits(nps_visits.fetch_park_xml(code))
    return {(row["year"], row["month"]): row["visits"] for row in rows}


def percent(part, whole):
    return round(100 * part / whole, 1)


def glacier_september():
    glacier = visits("GLAC")
    share_2010 = glacier[(2010, 9)] / glacier[(2010, 7)]
    share_2023 = glacier[(2023, 9)] / glacier[(2023, 7)]
    return card(
        "glacier-highline",
        "Go in September for quiet",
        f"September visits were {percent(glacier[(2010, 9)], glacier[(2010, 7)])}% of July in 2010 and "
        f"{percent(glacier[(2023, 9)], glacier[(2023, 7)])}% in 2023, so the quiet shoulder season is mostly gone.",
        {"2010": round(share_2010, 3), "2023": round(share_2023, 3)},
        IRMA,
    )


def zion_busiest_month():
    zion = visits("ZION")
    year_total = sum(zion[(2023, month)] for month in range(1, 13))
    busiest = max(range(1, 13), key=lambda month: zion[(2023, month)])
    assert busiest == 6, "the card says June"
    return card(
        "angels-landing",
        "Zion is busiest in summer, in August",
        f"June 2023 was the busiest month: {zion[(2023, 6)]:,} visits, {100 * zion[(2023, 6)] / year_total:.2f}% "
        f"of the {year_total:,} year total.",
        {"June 2023": zion[(2023, 6)], "Year 2023": year_total},
        IRMA,
    )


def zion_heat():
    daily = ghcn.fetch_daily(SPRINGDALE_STATION)
    august = daily[(daily["date"].dt.month == 8) & daily["date"].dt.year.isin(TEN_YEARS)]
    hot_days = int((august["TMAX"] >= ghcn.HEAT_DAY_F).sum())
    return card(
        "angels-landing",
        "Zion summers are hot but not that hot",
        f"Springdale averaged {hot_days / len(TEN_YEARS):.1f} days at or above 100 F each August in 2015-24 "
        f"({hot_days} days), far more than reanalysis models suggest.",
        {
            "Station mean Aug high (F)": round(float(august["TMAX"].mean()), 1),
            "Days >= 100 F per August": hot_days / len(TEN_YEARS),
        },
        GHCN,
    )


def yosemite_smoke(table):
    over = epa_aqi.unhealthy_days(table, MARIPOSA, 8, TEN_YEARS)
    reported = epa_aqi.days_reported(table, MARIPOSA, 8, TEN_YEARS)
    smoke = epa_aqi.unhealthy_days(table, MARIPOSA, 8, TEN_YEARS, epa_aqi.SMOKE_POLLUTANT)
    ozone = epa_aqi.unhealthy_days(table, MARIPOSA, 8, TEN_YEARS, epa_aqi.OZONE_POLLUTANT)
    return card(
        "half-dome",
        "Bad air in Yosemite means wildfire smoke",
        f"In Mariposa County, {over} of {reported} August days had AQI over 100 (2015-24). "
        f"Only {smoke} were PM2.5 smoke; {ozone} were ozone.",
        {"AQI>100 days": over, "PM2.5 (smoke) days": smoke, "Ozone days": ozone},
        AIRDATA,
    )


def glacier_smoke(table):
    before = epa_aqi.unhealthy_days(table, FLATHEAD, 8, range(2005, 2015))
    after = epa_aqi.unhealthy_days(table, FLATHEAD, 8, TEN_YEARS)
    after_smoke = epa_aqi.unhealthy_days(table, FLATHEAD, 8, TEN_YEARS, epa_aqi.SMOKE_POLLUTANT)
    assert after == after_smoke, "the card says all of them were smoke"
    return card(
        "grinnell-glacier",
        "Glacier's air is always clean",
        f"Flathead County August days over AQI 100 went from {before} (2005-14) to {after} (2015-24), "
        "all of them PM2.5 smoke.",
        {"2005-14": before, "2015-24": after},
        AIRDATA,
    )


def acadia_fall():
    acadia = visits("ACAD")

    def fall_share(year):
        year_total = sum(acadia[(year, month)] for month in range(1, 13))
        return (acadia[(year, 9)] + acadia[(year, 10)]) / year_total

    return card(
        "cadillac-north-ridge",
        "Acadia is quiet once summer ends",
        f"September and October together carried {100 * fall_share(2010):.1f}% of visits in 2010 and "
        f"{100 * fall_share(2023):.1f}% in 2023: fall is now a main season.",
        {"2010": round(fall_share(2010), 3), "2023": round(fall_share(2023), 3)},
        IRMA,
    )


def seattle_fare():
    return card(
        "angels-landing",
        "Flights to Las Vegas are cheap from Seattle",
        "The average one-way Seattle to Las Vegas fare was $169.78 in Q3 2025, not the $118 some tools suggest.",
        {"Q3 2025 average one-way fare ($)": 169.78},
        FARES,
    )


def build():
    table = epa_aqi.load_counties({MARIPOSA, FLATHEAD})
    return [
        glacier_september(),
        zion_busiest_month(),
        zion_heat(),
        yosemite_smoke(table),
        glacier_smoke(table),
        acadia_fall(),
        seattle_fare(),
    ]


def main():
    cards = build()
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(cards, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)}: {len(cards)} cards")


if __name__ == "__main__":
    main()
