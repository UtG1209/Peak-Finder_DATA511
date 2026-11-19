# Walk build report: north_cascades

- Hike: **Cascade Pass to Sahale Glacier (North Cascades National Park)** (`cascade-pass-sahale`)  ·  kit trail: `north_cascades`  ·  mode: verify
- Generated: 2026-11-18 16:46  ·  Python 3.15.2  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py north_cascades --hike-id cascade-pass-sahale`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify north_cascades`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| C1 | Structure | PASS | 33 referenced files exist, route has 943 points |
| C2 | Credits and seasons | PASS | credits, illustrative note, 4 seasons and ?season= present |
| C3 | Route vs the hike | PASS | start near trailhead: 135 m from 'Cascade Pass Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 522 m from 'Sahale Glacier Camp' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 9.41 km vs NPS 9.66 km one way (ratio 0.97; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 7,574 ft vs NPS 7,600 ft (0% apart) |
| C4 | Size budget | WARN | 38.7 MB in 461 files (legacy walk, exempt from the 15 MB budget) |
| C5 | Season photos | PASS | base photos 11; per season spring 5, summer 2, autumn 7, winter 5 |
| D3 | Hike-page profile | PASS | profile.json: 943 points, 11 checkpoints, scale 1.026 |

## Numbers
| | |
|---|---|
| Route length (walk) | 9.41 km |
| NPS length / highest point | 12.0 mi round-trip, 7,600 ft high |
| Climb along the route | 1513 m |
| Highest point on the route | 2309 m |
| Files / size | 461 files, 38.7 MB |
| Real photos | base 11; spring 5, summer 2, autumn 7, winter 5 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/north_cascades/index.html?season=summer (also winter, spring, autumn).

- [ ] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [ ] **End**: the last stop is the end point the NPS page describes for this hike.
- [ ] **Length**: the walk says 9.41 km; the NPS says 12.0 mi round-trip, 7,600 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [ ] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [ ] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [ ] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js north_cascades`.
- [ ] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [ ] **Hike page**: open `#/hike/cascade-pass-sahale`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [ ] **Size**: within the 15 MB budget (or an exemption is noted in walks/manifest.json).
- [ ] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.
