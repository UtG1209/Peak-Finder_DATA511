# Plan 1: Data core for the final 23

**Language:** Python. **Keys:** none required (optional `NPS_API_KEY`). **Read first:** `README.md` here, `../lane-1-data-core.md`, `pipeline/catalogue/hikes_coverage.csv`.
**You own:** `pipeline/hikes.py`, `pipeline/build.py`, `pipeline/advice.py`, `pipeline/meta.py`, `pipeline/catalogue/*`, `pipeline/checks/`, `scripts/make_fake_data.py`, `app/public/photos/`, the hike counts in `CLAUDE.md`.
**Do not touch:** `app/src`, `walks/`, `travel.py`, `cost.py`, `profiles.py` (Plan 2).

## Step 1 (do first, others wait on it): cut to the 23
1. Copy `docs/work/final-23/final_hikes.csv` to `pipeline/catalogue/final_hikes.csv` (keep this folder's copy as the record).
2. Make the list the one place that decides membership: `hikes.py`, `build.py` and `scripts/make_fake_data.py` keep only ids in `final_hikes.csv`. Every per-hike file (`hike_month`, `travel`, `cost`, `profiles/`, `advice`) must follow the same list, so no row refers to a missing hike.
3. Delete what belongs only to the 15 cut hikes: `app/public/data/profiles/<id>.json`, their `app/public/photos/*` (main photo and stop `.svg`), and their rows in the catalogue CSVs that nothing else reads. Keep the raw caches (git-ignored).
4. Re-run `python3 pipeline/hikes.py --publish` then `python3 pipeline/build.py`. Expect: 23 hikes, 276 month rows, 230 travel rows, 920 cost rows, 23 profiles.
5. Fix the tests that count: `app/src/data/data-contract.test.ts` ("38 until two replacements", `>= 38`) becomes exactly 23 (a one-line change, tell Plan 4). `pipeline/checks/test_build.py` and `pipeline/daylight.py` (comment "the 40 hikes") the same.
6. Update CLAUDE.md: "40" and "38" hike counts (sections 0, 1, 4, 7), the "Mix" line, and add this folder to the docs list. `npm run docs:check` must pass.
PR title: "Cut the dataset to the final 23 hikes". `npm run check` and `npm run validate:data` green.

## Step 2: real hike fields for the 7 new hikes and Mount Washburn
For each of `general-sherman-tree, moro-rock, clingmans-dome, anhinga-trail, emerald-lake, zion-narrows, longs-peak, mount-washburn`, replace every `placeholder` cell in `hikes_coverage.csv` with a sourced value, using the same tables the 15 priority hikes use (`nps_facts.csv`, `geo_facts.csv`, `end_points.csv`, `hike_fields.csv`, `closed_months.csv`):
- Trailhead and end coordinates (OSM, GNIS or NPS), NPS length and gain, summit elevation (NPS or USGS), difficulty rule, closed months, permit note.
- Longs Peak: summit 14,259 ft, NPS length about 15 mi round trip; needs the permit note for the August to October window and the "start before sunrise" note in `closure_note` or `description`.
- Zion Narrows: it is a river hike; NPS gives 9.4 mi round trip and almost no gain. Say "wade, flash-flood risk" in `gear` and `closure_note`. Closed months are by river flow and permits, not season; record only what NPS states.
- Anhinga: gain 0 is real; do not turn it into a placeholder.
- A figure without a source stays marked `placeholder` and goes into `docs/work/follow-ups.md`.
Check each new hike passes the gate in `candidates.csv` (station within 50 km, AQI county, IRMA visits, photo). If one fails, tell the team and swap it using the README swap rule; do not fake.

## Step 3: monthly data and advice for the 23
- `hike_month.json` already comes from GHCN, EPA, IRMA and daylight for all hikes; re-run `ghcn.py`, `epa_aqi.py`, `nps_visits.py`, `daylight.py` only for stations or counties you changed. Check Zion Narrows shares the Springdale station with Angels Landing and Longs Peak/Emerald Lake use Rocky Mountain (CO) rows.
- `advice.json`: 7 real cards exist. Keep every card whose `hike_id` is in the 23 (the cut hikes must not own a card, or the Hike page and About show a dangling reference). The Las Vegas fare card is hard-coded in `advice.py`: either compute it from the Plan 2 fares or keep it and label it hand-checked on About. Add 1 to 3 new cards only if `docs/ai-vs-data-check.md` has known answers for them.
- `meta.json`: `hike_count` 23, as-of dates updated, `cost_sources` merged by `meta.py` (Plan 2 writes them).

## Step 4: photos
Main photos: all hikes already have a Commons photo with credit. For the 8 hikes above, confirm the licence is public domain, CC0, CC BY or CC BY-SA (`photos.py`), the file is 900 px in `app/public/photos/`, and `photo.author`, `license_url` and `page` are set. Alt text comes from the hike name; check the tile and hike header show the credit.
Stop photos on the trail chart are Plan 2's (they live in profiles).

## Step 5: checks and final data PR
- `pipeline/checks/` known answers (Zion June 2023 564,036; Glacier Jul/Aug/Sep; Springdale 13.0 days; and so on) still pass.
- Every hike has a station within 50 km or a `missing` flag.
- No typical value uses 2020. Every photo licence is allowed.
- `npm run validate:data`, `pytest pipeline`, `npm run check`.

## Integration checklist (tick when true in the running app, `npm run dev`)
- [ ] Explore shows 23 markers; legend counts and the "N hikes" wording match.
- [ ] Easy, moderate and hard filter chips each show the expected 6, 7, 10 (with all limits open).
- [ ] Every hike card shows photo, credit, three reasons and no "undefined".
- [ ] Hike page: header numbers (NPS length, gain, summit), gear icons, closure note, month strip with no empty cells except flagged missing data, Advice vs data card where one exists.
- [ ] About lists the sources with as-of dates and says 23 hikes.

## Acceptance
All of `pipeline/catalogue/hikes_coverage.csv` rows for the 23 have no `placeholder` except items listed in `follow-ups.md`; contract test passes at exactly 23; CLAUDE.md check passes.

## Final goal and agent verification (do this last, it closes the plan)
**Goal:** the dataset is exactly the 23 hikes, every field is sourced, and nothing refers to a hike that was cut.

Done only when a fresh verifier agent, started in the repo root with no memory of your work, confirms every line. Give it this prompt:
> Read CLAUDE.md and docs/work/final-23/README.md and plan-1-*.md. Do not trust the author's claims. Run `git pull`, `npm run setup`, `node scripts/verify-final-23.mjs --plan 1` and `npm run check`. Then open the app (`npm run dev`), go through every "Integration checklist" box and every line below, and report PASS or FAIL for each with the evidence (command output, a screenshot, or the exact URL and what you saw). Any FAIL, any console error, any "undefined", any placeholder text or image is a FAIL. Do not fix anything; report only.

The author pastes the verifier's report into the PR description. The PR is not merged with a FAIL in it.
- [ ] `node scripts/verify-final-23.mjs --plan 1` prints only PASS.
- [ ] 23 markers on the Explore map; easy/moderate/hard chips with limits open show 6, 7, 10.
- [ ] Open five hikes at random (one per level plus a new one): numbers on the page match `hikes_coverage.csv` sources; every photo shows with its Commons credit; no stop photo or main photo is a generated picture.
- [ ] `grep -rn "placeholder" app/public/data/hikes.json` finds nothing for the 23 except items listed in `docs/work/follow-ups.md`.
- [ ] CLAUDE.md says 23 everywhere it counts hikes, and `npm run docs:check` passes.
