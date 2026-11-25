# Plan 4: App end to end for the final 23, and release

**Language:** React, TypeScript, Playwright. **Keys:** none. **Read first:** `README.md` here, `../lane-3-explore.md`, `../lane-4-hike-page-about.md`, `../design-track.md`, `app/src/styles/README.md`.
**You own:** `app/src/**`, `app/e2e/**`, `.github/`, `scripts/check-*.mjs`, the final CLAUDE.md pass.
**Do not touch:** data files by hand, `walks/` content, the pipeline (ask Plans 1 to 3).
**Waits:** none for steps 1 to 4 (they work on whatever data is present); step 5 needs Plans 1 to 3 merged.

## Step 1: tests and counts that assume 38 or 40
Grep `app/src` and `app/e2e` for fixed hike counts, ids and text ("40 hikes", "38", ids of cut hikes such as `hurricane-hill`, `old-rag`, `south-kaibab-skeleton-point`). Known: `app/src/data/data-contract.test.ts` (Plan 1 changes it to exactly 23), the comment in `view3d/scene.ts`, e2e specs that open a specific hike, About copy. Replace the ids with ones in `final_hikes.csv`. Keep `smoke.spec.ts` on a hike that has a walk.

## Step 2: Explore screen at 23 hikes
Test each in the browser with `npm run dev`, on desktop and phone width.
- [ ] Guided start: blurred map, three steps (home city, quarter, limits), "Show hikes" sets `go=1`, unblurs, shows markers, legend, hike card, "What next?" tip. Decision from follow-ups item 1 (pins hidden behind the card): ask the user, then implement the chosen option (keep, move the card aside, or unblur).
- [ ] Rail: Home city dropdown (10 cities + Skip), quarter chips Q1 to Q4 (default next quarter), temperature range, crowds, smoky days, wet days, max travel (greyed with "Pick a home city to use this" without city), difficulty chips, "Has 3D walk" switch, histograms, Reset filters.
- [ ] Markers: size = match %, colour = difficulty, hollow grey dot when filtered out, ring for walks, home city marker, nudging of close trailheads (fewer hikes: check that nothing overlaps wrongly), zoom controls, "Zoom to results", "Whole US".
- [ ] Ranked list: sorted by match, animated re-sort when the quarter changes, hover linking both ways, click zooms and opens the photo tile (`pick=<id>`), "Open this hike" is the only way to the hike page, Back returns to the same view.
- [ ] Spin the wheel: wheel takes the top 12 matching hikes. With 23 hikes and tight limits fewer than 12 may match: it must still work with 1 to 11 and handle 0 (use the empty state).
- [ ] Empty state: never blank; nearest misses and the one-click fix.
- [ ] 3D view (desktop only, `view=3d`): cones for 23 hikes, hover and click use the same tile and `pick`, dashboard below shows quarter match and month crowds and smoke, "3D view needs WebGL" fallback.
- [ ] Share link copies `go=1`; metric toggle; theme toggle; URL round-trips every filter.
- [ ] Phone: bottom sheet for the ranked list, filters sheet, 3D hidden.

## Step 3: Hike page at 23 hikes
For every one of the 23 ids, open `/#/hike/<id>` (see router in `App.tsx`) at each quarter and check, via a small Playwright loop in a new `app/e2e/all-hikes.spec.ts` that visits all 23 and fails on console errors:
- [ ] Header: name, park, description, NPS length and summit, difficulty, gear, photo and Commons credit, "Back to map", "Walk it in 3D" only when the hike has a walk.
- [ ] Quarter chips with match %, best quarter marked, per-factor breakdown vs your limits.
- [ ] Month strip, missing-data cells labelled in words, closed months shown.
- [ ] Trail chart: elevation profile, start time, scrubber, Back and Forward checkpoint buttons, arrow keys, daylight band and warning, stop photo or "No photo for this stop". Fix the known overlap of the "Start" and "Back" labels under the daylight bar on short hikes.
- [ ] Cost: stacked bars, controls, popover (Esc closes), source lines, "Typical... Not a price quote."
- [ ] Advice vs data card where one exists, none where not.
- [ ] Similar hikes (`models/twins.ts`): three cards, at least one from another park, none is the hike itself, each links correctly. With 23 hikes check Anhinga (Everglades has no near twin) still gets three.
- [ ] Loading skeleton, "data failed to load: one line + Retry + link to About", unknown hike id gives a friendly page, not a blank.

## Step 4: About, banner, states, accessibility, performance
- [ ] About: sources with links and as-of dates, worked match example, costs, times, honest limits, the hike count says 23, the "Work in progress" notice stays until step 5.
- [ ] Banner (`FakeBanner`) text is true: it lists what is still sample.
- [ ] `npm run e2e`: axe on every screen, keyboard-only, reduced motion, phone layout. Fix the flaky "bubbles jump straight to the new size" test (wait on the state, not on time).
- [ ] The saved-scroll replay bug (cloud transition replays once if a hike is reopened without a walk): clear the entry on mount.
- [ ] Budgets: `node scripts/check-budget.mjs` (first load, three.js chunk under 250 KB gzip, nothing from `walks/` on the first screen).
- [ ] Contrast in both themes (`lib/contrast.test.ts`), no raw hex, no glyph icons (`npm run design:check`).

## Step 5: release sweep (after Plans 1 to 3 are merged)
1. `git pull`, `npm run setup`, `npm run validate:data`, `pytest pipeline`, `npm run check`, `npm run e2e`.
2. Walk the integration map in `README.md` row by row on the production build (`npm run build` then preview under the Pages base path), on desktop and a phone-width window, in dark and light.
3. When every placeholder in `hikes_coverage.csv`, the cost rows and the profiles of the 23 are real (or listed in `follow-ups.md` as accepted limits), set `"fake": false` through `pipeline/meta.py` (not by hand), remove the banner and the About notice text, update CLAUDE.md "State of the repo" and section 1.
4. Push to a branch, check the Pages artifact, deploy from `main`, open the live link and repeat step 2 quickly.
5. Move finished items out of `follow-ups.md` and tick them in this folder's plans.

## Acceptance
`npm run check` and `npm run e2e` green; `all-hikes.spec.ts` visits 23 pages with no console error; every box above ticked on the live link; CLAUDE.md true.

## Final goal and agent verification (do this last, it closes the plan)
**Goal:** the whole product works end to end on the live link: every screen, button, URL parameter, data file and walk, with no sample data left.

Done only when a fresh verifier agent, started in the repo root with no memory of your work, confirms every line. Give it this prompt:
> Read CLAUDE.md and docs/work/final-23/README.md and plan-4-*.md. Do not trust the author's claims. Run `git pull`, `npm run setup`, `node scripts/verify-final-23.mjs --plan 4` and `npm run check`. Then open the app (`npm run dev`), go through every "Integration checklist" box and every line below, and report PASS or FAIL for each with the evidence (command output, a screenshot, or the exact URL and what you saw). Any FAIL, any console error, any "undefined", any placeholder text or image is a FAIL. Do not fix anything; report only.

The author pastes the verifier's report into the PR description. The PR is not merged with a FAIL in it.
- [ ] `node scripts/verify-final-23.mjs` (no `--plan`) prints only PASS, including `meta.fake is false`.
- [ ] `npm run check` and `npm run e2e` pass on a clean clone.
- [ ] The verifier walks the integration map in `README.md` row by row and also tries: every URL parameter in CLAUDE.md section 2 (`from, q, temp, crowd, smoke, rain, travel, diff, 3d, units, go, pick, view`) typed by hand; Share link opened in a private window; browser Back from the hike page; refresh on the hike page; an unknown hike id; the network blocked for `data/` (error state with Retry); dark and light; phone width.
- [ ] Every button, chip, switch, slider, toggle and link on Explore, Hike and About is clicked once and does something visible (the verifier lists them and ticks each).
- [ ] The final report is saved as `docs/work/final-23/FINAL_REPORT.md` with the date, the commit and the evidence.
