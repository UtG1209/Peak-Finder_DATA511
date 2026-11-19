# Lane 1: Data core (hikes, crowds, weather, air quality, daylight, checks)

**Owner:** ______________  **Language:** Python 3.13 (pandas, requests)  **Needs keys:** none required (optional NPS key)

You make the numbers behind Where and When. The app already reads fake versions of your files; your job is to
replace them with real, checked data, one file at a time, without the UI team noticing.

## Step 0 (you, then the whole team signs off): the 40 hikes
The list is the **40 most famous hikes that also have complete data**. Two rules, in this order:
1. **Data-completeness gate (hard).** A hike is a candidate only if it has all of: an official NPS page with length and gain; an OSM trail line;
   at least one open-licence Commons photo; a GHCN station within 50 km with at least 80% of days present (TMAX, PRCP); an EPA AQI monitor
   in the trailhead county; and NPS monthly recreation visits for its park. Write the result of each check per candidate into
   `pipeline/catalogue/candidates.csv` (one column per check, plus `complete = all checks pass`).
2. **Fame ranking (among complete ones).** Rank by how well known the hike is: the park's annual recreation visits (NPS IRMA) first, then the hike's
   own prominence (it is the park's signature hike, named on the NPS page, many Commons photos). Take the top 40, at most 2 per park, 1 per park where
   the park is small. Prefer a spread of Easy / Moderate / Hard and of regions, so the map and the three difficulty colours are not lopsided.

Save the final list as `pipeline/catalogue/hikes_seed.csv` (`id, name, park_code, nps_url`). Everyone else's lane starts from it. The three
featured 3D hikes (Angels Landing, Bright Angel, Cascade Pass to Sahale) are always in. The fake list in `scripts/make_fake_data.py` is a placeholder
you can start from; replace it. If a famous hike fails the gate (no nearby station, no AQI monitor), note it in the About page's limits rather than faking data.

## What you produce (shapes: CLAUDE.md section 4, enforced by `app/src/data/schema.ts`)
| File | Rows | Source | Notes |
|---|---|---|---|
| `hikes.json` | 40 | NPS pages, OSM, Commons, by hand | id, name, park, trailhead and end (lat/lon), **NPS** length and gain, difficulty, permit/closure note, gear icons, photo + credit, `featured`, `station`, `aqi_county` |
| `hike_month.json` | 480 | IRMA, GHCN, EPA, computed | 12 months per hike: crowd, temperature percentiles, wet/snow/smoky/ozone/heat days, daylight, closure flag, `missing[]` |
| `advice.json` | 5 to 10 | `docs/ai-vs-data-check.md` | "Advice vs data" cards; the Glacier September card is the demo closer |
| `meta.json` | 1 | you (lane 2 adds `cost_sources`) | Source names, links, **as-of dates**, pipeline version, and `cost_sources` (where each cost input comes from; lane 2 fills it). Set `"fake": false` only when every file is real |

## Scripts (one per source, in `pipeline/`)
`hikes.py`, `nps_visits.py`, `ghcn.py`, `epa_aqi.py`, `daylight.py`, `build.py` (merges everything, including lane 2's files,
into `data/processed/`, then copies to `app/public/data/`), and `checks/` (pytest, run in CI).
Raw downloads are cached in `data/raw/` (git-ignored). Processed JSON is committed.

## How each factor is built (do not skip the traps)
- **Crowds**: NPS IRMA monthly recreation visits, park level. `crowd_level = month / the park's busiest month`, median over 2015-24
  without 2020. Say "park crowd level", not trail level. `crowd_band`: under 0.4 quiet, under 0.7 moderate, else busy.
- **Temperature, rain, snow, heat**: NOAA GHCN-Daily TMAX/PRCP/SNOW through the NCEI access API (no key). Nearest station within
  50 km with at least 80% of days present; else set `station: null`, `missing: ["temp","wet"]` and the values to `null`.
  `tmax_summit_est = tmax_p50 - 3.5 F per 1,000 ft` (label it "estimate"). Wet day = 0.1 in or more. **Do not use Open-Meteo for heat**
  (1.5 vs 13.0 days at or above 100 F at Zion).
- **Air quality**: EPA AirData daily AQI by county. A **smoky day** = AQI over 100 with **PM2.5** as the defining parameter; an
  **ozone day** is counted separately. AQI over 100 is not smoke (Mariposa August: 71 days over 100, only 33 smoke).
- **Daylight**: computed from lat/lon and date (`daylight_hr`, `sunrise`, `sunset` as local "HH:MM"). The fake script has a working formula.
- **Photos**: Wikimedia Commons only; Public domain, CC0, CC BY, CC BY-SA. Never Google Images or travel sites. Always store the credit.
  Make a contact sheet of candidates and choose by eye (see `pipeline/trail_kit/docs/START_HERE_NEW_TRAIL.md`). Save at 900 px into `app/public/photos/`.
- **Typical** = median over 2015-2024, 2020 excluded.

## Acceptance (CI must pass these; they live in `pipeline/checks/`)
- [ ] The eight known answers in `docs/ai-vs-data-check.md` reproduce exactly (Zion June 2023 = 564,036 visits = 12.20% of 4,623,238;
      Acadia Sep+Oct share 28.8% in 2010 and 30.5% in 2023; Glacier Jul/Aug/Sep 2023 = 722,535 / 652,866 / 553,565;
      Mariposa August 71 of 310 days over 100 with 33 PM2.5; Flathead August 4 then 38; Springdale 13.0 August days at or above 100 F;
      GSA $110 July and October; SEA-LAS Q3 2025 fare $169.78 is lane 2's).
- [ ] Monthly visits add up to the NPS annual total for 3 random parks.
- [ ] No typical value uses 2020.
- [ ] Every hike has a station within 50 km, or a `missing` flag and a null station.
- [ ] Every photo licence is allowed.
- [ ] `npm run validate:data` passes on your output (run from `app/`).
- [ ] `meta.json` lists each source with a link and an as-of date.

## Order of work and hand-off
1. Hike list frozen, `hikes.json` with NPS lengths and trailheads, photos (needed by everyone: do it first).
2. `nps_visits.py` then `ghcn.py` (G2: real crowds and weather on the live map by Fri 20 Nov).
3. `epa_aqi.py`, `daylight.py`, `advice.json`, checks.
4. Hand your files to the app by opening a PR that replaces `app/public/data/<file>.json`. If lane 2's files are still fake, `build.py`
   keeps their fake rows (same hike ids) so the app never breaks.

## Do not
Change a data shape (contract PR), edit `app/` code (ask lane 3 or 4), commit `data/raw/`, or commit a key.
