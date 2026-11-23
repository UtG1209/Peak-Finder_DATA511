# Walk build report: grinnell_glacier_overlook

- Hike: **Grinnell Glacier (Glacier National Park)** (`grinnell-glacier`)  ·  kit trail: `grinnell_glacier_overlook`  ·  mode: verify
- Generated: 2026-11-19 20:28  ·  Python 3.14.8  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py grinnell_glacier_overlook --hike-id grinnell-glacier`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify grinnell_glacier_overlook`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| C1 | Structure | PASS | 5 referenced files exist, route has 908 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Many Glacier Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 16 m from 'Grinnell Glacier Overlook' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 9.07 km vs NPS 8.53 km one way (ratio 1.06; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 6,529 ft vs NPS 6,740 ft (3% apart) |
| C4 | Size budget | PASS | 15.7 MB in 286 files (budget 30 MB); largest season/summer/12/753/1410.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 2; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D3 | Hike-page profile | PASS | profile.json: 908 points, 5 checkpoints, scale 0.941 |

## Numbers
| | |
|---|---|
| Route length (walk) | 9.07 km |
| NPS length / highest point | 10.6 mi round-trip, 6,740 ft high |
| Climb along the route | 909 m |
| Highest point on the route | 1990 m |
| Files / size | 286 files, 15.7 MB |
| Real photos | base 2; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/grinnell_glacier_overlook/index.html?season=summer (also winter, spring, autumn).

- [ ] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [ ] **End**: the last stop is the end point the NPS page describes for this hike.
- [ ] **Length**: the walk says 9.07 km; the NPS says 10.6 mi round-trip, 6,740 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [ ] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [ ] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [ ] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js grinnell_glacier_overlook`.
- [ ] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [ ] **Hike page**: open `#/hike/grinnell-glacier`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [ ] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [ ] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.
