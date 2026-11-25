# Plan 6: optimize every part of the codebase

Status: PLAN ONLY. Nothing here is started. Run it after the Plan 5 design is agreed, so we do not tune a page that is about to be redesigned (the Hike page work in step 3 waits for Plan 5).
Rule for the whole plan: **measure first, change second, measure again.** No optimization lands without a before and after number in `docs/work/final-23/OPTIMIZATION_REPORT.md`. Behaviour, data shapes and the UX rules in CLAUDE.md section 3 do not change.

## Today's numbers (2026-11-25, measured)
| Part | Now | Limit today |
|---|---|---|
| `app/public/data` | 696 KB | 1 MB up front |
| `app/public/photos` | 4.1 MB | 900 px wide, lazy |
| `walks/` | 153 MB (7 walks) | 30 MB each, Pages 1 GB |
| `pipeline/trail_kit` | 472 MB | not shipped |
| `data/` (raw and processed) | 63 MB | `data/raw` ignored |
| Initial JS / map chunk / 3D chunk | see `node scripts/check-budget.mjs` | 150 / 350 / 250 KB gzip |
| CI | about 6 min, pipeline job slowest | none |
Largest source files: `Explore.tsx` 429 lines, `hike.css` 295, `explore.css` 287, `TrailSection.tsx` 220, `Hike.tsx` 215.

## Targets (the final goal, checked in step 8)
1. First screen: initial JS gzip down at least 15% from the step 1 baseline, Lighthouse performance 90+ on the production build (mobile profile), no layout shift from fonts or photos (CLS under 0.05).
2. Data: up-front JSON under 500 KB raw, every file validated by zod once, no file read twice.
3. Photos: every photo at most 150 KB (WebP or AVIF with JPEG fallback, 900 px), with width and height set; total under 2.5 MB.
4. Walks: every walk at or under 25 MB; the repo and the Pages build total under 600 MB.
5. Interaction: Explore filter drag stays at 60 fps with 23 markers (no long task over 50 ms in the trace); Hike page scrubber likewise.
6. Repo and CI: CI under 4 min cold, under 2 min warm; `git clone` under 100 MB of history growth per walk; no 10,000-line diffs from generated files.
7. Nothing regresses: `npm run check`, `npm run e2e`, `npm run verify:final`, pipeline checks all green.

## Step 1: baseline (half a day, no code changes)
- `npm run build`, then `node scripts/check-budget.mjs`; save the numbers. Add `npx vite-bundle-visualizer` output (list only, do not commit).
- Lighthouse (mobile and desktop) on `vite preview` for Explore, a Hike page, About, and the 3D view.
- Chrome performance trace: Explore filter drag, quarter change, map hover, Hike scrubber, cloud transition. Record long tasks.
- `du -sh` for each folder in the table; list the 10 biggest files in `app/public`, `walks/*`, `data/processed`.
- Time every CI job (`gh run view`). Write all of it into `OPTIMIZATION_REPORT.md` as the "before" column.

## Step 2: app bundle and loading (`app/`)
- Read the bundle report. Split by route: Explore, Hike, About each lazy; D3 imported per module (`d3-scale`, `d3-shape`), never `d3`; check `framer-motion` uses `LazyMotion` and `m.` so the full bundle is not pulled; `zod` only where data is parsed.
- Keep MapLibre and three.js as separate lazy chunks (existing budgets); confirm nothing from them is in the entry chunk.
- Preload only the entry data files (`hikes`, `hike_month`, `meta`); fetch `travel`, `cost`, `advice` when a hike or a city needs them; profiles on demand (already). Keep one shared fetch and parse per file.
- Fonts: subset to latin used glyphs, `font-display: swap`, preload only the two fonts used above the fold, keep the metric-matched fallbacks.
- Remove dead code: unused exports, components, CSS selectors, dependencies (`knip` or `ts-prune` and a CSS usage check). `npm ls` for duplicates.

## Step 3: rendering and interaction (React, map, charts)
- Profile with React DevTools: memoize derived `rows` (match, evaluate) once per filter change, not per marker; `useMemo` and `useCallback` only where the profile shows a re-render storm.
- Explore: throttle slider updates to the URL (write on release, render live from local state); list virtualization only if the list ever exceeds about 100 rows (it will not at 23, so skip and say so).
- Map: update marker layers with `setData` or paint expressions, not re-adding layers; cap the pixel ratio at 2; pause rendering when the tab is hidden.
- 3D view (three.js): render on demand only, dispose geometries and materials on leave, share one scene, cap pixel ratio, no per-frame allocations.
- Charts: no re-layout on hover; one `d3` scale per chart per data change; SVG node count under 2,000 per chart; scrubber moves with a transform, not a re-render.
- **Wait for Plan 5** before touching the Hike page structure; only do the generic parts (lazy charts, memoized models) until then.

## Step 4: styles and accessibility cost
- Merge duplicate rules, delete unused selectors, keep tokens only (`npm run design:check` stays green). Prefer `content-visibility: auto` for below-the-fold Hike sections.
- Respect reduced motion everywhere (existing rule); animate only `transform` and `opacity`.
- Re-run axe and keyboard specs after every change here.

## Step 5: photos and static assets
- Convert the 23 photos to WebP (and AVIF if the savings are over 20%) with a JPEG fallback through `<picture>`; set `width` and `height`; `loading="lazy"` except the Hike header photo; `fetchpriority="high"` on that one.
- A single script `pipeline/catalogue/photos.py` owns the conversion (never by hand); the licence and credit check stays. Update the photo test to accept the new formats.
- Favicon and icons: inline SVG only; remove unused files from `app/public`.

## Step 6: data files and the pipeline (`pipeline/`, `data/`)
- Minify committed JSON (already compact in `app/public/data`; do the same for `data/processed`, or stop tracking `data/processed` and generate it in CI, so diffs stop showing 12,000-line deletions).
- Drop fields the app never reads (check each against `schema.ts` and `grep`); round floats to the precision shown (1 decimal for temperature, 2 for fares).
- Profiles: simplify with Douglas-Peucker to about 2,000 points per hike while keeping the Tobler time within 1% (test it); gzip is served by Pages, so measure transfer size, not raw.
- Pipeline speed: cache every network call in `data/raw` (already), add `--only <hike-id>` to each script, run per-park work in parallel with a small thread pool, retry with backoff (the EPA timeout in `errors.md`), and mark the 8 network tests so CI can skip them offline.
- Delete dead scripts, old fake-data branches and CSV columns nothing reads. Every deletion is checked by `pytest pipeline/checks` and `npm run validate:data`.

## Step 7: walks (`walks/`) and the trail kit
- Per walk: `build_walk.py --verify-all` already enforces 30 MB. Lower to 25 MB with: lossless re-optimization of PNG and JPEG tiles, WebP where the walk page supports it, drop zoom levels nobody reaches, dedupe tiles shared between seasons.
- Never re-run s2 or s3 on a finished trail (CLAUDE.md rule); work only on the built output and keep a before and after file listing.
- `pipeline/trail_kit` is 472 MB: confirm it is not in git history growth or in the Pages build (it is not shipped); if it is committed, move the cache to `data/raw` or Git LFS and note it in `docs/DECISIONS.md`.
- Confirm nothing from `walks/` loads on the first screen (CI check stays).
- Deploy workflow: copy only walks listed in the manifest; compress with Pages' default gzip; check total artifact size.

## Step 8: CI and developer speed
- Cache npm (done) and pip (`cache: pip`), cache Playwright browsers, run `lint` and `test` in parallel jobs, share one `npm ci` through an artifact only if it saves time.
- Run the e2e on the production build artifact from the app job instead of rebuilding.
- Split pipeline checks into `offline` (always) and `network` (only on `main` and nightly), so an EPA outage cannot block a PR.
- Add `npm run perf` (budget plus a Lighthouse CI assertion) and a CI step that fails if initial JS, data or photos exceed the new budgets in `scripts/check-budget.mjs` (lower the numbers to the Targets above).
- Keep CLAUDE.md true: new commands, budgets and the optimized photo format go in the same PR.

## Steps in order, and PR sizes
One PR per step (small PRs rule), each with its before and after numbers: 1 report only, 2 bundle, 3 rendering (generic parts), 4 styles, 5 photos, 6 data and pipeline, 7 walks, 8 CI. After Plan 5 ships, one more PR: Hike page rendering.
Steps 2 to 7 touch different files and can run side by side; step 8 comes last because it locks the new budgets.

## Do not do
- Do not change data shapes, screen list or UX rules; do not remove a number the page shows.
- Do not add a dependency to save a few lines; remove dependencies instead.
- Do not optimize without a measurement showing the part is slow or large.
- Do not hand-edit `app/public/data/*.json`.

## Final goal and verifier agent
Done when a fresh agent, given only this file and `OPTIMIZATION_REPORT.md`, confirms by running commands (not by reading claims):
1. `npm run check`, `npm run e2e`, `npm run verify:final`, `pytest pipeline/checks` (offline set) all pass.
2. `node scripts/check-budget.mjs` meets every Target 1 to 4 number; the report shows before and after for each.
3. Lighthouse mobile performance 90+ on Explore, Hike and About; CLS under 0.05.
4. The trace shows no long task over 50 ms on filter drag, quarter change and scrubber.
5. CI cold run under 4 minutes; the `network` pipeline set no longer blocks PRs.
6. No screen, number or button from the integration map in `README.md` is missing (spot-check all 23 hike pages).
The verifier saves its result as `docs/work/final-23/OPTIMIZATION_VERIFY.md` with the command output.
