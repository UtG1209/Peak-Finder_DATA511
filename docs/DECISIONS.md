# Decisions made while building the base (please confirm or change)

These were open or ambiguous in `CLAUDE.md` / the plan PDF. The base was built with the defaults below so nobody is blocked.
Each is one small change if the team disagrees. Tick the box when confirmed.

## Modelling
- [ ] **Crowd scale.** `crowd_level` (0 to 1) is mapped to "levels" so one level is one band: 0 to 0.4 = Quiet (levels 0 to 1), 0.4 to 0.7 = Moderate (1 to 2),
      0.7 to 1 = Busy (2 to 3). A limit of Quiet / Moderate / Busy is 1 / 2 / 3. Tolerance = 2 levels past the limit. (`models/match.ts`, `crowdLevel`.)
      Worry: the plan says "2 levels (1 level = 0.5)", which reads as a different scale.
- [ ] **"Fits" vs "filtered out".** A hike is a grey hollow dot when **any active factor scores 0** (past its full tolerance), as in CLAUDE.md section 5.
      A hike slightly past a limit stays a coloured bubble, smaller. The count "N of 50 fit" counts non-grey hikes. The empty state says "No hike fits all your limits".
- [ ] **Hikes with missing data can rank first** (less likely now that the 40 are chosen for completeness, but a factor can still go missing in real data). A skipped factor is left out of the mean (spec), so a hike with no weather station and a temperature limit
      scores 100%. Proposal: add a "partial data" tag and sort such hikes after complete ones. Lane 3.
- [ ] **Tobler slope after scaling.** Distances are scaled by `nps_length_m / osm_length_m` before the slope is computed, so a longer official trail has gentler slopes.
- [ ] **Stops.** +10 min at every checkpoint except the trailhead at the start and the final arrival. `dir` is "up" for the outbound leg (even if it descends, e.g. Bright Angel)
      and "down" for the return. Loops and point-to-point routes have no return leg.
- [ ] **Cost details.** Entry fee = fee per vehicle x vehicles, **capped at $80 in total**; permit fee is **per party**; the 1.12 tax applies to lodging only; one rental car in
      "fly" mode regardless of party size; buffer = 15% of the sum.
- [ ] **Checkpoint `dist_m` is in profile (OSM) metres** (before scaling). `nps_length_m` is the one-way length for out-and-back hikes.

## Shapes (no shape was changed; these are the readings I used)
- [ ] `station` can be `null` and `hike_month` temperature, wet, snow, heat fields can be `null` when no station is within 50 km; `missing` then contains `"temp"` and `"wet"`.
- [ ] `route_type` is one of `out-and-back`, `loop`, `point-to-point`; `length_type` is `round-trip`, `loop` or `one-way`.
- [ ] `difficulty` is `easy`, `moderate` or `hard`. `gear` uses: chains, exposure, no-shade, steep, snow-gear, bear-spray, water-crossing, scramble, extra-water, headlamp, bug-spray.
- [x] **Cost sources moved to `meta.json`** (approved). `cost.json` rows no longer carry `sources`; `meta.cost_sources` holds fare, lodging, gas, fees and assumed once. Small files are about 585 KB.
- [ ] **Bundle size.** The app JS is about 1.4 MB raw (407 KB gzip), mostly MapLibre, plus a 550 KB map worker loaded separately. Budget says 1.5 MB app plus data; gzip is the honest number.

## Design and screens
- [x] **2026-11-19 Design direction (owner, final).** Base = Claude's design language (warm cream canvas, warm dark surfaces, terracotta accent, editorial serif display); the photo-first tile idea from Airbnb; the dense editorial data rules from Wired. This replaces the "dark sand-orange prototype" look below and **settles the accent: terracotta** (`--accent`, about `#cc785c` on dark, a darker variant on light for 4.5:1). Teal and sand-orange are retired.
- [x] **2026-11-19 Dark and light themes.** Both ship; the system setting decides by default, a manual toggle (stored in localStorage inside try/catch, optional) overrides. Tokens live in `app/src/styles/tokens.css`; difficulty colours are retuned per theme (`DIFFICULTY_BY_THEME`), desaturated, >= 3:1 on the map land and apart under deuteranopia/protanopia (test: contrast.test.ts). Canvas code (map markers, 3D scene, cost bars) migrates to per-theme values in the restyle that follows.
- [x] **2026-11-19 Fonts, self-hosted** (latin subset WOFF2, SIL OFL, no Google request): Fraunces for display headings, Inter for text, Archivo (condensed width, tabular figures) for big numbers; metric-matched fallbacks (`size-adjust`). Type scale 11/12/14/16/18/22/h1 and numbers 15/20/32.
- [x] **2026-11-19 3D view: approved with vanilla `three`** (not React Three Fiber); built, see `docs/work/design-track.md`.
- [x] **Guided start** (requested): the map is blurred until the user presses "Show hikes" (`go=1` in the URL); a card explains the three steps. This replaces "all filters start wide open so the map is never empty on arrival" with "wide open, but behind a short guide". Shared links include `go=1`, so they open unblurred.
- [x] **Difficulty colours** (requested): bubble colour = difficulty (Easy light teal, Moderate gold, Violet for Hard), size = match, hollow grey = filtered out. The label stays "Moderate" (the data value), not "Intermediate", so it matches CLAUDE.md. Colours are in `app/src/lib/difficulty.ts`.
- [x] **Look (superseded 2026-11-19 by the direction above)**: the dark, sand-orange look of the 29 Oct prototype (as requested), not the teal in CLAUDE.md section 3. One token (`--accent` in `app/src/styles/tokens.css`) switches it.
- [ ] **No landing page, no top-bar quarter slider, no "18 of 52" counter** (CLAUDE.md wins over the plan PDF). The counter "N of 50 hikes fit in Q4" is kept on the map as in the prototype.
- [ ] **Routing** uses `HashRouter` so deep links work on GitHub Pages without a 404 fallback: `https://.../#/?from=SEA&q=3` and `#/hike/angels-landing`. Filters live in the query part,
      with the parameter names from CLAUDE.md (not the prototype's `#q4-t50-85-...` hash).
- [ ] **US outline** is a static asset, `app/public/data/us-states.topo.json` (us-atlas, ISC licence, from US Census). Not one of the section 4 data files.
- [x] **Hike list = the 40 most famous hikes that also have complete data** (approved). Gate first (station within 50 km, AQI monitor, NPS visits, NPS page, OSM line, open photo), then fame. The fake list is a placeholder; lane 1 produces the real one.

## Process
- [ ] Models are split: lane 3 owns `match.ts`; lane 4 owns `checkpoints.ts` and `cost.ts`; shared files change only through a PR everyone sees.
- [ ] Contract changes need a PR labelled `contract` approved by all four.

## Walks: size and hosting (needs a team decision before lane 2 builds more)
- [ ] The 3 finished walks are **108 MB** (32 to 39 MB each). A visitor downloads only about **7 MB on opening and about 15 MB for a whole walk** (measured), so this is **not a speed problem**; it is a
      **storage and hosting** problem: GitHub Pages publishes at most **1 GB** per site, repos should stay under about 1 GB, and every rebuilt walk adds to git history for good.
- [x] **Quality-safe trimming is built** (`pipeline/walks/optimize_walk.py`, runs inside the walk build): elevation tiles to lossless WebP (pixel-exact), season overlays to lossless WebP, one shared copy of the
      cloud images. Measured on the real walks: Angels Landing 35.5 to 26.8 MB, Bright Angel 31.7 to 26.3 MB, Cascade Pass 38.7 to 31.0 MB (about 20% smaller). Proof it did not change what people see:
      every converted tile is checked against its original (elevation tiles 100% pixel-exact), and the same screens rendered from the original and the optimized walk are identical
      (3 of 4 compared screens 100% identical pixels; the 4th 98.5% identical with a maximum difference of 1/255, SSIM 0.99996: render noise).
- [x] **What was tried and rejected for quality:** pruning tiles far from the route (a 2844 px-wide window requests terrain up to 11 km away, so pruning lowers quality on big screens); re-encoding the
      imagery or photos (no gain, or small gain with extra JPEG loss); lossy season overlays (q95 is visually identical at 48 dB but only 15% smaller than lossless, so it is off by default: `--season-lossy`).
- [ ] **The honest numbers:** a 15 MB walk is not reachable without lowering quality. New walks get a budget of **30 MB after optimization, aim for 25** (manifest `size_budget_mb`).
      40 walks at about 27 MB is about **1.1 GB: it does not fit on one Pages site.** Options: (a) a separate walks repo (its own Pages site, `VITE_WALKS_BASE` already supported), split in two if needed;
      (b) fewer walks (about 25 fit on one site with the app); (c) object storage/CDN (R2, S3) for walks. Recommendation: (a), starting with the optimized copies of the three walks.
- [ ] **Do not commit optimized copies of the 3 existing walks to this repo**: they are already in history, so it would add about 85 MB to every clone to save about 22 MB per deploy.
      The optimized copies are in `Peak-Finder-walks-optimized/` next to the repo, ready to be the first commit of the walks repo.
- [ ] Everyone clones the walks with the repo. If clone size becomes a problem: `git clone --filter=blob:none` and sparse-checkout.
- [x] **Walks never load on the first screen.** The app only builds a link; the walk page and its tiles are fetched when someone opens it. `scripts/check-budget.mjs` fails CI if the entry
      or Explore chunk ever references `walks/`.

## Time model on real data
- [ ] Real DEM profiles are noisy (the Angels Landing walk had a 4:1 slope in one 10 m step, which Tobler turned into 90 hours). The checkpoint model now smooths elevation over about 50 m and caps
      slope at ±0.6 (`MAX_SLOPE`, `SMOOTH_WINDOW_M` in `models/checkpoints.ts`). With real routes it gives Angels Landing 4.6 h, Bright Angel 11.7 h, Cascade Pass 8.7 h round trip. Lane 4 validates against NPS times for 5 hikes.
- [x] Walks are built by one verified process (`docs/WALKS.md`); `walks/manifest.json` is the single source of truth for `featured` and `walk_path`.

## Design pass, wave 1 (done)
- [x] Shape marks on the peaks (one band for moderate, two for hard) as colour-blind redundancy: **deferred** to a follow-up, because they touch the map, legend and list together. Colours are already tested to stay distinguishable under deuteranopia and protanopia.
- [x] Canvas code reads colours through `useMapColors()` / `resolveMapColors` (`app/src/lib/themeColors.ts`), not `DIFFICULTY_COLORS`.
- [x] DONE in wave 2 (desktop screenshots identical apart from the intended blur change): clean-up of `map.css` and `view3d.css`, which held old `#detail`, `.guide`, `#legend`, `.tip`, `.pill` and `.viewtoggle` rules that `explore.css` overrides with `.explore`-prefixed selectors. Delete the old rules and drop the prefixes.

## Design pass, wave 2 (done)
- [x] Phone and tablet (860 px and below): map full screen, ranked list as a bottom sheet (collapsed, peek, expanded), filters as a full-height sheet, tile above the sheet bar, compact legend. 3D stays desktop-only (the 2D|3D control is hidden, the view is forced to 2D).
- [x] Accessibility gate in CI-ready form: `app/e2e/a11y.spec.ts` (axe, no rules disabled), keyboard-only and reduced-motion specs, layout spec.
- [x] Cost chart: thin slices of the selected bar (park fees and permits) get a leader-line label in a right-hand column.
- [x] The blurred guide map is fainter-blur (3 px, 85% saturation) so it reads in both themes.
- [ ] Open for the owner: the e2e suite is not in CI yet (it needs Chromium); `npm run e2e` locally. Whether to add it to a CI job.

## Hike page and About (lane 4)
- [ ] **Month strip: day limits per month.** The smoky-day and wet-day limits are for a whole quarter, so a single month's cell is marked "Past limit" when it alone is above **one third** of the limit.
      Temperature and crowds are compared directly. (`lib/monthStrip.ts`, `SHARE`.) The strip says this under the table.
- [ ] **Sunrise and sunset for a quarter** come from its **middle month** (the same month that sets the default start time, sunrise + 1 h). Early and late months of the quarter differ by up to about an hour.
- [ ] **The profile chart's x axis is the distance walked** (NPS-scaled), so an out-and-back hike is two humps: the climb (solid line, filled markers) and the return (dashed line, hollow markers). Loops and one-way routes are one curve.
- [ ] **Stepping.** Back / Forward and the arrow keys jump between checkpoint events in the hike's own order (C0, C1 ... summit ... C1, C0). While waiting at a stop, Back goes to that stop.
      The native time slider keeps minute-by-minute control. (`stepTime` in `models/checkpoints.ts`.)
- [ ] **Stop photos on the hike page come from the 3D walk's files** (`walks/<id>/photos/...`, the paths in `profiles/<id>.json`) and are loaded only when that stop is reached. Their credits are on the walk page; the page says so.
- [ ] **About worked example is computed live** from the data with the real match model (Angels Landing, Q3, 60 to 85 F; falls back to the first hike), so it cannot drift from the app.
- [ ] **Hike times are not yet validated against NPS time estimates** (the lane brief asks for 5 hikes). No global correction is applied, and About says so. Still to do once real profiles are in.
- [ ] **Similar hikes** (a "Should" item, after G3) and **user testing** (needs real people) are not part of this change.

## Crowds pipeline (lane 1, `pipeline/nps_visits.py`)
- [ ] **2026-11-19 19:30. Source: the IRMA stats REST service, not the report viewer.** `irma.nps.gov/STATS` is an interactive report viewer with no direct CSV link;
      `irmaservices.nps.gov/v3/rest/stats/visitation` returns the same "Recreation Visitors by month" table as XML, no key. One request per park, cached in `data/raw/nps/`.
- [ ] **2026-11-19 19:30. Typical crowd level = median of each month over 2015-2024 (2020 excluded), divided by the park's busiest month.** This reads the plan's "median over years" as a
      per-month median, then scales. Alternative (median of each year's own ratio) was not chosen: it is the same on stable parks and harder to explain. 2010 is downloaded only for the known-answer checks.
- [ ] **2026-11-19 19:30. `SEKI` maps to IRMA `SEQU`.** IRMA counts Sequoia and Kings Canyon as separate parks; both SEKI hikes (Moro Rock, General Sherman Tree) are in Sequoia. If a Kings Canyon hike is added, `park_code` needs its own `KICA` entry.
- [ ] **2026-11-20 10:30. Weather (`pipeline/ghcn.py`): nearest station within 50 km with 80% of days present for highs AND rain, over 2015-24 without 2020.** Station list and inventory come from the GHCN-D files;
      daily values from the NCEI access API, cached per station. If the nearest fails the 80% test the next nearest is tried. Open question: nine hikes got a SNOTEL station (`USS...`, mountain sensors, not standard weather shelters)
      because the brief says "nearest station". Eight hikes have a station 2,500 to 6,500 ft below the hike top (Moro Rock and General Sherman Tree use Lemon Cove at 513 ft; Longs Peak uses 8,600 ft for a 14,259 ft summit). `tmax_p50` is the station's high; only `tmax_summit_est` adjusts for height.
- [ ] **2026-11-20 10:30. `tmax_p50` is the median of daily highs; the doc's 97.9 F is the mean (median is 98.0).** p25/p50/p75 are pooled over all daily highs in that month. The data contract test pins 97.9 and 13 for Zion August, written against the fake data.
- [ ] **2026-11-20 10:30. Heat, wet, snow and smoky days are yearly averages over 9 years (2020 out).** The doc's "13.0 August days at or above 100 F" uses all ten years including 2020 (130 days); without 2020 it is 11.2. The rule "no typical value uses 2020" wins, so the app shows 11.2 for Zion; the 13.0 is reproduced in `test_ghcn.py` with 2020 included.
      The Mariposa and Flathead figures (71/33/38 and 4 then 38) are also ten-year totals with 2020 and reproduce exactly in `test_epa_aqi.py`.
- [ ] **2026-11-20 10:30. A month in a year with fewer than 80% of days present is skipped for that year; a partly missing month is scaled up to the full month.**
- [ ] **2026-11-20 10:30. Air quality (`pipeline/epa_aqi.py`): the county comes from the trailhead through the FCC area API (cached), not from the park.** Smoky day = AQI over 100 with PM2.5 defining; ozone day = AQI over 100 with ozone defining.
      A county with no AirData rows in the typical years gets `missing: ["smoky"]` (smoky and ozone set to 0). A county with partial monitoring simply has fewer days reported, so smoky days can be undercounted there.
- [ ] **2026-11-20 10:30. Daylight (`pipeline/daylight.py`): NOAA solar formulas for the 15th of each month, local clock via the IANA zone for the state (Arizona has no daylight saving; Guadalupe Mountains is Mountain time).** Checked to the minute against Denver's June solstice. Needs `tzdata` on Windows.
- [ ] **2026-11-20 10:30. `build.py` writes `data/processed/hike_month.json` and does not touch `app/public` unless run with `--publish`.** CI runs `scripts/make_fake_data.py` and fails if `app/public` differs, so real data cannot land until CI skips that step when `meta.json` says `"fake": false`. `.github/` is owned by the lead.
      `closed` is still carried over from the fake file (seasonal closures need the hike catalogue).

## Hike list (lane 1)
- [ ] **2026-11-22 18:49. The final list is 40 hikes, no extra 10.** Decided by Adnan (lane 1). Supersedes the earlier "40 plus 10" idea.
      Start from the current 40 (the placeholder list in `scripts/make_fake_data.py`, nothing in the plan or lane brief names a pool). Hikes that fail the data gate are replaced by another hike, so the count stays 40. The 7 hikes with built 3D walks stay in.
      Open: what replaces Guadalupe Peak (no weather station) and Alkali Flat (no air-quality data), and any others that fail the gate. The team signs off on the final list.
- [ ] **2026-11-23 19:59. Guadalupe Peak and Alkali Flat are removed from the list for now (38 hikes), kept on the branch `archive/guadalupe-peak-alkali-flat`.** Asked by Utkarsh so the real data set can build and land on main; replacements or a fix are decided after that.
      Guadalupe Peak: no station within 50 km passes 80% (the closest official one, Pine Springs `USW00023055`, has 76% highs and 78% rain over 2015-24). Alkali Flat: Otero County has no EPA air monitor. The data-contract test floor is lowered from 40 to 38 until the list is back to 40.
- [ ] **2026-11-23 20:54. NPS pages for the hike list (`pipeline/catalogue/nps_pages.csv`): all 38 found.** Five are park-level trail lists, not a page for the hike itself (Cassidy Arch, Garfield Peak, Emerald Lake, Inspiration Point, Hall of Mosses).
      Open: NPS pages disagree with each other on length and gain, so `hikes.json` needs a rule for which figure wins. Seen so far: Fairy Falls 4.5, 5.4, 6.7 or 9 mi round trip; Delicate Arch gain 538 or 480 ft; Emerald Lake gain 605 or 771 ft; Wheeler Peak 8.6 mi and 3,100 ft or 8.2 mi and 2,900 ft; Old Rag gain 2,348 or 2,415 ft; Upper Yosemite Fall 7.2 or 7.4 mi; Lady Bird Johnson Grove loop 1.5 or 1 mi; Highline to Granite Park Chalet 7.6 mi from Logan Pass, but the trailhead page lists 11.8 mi one way to The Loop.
      Pinnacles High Peaks has three NPS loops (5.3, 6.7 and 8.4 mi); the table points at the 6.7 mi High Peaks to Bear Gulch loop, which is a choice to confirm.
      Proposed rule (not agreed): use the hike's own NPS trail page, record its URL, and keep the figure it gives.
      Naming: NPS now calls Clingmans Dome "Kuwohi" (renamed 2025), so the hike name in the app may need to follow.
- [ ] **2026-11-23 21:29. NPS facts table (`pipeline/catalogue/nps_facts.csv`): 36 of 38 hikes have a length, 23 a gain, 10 a difficulty.** Only figures that appear in the text of an nps.gov page are recorded, each with its URL. Where the hike's own page had none, the row cites the NPS page that does.
      Decided by Adnan: where a page lists several routes, use NPS's main route, except that lane 2's walk routes win (Highline stays to Granite Park Chalet; Fairy Falls stays the 4.5 mi out-and-back).
      Still blank: Bright Angel to Phantom Ranch (no page states it) and Moro Rock's distance (the page gives 350 steps and a 300 ft climb only). Difficulty is filled only where a page uses the word.
      12 rows are flagged `needs_check` with the reason in the note, for example Emerald Lake (two NPS pages disagree: 1.8 mi and 605 ft against 1.7 mi and 771 ft) and Highline (800 ft gain looks low against NPS's 2,388 ft for the full trail).
