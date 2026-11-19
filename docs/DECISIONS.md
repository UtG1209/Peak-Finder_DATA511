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
- [x] **Guided start** (requested): the map is blurred until the user presses "Show hikes" (`go=1` in the URL); a card explains the three steps. This replaces "all filters start wide open so the map is never empty on arrival" with "wide open, but behind a short guide". Shared links include `go=1`, so they open unblurred.
- [x] **Difficulty colours** (requested): bubble colour = difficulty (Easy light teal, Moderate gold, Violet for Hard), size = match, hollow grey = filtered out. The label stays "Moderate" (the data value), not "Intermediate", so it matches CLAUDE.md. Colours are in `app/src/lib/difficulty.ts`.
- [ ] **Look**: the dark, sand-orange look of the 29 Oct prototype (as requested), not the teal in CLAUDE.md section 3. One token (`--accent` in `app/src/styles.css`) switches it.
- [ ] **No landing page, no top-bar quarter slider, no "18 of 52" counter** (CLAUDE.md wins over the plan PDF). The counter "N of 50 hikes fit in Q4" is kept on the map as in the prototype.
- [ ] **Routing** uses `HashRouter` so deep links work on GitHub Pages without a 404 fallback: `https://.../#/?from=SEA&q=3` and `#/hike/angels-landing`. Filters live in the query part,
      with the parameter names from CLAUDE.md (not the prototype's `#q4-t50-85-...` hash).
- [ ] **US outline** is a static asset, `app/public/data/us-states.topo.json` (us-atlas, ISC licence, from US Census). Not one of the section 4 data files.
- [x] **Hike list = the 40 most famous hikes that also have complete data** (approved). Gate first (station within 50 km, AQI monitor, NPS visits, NPS page, OSM line, open photo), then fame. The fake list is a placeholder; lane 1 produces the real one.

## Process
- [ ] Models are split: lane 3 owns `match.ts`; lane 4 owns `checkpoints.ts` and `cost.ts`; shared files change only through a PR everyone sees.
- [ ] Contract changes need a PR labelled `contract` approved by all four.

## Walks: size and hosting (needs a team decision before lane 2 builds more)
- [ ] The 3 finished walks are **108 MB** (35 to 40 MB each; mostly terrain and imagery tiles plus season overlays). GitHub Pages publishes at most **1 GB** per site and
      repos should stay under about 1 GB. At today's size **40 walks would be about 1.4 GB, which does not fit**.
- [ ] **We build a walk for every hike (requested), so each new walk gets a budget of 15 MB or less** (about 600 MB for 40, plus the 3 existing). Levers in the trail kit config:
      a tighter `bounds` box, a corridor around the route (`bounds.corridor_m`), fewer zoom levels, WebP or smaller season overlay tiles, JPEG quality for photos, fewer season photos.
      Lane 2 adds `scripts/check-walk-size.py` (fails over 15 MB) to the kit run.
- [ ] If we still outgrow Pages, host walks in a second repo or bucket and set `VITE_WALKS_BASE` (already supported by `app/src/lib/walks.ts`); no app code changes.
- [ ] Everyone clones the walks with the repo. If clone size becomes a problem: `git clone --filter=blob:none` and sparse-checkout `walks/` only where needed.
- [x] **Walks never load on the first screen.** The app only builds a link; the walk page and its tiles are fetched when someone opens it. `scripts/check-budget.mjs` fails CI if the entry
      or Explore chunk ever references `walks/`.

## Time model on real data
- [ ] Real DEM profiles are noisy (the Angels Landing walk had a 4:1 slope in one 10 m step, which Tobler turned into 90 hours). The checkpoint model now smooths elevation over about 50 m and caps
      slope at ±0.6 (`MAX_SLOPE`, `SMOOTH_WINDOW_M` in `models/checkpoints.ts`). With real routes it gives Angels Landing 4.6 h, Bright Angel 11.7 h, Cascade Pass 8.7 h round trip. Lane 4 validates against NPS times for 5 hikes.
- [x] Walks are built by one verified process (`docs/WALKS.md`); `walks/manifest.json` is the single source of truth for `featured` and `walk_path`.
