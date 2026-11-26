# Walk build report: alum_cave_leconte

- Hike: **Alum Cave to Mount LeConte (Great Smoky Mountains National Park)** (`alum-cave-leconte`)  ·  kit trail: `alum_cave_leconte`  ·  mode: build
- Generated: 2026-11-25 16:36  ·  Python 3.14.6  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py alum_cave_leconte --hike-id alum-cave-leconte`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify alum_cave_leconte`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| A1 | Preflight | WARN | unreachable: Overpass (use the kit's browser fallback, README section 6) |
| A2 | Config check | PASS | 0s |
| B1 | OSM trail line | PASS | 43s |
| B2 | Elevation and imagery tiles | PASS | 6s |
| B3 | Route | PASS | 0s |
| B4 | Photos | PASS | 2s |
| B5 | Season overlays | PASS | 10s |
| B6 | Walk page | PASS | 0s |
| D1 | Copy into walks/ | PASS | copied pipeline/trail_kit/output/alum_cave_leconte -> walks/alum_cave_leconte/ |
| D1b | Optimize (lossless) | PASS | 10.5 MB -> 8.7 MB, worst quality score dem 1.0000, season 1.0000, photos 1.0000 |
| C1 | Structure | PASS | 6 referenced files exist, route has 807 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Alum Cave Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 6 m from 'LeConte Lodge' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 8.06 km vs NPS 8.05 km one way (ratio 1.00; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 6,381 ft vs NPS 6,593 ft (3% apart) |
| C4 | Size budget | PASS | 8.7 MB in 192 files (budget 30 MB); largest season/winter/12/1099/1613.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 3; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D2 | Manifest | PASS | walks/manifest.json lists 15 walks |
| D3 | Hike-page profile | PASS | profile.json: 807 points, 4 checkpoints, scale 0.999 |
| D4 | App data | PASS | regenerated app/public/data (featured and walk_path come from walks/manifest.json) |
| D5 | App tests | FAIL | app tests failed: read the output above |

## Numbers
| | |
|---|---|
| Route length (walk) | 8.06 km |
| NPS length / highest point | 10.0 mi round-trip, 6,593 ft high |
| Climb along the route | 1187 m |
| Highest point on the route | 1945 m |
| Files / size | 192 files, 8.7 MB |
| Real photos | base 3; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/alum_cave_leconte/index.html?season=summer (also winter, spring, autumn).

- [x] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [x] **End**: the last stop is the end point the NPS page describes for this hike.
- [x] **Length**: the walk says 8.06 km; the NPS says 10.0 mi round-trip, 6,593 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [x] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [x] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [x] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js alum_cave_leconte`.
- [x] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [x] **Hike page**: open `#/hike/alum-cave-leconte`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [x] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [x] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.

_Checked 2026-11-25 on the production build under the Pages base path: 178-check browser script over all 16 walks (hike-page button and season per quarter, forward and reverse clouds, walk Back and browser Back with scroll kept, four seasons, credits, reduced motion, phone width, no failed requests), plus screenshots of each season reviewed by eye. The camera was reviewed at the start and at sampled points along the route, not at every scroll position._
