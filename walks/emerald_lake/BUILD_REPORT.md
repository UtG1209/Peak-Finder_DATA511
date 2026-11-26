# Walk build report: emerald_lake

- Hike: **Emerald Lake (Rocky Mountain National Park)** (`emerald-lake`)  ·  kit trail: `emerald_lake`  ·  mode: build
- Generated: 2026-11-25 19:24  ·  Python 3.14.6  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py emerald_lake --hike-id emerald-lake`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify emerald_lake`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| A1 | Preflight | WARN | unreachable: Overpass (use the kit's browser fallback, README section 6) |
| A2 | Config check | PASS | 0s |
| B1 | OSM trail line | PASS | 0s |
| B2 | Elevation and imagery tiles | PASS | 0s |
| B3 | Route | PASS | 0s |
| B4 | Photos | PASS | 0s |
| B5 | Season overlays | PASS | 7s |
| B6 | Walk page | PASS | 0s |
| D1 | Copy into walks/ | PASS | copied pipeline/trail_kit/output/emerald_lake -> walks/emerald_lake/ |
| D1b | Optimize (lossless) | PASS | 7.8 MB -> 6.4 MB, worst quality score dem 1.0000, season 1.0000, photos 1.0000 |
| C1 | Structure | PASS | 6 referenced files exist, route has 217 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Bear Lake Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 0 m from 'Emerald Lake (end of the Emerald Lake Trail)' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 2.16 km vs NPS 2.90 km one way (ratio 0.75; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 10,132 ft vs NPS 10,110 ft (0% apart) |
| C4 | Size budget | PASS | 6.4 MB in 120 files (budget 30 MB); largest season/spring/12/845/1546.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 3; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D2 | Manifest | PASS | walks/manifest.json lists 21 walks |
| D3 | Hike-page profile | PASS | profile.json: 217 points, 3 checkpoints, scale 1.342 |
| D4 | App data | PASS | regenerated app/public/data (featured and walk_path come from walks/manifest.json) |
| D5 | App tests | PASS | validate:data and app tests (incl. walks manifest checks) |

## Numbers
| | |
|---|---|
| Route length (walk) | 2.16 km |
| NPS length / highest point | 3.6 mi round-trip, 10,110 ft high |
| Climb along the route | 275 m |
| Highest point on the route | 3088 m |
| Files / size | 120 files, 6.4 MB |
| Real photos | base 3; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/emerald_lake/index.html?season=summer (also winter, spring, autumn).

- [x] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [x] **End**: the last stop is the end point the NPS page describes for this hike.
- [x] **Length**: the walk says 2.16 km; the NPS says 3.6 mi round-trip, 10,110 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [x] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [x] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [x] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js emerald_lake`.
- [x] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [x] **Hike page**: open `#/hike/emerald-lake`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [x] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [x] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.

_Checked 2026-11-25 on the production build under the Pages base path with the same browser script as the other walks (hike-page button and season per quarter, forward and reverse clouds, walk Back and browser Back with the scroll kept, four seasons, credits, reduced motion, phone width, no failed requests) and screenshots reviewed by eye. The camera was reviewed at the start and at sampled points, not at every scroll position._
