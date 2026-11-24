# Remaining work plan (written 2026-11-24, after PR #12)

Scope now: **15 priority hikes** (first 10, then 5 more added the same day). The final list is 15 to 20; the next 5 to 10 come in a later session. Nothing is cut from the data yet (still 38 hikes), so
nothing breaks; the work below goes into the 10 first. Cutting to the final count is deleting rows, done once the list is agreed.

## The 10 priority hikes
Three featured (they already have walks), the Glacier demo hike, and a spread of parks, difficulty and region.
`angels-landing`, `bright-angel-trail`, `cascade-pass-sahale`, `glacier-highline`, `half-dome`, `delicate-arch`, `fairy-falls-grand-prismatic`,
`navajo-loop-queens-garden`, `skyline-trail`, `cadillac-north-ridge` (Acadia, which the Advice vs data cards need).
Added: `grinnell-glacier`, `mesa-arch`, `alum-cave-leconte`, `inspiration-point`, `ryan-mountain`. Mix of the 15: 2 easy, 6 moderate, 7 hard. Swap any of them freely; the list lives in `pipeline/catalogue/priority_hikes.csv`.

## Tracks (disjoint files, so they can run side by side)
| Track | Lane | What | Files |
|---|---|---|---|
| A | 1 | Real trailhead and end coordinates, gain, summit elevation and `closed` months for the 10 hikes, each from a named source | `pipeline/hikes.py`, `pipeline/catalogue/*.csv` |
| B | 1 | Real `advice.json` cards from `docs/ai-vs-data-check.md`, including Glacier September | `pipeline/advice.py`, `pipeline/checks/test_advice.py` |
| C | 2 | Real fares (DOT, no key), NPS fees and profiles for the 10 hikes; ORS, GSA and EIA need keys that are not in `.env`, so those are reported, not faked | `pipeline/travel.py`, `cost.py`, `profiles.py`, `pipeline/test_lane2.py` |

## Rules for every track
- Do not commit. Do not edit `app/src`. Never hand-edit `app/public/data/*.json`: change the pipeline or the catalogue.
- A value without a source stays a marked placeholder. Never invent a number.
- Run only your own script and tests, not `build.py` (it writes every data file). The merge step is done once, at the end.

## After the tracks
Run `build.py`, `npm run validate:data`, the pipeline tests, `npm run check` and `npm run e2e`; then flip `"fake"` to `false` only if every file is real
(it will not be while ORS, GSA and EIA keys are missing). Then cut to the final hike count.

## Not in this plan (other owners)
Cloud transition, walks for the other hikes, similar hikes (lanes 2, 3 and 4 and the design track).
