# Design track: UI polish (done with Claude Design)

**Owner:** ______________  **Not a lane:** it cuts across lanes 3 and 4 and the 3D walk template. Functional work stays in the lanes; this track is how it looks and feels.
The visual target is `docs/reference/oct29-prototype.html`. All colours, fonts and sizes live as tokens in `app/src/styles.css` (`:root`) and `app/src/lib/difficulty.ts`:
**change tokens first, components second**, so the whole app moves together. Put design files and exports in `docs/design/` (create it).

## How to work with Claude Design
1. Give it the target (`docs/reference/oct29-prototype.html`), screenshots of today's screens (run `npm run dev`, Explore, a hike page, the guide overlay) and the tokens file.
2. Ask for a revised token set and per-screen changes; apply tokens in `styles.css`, then adjust components. Keep behaviour untouched (tests must stay green: `npm run check`).
3. Check against the rules in CLAUDE.md section 3: contrast 4.5:1, never colour alone, reduced motion, mobile width, units, "typical" wording.
4. Screenshot before and after in the PR.

## To do (in priority order)
1. **Back button on the 3D walk** (requested). The walk page has no way back to the app. Add a clear **"← Back to <hike name>"** button, top left, in the Peak Finder style, on every walk.
   - Implement it once in the kit template (`pipeline/trail_kit/template/template.html`) so every future walk has it, and patch the three existing `walks/*/index.html` (a text edit; never re-run tile steps).
   - Target: the hike page the user came from. The hike page link should pass the return address (`...index.html?season=winter&back=<encoded #/hike/<id>?...>`); the walk reads `back`, falls back to `history.back()`, then to the site root. Keep the user's filters in that address.
   - Lane 2 plays the cloud transition in reverse on this button (CLAUDE.md "3D trail walk"); with reduced motion, a fade. Keyboard reachable, 44 px target, visible focus.
   - Acceptance: from the hike page open the walk, press Back, land on the same hike page with the same quarter and filters, map unblurred.
2. **3D interactive dashboard with Three.js** (requested). A second way to see the whole thing: one interactive 3D scene instead of the flat map, built with Three.js (`three`; optionally `@react-three/fiber`).
   - Idea to start from: the lower 48 as a 3D terrain or extruded-states surface, one 3D peak per hike (colour = difficulty, height or size = match %, outline = 3D walk ready), orbit / zoom / tilt, hover shows the same tile as the map, click selects, the tile's button opens the hike page. Quarter, city and the filters drive it exactly like the map (same URL state, same `evaluate()` results; do not fork the logic).
   - "Dashboard" part: linked panels beside the scene (match by quarter, cost, crowds, smoky days) that update when a peak is selected or a filter moves; reuse the D3-in-React-SVG charts in `app/src/components/charts/`.
   - Hard limits: **lazy-loaded chunk, opened by a "3D view" toggle, never on the first screen** (CI budget check; Three.js is large, so it must not count towards the first-screen JS). Keep a working 2D map as the default and as the fallback when WebGL is missing; honour `prefers-reduced-motion` (no auto-rotate); keyboard and screen-reader users keep the ranked list. Phones: lower detail or fall back to 2D.
   - Needs approval before it becomes a screen: it adds to the screen list in CLAUDE.md section 2 and a dependency, so propose it to the owner with a short mock first.
   - Acceptance: toggle between 2D and 3D keeps the same filters and the selected hike; first-screen budget unchanged; `npm run e2e` has a test that opens the 3D view and sees a canvas of non-zero size.
3. **Typography and sizes.** Fonts and sizes feel off today: set a type scale (display, heading, body, small, number), line heights and weights; check Archivo and Inter load and fall back well; fix cramped rail labels, card text and chart labels.
4. **Walk page look.** Rename the brand pill ("When to Go · Trail test" to "Peak Finder"), match fonts and the dark theme, keep credits legible, make sure nothing overlaps the profile strip.
5. **Explore polish.** Guide overlay, rail spacing and hierarchy, peak-marker overlap in dense areas (clustering or smaller peaks; the markers are flat triangles drawn in `UsMap.tsx`, colour = difficulty, size = match), hover card, legend, empty state, loading skeleton, "What next?" tip placement.
6. **Hike page polish.** Header layout, quarter cards, the cost graph (segment colours, labels, popover), responsive layout, and the sections lane 4 is still building (month strip, profile) so they land in a finished frame.
7. **Mobile and tablet.** Explore stacks the map above the rail below 860 px: design it properly (bottom sheet for the list and card). Hike page at phone width.
8. **Accessibility pass.** Contrast, focus rings, keyboard order (rail, list, map), screen-reader labels, reduced motion everywhere.
9. **Replace placeholders.** Real Commons photos (lane 1) with credits in the card and the hike header; remove the "(placeholder image)" alt text.
10. **Accent decision.** Sand-orange (prototype) or teal (CLAUDE.md's first proposal): one token, `--accent`. Decide once, record it in `docs/DECISIONS.md`.
11. **Known issue to re-test after changes.** An intermittent blank map after browser Back was reported once; the map now resizes itself and guards unmount races (`UsMap.tsx`). If it shows again, capture the console and the URL and add it here.

## Definition of done for a design change
Tokens updated, screenshots before/after in the PR, `npm run check` green (including the performance budget), CLAUDE.md updated if a rule or the look description changed.
