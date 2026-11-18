# AI vs official data — 8-question check (Oct 2026)

Checked GPT (2 runs), Gemini and Gemini Deep Research against the official data, pulled on 26–27 Oct 2026.
The "Real answer" column is the ground truth the pipeline must reproduce.

| # | Question | Real answer (source) | GPT run 1 | GPT run 2 | Gemini | Gemini Deep Research |
|---|---|---|---|---|---|---|
| 1 | Zion busiest month 2023 | June, 564,036 = 12.20% of 4,623,238 (NPS IRMA, Recreation Visits by Month) | Wrong (August) | Right | Month right, total wrong (4,640,822) | Month right, total wrong (4,628,088) |
| 2 | Acadia Sep+Oct share | 2010: 720,115 = 28.8%; 2023: 1,184,573 = 30.5% (NPS IRMA) | Declined | Declined | Wrong both (26.9%, 28.3%) | 2023 right; 2010 declined |
| 3 | Glacier Jul/Aug/Sep 2023 | 722,535 / 652,866 / 553,565 (NPS IRMA) | Declined | July right only | All three wrong | Declined |
| 4 | Mariposa Aug days AQI>100, 2015–24 | 71 of 310 = 22.9%; only 33 days (10.6%) were PM2.5 (smoke), 38 were ozone (EPA AirData daily AQI by county) | Declined | Declined | 21.3% (close, not right) | Declined |
| 5 | Flathead Aug days AQI>100 | 2005–14: 4; 2015–24: 38, all PM2.5 (EPA AirData) | Declined | Declined | Wrong (12 → 31) | Declined |
| 6 | Springdale Aug days ≥100°F, 2015–24 | 13.0 per August (130 days; NOAA GHCN station USC00429717 "Zion National Park") | Declined | Declined | 14.2 (close, not right) | Declined |
| 7 | Springdale GSA rate Jul vs Oct FY2026 | $110 both (standard rate) | Right | Right | Right | Right, but mislabelled "October 2026" |
| 8 | SEA–LAS avg one-way fare Q3 2025 | $169.78 (DOT Consumer Airfare Report Table 6) | Declined | Declined | Wrong ($118.40) | Declined |

## Findings that change the project plan

- **Open-Meteo badly underestimates canyon heat.** At Springdale, ERA5-Land gives 1.5 days ≥100°F per August, ERA5 4.2, versus 13.0 at the NOAA station; mean August high 92.7–94.2°F vs 97.9°F. Use NOAA GHCN station data for heat (NCEI access API, no key).
- **AQI>100 is not the same as smoke.** Mariposa's unhealthy August days fell (93 → 71) while smoke days rose 3 → 33; the earlier decade was mostly ozone. Split AQI by defining parameter (PM2.5 vs ozone).
- **The September story is real at Glacier.** September visits were 44.6% of July in 2010 and 76.6% in 2023 (2026 preliminary: 71.8%). Zion's September beat August in 2023.
- **Fare data lags about one quarter.** Table 6 already had Q1 2026 in Oct 2026, and its Socrata API works without a key.
