# Plan 5b: Build the Hike page from the approved design (v2)

**Status: DRAFT. PLAN ONLY. Nothing starts until the user says "go".** Design phase is done; this is the build plan that follows it.
**Design (source of truth):** canvas https://claude.ai/artifact/PXSwjkPPh9qWRL3xPGnvBi, sources in `docs/design/hike-page/canvas-v2/`, numbers and how they were computed in `docs/design/hike-page/README.md` ("v2 (enhanced 2D)"). v1 (`canvas/`) is kept for reference only.
**Decided by the user:** v2 is the base. 2D only: 3D is a later optional add-on and none is built here. Similar hikes stays exactly as deployed. "Walk it in 3D" button stays (deployed feature).
**You own:** `app/src/screens/Hike/*`, `app/src/components/charts/*`, `app/src/styles/hike.css`, matching e2e specs. **Do not touch:** data shapes (`schema.ts`), Explore, walks, pipeline. Models in `app/src/models/` change only with a test and the user's OK.
**Read first:** CLAUDE.md sections 2, 3, 4, 5; `plan-5-hike-page-redesign.md` (rules and the final-goal checklist still apply); `app/src/styles/README.md`.

## Copy and design changes agreed after reviewing v2 (apply while building)
1. Less text: keep the one answer sentence per block and the word "typical" or "past years"; move source lines into the hover/popover (rule 3 stays: every number has its source one hover away).
2. Summit appears once in the header (NPS 5,759 ft). The terrain-tile figure goes in a hover note, not a second visible number.
3. Ties and "no limits set": when several quarters score the same, the headline says so ("Q1, Q2 and Q4 fit your limits; Q4 is cheapest"). With every limit left open, do not claim "fits 100%"; say "no limits set, here is the typical year". Same wording on Explore if it shares the helper (ask first, Explore is not ours).
4. Phone: sticky quarter chips, checkpoint table and advice card collapsed by default, no horizontal page scroll.
5. "Latest start that ends in daylight" only if it is a tested one-liner on `beforeDark`; otherwise drop it.

## Steps (one PR each, `npm run check` green, CLAUDE.md "Hike page" section and About text updated in the same PR)
1. **Split `Hike.tsx`** (215 lines, cost controls inline) into one component per block: `Hero`, `SelectionBar`, `WhenSection` (existing `FitSection`), `AdviceCard`, `TrailSection`, `CostSection`, `SimilarHikes` (unchanged). No behaviour or visual change; all current e2e specs pass as they are.
2. **Tokens and shared bits:** add only what the v2 token sheet needs to `app/src/styles/tokens.css` (type scale steps, spacing); shared `SourceHover` and `StateCell` (missing data, hazard with icon + words) components, with unit tests. `npm run design:check` clean.
3. **Hero and selection bar:** headline sentence from `match.ts`, `cost.ts`, `hike_month` (new helper in `models/` with a test for ties and "no limits"), three big numbers, gear, photo credit, permit/closure note, "Walk it in 3D". Sticky linked-selection bar: quarter (URL `q`), month and checkpoint (in-page state, one provider, every chart reads it).
4. **When:** quarter cards aligned over their month columns, one month chart drawn to scale (high band, limit lines, crowds, smoky, wet, daylight), hover tooltip, arrow keys step months and quarters, "Show as table". Replaces `MonthStrip` and the quarter breakdown; keep `lib/monthStrip.ts` helpers that still apply.
5. **On the trail:** profile to scale with checkpoints, up and back clock times, scrubber, daylight band and warning in words, start-time input, stop card with photo and credit, checkpoint table. Uses `models/checkpoints.ts` as is.
6. **How much:** stacked bars from `cost.ts` with direct labels on the selected bar, popover with line items and sources, what-if (travellers, nights, fly or drive) with live deltas, "Not a price quote" always visible.
7. **Advice vs data:** two-bar claim vs data from `advice.json`; hidden when a hike has no card.
8. **Light theme, phone layout, states pass:** every block in both themes, loading skeletons, no home city, no match, missing factor, data failed (one line + Retry + link to About). Contrast tests extended.
9. **Cleanup:** remove dead chart code and CSS, update `docs/design/hike-page/README.md` with "built", About page text.

## Tests per step
Unit tests for any new model or lib code; `hike-ui.spec.ts` step per block; `a11y.spec.ts` axe pass; `keyboard.spec.ts` (arrow keys on months, quarters, checkpoints; Esc closes popovers); `layout.spec.ts` phone width; reduced-motion spec; URL state (`q`, `units`, `from`, `pick`, filters), Back and scroll restore, cloud transition and walk return, Share link, Similar hikes links all keep working.

## Do not do
No data or schema change; no new dependency; no 3D; no change to Explore, walks, pipeline or `ci.yml`; do not run the Plan 6 optimizations here (Plan 6 waits for this plan to land); no commit of `docs/design/` without `git add -f` (it is gitignored) and the user's OK.

## Design decisions (made by Claude on 2026-11-25 at the user's request; the user may override any of them)
1. **Ties and no limits.** One helper in `app/src/models/` (with tests) builds the headline. One winner: "Q4 fits 91%: typical high 67°F, no smoky days, about $1,437 from Seattle." A tie: "Q1, Q2 and Q4 fit your limits. Q4 is the cheapest, at about $1,437." No limit set: "No limits set. Here is the typical year: Q4 is the cheapest, about $1,437." Never "100%" in a headline. The helper is neutral; the Hike page adopts it first, and Explore adopts it in a later small PR that the user approves (Explore is not ours).
2. **Quarter cards and month chart stay separate**, as v2 draws them (cards aligned over their month columns). A merged "season lens" can come later; it is not needed for the goal.
3. **"Latest start that ends in daylight" is dropped.** The start-time input and the daylight warning in words stay (both use `beforeDark`, no new model).
4. **Reference hikes for e2e and the verifier:** `angels-landing` (has a walk, the design's reference), `half-dome` (closure note, no walk, long and steep), `anhinga-trail` (flat, zero gain: tests the profile and match edge cases). No hike has missing weather data today, so the grey "No station within 50 km" state is tested with a fixture in unit tests and one e2e that stubs the data file.
5. **Summit:** header shows the NPS figure only; the terrain figure sits in the source hover.
6. **Chart labels:** direct labels first; where two labels would collide the lower-priority one moves into the hover card. Verified in a real browser at each step (the v2 boards were never rendered).

## Final goal and agent verification
**Goal:** all 23 hike pages match the v2 design in both themes and at phone width, with nothing from the old page lost (header numbers, gear, photo credit, closure notes, daylight warning, source popover, "Not a price quote").
Fresh verifier agent prompt:
> Read CLAUDE.md, docs/work/final-23/plan-5-hike-page-redesign.md, plan-5b-build-from-v2.md and docs/design/hike-page/canvas-v2/. Run `npm run check` and `npm run e2e`. In `npm run dev` open every one of the 23 hikes (`/#/hike/<id>`) at each quarter, desktop and phone, dark and light. For each block confirm it matches v2, every datum the old page showed is still reachable, and every control works by mouse and keyboard. Report PASS or FAIL with evidence. Do not fix.

- [ ] Every block built to v2, nothing lost from the old page.
- [ ] One selection (quarter, month, checkpoint) drives every chart; URL keeps `q`; refresh and Back keep state.
- [ ] Ties and no-limit wording correct; missing-data cells honest.
- [ ] axe clean, keyboard-only run works, reduced-motion works, contrast 4.5:1 both themes.
- [ ] 23 of 23 render with no console error; hikes with no walk show no button; hikes with a walk keep the cloud transition.
- [ ] `npm run check`, `npm run e2e`, `node scripts/verify-final-23.mjs --plan 4` pass; CLAUDE.md and About updated.
