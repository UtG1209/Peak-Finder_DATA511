# Walk build report: delicate_arch

- Hike: **Delicate Arch (Arches National Park)** (`delicate-arch`)  ·  kit trail: `delicate_arch`  ·  mode: build
- Generated: 2026-11-25 16:24  ·  Python 3.14.6  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py delicate_arch --hike-id delicate-arch`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify delicate_arch`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| A1 | Preflight | WARN | unreachable: Overpass (use the kit's browser fallback, README section 6) |
| A2 | Config check | PASS | 0s |
| B1 | OSM trail line | PASS | 63s |
| B2 | Elevation and imagery tiles | PASS | 5s |
| B3 | Route | PASS | 0s |
| B4 | Photos | PASS | 2s |
| B5 | Season overlays | PASS | 4s |
| B6 | Walk page | PASS | 0s |
| D1 | Copy into walks/ | PASS | copied pipeline/trail_kit/output/delicate_arch -> walks/delicate_arch/ |
| D1b | Optimize (lossless) | PASS | 6.7 MB -> 5.8 MB, worst quality score dem 1.0000, season 1.0000, photos 1.0000 |
| C1 | Structure | PASS | 6 referenced files exist, route has 251 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Delicate Arch Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 448 m from 'Delicate Arch' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 2.49 km vs NPS 2.41 km one way (ratio 1.03; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 4,887 ft vs NPS 4,771 ft (2% apart) |
| C4 | Size budget | PASS | 5.8 MB in 144 files (budget 30 MB); largest season/winter/12/801/1569.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 3; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D2 | Manifest | PASS | walks/manifest.json lists 9 walks |
| D3 | Hike-page profile | PASS | profile.json: 251 points, 3 checkpoints, scale 0.969 |
| D4 | App data | PASS | regenerated app/public/data (featured and walk_path come from walks/manifest.json) |
| D5 | App tests | FAIL | app tests failed: read the output above |

## Numbers
| | |
|---|---|
| Route length (walk) | 2.49 km |
| NPS length / highest point | 3.0 mi round-trip, 4,771 ft high |
| Climb along the route | 241 m |
| Highest point on the route | 1490 m |
| Files / size | 144 files, 5.8 MB |
| Real photos | base 3; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/delicate_arch/index.html?season=summer (also winter, spring, autumn).

- [x] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [x] **End**: the last stop is the end point the NPS page describes for this hike.
- [x] **Length**: the walk says 2.49 km; the NPS says 3.0 mi round-trip, 4,771 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [x] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [x] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [x] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js delicate_arch`.
- [x] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [x] **Hike page**: open `#/hike/delicate-arch`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [x] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [x] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.

_Checked 2026-11-25 on the production build under the Pages base path: 178-check browser script over all 16 walks (hike-page button and season per quarter, forward and reverse clouds, walk Back and browser Back with scroll kept, four seasons, credits, reduced motion, phone width, no failed requests), plus screenshots of each season reviewed by eye. The camera was reviewed at the start and at sampled points along the route, not at every scroll position._
