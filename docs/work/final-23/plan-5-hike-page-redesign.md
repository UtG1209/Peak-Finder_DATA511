# Plan 5: Redesign the page behind "Open this hike" (owned and designed by the user)

**Status:** separate track. It does not block Plans 1 to 4 and none of them wait for it. **Language:** design first, then React, TypeScript, D3, three.js.
**Read first:** `README.md` here, CLAUDE.md sections 2 and 3, `../lane-4-hike-page-about.md`, `../design-track.md`, `app/src/styles/README.md`.
**You own:** `app/src/screens/Hike/*`, `app/src/components/charts/*`, `app/src/styles/hike.css`, a new `app/src/screens/Hike/view3d/` if a 3D piece is built, and the matching e2e specs.
**Do not touch:** data shapes (`schema.ts`), the models in `app/src/models/` (use them; change only with approval), Explore, walks, the pipeline.

## Goal
Today the page is one long scroll with text, numbers and a few charts. Replace the dense numbers and text with graphs, plots and interactive dashboards, in 3D where 3D answers the question better than 2D. Keep the three questions in order (Where, When, How much), the answer first, detail on demand.

## What the page shows today (inventory: each row needs a new design)
| Block today | Component | Data | Redesign question |
|---|---|---|---|
| Header: name, park, description, NPS length, summit, difficulty, gear icons, photo, "Walk it in 3D", Back | `HikeHeader.tsx`, `GearList` | `hikes.json` | Which two numbers are the hero? Can length, gain and summit be one mini profile glyph? |
| Quarter chips with match %, best quarter, per-factor bars vs your limits | `FitSection.tsx`, `models/fit.ts`, `match.ts` | `hike_month`, filters | A radar or bullet chart per quarter? A small-multiples row of Q1 to Q4? |
| Month by month strip (high, crowd, smoky, wet, daylight) | `charts/MonthStrip.tsx`, `lib/monthStrip.ts` | `hike_month` | One interactive chart with linked months (brush a month, all measures highlight)? A calendar heat map? |
| Advice vs data card | `AdviceCard.tsx` | `advice.json` | A two-bar "claim vs data" visual instead of a paragraph? |
| On the trail: elevation profile, start time, scrubber, checkpoints, daylight band | `TrailSection.tsx`, `ElevationProfile.tsx`, `DaylightBand.tsx`, `models/checkpoints.ts` | `profiles/<id>.json` | A 3D terrain ribbon of the route with the hiker marker, linked to the 2D profile? |
| What it costs: stacked bars, party size, nights, mode, popover | `CostBars.tsx`, `models/cost.ts`, `lib/costParts.ts` | `cost.json`, `travel.json` | A treemap or waterfall per quarter, with a live "what if" panel? |
| Similar hikes: three cards | `SimilarHikes.tsx`, `models/twins.ts` | all hikes | A scatter (length vs gain, climate as colour) with this hike highlighted and the twins linked? |
| Footer note | `Hike.tsx` | none | Keep: "typical, from past years". |

## Design deliverables (the user does these first, in Claude Design or Figma)
1. Page structure: order of dashboards, what is above the fold on desktop and phone, the one headline sentence ("Q3 fits 84%: cooler than your limit, 1 smoky day, about $640").
2. For every row above: the chart type, the interaction (hover, brush, click, scrub, toggle), the empty and missing-data state, the phone version.
3. Which pieces are 3D and why (candidates: terrain ribbon route with hiker marker; month by quarter "match landscape" surface; 3D scatter of the 23 hikes). Each 3D piece needs a 2D fallback and a text equivalent.
4. One linked-state rule: the selected quarter, month or checkpoint is shared by every chart on the page (today the quarter already is, via the URL `q`).
5. A token sheet: colours only from `tokens.css`, the three difficulty colours, one terracotta accent, amber and red only for hazards with icon and words. Both themes.

## Build rules (do not break these)
- No new data and no change to a data shape: everything comes from the files listed above and the existing models. If a chart needs a new number, derive it in `app/src/models/` with a test, or ask the user.
- Rule 3: the words "typical" or "past years" wherever a number appears; every number has its source one hover away (`meta.json` sources).
- Rule 6: with `prefers-reduced-motion` everything is instant or a fade; 3D never auto-rotates.
- 3D is vanilla three.js in its own lazy chunk (the existing 3D view uses three 0.187 in `screens/Explore/view3d/`; reuse its projection and WebGL check). Chunk at most 250 KB gzip (`scripts/check-budget.mjs` enforces it); the first screen loads nothing new.
- Accessibility: every chart has a text table or description for screen readers, full keyboard use (arrow keys step months, quarters and checkpoints), contrast 4.5:1 in both themes, `npm run design:check` clean (no raw hex, no glyph icons).
- Phone: 3D is desktop-only (as in Explore); phone gets the 2D version of the same chart, not a smaller copy.
- Keep working: the URL (`q`, `units`, `from`, `pick` and the filters), the Back button and scroll restore, the cloud transition and walk return, Share link, Similar hikes links.
- Missing data stays honest: grey cell with the words, factor left out of the match and the card says so.

## Build steps
1. Land the design (deliverables above) in `docs/design/hike-page/` as images or a short PDF plus a `README.md` that lists each chart, its data fields and its interaction.
2. Split `Hike.tsx` (it is long: it holds the cost controls inline) into one component per dashboard, no behaviour change, tests green. Do this first so the redesign is small PRs.
3. Replace one block per PR, in this order: header hero, fit and months (one linked chart), trail (2D then the 3D ribbon), cost, similar hikes scatter, advice visual.
4. For each block: unit tests for any new model code, an e2e step in `app/e2e/hike-ui.spec.ts`, an axe pass in `a11y.spec.ts`, a keyboard path in `keyboard.spec.ts`, a phone check in `layout.spec.ts`.
5. Update the About page text where it describes the page, and CLAUDE.md section 2 "Hike page" in the same PR as each change. Screens and UX rules change only with the user's explicit approval, which this redesign gives for the Hike page only.

## Final goal and agent verification
**Goal:** the page after "Open this hike" tells Where, When and How much through linked graphs, plots and dashboards (3D where designed), for all 23 hikes, with nothing lost that the old page offered.

A fresh verifier agent checks it. Prompt:
> Read CLAUDE.md, docs/work/final-23/README.md and plan-5-hike-page-redesign.md, and the design in docs/design/hike-page/. Run `npm run check` and `npm run e2e`. In `npm run dev`, open every one of the 23 hikes (`/#/hike/<id>`) at each quarter on desktop and phone width, in dark and light. For each row of the inventory table, confirm the new chart exists, matches the design, and that every piece of data the old block showed is still reachable (list any that is missing). Click and key through every control. Report PASS or FAIL with evidence. Do not fix.

- [ ] Every inventory row has its redesigned block; nothing from the old page is lost (header numbers, gear, photo credit, closure notes, daylight warning, source popover, "Not a price quote").
- [ ] One selection (quarter, month, checkpoint) drives every chart; the URL keeps `q`; refresh and Back keep the state.
- [ ] 3D pieces: lazy, within budget, WebGL fallback in words, 2D equivalent, no auto-rotate, desktop only.
- [ ] A text or table equivalent for every chart; axe has no violations; keyboard-only run works; reduced-motion run works.
- [ ] 23 of 23 hikes render with no console error, including hikes with missing data (grey states) and hikes with no walk (no button) and with a walk (button and cloud transition work).
- [ ] `npm run check`, `npm run e2e` and `node scripts/verify-final-23.mjs --plan 4` pass; CLAUDE.md and About updated.
