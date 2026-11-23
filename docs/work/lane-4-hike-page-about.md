# Lane 4: Hike page (When and How much), About page, and user testing

**Owner:** ______________  **Language:** React + TypeScript, D3 as React SVG  **Needs keys:** none

You own the page people read before they decide: one scrolling page per hike. **Already built as a starter** in `app/src/screens/Hike/Hike.tsx`: header (difficulty colour, NPS length, gain, highest point, permit and closure notes), the four quarter cards with match % and "Best fit", and the **cost graph** (`components/charts/CostBars.tsx`: stacked bars Q1 to Q4 with lodging, food, transport, park fees and the hatched 15% buffer, cheapest and best-fit labels, party size, nights, fly or drive, click a segment for line items and source from `meta.json` `cost_sources`). **Status:** the month strip (`components/charts/MonthStrip.tsx`, heading id `months-h`), the timed profile with daylight band and checkpoint tables (`screens/Hike/TrailSection.tsx`, `trail-h`), the fit breakdown, the Advice vs data card and `About.tsx` are built and re-skinned with the design tokens (`styles/hike.css`, `styles/about.css`). Still open: similar hikes, validating hike times against NPS estimates for 5 hikes, and user testing. Review the starter against CLAUDE.md, then build the rest. The paper prototypes are in `docs/paper-prototype/`. The pie chart on the orange sticky note was rejected: use stacked bars.

## Files you own
`app/src/screens/Hike/`, `app/src/screens/About/`, new chart components under `app/src/components/charts/`, and the models
`app/src/models/checkpoints.ts` and `cost.ts` (60 tests already pass; extend them).
Data: `useData()` for the small files; `loadProfile(id)` for the elevation profile (one file per hike, loaded on demand).
The selected quarter, home city and filters arrive in the URL (`parseFilters(useSearchParams())` or `useFilters()`).

## What you build (CLAUDE.md section 2, "Hike page"; build in this order)
1. **Header**: name, park, description, **NPS** length and summit elevation (not the OSM length), difficulty, gear icons, photo with Commons credit,
   "Walk it in 3D" (featured only; lane 2 provides `CloudTransition`), "Back to map" (returns to the same map state).
2. **Fit for you**: Q1 to Q4 chips with match %, best quarter marked (`bestQuarter` in the match model, tie goes to the cheaper), and a breakdown for the
   chosen quarter: one bar per factor, typical value vs the user's limit (use `computeMatch(...).factors`; `reasonRows` gives the words).
3. **Month by month** strip: 12 columns of typical high, crowd level, smoky days, wet days, daylight hours. Cells past the user's limits are marked (icon
   and text, not colour alone); the chosen quarter's three months are framed; missing data is a grey cell "No station within 50 km".
   Hazard row (heat, smoke, snow, closure) uses amber with an icon and words. The "Advice vs data" card appears here when the hike has one.
4. **On the trail**: elevation profile with time. X = distance, Y = elevation, with axes and units; out-and-back shows the climb and the return.
   Start time input (default: 1 hour after sunrise in the chosen quarter's middle month: `defaultStartMin`). Checkpoints C0 to Cn on the profile with the
   clock time going up **and** coming back (`timeline`). Time scrubber (drag the profile or a time slider) with a hiker marker (`positionAt`), elapsed time,
   distance, elevation and the current stop photo. Back/Forward buttons and arrow keys step between checkpoints in both directions. Daylight band
   (sunrise to sunset) and a warning in words if the finish (`finishTime`) is after dark (`beforeDark`).
5. **What it costs** (starter built; verify and polish): four stacked bars Q1 to Q4 (lodging, food, transport, activity) plus a hatched 15% buffer on top; total on each bar; cheapest and best
   quarter labelled; controls for party size, nights, drive or fly (default = shorter door to trailhead, from `travel.json`); click a segment for a popover
   with its line items and source (`tripCost(...).lines`). Label: "Typical, from past data. Not a price quote." No pie.
6. **About**: sources with links and as-of dates (from `meta.json`), how match % is computed with a worked example (Angels Landing Q3, limit 60 to 85 F:
   temperature scores about 0 and the bubble goes grey), tolerances, and the honest limits: park-level crowds, county-level AQI, station-based weather,
   typical not quoted costs, illustrative season maps, and any global time correction.
7. **Similar hikes** (Should, only after G3): three twin cards, z-scores of length, gain, top elevation and 12 monthly highs; one line on why.

## User testing (you run it, everyone helps)
Round 1 lo-fi (Week 8, 3 people), round 2 hi-fi (Week 10, 4 to 5 people, SUS), final check (2 new people). Tasks, session script and targets are in
`docs/implementation-plan.pdf` section 11. Keep one shared sheet (task, outcome, time, quote, issue, Nielsen severity 0 to 4). Fix every severity 3 and 4
before the next round, and link each fix to the finding that caused it (that list is the report's "what testing changed" section).

## Acceptance
- [ ] Changing the quarter on the hike page changes everything: fit, strip highlight, checkpoint daylight, cost focus.
- [ ] Angels Landing: starting at 7 am shows the summit time and whether you finish before dark, in each quarter.
- [ ] Every number has a source one hover away; the words "typical" or "past years" appear wherever a number does.
- [ ] Works with the fake data now and unchanged with real data (run `npm run validate:data`).
- [ ] Keyboard: arrows step checkpoints, scrubber is operable without a mouse; sliders and inputs are native with spoken values.
- [ ] `npm run lint`, `npm test`, `npm run build` pass; add Vitest tests for any new pure function and a Playwright check of the hike page.

## Do not
Use a pie chart, show a forecast or price quote, put cost inside the match score (cost is a separate number beside match), or change a data shape.
