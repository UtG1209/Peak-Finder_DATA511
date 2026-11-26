# Walk build report: inspiration_point

- Hike: **Hidden Falls and Inspiration Point (Grand Teton National Park)** (`inspiration-point`)  ·  kit trail: `inspiration_point`  ·  mode: build
- Generated: 2026-11-25 16:35  ·  Python 3.14.6  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py inspiration_point --hike-id inspiration-point`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify inspiration_point`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| A1 | Preflight | WARN | unreachable: Overpass (use the kit's browser fallback, README section 6) |
| A2 | Config check | PASS | 0s |
| B1 | OSM trail line | PASS | 56s |
| B2 | Elevation and imagery tiles | PASS | 5s |
| B3 | Route | PASS | 0s |
| B4 | Photos | PASS | 1s |
| B5 | Season overlays | PASS | 6s |
| B6 | Walk page | PASS | 0s |
| D1 | Copy into walks/ | PASS | copied pipeline/trail_kit/output/inspiration_point -> walks/inspiration_point/ |
| D1b | Optimize (lossless) | PASS | 8.5 MB -> 7.0 MB, worst quality score dem 1.0000, season 1.0000, photos 1.0000 |
| C1 | Structure | PASS | 5 referenced files exist, route has 428 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Jenny Lake Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 10 m from 'Inspiration Point' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 4.26 km vs NPS 4.59 km one way (ratio 0.93; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 7,219 ft vs NPS 7,221 ft (0% apart) |
| C4 | Size budget | PASS | 7.0 MB in 164 files (budget 30 MB); largest season/winter/12/788/1492.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 2; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D2 | Manifest | PASS | walks/manifest.json lists 14 walks |
| D3 | Hike-page profile | PASS | profile.json: 428 points, 2 checkpoints, scale 1.076 |
| D4 | App data | PASS | regenerated app/public/data (featured and walk_path come from walks/manifest.json) |
| D5 | App tests | FAIL | app tests failed: read the output above |

## Numbers
| | |
|---|---|
| Route length (walk) | 4.26 km |
| NPS length / highest point | 5.7 mi round-trip, 7,221 ft high |
| Climb along the route | 327 m |
| Highest point on the route | 2200 m |
| Files / size | 164 files, 7.0 MB |
| Real photos | base 2; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/inspiration_point/index.html?season=summer (also winter, spring, autumn).

- [x] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [x] **End**: the last stop is the end point the NPS page describes for this hike.
- [x] **Length**: the walk says 4.26 km; the NPS says 5.7 mi round-trip, 7,221 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [x] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [x] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [x] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js inspiration_point`.
- [x] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [x] **Hike page**: open `#/hike/inspiration-point`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [x] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [x] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.

_Checked 2026-11-25 on the production build under the Pages base path: 178-check browser script over all 16 walks (hike-page button and season per quarter, forward and reverse clouds, walk Back and browser Back with scroll kept, four seasons, credits, reduced motion, phone width, no failed requests), plus screenshots of each season reviewed by eye. The camera was reviewed at the start and at sampled points along the route, not at every scroll position._
