# Peak Finder — project context for Claude Code

DATA 511 (Data Visualization), UW MSDS, Autumn 2026. Team "Peak Finder": Utkarsh Anshu Gupta, Niru A,
Vanshika Nehra, Adnan Kalim. Read this file fully before writing code. The long-form plan is
`docs/implementation-plan.pdf`; where this file and the PDF disagree, **this file wins** (it includes the
paper-prototype decisions made after the PDF).

## 0. Start here (agents: read this block first, then the section for your task)

**State of the repo.** The app runs end to end on **fake data** where real data is not in yet, so `meta.json` keeps `"fake": true` and a "Work in progress" banner shows until every file is real. Real now: lane 1 data (`hikes.json`, `hike_month.json`, `advice.json`; every hike field is sourced, the source per field is in `pipeline/catalogue/hikes_coverage.csv`), travel for all hikes (ORS drive times, DOT airports), and for the 15 priority hikes in `pipeline/catalogue/priority_hikes.csv` also cost (DOT fares, GSA lodging and meals, EIA gas, NPS fees) and profiles. Still fake: cost rows and profiles of the other hikes, and the placeholder fields in `docs/work/follow-ups.md`. `scripts/make_fake_data.py` leaves real files alone.
Built: data contract (zod schemas) and loaders, the three models with tests, Explore (guided start with a blurred map until "Show hikes",
difficulty colours, filters, ranked list, hover card, dark and light themes with design tokens in `app/src/styles/`, opt-in lazy **3D view** with linked dashboard in `app/src/screens/Explore/view3d/`), Explore restyle (ruled rail, photo-first tile, animated list re-sort, designed empty state, home city marker, hover linking between map and list, "Spin the wheel" dialog, Share link and metric toggle in the rail tools, Back returns to the same map view), canvas map and 3D scene that follow the theme live (`MapBoundary` keeps Explore usable without WebGL), Hike page, redesigned to the v2 design (hero with answer sentence and stat tiles, sticky linked selection bar, quarter cards over one month chart, Advice vs data with a chart, timed elevation profile with scrubber, stop card, checkpoint table and daylight band, cost bars with direct labels, keyboard use and a what-if panel), About page (sources, worked match example, costs, times, honest limits), the three 3D walks in `walks/`, CI and
GitHub Pages deploy, setup tooling, the phone and tablet layout (bottom sheet for the ranked list, filters sheet, 3D desktop-only) and the axe, keyboard and layout browser tests. Also built: the cloud transition for "Walk it in 3D" (`components/CloudTransition.tsx`, timings in `lib/cloudSchedule.ts`, reverse on return with the scroll position kept by `lib/walkReturn.ts`) and Similar hikes (`models/twins.ts`, `screens/Hike/SimilarHikes.tsx`). Also built: 3D walks for 16 hikes (the original three plus Mount Washburn, Fairy Falls, Grinnell, Highline, and Plan 3's Half Dome, Delicate Arch, Mesa Arch, Navajo Loop, Skyline, Cadillac North Ridge, Inspiration Point, Alum Cave, Ryan Mountain; loop walks use `route_via` in the kit config, configs are made by `pipeline/walks/make_config.py` from `pipeline/walks/specs/`). Not built yet: real cost and profile data for the hikes outside the priority 15, walks for the Tier C hikes (Longs Peak, Emerald Lake, General Sherman, Moro Rock, Clingmans Dome; they wait for real hike data). What is left is listed in `docs/work/follow-ups.md`.

**Which lane are you in?** The work is split in four independent lanes, each with a brief. If the user has not said, ask which one they own, then read
only that brief and stay in its files.

| Lane | Brief | Owns |
|---|---|---|
| 1 Data core | `docs/work/lane-1-data-core.md` | hikes catalogue, crowds, weather, air quality, daylight, checks |
| 2 Travel, cost, walks | `docs/work/lane-2-travel-cost-walks.md` | travel, cost, elevation profiles, 3D walks, cloud transition |
| 3 Explore | `docs/work/lane-3-explore.md` | Explore screen, map, filters, wheel, `models/match.ts` |
| 4 Hike page and About | `docs/work/lane-4-hike-page-about.md` | Hike page, About, charts, `models/checkpoints.ts` and `cost.ts`, user testing |
| Design track | `docs/work/design-track.md` | UI polish with Claude Design: type scale, tokens, mobile, the Back button on the 3D walk |

**Final scope (decided 2026-11-24): 23 hikes** (nothing built is cut; list in `docs/work/final-23/final_hikes.csv`). Four pickup plans (plus Plan 5, the hike page redesign), start at `docs/work/final-23/README.md`.

Overview and working rules: `docs/work/README.md`. Setup and commands: `docs/SETUP.md`. Open decisions and defaults we chose: `docs/DECISIONS.md`.
API keys (pipeline only, none needed to run the app): `docs/CREDENTIALS.md`.

**Commands (repo root).** `npm run doctor` (check your machine), `npm run setup`, `npm run dev`, `npm run check` (CLAUDE.md check, design-rule guard, lint, tests, build, performance budget: run it
before every PR), `npm run design:check` (only the guard: `scripts/check-design-rules.mjs` fails on a raw hex colour or a glyph icon such as an arrow, cross, check or minus in `app/src` TypeScript; use tokens and `Icon`), `npm run validate:data` (check data against the shapes), `npm run fake-data` (regenerate placeholder data), `npm run verify:final` (final-goal data checks for the 23 hikes, `scripts/verify-final-23.mjs`), `npm run e2e` (real-browser smoke test of the production build under the Pages base path, plus axe accessibility, keyboard-only, reduced-motion and phone-layout specs: run it after touching the map, CSS or routing).

**Hard rules for any agent.**
1. Do not change the data shapes (section 4), the screen list (section 2) or the UX rules (section 3) without the user's explicit approval. Shapes live in `app/src/data/schema.ts`.
2. Never hand-edit `app/public/data/*.json`: change `scripts/make_fake_data.py` or the pipeline.
3. Nothing from `walks/` may load on the first screen (CI enforces it); never re-run the trail kit's tile steps on a finished walk.
4. No secrets in git (`.env` is ignored). The browser app never calls an API.
5. Small PRs into `main`, one feature each, `npm run check` green.

**Keep this file true.** If your change alters a data shape, a screen, a rule, a command, the repo layout or the "State of the repo" above, **update CLAUDE.md in the same PR**.
CI runs `scripts/check-claude-md.mjs` (section 4 fields match `schema.ts`, referenced files exist, `npm run` commands exist, required sections present) and fails if this file drifts.

## 1. What we are building

One static web app that helps a hiker answer three questions in order:
**Where** should I hike, **When** (which quarter), and **How much** will it cost.

- **The 23 final hikes/peaks in lower-48 US national parks (the 40 most famous that also have complete data was the first plan; scope is now `docs/work/final-23/final_hikes.csv`)** (famous first, then kept only if
  they pass the data-completeness gate in section 6: weather station within 50 km, county AQI monitor, NPS monthly visits, NPS page,
  OSM trail line, open-licence photo).
- Built only from free, public, _past_ data (2015–2024, 2020 excluded for Covid). We show **typical** values,
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

- **Guided start (the "web navigator")**: on arrival the **map is blurred** and a card says what to do next in three steps
  (1 home city or skip, 2 quarter, 3 limits), with a **Show hikes** button. Pressing it (`go=1` in the URL) unblurs the map and shows
  the peaks, the filtered-out markers, the legend, the hike card and a short "What next?" tip. Every limit starts wide open, and any step can be skipped.
- **Left rail** (a ruled form; the steps are numbered only in the guide, there is no Beta badge)
  - "Peak Finder" wordmark and the theme toggle.
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
  - One flat peak (triangle) marker per hike at its trailhead (trailheads that sit within a few pixels are nudged apart at each zoom for display only; data coordinates never change; the hover/selected highlight is an outline ring). Marker **size** (area) = match %, **colour** = difficulty (Easy light teal,
    Moderate gold, Hard violet; always also in words). A hike that fails a limit becomes a small
    hollow grey dot (never disappears). Featured 3D hikes get a thin outer ring. Home city is a marker.
  - Legend: the three difficulty colours, "Filtered out", "3D walk ready".
  - Controls: + / −, "Zoom to results", "Whole US".
  - Hover a peak or list row → card: photo, name, park, match %, three reasons in words
    ("Typical high 68°F · 1 smoky day · 4.5 h away"), typical cost. Hover one highlights the other.
  - Click a peak (or a list row) → zoom to the hike and keep its photo tile open (`pick=<id>` in the URL, so Back returns to it). The hike page opens only from the tile's **Open this hike** button.
  - Changing quarter: peaks resize (~400 ms) and the list re-sorts with a slide.
- **3D view (opt-in, approved, vanilla three.js)**: a small "2D map | 3D view" toggle in the map pane (hidden below 860 px; disabled with the words
  "3D view needs WebGL" when WebGL is missing). `view=3d` in the URL; the 2D map is the default and the fallback. The lower 48 are thin extruded shapes, one cone per hike
  (colour = difficulty, height = match %, short dark grey = filtered out, thin ring = 3D walk ready), orbit / zoom / pan, rendered on demand only (no auto-rotate; damping off with reduced motion).
  It gets the same `rows` as the map (no forked `evaluate()`), hover and click use the same tile and `pick` flow, and switching keeps filters, `go` and `pick`.
  Under the scene a dashboard shows the shown hike's match by quarter and crowds + smoky days by month. three.js is its own lazy chunk (<= 250 KB gzip, CI-enforced) fetched only after the user switches to 3D.
- **"Not sure? Spin the wheel"** button opens the random picker: a wheel of the top 12 matching hikes,
  weighted by match %; lands, shows the card with Open / Spin again. Reduced motion → picks at once.
- **Empty state**: never blank. "No hike fits all your limits. Allowing Busy crowds adds 6." with a one-click fix.
- All state lives in the URL (`?from=SEA&q=3&temp=55-80&crowd=2&smoke=3&rain=10&travel=8&diff=easy,moderate&3d=1&units=metric&go=1&pick=angels-landing&view=3d`; `view=3d` only when the 3D view is on),
  plus a Share link button (it copies the link with `go=1`, so it opens unblurred). `units=metric` switches °F/mi/ft to °C/km/m on the card, list and sliders. Back always works.

### Hike page (one scrolling page)

- **Header**: name, park, then **one answer sentence** (`models/headline.ts`: one winner "Q4 fits 91%: …", a tie "Q1, Q2 and Q4 fit your limits. Q4 is the cheapest…", or "No limits set…"; never "100%" as a headline), short description, **NPS** length and summit elevation (not the OSM-measured length),
  difficulty, gear icons, photo with Commons credit, "Walk it in 3D →" (featured only), "← Back to map".
- **Hero tiles and a sticky "Your selection" bar** (design v2, `docs/design/hike-page/`): under the answer sentence, three ruled tiles (Best quarter, Fits your limits, Typical trip); then a bar that stays on screen with the quarter (URL `q`), the month and the checkpoint. One selection drives every block (`screens/Hike/selectionContext.ts`).
- **When**: four quarter cards (match %, one "why" line in words, best marked, a quarter past a limit drawn muted) aligned over **one month chart drawn to scale**: typical high with its middle half against the user's limit band, crowds, smoky days, wet days, daylight; the chosen quarter framed, the picked month highlighted across all rows; hazards (heat, snow) as amber chips with words; "Show as table" for the same numbers. Arrow keys step months.
- **Advice vs data**: the claim, what the data says, a two-bar chart when the numbers are comparable, the source; steps through the hike's cards.
- **On the trail — elevation profile with time** (the two-hump chart on the paper):
  - X = distance, Y = elevation, with axes and units. Out-and-back hikes show the climb and the return.
  - User sets a **start time** (default: 1 hour after sunrise in the chosen quarter's middle month).
  - Checkpoints C0…Cn (trailhead, named landmarks, summit/turnaround) are marked on the profile with the
    **clock time you reach each one going up and again coming back**.
  - A **time scrubber**: drag along the profile or a time slider; a hiker marker shows _where you are at that
    time_, with elapsed time, distance, elevation and the current stop photo.
  - **◀ Back / Forward ▶** buttons step checkpoint to checkpoint, in both directions of the hike
    (C0 → summit → C0 for out-and-back). Arrow keys do the same.
  - A daylight band (sunrise–sunset for the quarter) shows whether you finish before dark; if not, a warning
    in words.
- **What it costs** (stacked bars, not a pie — the pie on the orange sticky note was rejected):
  - Four bars Q1–Q4, each stacked: lodging, food, transport, activity (entry/permit), and a hatched 15% buffer on top.
  - Total on each bar; cheapest and best quarter labelled.
  - Controls: home city, party size, nights, drive or fly (default = shorter door to trailhead), with live "what if" lines (one more night, drive instead, more travellers) from `lib/costWhatIf.ts`.
  - Click a segment → popover with its line items and source. The selected bar is labelled directly (no detached legend), quarter labels and segments are keyboard buttons, and Esc closes the popover.
  - Label: "Typical, from past data. Not a price quote."
- **Similar hikes** (`models/twins.ts`, `SimilarHikes.tsx`): three photo-first twin cards, each linking to that hike's page, with one line on why they are similar (z-scores of length, gain, top elevation and the 12 monthly highs; at least one from another park).

### 3D trail walk (featured hikes only)

- "Walk it in 3D" plays the cloud transition (clouds rush in, white-out, trail name, clouds part) and opens
  the existing walk page at `walks/<id>/index.html?season=<season>`.
- Season follows the quarter: Q1 winter, Q2 spring, Q3 summer, Q4 autumn. User can still switch.
- Checkpoint times from the hike page appear on the walk's bottom elevation strip.
- Back plays the clouds in reverse and returns to where the user came from, scrolled where they left it (the hike page saves its scroll in sessionStorage before leaving; the walk files are not touched, so the browser Back button is the way back). With reduced motion the transition is a short fade.

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

Visual (decided 2026-11-19, `docs/DECISIONS.md`): Claude's design language as the base (warm cream canvas, warm dark surfaces, editorial serif display), the photo-first tile idea from Airbnb,
and the dense editorial data rules from Wired. **Two themes, dark and light**: the system setting by default, a manual toggle (`app/src/components/ThemeToggle.tsx`) stored in localStorage; `data-theme` on `<html>`
(`app/src/lib/theme.ts`, set by an inline script in `app/index.html` before first paint). **All colours, type sizes, spacing, radii and motion are tokens in `app/src/styles/tokens.css`**
(structure and rules: `app/src/styles/README.md`); no raw hex outside it and `app/src/lib/difficulty.ts`. ONE accent, terracotta (`--accent`, about `#cc785c` on dark, a darker variant on light so text and buttons keep 4.5:1).
Marker colour = difficulty (Easy light teal, Moderate gold, Hard violet, desaturated and retuned per theme in `DIFFICULTY_BY_THEME`, equal to the `--diff-*` tokens; a test enforces it), size = match %.
Amber/red only for hazards and always with an icon and words; never red/green pairs. °F, miles, feet by default, with a metric toggle. Fonts, self-hosted (`app/src/styles/fonts/`, latin, no Google request):
Fraunces (display headings), Inter (text), Archivo condensed with tabular figures (big numbers); metric-matched fallbacks avoid layout shift. Icons: `app/src/components/Icon.tsx` (inline SVG, no glyph characters).
Accessibility: contrast >= 4.5:1 (tested for both themes in `app/src/lib/contrast.test.ts`), full keyboard use, native inputs with spoken values, alt text + Commons credit on photos.

States to handle on every screen: loading (skeletons), no home city, no match, missing data for a factor
(grey cell "No station within 50 km"; factor left out of match and the card says so), hike without 3D walk
(no button, no promise), data failed to load (one line + Retry + link to About).

## 4. Data files the app reads (`app/public/data/`, produced by `pipeline/`, committed)

Total except profiles < 1 MB. The app never calls a live API.

```jsonc
// Example values are illustrative, not pipeline output.
// hikes.json — 23
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

// hike_month.json — 276 (hike × 12)
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
  "lodging_per_night": 110, "meals_per_day": 68, "entry_fee_vehicle": 35, "permit_fee": 6 }
// (sources are NOT repeated on every row: they live once in meta.json "cost_sources", see below)

// profiles/<id>.json — one per hike (not in the 1 MB budget)
{ "hike_id": "angels-landing", "step_m": 10, "points": [[0, 1304], [10, 1305]],   // [dist_m, elev_m]
  "osm_length_m": 3307, "nps_length_m": 4345, "scale": 1.314,
  "checkpoints": [{"id": "c0", "name": "The Grotto", "dist_m": 0, "photo": "…"}] }

// advice.json — 5 to 10 "Advice vs data" cards
{ "hike_id": "glacier-highline", "claim": "Go in September for quiet", "finding": "…",
  "numbers": {"2010": 0.446, "2023": 0.766}, "source": "NPS IRMA", "url": "…" }

// meta.json — source names, links, as-of dates, pipeline version, and where each cost input comes from
{ "fake": false, "pipeline_version": "1.0.0", "generated": "2026-11-20",
  "sources": [{"name": "NOAA GHCN-Daily", "url": "…", "as_of": "2026-11-12"}],
  "cost_sources": {                       // keys: fare, lodging, gas, fees, assumed
    "fare": {"label": "DOT Consumer Airfare Report, Table 6", "detail": "Average one-way fare, Q3 2025", "url": "…"},
    "lodging": {"label": "GSA per diem, FY2026", "detail": "…", "url": "…"},
    "gas": {"label": "EIA regional gasoline price", "detail": "…", "url": "…"},
    "fees": {"label": "NPS entrance and permit fees", "detail": "…", "url": "…"},
    "assumed": {"label": "Team assumption", "detail": "Rental car $60 a day", "url": ""} } }
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
Real profiles are noisy, so elevations are smoothed over ~50 m and slope is capped at ±0.6 before Tobler (a single 4:1 spike would add days).
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

| Factor                 | Source                                                                        | Join                                            | Notes                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crowds                 | NPS Visitor Use Statistics (IRMA), monthly recreation visits                  | park                                            | crowd_level = month ÷ park's busiest month (median over years). Park level, not trail level — say so.                                              |
| Temp, rain, snow, heat | NOAA GHCN-Daily TMAX/PRCP/SNOW (NCEI access API, no key)                      | nearest station ≤ 50 km with ≥ 80% days present | **Do not use Open-Meteo for heat** (1.5 vs 13.0 days ≥100°F at Zion). Summit estimate: −3.5°F per 1,000 ft, labelled "estimate". Wet day ≥ 0.1 in. |
| Air quality            | EPA AirData daily AQI by county                                               | trailhead county                                | Smoky day = AQI > 100 with PM2.5 as defining parameter; ozone day separate. AQI>100 ≠ smoke.                                                       |
| Travel                 | OpenRouteService matrix (key in `.env`, pipeline only) + DOT Table 6 airports | hike × city                                     |                                                                                                                                                    |
| Cost                   | DOT Table 6 (Socrata, no key), GSA per diem, EIA gas, NPS fees                | hike × city × quarter                           | GSA lodging varies by month at only 18 of 51 parks; elsewhere flat.                                                                                |
| Daylight               | computed from lat/lon + date                                                  | hike × month                                    |                                                                                                                                                    |
| Profile                | trail kit s1–s3 (OSM + AWS Terrarium tiles)                                   | hike                                            | Data hosts may be blocked in sandboxes; run on a laptop or use the kit's browser fallback.                                                         |
| Photos                 | Wikimedia Commons only                                                        | hike                                            | Public domain, CC0, CC BY, CC BY-SA only. Never Google Images or travel sites. Always credit.                                                      |

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
pipeline/            one script per source (lanes 1 and 2, to be written): hikes.py, nps_visits.py, ghcn.py, epa_aqi.py,
                     travel.py, cost.py, daylight.py, profiles.py, build.py ; checks/ ; requirements.txt ;
                     trail_kit/ (s1–s6 from the kit, present)
data/raw/            download cache (gitignored)
data/processed/      outputs before copy to the app
app/                 Vite app: src/screens/ (Explore, Hike, About), src/components/, src/models/, src/data/ (schema = the contract),
                     src/lib/ (URL filters, difficulty colours, theme, themeColors, flip, walks link), src/styles/ (tokens.css, base.css, explore.css, hike.css, about.css, map.css, view3d.css, index.css, fonts/),
                     public/data/*.json, public/data/profiles/
walks/<id>/          finished trail-walk sites (angels_landing, grand_canyon, north_cascades); served at /walks/<id>/, copied into the build,
                     loaded only when a walk is opened (~35 MB each as built, ~27 MB after lossless optimization; new walks must be <= 30 MB, see docs/DECISIONS.md)
scripts/             make_fake_data.py, check-budget.mjs, check-claude-md.mjs, doctor.sh
docs/                SETUP.md, DECISIONS.md, CREDENTIALS.md, work/ (the four lane briefs), plan PDF, paper prototype, reference/
.github/             workflows/ci.yml (lint, tests, build, budgets, CLAUDE.md check), deploy.yml (Pages), pull_request_template.md, CODEOWNERS
```

## 8. Trail kit notes (when touching walks or profiles)
- **Every walk is built the same way, with one command** (`docs/WALKS.md`): `python3 pipeline/walks/build_walk.py <trail> --hike-id <id>` prints the step plan, asks, runs the kit,
  verifies (structure, credits, four seasons, route vs the hike's NPS numbers, size <= 30 MB after lossless optimization), copies into `walks/`, updates `walks/manifest.json` (the single source of truth: `featured` and
  `walk_path` in app data come from it), writes the hike-page profile from the walk's own route and a `BUILD_REPORT.md` with a checklist to tick by hand. Re-check any time:
  `python3 pipeline/walks/build_walk.py --verify-all`. A walk not in the manifest does not exist for the app. Every walk needs a Back button to the hike page (`docs/work/design-track.md`).

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
- `scripts/make_fake_data.py` (or `.ts`) generates plausible fake data for the final 23 hikes so the UI can be built
  before the pipeline is done. Fake data must be clearly marked in `meta.json` (`"fake": true`) and shown
  as a banner in the app.
- Small PRs, one feature each, into `main`; CI must pass (`npm run check`). Never commit API keys (`.env` is gitignored).
- Update this file in the same PR as any change it describes (see "Keep this file true" in section 0).
- Ask before changing the data shapes, the screen list, or anything in section 3.
- Not in scope: crowds by hour, review scraping, login, Amtrak, pie charts.
