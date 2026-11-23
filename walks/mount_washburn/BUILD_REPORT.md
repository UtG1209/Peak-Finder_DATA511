# Walk build report: mount_washburn

- Hike: **Mount Washburn via Chittenden Road (Yellowstone National Park)** (`mount-washburn`)  ·  kit trail: `mount_washburn`  ·  mode: verify
- Generated: 2026-11-19 20:28  ·  Python 3.14.8  ·  data fake: True
- Reproduce: `python3 pipeline/walks/build_walk.py mount_washburn --hike-id mount-washburn`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify mount_washburn`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
| C1 | Structure | PASS | 5 referenced files exist, route has 345 points |
| C2 | Credits, seasons and navigation | PASS | credits, four seasons, back link and optional back/times parameters present |
| C3 | Route vs the hike | PASS | start near trailhead: 0 m from 'Dunraven Pass Trailhead' (limit 3000 m) |
| C3 | Route vs the hike | PASS | end near end point: 6 m from 'Summit' (limit 3000 m) |
| C3 | Route vs the hike | PASS | length vs NPS: route 3.43 km vs NPS 5.15 km one way (ratio 0.67; OSM shortens switchbacks, 0.6 to 1.15 is normal) |
| C3 | Route vs the hike | PASS | highest point vs NPS: route 10,250 ft vs NPS 10,243 ft (0% apart) |
| C4 | Size budget | PASS | 5.5 MB in 134 files (budget 30 MB); largest season/winter/12/790/1477.webp 0.3 MB |
| C5 | Season photos | WARN | base photos 2; per season spring 0, summer 0, autumn 0, winter 0; no own photo in: spring, summer, autumn, winter |
| D3 | Hike-page profile | PASS | profile.json: 345 points, 3 checkpoints, scale 1.5 |

## Numbers
| | |
|---|---|
| Route length (walk) | 3.43 km |
| NPS length / highest point | 6.4 mi round-trip, 10,243 ft high |
| Climb along the route | 461 m |
| Highest point on the route | 3124 m |
| Files / size | 134 files, 5.5 MB |
| Real photos | base 2; spring 0, summer 0, autumn 0, winter 0 |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/mount_washburn/index.html?season=summer (also winter, spring, autumn).

- [ ] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [ ] **End**: the last stop is the end point the NPS page describes for this hike.
- [ ] **Length**: the walk says 3.43 km; the NPS says 6.4 mi round-trip, 10,243 ft high. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [ ] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [ ] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [ ] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js mount_washburn`.
- [ ] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [ ] **Hike page**: open `#/hike/mount-washburn`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [ ] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [ ] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.
