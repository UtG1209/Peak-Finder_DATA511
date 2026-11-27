# Walk build report: general_sherman_tree

- Hike: **General Sherman Tree (Sequoia and Kings Canyon National Parks)** (`general-sherman-tree`)  ·  kit trail: `general_sherman_tree`  ·  mode: build
- Generated: 2026-11-25 19:23  ·  Python 3.14.6  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py general_sherman_tree --hike-id general-sherman-tree`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify general_sherman_tree`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| A1 | Preflight | WARN | unreachable: Overpass (use the kit's browser fallback, README section 6) |
| A2 | Config check | PASS | 0s |
| B1 | OSM trail line | PASS | 0s |
| B2 | Elevation and imagery tiles | PASS | 0s |
| B3 | Route | PASS | 0s |
| B4 | Photos | PASS | 0s |
| B5 | Season overlays | PASS | 6s |
| B6 | Walk page | PASS | 0s |
| D1 | Copy into walks/ | PASS | copied pipeline/trail_kit/output/general_sherman_tree -> walks/general_sherman_tree/ |
| D1b | Optimize (lossless) | PASS | 5.9 MB -> 4.9 MB, worst quality score dem 1.0000, season 1.0000, photos 1.0000 |
| C1 | Structure | PASS | 5 referenced files exist, route has 76 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Sherman Tree Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 19 m from 'General Sherman Tree' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 0.75 km vs NPS 0.80 km one way (ratio 0.93; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 7,069 ft vs NPS 7,050 ft (0% apart) |
| C4 | Size budget | PASS | 4.9 MB in 88 files (budget 30 MB); largest season/winter/12/696/1599.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 2; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D2 | Manifest | PASS | walks/manifest.json lists 21 walks |
| D3 | Hike-page profile | PASS | profile.json: 76 points, 2 checkpoints, scale 1.078 |
| D4 | App data | PASS | regenerated app/public/data (featured and walk_path come from walks/manifest.json) |
| D5 | App tests | PASS | validate:data and app tests (incl. walks manifest checks) |

## Numbers
| | |
|---|---|
| Route length (walk) | 0.75 km |
| NPS length / highest point | 1.0 mi round-trip, 7,050 ft high |
| Climb along the route | 7 m |
| Highest point on the route | 2155 m |
| Files / size | 88 files, 4.9 MB |
| Real photos | base 2; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/general_sherman_tree/index.html?season=summer (also winter, spring, autumn).

- [x] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [x] **End**: the last stop is the end point the NPS page describes for this hike.
- [x] **Length**: the walk says 0.75 km; the NPS says 1.0 mi round-trip, 7,050 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [x] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [x] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [x] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js general_sherman_tree`.
- [x] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [x] **Hike page**: open `#/hike/general-sherman-tree`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [x] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [x] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.

_Checked 2026-11-25 on the production build under the Pages base path with the same browser script as the other walks (hike-page button and season per quarter, forward and reverse clouds, walk Back and browser Back with the scroll kept, four seasons, credits, reduced motion, phone width, no failed requests) and screenshots reviewed by eye. The camera was reviewed at the start and at sampled points, not at every scroll position._
