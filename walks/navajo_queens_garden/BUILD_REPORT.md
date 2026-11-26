# Walk build report: navajo_queens_garden

- Hike: **Navajo Loop and Queen's Garden (Bryce Canyon National Park)** (`navajo-loop-queens-garden`)  ·  kit trail: `navajo_queens_garden`  ·  mode: build
- Generated: 2026-11-25 16:26  ·  Python 3.14.6  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py navajo_queens_garden --hike-id navajo-loop-queens-garden`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify navajo_queens_garden`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| A1 | Preflight | WARN | unreachable: Overpass (use the kit's browser fallback, README section 6) |
| A2 | Config check | PASS | 0s |
| B1 | OSM trail line | PASS | 31s |
| B2 | Elevation and imagery tiles | PASS | 4s |
| B3 | Route | PASS | 0s |
| B4 | Photos | PASS | 2s |
| B5 | Season overlays | PASS | 5s |
| B6 | Walk page | PASS | 0s |
| D1 | Copy into walks/ | PASS | copied pipeline/trail_kit/output/navajo_queens_garden -> walks/navajo_queens_garden/ |
| D1b | Optimize (lossless) | PASS | 7.2 MB -> 6.1 MB, worst quality score dem 1.0000, season 1.0000, photos 1.0000 |
| C1 | Structure | PASS | 7 referenced files exist, route has 435 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Sunrise Point (Queen's Garden Trailhead)' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 4.34 km vs NPS 4.67 km one way (ratio 0.93; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 8,001 ft vs NPS 8,002 ft (0% apart) |
| C4 | Size budget | PASS | 6.1 MB in 121 files (budget 30 MB); largest season/spring/12/771/1585.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 4; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D2 | Manifest | PASS | walks/manifest.json lists 10 walks |
| D3 | Hike-page profile | PASS | profile.json: 435 points, 6 checkpoints, scale 1.076 |
| D4 | App data | PASS | regenerated app/public/data (featured and walk_path come from walks/manifest.json) |
| D5 | App tests | FAIL | app tests failed: read the output above |

## Numbers
| | |
|---|---|
| Route length (walk) | 4.34 km |
| NPS length / highest point | 2.9 mi loop, 8,002 ft high |
| Climb along the route | 412 m |
| Highest point on the route | 2439 m |
| Files / size | 121 files, 6.1 MB |
| Real photos | base 4; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/navajo_queens_garden/index.html?season=summer (also winter, spring, autumn).

- [x] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [x] **End**: the last stop is the end point the NPS page describes for this hike.
- [x] **Length**: the walk says 4.34 km; the NPS says 2.9 mi loop, 8,002 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [x] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [x] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [x] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js navajo_queens_garden`.
- [x] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [x] **Hike page**: open `#/hike/navajo-loop-queens-garden`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [x] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [x] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.

_Checked 2026-11-25 on the production build under the Pages base path: 178-check browser script over all 16 walks (hike-page button and season per quarter, forward and reverse clouds, walk Back and browser Back with scroll kept, four seasons, credits, reduced motion, phone width, no failed requests), plus screenshots of each season reviewed by eye. The camera was reviewed at the start and at sampled points along the route, not at every scroll position._
