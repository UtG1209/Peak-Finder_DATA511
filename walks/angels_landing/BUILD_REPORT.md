# Walk build report: angels_landing

- Hike: **Angels Landing (Zion National Park)** (`angels-landing`)  ·  kit trail: `angels_landing`  ·  mode: verify
- Generated: 2026-11-18 16:46  ·  Python 3.15.2  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py angels_landing --hike-id angels-landing`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify angels_landing`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| C1 | Structure | PASS | 18 referenced files exist, route has 332 points |
| C2 | Credits and seasons | PASS | credits, illustrative note, 4 seasons and ?season= present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'The Grotto' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 0 m from 'Summit' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 3.31 km vs NPS 4.35 km one way (ratio 0.76; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 5,802 ft vs NPS 5,790 ft (0% apart) |
| C4 | Size budget | WARN | 35.5 MB in 446 files (legacy walk, exempt from the 15 MB budget) |
| C5 | Season photos | PASS | base photos 7; per season spring 2, summer 1, autumn 1, winter 4 |
| D3 | Hike-page profile | PASS | profile.json: 332 points, 7 checkpoints, scale 1.314 |

## Numbers
| | |
|---|---|
| Route length (walk) | 3.31 km |
| NPS length / highest point | 5.4 mi round-trip, 5,790 ft high |
| Climb along the route | 785 m |
| Highest point on the route | 1768 m |
| Files / size | 446 files, 35.5 MB |
| Real photos | base 7; spring 2, summer 1, autumn 1, winter 4 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/angels_landing/index.html?season=summer (also winter, spring, autumn).

- [ ] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [ ] **End**: the last stop is the end point the NPS page describes for this hike.
- [ ] **Length**: the walk says 3.31 km; the NPS says 5.4 mi round-trip, 5,790 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [ ] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [ ] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [ ] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js angels_landing`.
- [ ] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [ ] **Hike page**: open `#/hike/angels-landing`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [ ] **Size**: within the 15 MB budget (or an exemption is noted in walks/manifest.json).
- [ ] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.
