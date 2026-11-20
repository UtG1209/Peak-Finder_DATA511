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
