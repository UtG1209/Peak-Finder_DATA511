# Hike page redesign: design (Plan 5, step 1)

Status: **draft for the user to decide on.** No app code changed.

- Design canvas (Claude Design, private link): https://claude.ai/artifact/3eNUHj6xX1d1ZLWX38TCQ5 . Sources of each board are in `canvas/`: wireframes (desktop, phone), mockups (desktop dark, desktop light, phone dark), 3D options sheet.
- Live 3D world (three.js, real data, hover and click): `3d-options.html` here, also https://claude.ai/artifact/NYuZPpDx4785PVQ5JiyULZ . It loads three 0.170 from jsDelivr, so open it through a web server or the link, not `file://`. Not yet run in a browser by me.
- All numbers in the mocks are illustrative (Angels Landing, home SEA, one traveller, limit 55 to 85 F).

## Page order and the one linked-state rule
Hero (answer) > Selection bar (sticky) > When > Advice vs data > On the trail > How much > Similar hikes > footer.
One selection (quarter, month, checkpoint) lives in one place, echoed in the sticky bar. Quarter stays in the URL (`q`); month and checkpoint are in-page state.
Headline: "Q4 fits 91%: typical high 67 F, no smoky days, about $1,440 from Seattle." (built from `match.ts`, `cost.ts`, `hike_month`).

## Block table
| Block | Chart | Data | Interaction | Phone | Fallback / missing |
|---|---|---|---|---|---|
| Hero | Headline sentence, 3 big numbers, mini profile glyph | `hikes.json`, profile, match, cost | hover = source | stacked, full-width 3D button | missing factor named in the sentence as "left out" |
| When: quarters | Four small cards, match % + top limiting factor in words | `fit.ts`, `match.ts` | click, arrows | swipe, snap | grey card with the words |
| When: months | One chart: high band + limit lines, crowd bars, smoky and wet dots, daylight | `hike_month` | hover or brush a month, arrows | horizontal scroll, tap | "No station within 50 km" cell; table toggle |
| Advice vs data | Quote + two bars + source | `advice.json` | none | same | block hidden if no card |
| On the trail | 2D profile (default) or 3D ribbon (option A), scrubber, checkpoints, daylight band | `profiles/<id>.json`, `checkpoints.ts` | scrub, Back/Forward, arrows | 2D only | checkpoint list |
| How much | Stacked bars Q1..Q4 + what-if panel + live delta | `cost.json`, `travel.json`, `cost.ts` | click segment = popover, controls | stacked | "Not a price quote" always visible |
| Similar | **Unchanged: as deployed on the live site** (`SimilarHikes.tsx`, three photo-first twin cards, why line, links) | `hikes.json`, `twins.ts` | link | same | existing empty state |

## 3D decision (2026-11-25, from the user)
**The approved design is the 2D page.** 3D is optional and a later add-on, not part of the redesign build. Three 3D tries were rejected: chart-style options (A/B/C), "Hike World" (`3d-options.html`) and "Hike Almanac" (`3d-dashboard.html`, "too confusing, looks ugly"). They stay in this folder as reference only.
If 3D comes back later, the user wants: hover shows nice frosted data cards, every object clickable, simple and polished (see the first note below), desktop only, 2D fallback and text version, lazy chunk under 250 KB gzip.
Similar hikes stays exactly as deployed.

## v2 (enhanced 2D)
Same structure and order as the approved v1, more craft. v1 is unchanged (its canvas and `canvas/` are untouched).
- Canvas (private link): https://claude.ai/artifact/PXSwjkPPh9qWRL3xPGnvBi . Sources in `canvas-v2/`: full desktop page dark (`Main`) and light (`Light`), phone dark and light, token sheet, interactions and states.
- Better than v1: every chart drawn to scale from real data (month chart from `hike_month`, the 332-point profile smoothed and downsampled to 112 points per leg, true checkpoint positions and Tobler clock times, cost stacks from `cost.ts`); real photos with Commons credits; real Similar hikes twins (`twins.ts`); type only from the token scale (v1 used 56/40/30/28 px); answer-first rhythm (eyebrow, Fraunces answer sentence, Archivo numbers) in every block; quarter cards aligned to their three month columns; direct labels on the selected cost bar; card styling by role (chart card, control panel, ruled evidence); hover tooltip, heat-day and permit/exposure hazards (amber, icon, words), daylight warning, missing-data cells, cost popover, source tooltip, no-city, loading and error states; 44 px targets and real buttons, inputs and labels.
- Dropped from v1: the "3D ribbon" toggle (3D is out). Kept: the existing "Walk it in 3D" button for featured hikes.

Numbers (Angels Landing, home SEA, Q4, limit 55 to 85 F, 1 traveller, 2 nights, fly), computed by running copies of `app/src/models/{match,cost,checkpoints,twins}.ts` with Node on `app/public/data`:
- Match: Q1 100%, Q2 100%, Q3 0% (97 F, 12 F past 85 with a 10 F tolerance), Q4 100%. Only the temperature limit is set. `bestQuarter` breaks the tie on cost: Q4.
- Cost (`tripCost`): Q1 $1,441, Q2 $1,564, Q3 $1,487, Q4 $1,437 (transport $792 = flights 2 x $306.16 + car $60 x 3 days; lodging $246 = $110 x 2 x 1.12; food $170 = $68 x 2.5; entry and permit $41; buffer 15% $187). One more night +$289; driving $1,035; two travellers $2,337.
- Trail (`timeline`, start = Nov sunrise 7:10 + 1 h): C0 8:10, C1 8:28, C2 9:04, C3 9:21, C4 9:44, C5 10:02, summit 10:32, back down C5 10:57, C4 11:14, C3 11:34, C2 11:50, C1 12:19, C0 12:44 pm; 4 h 34 min; sunset 5:23 pm. Latest start that ends in daylight 12:49 pm (a 1:00 pm start ends 5:34 pm).
- Month values are `hike_month` as stored; quarter values are `quarterValues` (Q4 high 66.8 F, crowd 0.49).
- Twins: The Narrows (same park), Delicate Arch, Moro Rock.
- Contrast pairs on the token sheet use the WCAG formula on `tokens.css` values; all pass 4.5:1.
- Not checked in a browser (the brief said not to). The missing-data cells are drawn for a hike without a station; Angels Landing has one.

## Open decisions for the user
1. 3D: none for now (decided). Build the 2D redesign first.
2. Merge quarter cards and month chart into the one "season lens" shown here, or keep them separate.
3. Hero: headline sentence as shown, or the three numbers first.
4. Plan-shape of the ribbon needs the route lat/lon from the walk files or the profile pipeline; profiles hold distance and elevation only (illustrative meander in the demo).
5. Token sheet: mocks use `tokens.css` values and the three difficulty colours only; amber/red unused (no hazard shown in the mocks).
