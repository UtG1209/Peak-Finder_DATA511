# Plan 2: Travel, cost and profiles for the final 23

**Language:** Python. **Keys:** `ORS_API_KEY`, `EIA_API_KEY`, `GSA_API_KEY` in `.env` (`docs/CREDENTIALS.md`); DOT needs none. **Read first:** `README.md` here, `../lane-2-travel-cost-walks.md`, `pipeline/lane2_common.py`.
**You own:** `pipeline/travel.py`, `cost.py`, `profiles.py`, `lane2_common.py`, `nps_fees.json`, `test_lane2.py`, `pipeline/catalogue/drive_points.csv`, `loop_waypoints.csv`, `app/public/data/travel.json`, `cost.json`, `profiles/` (by running the scripts).
**Do not touch:** `hikes.json` fields (Plan 1), `app/src`, `walks/` (Plan 3).
**Wait for:** Plan 1 step 1 (the list and the cut). Real trailheads for the new hikes (Plan 1 step 2) come first for the best result; you can start with the ones that already have them.

## Which hikes
Real already (do not redo): the 15 priority hikes, except the gaps in step 4. Needs the full treatment: `general-sherman-tree, moro-rock, clingmans-dome, anhinga-trail, emerald-lake, zion-narrows, longs-peak, mount-washburn`.
Put those 8 ids in a CSV with an `id` column (for example `data/processed/lane2/new8.csv`) and use the `--only` flags below.

## Step 1: travel for the 8
`python3 pipeline/travel.py --help`, then run it for the 8 (10 cities each, so 80 rows). ORS drive time and distance from each home city; nearest airport that has a DOT fare; `default_mode` is whichever is shorter door to trailhead. Where ORS cannot reach the last road (Clingmans Dome is already known, Longs Peak trailhead, Zion Narrows Temple of Sinawava shuttle), add the point to `drive_points.csv` and note it. Never edit `travel.json` by hand.

## Step 2: cost for the 8
`python3 pipeline/cost.py --only <csv>` runs the full GSA and EIA build for those ids and keeps every other hike's rows. 8 hikes x 10 cities x 4 quarters = 320 rows.
- Fees: add each park to `nps_fees.json` with a source note: Sequoia and Kings Canyon (General Sherman, Moro Rock), Great Smoky Mountains (Clingmans Dome), Everglades, Rocky Mountain (Emerald Lake, Longs Peak, with timed entry), Zion (Narrows: the Narrows top-down needs a wilderness permit; the bottom-up day hike needs none), Yellowstone (Washburn). Unknown fees stay marked `UNVERIFIED`, never guessed.
- GSA lodging varies by month at only 18 of 51 parks; elsewhere flat. Keep the sourcing note.
- Fix the placeholder fares: Alum Cave from ATL (nobody flies ATL to ATL: choose the nearest real airport pair, for example ATL to TYS or AVL, if DOT lists it, or drive only), Seattle to Bangor Q1 (Acadia). If DOT has no row, state "no fare, drive only" in the cost source note and let `default_mode` be drive.

## Step 3: profiles for the 8
`python3 pipeline/profiles.py --only <csv>`. Mount Washburn already has a walk, so `profile_from_walk` builds its profile from the walk route; the other 7 run the trail kit (OSM plus AWS Terrarium tiles; a sandbox may block those hosts, run on a laptop).
- Check `osm_length_m` against NPS: more than 15% off means keep the NPS figure and set `scale` (documented, like Cadillac and Highline).
- Anhinga, General Sherman and Moro Rock are short; Zion Narrows has almost no gain (it is a river), so check the checkpoint model does not give silly times and note it on About if it does.
- Checkpoints: named landmarks from the NPS page, else every quarter of the distance plus the summit or turnaround. `dist_m` is in OSM metres, before scaling.
- Stop photos: a real Commons photo per stop where one exists (public domain, CC0, CC BY, CC BY-SA, with credit), otherwise leave none: the page says "No photo for this stop". No new `.svg` placeholders.
- Do the same for the two profiles that start at the old walk start: Fairy Falls and Grinnell (move them to the new trailheads).

## Step 4: close the known gaps for the kept 15
From `../follow-ups.md`, only those that touch the 23: Navajo Loop, Hurricane Hill is cut, Clingmans (now in) drive distance understated; Delicate Arch and Glacier Highline permit fees UNVERIFIED at $0; Great Smoky entrance $0 UNVERIFIED (read the parking tag price on nps.gov and record it); Angels Landing and Half Dome permit extras (decide: model them, or say "permit lottery fee not included" on the cost popover and About; needs Plan 4 for the wording). Cut hikes' gaps are dropped, not fixed.

## Step 5: sources and tests
- `python3 pipeline/meta.py` merges `cost_sources`; no source says "(fake)".
- `pipeline/test_lane2.py` known answers: SEA to LAS Q3 2025 fare $169.78; Springdale lodging $110 in July and October; Angels Landing scale about 1.31.
- Contract: every hike has 10 travel rows, 40 cost rows, one profile with a valid scale. `npm run validate:data`, `pytest pipeline`, `npm run check`.

## Integration checklist (tick in the running app)
- [ ] Explore: pick a home city; "Max travel time" slider enables; every hike has a travel value; hover card shows "x h away" and a typical cost.
- [ ] Hike page cost graph: four stacked bars, cheapest and best quarter labelled, party size, nights and fly or drive controls change the numbers, segment popover shows line items and the source from `meta.json`, "Typical, from past data. Not a price quote." visible.
- [ ] Trail chart: scrubber, checkpoint stepping with Back and Forward, arrow keys, start-time input, daylight band with the "not before dark" warning, stop photo or the "No photo" sentence.
- [ ] No hike shows a fare from the home city's own airport. No cost row has a `null`.

## Acceptance
`cost.json` has 920 rows; `travel.json` 230; 23 profiles; no `placeholder` fare except where the source note says drive only; about page cost section lists the real sources.

## Final goal and agent verification (do this last, it closes the plan)
**Goal:** every one of the 23 has real travel, cost and profile data and the hike page cost graph and trail chart run on it.

Done only when a fresh verifier agent, started in the repo root with no memory of your work, confirms every line. Give it this prompt:
> Read CLAUDE.md and docs/work/final-23/README.md and plan-2-*.md. Do not trust the author's claims. Run `git pull`, `npm run setup`, `node scripts/verify-final-23.mjs --plan 2` and `npm run check`. Then open the app (`npm run dev`), go through every "Integration checklist" box and every line below, and report PASS or FAIL for each with the evidence (command output, a screenshot, or the exact URL and what you saw). Any FAIL, any console error, any "undefined", any placeholder text or image is a FAIL. Do not fix anything; report only.

The author pastes the verifier's report into the PR description. The PR is not merged with a FAIL in it.
- [ ] `node scripts/verify-final-23.mjs --plan 2` prints only PASS.
- [ ] For three home cities (SEA, DEN, ATL) and all 23 hikes, no travel time or cost is missing, zero, or from a city's own airport (script it in a throwaway Node check against `travel.json` and `cost.json`).
- [ ] Known answers still hold (`pytest pipeline/test_lane2.py`): SEA to LAS Q3 2025 $169.78, Springdale $110 July and October.
- [ ] On five hike pages (include Longs Peak, Zion Narrows and Anhinga): the scrubber, Back and Forward buttons, start time and daylight band work; finish times are plausible against the NPS time estimate on the NPS page (say so if not, and note it on About).
- [ ] Cost popover shows a real source for fare, lodging, gas and fees, and the words "Typical, from past data. Not a price quote."
