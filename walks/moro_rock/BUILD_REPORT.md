# Walk build report: moro_rock

- Hike: **Moro Rock (Sequoia and Kings Canyon National Parks)** (`moro-rock`)  ·  kit trail: `moro_rock`  ·  mode: build
- Generated: 2026-11-25 19:23  ·  Python 3.14.6  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py moro_rock --hike-id moro-rock`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify moro_rock`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| A1 | Preflight | WARN | unreachable: Overpass (use the kit's browser fallback, README section 6) |
| A2 | Config check | PASS | 0s |
| B1 | OSM trail line | PASS | 0s |
| B2 | Elevation and imagery tiles | PASS | 0s |
| B3 | Route | PASS | 0s |
| B4 | Photos | PASS | 0s |
| B5 | Season overlays | PASS | 5s |
| B6 | Walk page | PASS | 0s |
| D1 | Copy into walks/ | PASS | copied pipeline/trail_kit/output/moro_rock -> walks/moro_rock/ |
| D1b | Optimize (lossless) | PASS | 5.1 MB -> 4.3 MB, worst quality score dem 1.0000, season 1.0000, photos 1.0000 |
| C1 | Structure | PASS | 5 referenced files exist, route has 41 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Moro Rock Trailhead (Moro Rock parking)' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 6 m from 'Moro Rock summit' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 0.40 km vs NPS 0.40 km one way (ratio 0.99; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 6,676 ft vs NPS 6,275 ft (6% apart) |
| C4 | Size budget | PASS | 4.3 MB in 90 files (budget 30 MB); largest season/winter/12/697/1601.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 2; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D2 | Manifest | PASS | walks/manifest.json lists 21 walks |
| D3 | Hike-page profile | PASS | profile.json: 41 points, 2 checkpoints, scale 1.013 |
| D4 | App data | PASS | regenerated app/public/data (featured and walk_path come from walks/manifest.json) |
| D5 | App tests | PASS | validate:data and app tests (incl. walks manifest checks) |

## Numbers
| | |
|---|---|
| Route length (walk) | 0.4 km |
| NPS length / highest point | 0.5 mi round-trip, 6,275 ft high |
| Climb along the route | 116 m |
| Highest point on the route | 2035 m |
| Files / size | 90 files, 4.3 MB |
| Real photos | base 2; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/moro_rock/index.html?season=summer (also winter, spring, autumn).

- [x] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [x] **End**: the last stop is the end point the NPS page describes for this hike.
- [x] **Length**: the walk says 0.4 km; the NPS says 0.5 mi round-trip, 6,275 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [x] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [x] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [x] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js moro_rock`.
- [x] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [x] **Hike page**: open `#/hike/moro-rock`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [x] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [x] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.

_Checked 2026-11-25 on the production build under the Pages base path with the same browser script as the other walks (hike-page button and season per quarter, forward and reverse clouds, walk Back and browser Back with the scroll kept, four seasons, credits, reduced motion, phone width, no failed requests) and screenshots reviewed by eye. The camera was reviewed at the start and at sampled points, not at every scroll position._
