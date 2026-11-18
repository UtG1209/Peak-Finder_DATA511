# Peak Finder — project context for Claude Code

DATA 511 (Data Visualization), UW MSDS, Autumn 2026. Team "Peak Finder": Utkarsh Anshu Gupta (lead), Niru A,
Vanshika Nehra, Adnan Kalim. Read this file fully before writing code. The long-form plan is
`docs/implementation-plan.pdf`; where this file and the PDF disagree, **this file wins** (it includes the
paper-prototype decisions made after the PDF).

## 1. What we are building

One static web app that helps a hiker answer three questions in order:
**Where** should I hike, **When** (which quarter), and **How much** will it cost.

- About 50 named hikes/peaks in lower-48 US national parks (one signature hike per park, two in the biggest).
- Built only from free, public, *past* data (2015–2024, 2020 excluded for Covid). We show **typical** values,
  never forecasts or price quotes.
- Three featured hikes already have a finished scroll-driven 3D trail walk (MapLibre terrain) with a
  four-season toggle: **Angels Landing** (Zion), **Bright Angel Trail, rim to Phantom Ranch** (Grand Canyon),
  **Cascade Pass to Sahale Glacier** (North Cascades).
- North star: a first-time user picks a hike and a quarter in under 3 minutes and can say why it fits
  ("cooler than my limit, few smoke days, about $640").
- Pitch line: "Is the travel advice still true?" We check common advice against official data
  (see `docs/ai-vs-data-check.md`).

## 2. Screens (final, after the paper prototype — see `docs/paper-prototype/`)

### Explore (one screen; there is no separate landing page)
- **Left rail**
  - "Peak Finder" title.
  - Home city: a **dropdown of 10 cities** (not free text; we only have travel/cost data for these):
    Seattle (SEA), San Francisco (SFO), Los Angeles (LAX), Phoenix (PHX), Denver (DEN), Dallas/Fort Worth (DFW),
    Chicago (ORD), Atlanta (ATL), New York (NYC), Washington DC (DCA). Plus "Skip".
  - Quarter chips Q1–Q4 with months under them (Q1 Jan–Mar …). Default = next quarter.
  - Filters, all starting wide open so the map is never empty on arrival, labelled in real units:
    - Temperature: two-handle range for typical daytime high, °F.
    - Crowds: max level (Quiet / Moderate / Busy / Any).
    - Air quality: max smoky days in the quarter.
    - Rain: max wet days in the quarter.
    - Max travel time: hours door to trailhead (greyed with "Pick a home city to use this" when no city).
    - Difficulty chips (Easy / Moderate / Hard) and a "Has 3D walk" switch.
    - Each slider shows a tiny histogram of how many hikes sit at each value.
  - **Ranked list** of matching peaks with match % (replaces the paper's "Filtered parks" chips; it is also
    the screen-reader version of the map).
  - "Reset filters" link.
- **Map** ("Click on a peak")
  - One bubble per hike at its trailhead. Bubble **area** = match %. A hike that fails a limit becomes a small
    hollow grey dot (never disappears). Featured 3D hikes get a thin outer ring. Home city is a marker.
  - Legend: "Fits your filters" / "Filtered out".
  - Controls: + / −, "Zoom to results", "Whole US".
  - Hover a bubble or list row → card: photo, name, park, match %, three reasons in words
    ("Typical high 68°F · 1 smoky day · 4.5 h away"), typical cost. Hover one highlights the other.
  - Click → zoom to the hike, then open the hike page.
  - Changing quarter: bubbles resize (~400 ms) and the list re-sorts with a slide.
- **"Not sure? Spin the wheel"** button opens the random picker: a wheel of the top 12 matching hikes,
  weighted by match %; lands, shows the card with Open / Spin again. Reduced motion → picks at once.
- **Empty state**: never blank. "No hike fits all your limits. Allowing Busy crowds adds 6." with a one-click fix.
- All state lives in the URL (`?from=SEA&q=3&temp=55-80&crowd=2&smoke=3&rain=10&travel=8&diff=easy,moderate&3d=1`),
  plus a Share link button. Back always works.

### Hike page (one scrolling page)
- **Header**: name, park, short description, **NPS** length and summit elevation (not the OSM-measured length),
  difficulty, gear icons, photo with Commons credit, "Walk it in 3D →" (featured only), "← Back to map".
- **Quarter chips with match %** for Q1–Q4, best quarter marked. The selected quarter comes from the map
  and changes *everything* on this page (fit, strip highlight, checkpoint daylight, cost focus).
  Under them: the breakdown for the chosen quarter, one bar per factor, typical value vs the user's limit.
- **Month by month** strip (12 columns): typical high, crowd level, smoky days, wet days, daylight hours.
  Cells outside the user's limits marked; the chosen quarter's three months framed.
- **On the trail — elevation profile with time** (the two-hump chart on the paper):
  - X = distance, Y = elevation, with axes and units. Out-and-back hikes show the climb and the return.
  - User sets a **start time** (default: 1 hour after sunrise in the chosen quarter's middle month).
  - Checkpoints C0…Cn (trailhead, named landmarks, summit/turnaround) are marked on the profile with the
    **clock time you reach each one going up and again coming back**.
  - A **time scrubber**: drag along the profile or a time slider; a hiker marker shows *where you are at that
    time*, with elapsed time, distance, elevation and the current stop photo.
  - **◀ Back / Forward ▶** buttons step checkpoint to checkpoint, in both directions of the hike
    (C0 → summit → C0 for out-and-back). Arrow keys do the same.
  - A daylight band (sunrise–sunset for the quarter) shows whether you finish before dark; if not, a warning
    in words.
- **What it costs** (stacked bars, not a pie — the pie on the orange sticky note was rejected):
  - Four bars Q1–Q4, each stacked: lodging, food, transport, activity (entry/permit), and a hatched 15% buffer on top.
  - Total on each bar; cheapest and best quarter labelled.
  - Controls: party size, nights, drive or fly (default = shorter door to trailhead).
  - Click a segment → popover with its line items and source.
  - Label: "Typical, from past data. Not a price quote."
- **Similar hikes** (later): three twin cards with one line each on why they are similar.

### 3D trail walk (featured hikes only)
- "Walk it in 3D" plays the cloud transition (clouds rush in, white-out, trail name, clouds part) and opens
  the existing walk page at `walks/<id>/index.html?season=<season>`.
- Season follows the quarter: Q1 winter, Q2 spring, Q3 summer, Q4 autumn. User can still switch.
- Checkpoint times from the hike page appear on the walk's bottom elevation strip.
- Back plays the clouds in reverse and returns to where the user came from, scrolled where they left it.

### About the data
Sources with links and as-of dates, how match % is computed (with a worked example), and the honest limits:
park-level crowds, county-level AQI, station-based weather, typical not quoted costs, illustrative season maps.

## 3. Rules every screen follows
1. Answer first, detail on demand (verdict before chart).
2. Show the work: every number has a source and definition one hover away.
3. Typical, not exact: the words "typical" / "past years" appear wherever a number does.
4. Never a dead end: no empty map or list; always the nearest misses and the one change that brings them back.
5. One control, one effect: quarter changes time; sliders change limits; city changes distance and cost.
6. Motion explains change; with `prefers-reduced-motion`, everything is instant or a fade.
7. Same words everywhere: Q1 = Jan–Mar = Winter on every screen, including the 3D walk.

Visual: one calm hue (teal) for match; amber/red only for hazards and always with an icon and words; never
red/green pairs. °F, miles, feet by default, with a metric toggle. Fonts: Archivo (headings), Inter (text),
same as the walks. Accessibility: contrast ≥ 4.5:1, full keyboard use, native inputs with spoken values,
alt text + Commons credit on photos.

States to handle on every screen: loading (skeletons), no home city, no match, missing data for a factor
(grey cell "No station within 50 km"; factor left out of match and the card says so), hike without 3D walk
(no button, no promise), data failed to load (one line + Retry + link to About).

## 4. Data files the app reads (`app/public/data/`, produced by `pipeline/`, committed)

Total except profiles < 1 MB. The app never calls a live API.

```jsonc
// Example values are illustrative, not pipeline output.
// hikes.json — about 50
{ "id": "angels-landing", "name": "Angels Landing", "park_code": "ZION", "park_name": "Zion National Park",
  "state": "UT", "trailhead": {"name": "The Grotto", "lat": 37.25897, "lon": -112.95097},
  "end": {"name": "Summit", "lat": 37.26931, "lon": -112.94792},
  "length_mi": 5.4, "length_type": "round-trip", "gain_ft": 1500, "max_elev_ft": 5790,
  "route_type": "out-and-back", "difficulty": "hard", "nps_url": "https://www.nps.gov/...",
  "description": "…", "permit_note": "Permit lottery", "closure_note": null,
  "gear": ["chains", "exposure", "no-shade"],
  "photo": {"file": "…jpg", "author": "…", "license": "CC BY-SA 2.0", "license_url": "…", "page": "…"},
  "featured": true, "walk_path": "walks/angels_landing/",
  "station": {"id": "USC00429717", "name": "Zion National Park", "dist_km": 5.0, "elev_ft": 4050},
  "aqi_county": {"fips": "49053", "name": "Washington County, UT"} }

// hike_month.json — about 600 (hike × 12)
{ "hike_id": "angels-landing", "month": 8, "crowd_level": 0.92, "crowd_band": "busy",
  "tmax_p25": 95.1, "tmax_p50": 97.9, "tmax_p75": 100.4, "tmax_summit_est": 92.6,
  "wet_days": 3.1, "snow_days": 0, "smoky_days": 0.4, "ozone_days": 1.2, "heat_days": 13.0,
  "daylight_hr": 13.4, "sunrise": "06:38", "sunset": "20:05", "closed": false, "missing": [] }

// travel.json — hike × 10 cities
{ "hike_id": "angels-landing", "city": "SEA", "drive_hr": 15.6, "drive_mi": 1060,
  "airport": "LAS", "fly_drive_hr": 6.4, "default_mode": "fly" }

// cost.json — hike × city × quarter: unit inputs, so the browser can apply party size / nights live
{ "hike_id": "angels-landing", "city": "SEA", "quarter": 3,
  "fare_one_way": 169.78, "car_per_day": 60, "drive_mi": 1060, "gas_per_gal": 4.10, "mpg": 25,
  "lodging_per_night": 110, "meals_per_day": 68, "entry_fee_vehicle": 35, "permit_fee": 6,
  "sources": {"fare": "DOT Table 6, Q3 2025", "lodging": "GSA FY2026", "gas": "EIA West Coast", "fees": "NPS"} }

// profiles/<id>.json — one per hike (not in the 1 MB budget)
{ "hike_id": "angels-landing", "step_m": 10, "points": [[0, 1304], [10, 1305]],   // [dist_m, elev_m]
  "osm_length_m": 3307, "nps_length_m": 4345, "scale": 1.314,
  "checkpoints": [{"id": "c0", "name": "The Grotto", "dist_m": 0, "photo": "…"}] }

// advice.json — 5 to 10 "Advice vs data" cards
{ "hike_id": "glacier-highline", "claim": "Go in September for quiet", "finding": "…",
  "numbers": {"2010": 0.446, "2023": 0.766}, "source": "NPS IRMA", "url": "…" }

// meta.json — source names, links, as-of dates, pipeline version
```

Agree these shapes with the team before changing them; the app and pipeline are built against them in parallel.

## 5. Models (pure functions in `app/src/models/`, each with Vitest tests)

**Match %** (per hike, quarter, user limits). A factor's quarter value = mean of its three monthly medians
(sum for day counts). Each active factor scores 1 inside the limit and falls linearly to 0 at its tolerance:
`match = 100 × mean_f max(0, 1 − distance_past_limit_f / tolerance_f)`. Sliders on "Any" are not counted;
factors with missing data are left out and listed.
Tolerances: temperature 10°F outside the band; crowds 2 levels (1 level = 0.5); smoky days 5; wet days 10;
travel 2 h. Any factor at 0 → hollow grey dot but keeps its number. Best quarter = highest match, tie → cheaper.
Test case: Angels Landing, Q3, limit 60–85°F → temperature scores ≈ 0 → grey.

**Checkpoint times** (Tobler): speed on each 10 m step `v = 6·exp(−3.5·|S + 0.05|)` km/h, S = rise/run.
Scale distances by `nps_length_m / osm_length_m` (OSM shortens switchbacks: 3.3 km vs ~4.3 km at Angels
Landing). +10 min stop at each checkpoint. Out-and-back: run the profile backwards for the return.
Functions needed: `timeline(profile, startTime) → [{checkpoint, dir: "up"|"down", time}]`,
`positionAt(timeline, t) → {dist, elev, dir, nextCheckpoint}`, `finishTime`, `beforeDark(sunset)`.
Validate the totals against NPS time estimates for 5 hikes; if far off, apply one global correction factor
and note it on the About page.

**Trip cost** (per hike, city, quarter, party size, nights, mode):
- Fly: fare × 2 × travellers + car_per_day × (nights + 1).
- Drive: drive_mi × 2 ÷ mpg × gas × vehicles (vehicles = ceil(travellers / 4)).
- Lodging: lodging_per_night × nights × rooms (rooms = ceil(travellers / 2)) × 1.12 tax.
- Food: meals_per_day × (nights + 0.5) × travellers.
- Activity: entry fee per vehicle (cap at the $80 annual pass) + permits.
- Buffer: 15% of the sum.

**Hike twins** (later): z-score length, gain, top elevation and 12 monthly highs; 3 nearest, ≥1 from another park.

## 6. Data sources and known traps

| Factor | Source | Join | Notes |
|---|---|---|---|
| Crowds | NPS Visitor Use Statistics (IRMA), monthly recreation visits | park | crowd_level = month ÷ park's busiest month (median over years). Park level, not trail level — say so. |
| Temp, rain, snow, heat | NOAA GHCN-Daily TMAX/PRCP/SNOW (NCEI access API, no key) | nearest station ≤ 50 km with ≥ 80% days present | **Do not use Open-Meteo for heat** (1.5 vs 13.0 days ≥100°F at Zion). Summit estimate: −3.5°F per 1,000 ft, labelled "estimate". Wet day ≥ 0.1 in. |
| Air quality | EPA AirData daily AQI by county | trailhead county | Smoky day = AQI > 100 with PM2.5 as defining parameter; ozone day separate. AQI>100 ≠ smoke. |
| Travel | OpenRouteService matrix (key in `.env`, pipeline only) + DOT Table 6 airports | hike × city | |
| Cost | DOT Table 6 (Socrata, no key), GSA per diem, EIA gas, NPS fees | hike × city × quarter | GSA lodging varies by month at only 18 of 51 parks; elsewhere flat. |
| Daylight | computed from lat/lon + date | hike × month | |
| Profile | trail kit s1–s3 (OSM + AWS Terrarium tiles) | hike | Data hosts may be blocked in sandboxes; run on a laptop or use the kit's browser fallback. |
| Photos | Wikimedia Commons only | hike | Public domain, CC0, CC BY, CC BY-SA only. Never Google Images or travel sites. Always credit. |

Checks that must pass before data reaches the app (`pipeline/checks/`, run in CI):
- The known answers in `docs/ai-vs-data-check.md` reproduce exactly (e.g. Zion June 2023 = 564,036 visits;
  Glacier Jul/Aug/Sep 2023 = 722,535 / 652,866 / 553,565; Springdale 13.0 August days ≥100°F 2015–24).
- Monthly visits add up to the NPS annual totals for 3 random parks.
- No typical value uses 2020.
- Every hike has a station within 50 km or a `missing` flag.
- Profile length within 15% of NPS, else scale.
- Every photo licence is allowed.

## 7. Tech stack and repo layout

- Pipeline: Python 3.13, pandas, requests; raw downloads cached in `data/raw/` (gitignored).
- App: React + Vite + TypeScript. Map: MapLibre GL JS (US states outline as a vector layer; no API keys,
  no tile services that need keys). Charts: D3 scales/shapes rendered as React SVG. Motion: Framer Motion.
- Tests: Vitest for models; Playwright smoke test for pages.
- Hosting: GitHub Pages via GitHub Actions on push to `main`; walks served from the same site.
- Performance: first screen < 2 s; app code + data < 1.5 MB; photos lazy-loaded at 900 px; walks only on request.

```
pipeline/            one script per source: hikes.py, nps_visits.py, ghcn.py, epa_aqi.py, travel.py, cost.py,
                     daylight.py, profiles.py, build.py ; checks/ ; trail_kit/ (s1–s6 from the kit)
data/raw/            download cache (gitignored)
data/processed/      outputs before copy to the app
app/                 Vite app: src/screens/ (Explore, Hike, About), src/components/, src/models/, src/data/,
                     public/data/*.json, public/data/profiles/
walks/<id>/          finished trail-walk sites copied from the kit output (angels_landing, grand_canyon,
                     north_cascades); copied into the Pages build
docs/                plan PDF, paper prototype photos, data notes, trail kit docs
.github/workflows/   ci.yml (lint, tests, pipeline checks), deploy.yml (Pages)
```

## 8. Trail kit notes (when touching walks or profiles)
- Kit docs (in `pipeline/trail_kit/docs/` once copied): `START_HERE_NEW_TRAIL.md`, `NEW_TRAIL_RUNBOOK.md`,
  `LESSONS_LEARNED.md`, `BUILD_LOG.md`. Read them before running the kit.
- Never re-run s2/s3 on a finished trail; rebuild from its cache (a fresh download can change the route).
- Walk pages support `?season=winter|spring|summer|autumn`. Camera settings are per trail; don't copy them.
- The 511-file limit only applied to Claude artifacts; on GitHub Pages it no longer matters.
- Walk pages must keep their credits (USGS imagery, Mapzen/AWS terrain, © OpenStreetMap, each photo's Commons credit).

## 9. How to work in this repo
- Build in this order: (1) scaffold + fake data in the exact shapes above + deploy; (2) models + tests;
  (3) Explore screen on fake data; (4) Hike page (profile/time, cost); (5) pipeline scripts replacing fake data
  source by source; (6) walks + cloud transition; (7) About, states, accessibility; (8) "Should" items.
- `scripts/make_fake_data.py` (or `.ts`) generates plausible fake data for ~50 hikes so the UI can be built
  before the pipeline is done. Fake data must be clearly marked in `meta.json` (`"fake": true`) and shown
  as a banner in the app.
- Small PRs, one feature each, into `main`; CI must pass. Never commit API keys (`.env` is gitignored).
- Ask before changing the data shapes, the screen list, or anything in section 3.
- Not in scope: crowds by hour, review scraping, login, Amtrak, pie charts.
