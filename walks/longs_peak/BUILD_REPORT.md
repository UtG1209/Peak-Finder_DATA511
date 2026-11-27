# Walk build report: longs_peak

- Hike: **Longs Peak Keyhole Route (Rocky Mountain National Park)** (`longs-peak`)  ·  kit trail: `longs_peak`  ·  mode: build
- Generated: 2026-11-25 19:17  ·  Python 3.14.6  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py longs_peak --hike-id longs-peak`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify longs_peak`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| A1 | Preflight | WARN | unreachable: Overpass (use the kit's browser fallback, README section 6) |
| A2 | Config check | PASS | 0s |
| B1 | OSM trail line | PASS | 0s |
| B2 | Elevation and imagery tiles | PASS | 0s |
| B3 | Route | PASS | 0s |
| B4 | Photos | PASS | 1s |
| B5 | Season overlays | PASS | 12s |
| B6 | Walk page | PASS | 0s |
| D1 | Copy into walks/ | PASS | copied pipeline/trail_kit/output/longs_peak -> walks/longs_peak/ |
| D1b | Optimize (lossless) | PASS | 13.6 MB -> 11.4 MB, worst quality score dem 1.0000, season 1.0000, photos 1.0000 |
| C1 | Structure | PASS | 6 referenced files exist, route has 1043 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Longs Peak Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 5 m from 'Longs Peak summit' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 10.41 km vs NPS 12.07 km one way (ratio 0.86; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 14,257 ft vs NPS 14,259 ft (0% apart) |
| C4 | Size budget | PASS | 11.4 MB in 261 files (budget 30 MB); largest season/winter/12/847/1546.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 3; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D2 | Manifest | PASS | walks/manifest.json lists 21 walks |
| D3 | Hike-page profile | PASS | profile.json: 1043 points, 5 checkpoints, scale 1.159 |
| D4 | App data | PASS | regenerated app/public/data (featured and walk_path come from walks/manifest.json) |
| D5 | App tests | FAIL | app tests failed: read the output above |

## Numbers
| | |
|---|---|
| Route length (walk) | 10.41 km |
| NPS length / highest point | 15.0 mi round-trip, 14,259 ft high |
| Climb along the route | 1636 m |
| Highest point on the route | 4346 m |
| Files / size | 261 files, 11.4 MB |
| Real photos | base 3; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/longs_peak/index.html?season=summer (also winter, spring, autumn).

- [x] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [x] **End**: the last stop is the end point the NPS page describes for this hike.
- [x] **Length**: the walk says 10.41 km; the NPS says 15.0 mi round-trip, 14,259 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [x] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [x] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [x] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js longs_peak`.
- [x] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [x] **Hike page**: open `#/hike/longs-peak`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [x] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [x] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.

_Checked 2026-11-25 on the production build under the Pages base path with the same browser script as the other walks (hike-page button and season per quarter, forward and reverse clouds, walk Back and browser Back with the scroll kept, four seasons, credits, reduced motion, phone width, no failed requests) and screenshots reviewed by eye. The camera was reviewed at the start and at sampled points, not at every scroll position._
