# Plan 3: 3D walks for the final 23

**Language:** Python (the walk builder) and a little React only if the button breaks. **Keys:** none. **Read first:** `README.md` here, `../../WALKS.md`, `pipeline/trail_kit/docs/START_HERE_NEW_TRAIL.md`, `LESSONS_LEARNED.md`.
**You own:** `walks/`, `walks/manifest.json`, `pipeline/walks/`, `pipeline/trail_kit/` configs for new trails.
**Do not touch:** `app/src` (ask Plan 4), data files by hand (the builder writes the profile through Plan 2's code).
**Wait for:** a hike needs real trailhead, end point and profile (Plan 1 step 2, Plan 2 step 3) before its walk is built. The kept priority hikes can start today.

## Where we are
**Update 2026-11-25:** Tier A and Tier B are built and verified (9 walks). Tier C waits for Plans 1 and 2.

Built and in the manifest: `angels_landing`, `grand_canyon`, `north_cascades` (legacy, about 35 MB each), `mount_washburn`, `fairy_falls_only`, `grinnell_glacier_overlook`, `highline_to_granite_park`. All 7 hikes are in the final 23, so nothing is deleted. `_shared/` holds shared assets.
Budget: 30 MB per new walk after lossless optimization, aim 25. GitHub Pages total limit 1 GB. Walks stay in this repo (decision made); build each once and never rebuild.

## Build order (by fame, priority hikes first)
Tier A, do first (real data already present): `half-dome`, `delicate-arch`, `navajo-loop-queens-garden`, `mesa-arch`, `skyline-trail`.
Tier B (real data present, shorter fame): `cadillac-north-ridge`, `inspiration-point`, `alum-cave-leconte`, `ryan-mountain`.
Tier C (after Plan 1 and 2 finish the new hikes): `longs-peak`, `emerald-lake`, `general-sherman-tree`, `moro-rock`, `clingmans-dome`.
Skip, on purpose: `anhinga-trail` (flat boardwalk, nothing to fly over) and `zion-narrows` (a river; the terrain walk would mislead). They show no button and no promise, which the UX rules allow. Size check: 16 new walks at about 27 MB adds about 430 MB; with the 7 existing the site is around 650 MB, under 1 GB. If you stop short, stop after Tier A; that is already a good demo.

## For each walk (one at a time, verify before the next)
1. `python3 pipeline/walks/build_walk.py <trail> --hike-id <id>`: it prints the plan and asks. Follow it; never run kit scripts by hand.
2. It verifies structure, credits, four seasons, route vs the hike's NPS numbers, size. It writes the hike-page profile from the walk route and a `BUILD_REPORT.md`.
3. Tick the report's manual checklist: open `walks/<trail>/index.html?season=winter|spring|summer|autumn` in a browser, check the credits (USGS imagery, Mapzen/AWS terrain, OpenStreetMap, each photo's Commons credit), the Back button, the time strip.
4. `python3 pipeline/walks/build_walk.py --verify-all` and `npm run walk:verify`.
5. One PR per walk (about 27 MB each; do not squash five walks into one commit you may need to redo).
Never re-run s2 or s3 on a finished trail. A walk not in the manifest does not exist for the app.

## Integration (what makes the button real)
Per CLAUDE.md the manifest is the single source of truth: `featured` and `walk_path` in `hikes.json` come from it. After each new walk:
- [ ] `python3 pipeline/hikes.py --publish` (Plan 1's script) shows `featured: true` and `walk_path` for that hike.
- [ ] Explore: the marker gets the thin outer ring, "3D walk ready" legend matches, the "Has 3D walk" switch includes it, the 3D view shows a thin ring.
- [ ] Hike page: "Walk it in 3D" button appears; click plays the cloud transition (forward), loads `walks/<id>/index.html?season=<q-season>` with Q1 winter, Q2 spring, Q3 summer, Q4 autumn; the season toggle still works.
- [ ] The walk's bottom strip shows the hike page's checkpoint times (`?times=`, handled in the template; do not touch finished walks).
- [ ] The walk's Back button (and the browser Back) plays the clouds in reverse and returns to the same scroll position (`lib/walkReturn.ts`). A new walk made from the template already has the button; legacy ones are covered by the existing patch, see `docs/work/design-track.md`.
- [ ] With reduced motion the transition is a fade.
- [ ] First screen loads nothing from `walks/` (CI enforces; run `npm run check`).
- [ ] A hike without a walk shows no button and no promise.

## Acceptance
Every walk in the manifest passes `--verify-all`; each new walk is at most 30 MB; `npm run e2e` (`walk-back.spec.ts`) passes; the live site total stays under 1 GB (`du -sh walks`). Update the "walks" lines in CLAUDE.md and `docs/work/follow-ups.md` in the same PR.

## Final goal and agent verification (do this last, it closes the plan)
**Goal:** every walk in the manifest is verified and wired into the app, at least Tier A is built, and the site stays under the size limit.

Done only when a fresh verifier agent, started in the repo root with no memory of your work, confirms every line. Give it this prompt:
> Read CLAUDE.md and docs/work/final-23/README.md and plan-3-*.md. Do not trust the author's claims. Run `git pull`, `npm run setup`, `node scripts/verify-final-23.mjs --plan 3` and `npm run check`. Then open the app (`npm run dev`), go through every "Integration checklist" box and every line below, and report PASS or FAIL for each with the evidence (command output, a screenshot, or the exact URL and what you saw). Any FAIL, any console error, any "undefined", any placeholder text or image is a FAIL. Do not fix anything; report only.

The author pastes the verifier's report into the PR description. The PR is not merged with a FAIL in it.
- [ ] `node scripts/verify-final-23.mjs --plan 3`, `python3 pipeline/walks/build_walk.py --verify-all` and `npm run walk:verify` all pass.
- [ ] `du -sh walks` is under 800 MB and every new walk is at most 30 MB.
- [ ] For each walk, in a real browser: Explore ring and "3D walk ready" legend; "Walk it in 3D" button on the hike page; forward cloud transition; the right season for each of Q1 to Q4; credits visible; walk Back button returns with the clouds in reverse and the same scroll position; browser Back does the same.
- [ ] Reduced motion (`prefers-reduced-motion`): fade only. Phone width: the button works or is hidden with words, never broken.
- [ ] The first screen network log shows no request under `walks/`.
