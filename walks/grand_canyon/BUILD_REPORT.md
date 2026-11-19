# Walk build report: grand_canyon

- Hike: **Bright Angel Trail to Phantom Ranch (Grand Canyon National Park)** (`bright-angel-trail`)  ·  kit trail: `grand_canyon`  ·  mode: verify
- Generated: 2026-11-18 16:46  ·  Python 3.15.2  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py grand_canyon --hike-id bright-angel-trail`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify grand_canyon`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| C1 | Structure | PASS | 42 referenced files exist, route has 1577 points |
| C2 | Credits and seasons | PASS | credits, illustrative note, 4 seasons and ?season= present |
| C3 | Route vs the hike | PASS | start near trailhead: 49 m from 'Bright Angel Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 178 m from 'Phantom Ranch' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 15.76 km vs NPS 15.29 km one way (ratio 1.03; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 6,847 ft vs NPS 6,860 ft (0% apart) |
| C4 | Size budget | WARN | 31.7 MB in 437 files (legacy walk, exempt from the 15 MB budget) |
| C5 | Season photos | PASS | base photos 12; per season spring 6, summer 7, autumn 2, winter 12 |
| D3 | Hike-page profile | PASS | profile.json: 1577 points, 12 checkpoints, scale 0.97 |

## Numbers
| | |
|---|---|
| Route length (walk) | 15.76 km |
| NPS length / highest point | 19.0 mi round-trip, 6,860 ft high |
| Climb along the route | 1123 m |
| Highest point on the route | 2087 m |
| Files / size | 437 files, 31.7 MB |
| Real photos | base 12; spring 6, summer 7, autumn 2, winter 12 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/grand_canyon/index.html?season=summer (also winter, spring, autumn).

- [ ] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [ ] **End**: the last stop is the end point the NPS page describes for this hike.
- [ ] **Length**: the walk says 15.76 km; the NPS says 19.0 mi round-trip, 6,860 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [ ] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [ ] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [ ] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js grand_canyon`.
- [ ] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [ ] **Hike page**: open `#/hike/bright-angel-trail`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [ ] **Size**: within the 15 MB budget (or an exemption is noted in walks/manifest.json).
- [ ] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.
