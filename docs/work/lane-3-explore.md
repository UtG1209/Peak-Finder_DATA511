# Lane 3: Explore screen (Where)

**Owner:** ______________  **Language:** React + TypeScript  **Needs keys:** none

You own the first screen people see: filters, map, ranked list, the wheel. A working starter is already there in the
look of the 29 Oct prototype (`docs/reference/oct29-prototype.html`, open it in a browser to see the target).

## Files you own
`app/src/screens/Explore/`, `app/src/components/{UsMap,RangeSlider,HikeCard,FakeBanner}.tsx`, `app/src/lib/{explore,filters,useFilters,reasons,bubbles}.ts`,
and `app/src/models/match.ts`. You may add components. Changes to `styles.css` tokens need a PR everyone sees.

## What is built
Home city dropdown, quarter chips, five filters (dual temperature range, crowd chips, smoky and wet day sliders, max travel time) with tiny histograms,
difficulty chips, "Only 3D" switch, ranked list that doubles as the screen-reader map, MapLibre bubbles (area = match %, grey hollow dots for hikes past a
limit, a ring for featured), hover card with reasons and typical cost, zoom controls, empty-state fix suggestion, all state in the URL.

## What you build (in this order)
1. **Verify the spec against the screen** (CLAUDE.md section 2, Explore): every control, state and sentence. Fix gaps.
2. **Motion**: bubbles resize over about 400 ms when the quarter changes (the layers have a radius transition: check it) and the list re-sorts with a
   slide (Framer Motion `layout`). With `prefers-reduced-motion`, everything is instant or a fade.
3. **Hover linking**: hovering a bubble highlights its list row and the other way round (started: check list scroll-into-view).
4. **Random picker**: "Not sure? Spin the wheel" opens a wheel of the **top 12 matching** hikes, weighted by match %, lands, shows the card with
   **Open** and **Spin again**. Reduced motion picks at once. Put it in `app/src/components/Wheel.tsx`; pure `pickWeighted(rows, rng)` in `lib/` with Vitest tests.
5. **Share link** button (copies the URL), metric toggle (km, m, °C) stored in the URL (`units=metric`) and honoured by the card, list and sliders.
6. **States**: loading skeletons for bubbles and rows (the shell shows a basic one), no home city (travel slider greyed, done), no match with the nearest misses
   and the one-click fix (done, test it), missing data for a factor (grey cell "No station within 50 km"; the factor is left out of the match and the card says so),
   data failed to load (one line, Retry, link to About: done in the shell).
7. **Click behaviour**: zoom to the hike, then open the hike page (done; check it is smooth and that Back returns to the same map view).
8. **Accessibility**: contrast 4.5:1 on text including over photos, keyboard order rail then list then map, native sliders with spoken values (done: check),
   colour is never the only signal (amber hazards always with an icon and words), alt text on photos.
9. **Tests**: Vitest for `lib/explore.ts`, `lib/filters.ts`, wheel weighting. A Playwright smoke test (`app/e2e/explore.spec.ts`): load, change quarter,
   see the count change, click a bubble, land on the hike page. Add `npm run e2e` and a CI job.

## Decisions waiting on the team (see [DECISIONS](../DECISIONS.md))
- Hikes with a skipped factor (e.g. no station) can score 100% and rank first. Should they rank lower, with a "partial data" tag?
- Accent colour: orange (prototype) or teal (CLAUDE.md section 3). It is one token, `--accent`.

## Acceptance
- [ ] A first-time user picks a hike and a quarter in under 3 minutes (north star; test with 2 people before round 2).
- [ ] The map and the list are never empty; the empty state always offers the fix.
- [ ] All state round-trips through the URL, including Back and a pasted Share link.
- [ ] `npm run lint`, `npm test`, `npm run build` pass; the Playwright smoke test passes in CI.
- [ ] First screen under 2 s on campus Wi-Fi; photos lazy-loaded at 900 px.
- [ ] Still works unchanged when lanes 1 and 2 replace the fake data (run `npm run validate:data` first).

## Do not
Call a live API, add a login, show red/green pairs, or change a data shape.
