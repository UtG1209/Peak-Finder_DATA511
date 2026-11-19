# Build log: Angels Landing Walk

This is how the 3D trail walk for **When to Go** (DATA VIZ 511, UW MSDS) was made: every source, file, library, decision and dead end. Read it alongside `README.md`, which covers how to run the kit.

---

## 1. Why it exists

The project is **When to Go**, a trip planner for about 51 lower-48 national parks, built as a web app. The open question was what a visualization adds over just asking ChatGPT.

The trail walk is one answer: you *see* the trail before you go, how steep it is, where the exposure is, and what each stop looks like. That is something a text answer can't give.

The aim of this build was narrow: **prove that a scroll-driven 3D trail walk is doable with free, public data**, before adding the month-by-month layers (crowds, heat, smoke).

## 2. Related project material

| What | Where |
|---|---|
| Full project plan (18 sections + "Doable version") | Claude Doc: https://claude.ai/artifact/5y5Dtwgy3Vuc1fDJyTYv2g |
| Same plan as PDF | `When_to_Go_Project_Plan.pdf` (sent in chat) |
| AI answers vs official data check | Project doc `claude/ai-vs-data-check.md` |
| Scroll-story mockup (kept for later) | Claude Design canvas: https://claude.ai/artifact/5ad8hrBGB29vL7e1oEym4d |
| This trail walk, live | https://claude.ai/artifact/Pz6FoNxhKieBDwRQz5fQfY (v3) |
| **Look reference** | Utkarsh's Google Images screenshot of Zion: red-orange sandstone, deep green valley floor, blue sky. Used to tune colour, not copied. |

## 3. Data sources (all free, no keys)

| Data | Source and URL pattern | Licence / credit |
|---|---|---|
| Elevation tiles | AWS Terrain Tiles, Terrarium PNG: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`. Decode with `elev = R*256 + G + B/256 - 32768` (metres). | Mapzen / Terrain Tiles; underlying USGS 3DEP. Credit required. |
| Aerial imagery | USGS The National Map, USGSImageryOnly: `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`. **Note: y comes before x.** | US Government, public domain. Credit as courtesy. |
| Trail geometry | OpenStreetMap through the Overpass API, `https://overpass-api.de/api/interpreter`, query in `s1_fetch_osm.py` | © OpenStreetMap contributors, ODbL |
| Photos | Wikimedia Commons API, `https://commons.wikimedia.org/w/api.php` with `prop=imageinfo&iiprop=url\|extmetadata&iiurlwidth=1280` | Per file (see section 5) |
| Map library | MapLibre GL JS 4.7.1, `https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js` | BSD-3 |
| Fonts | Google Fonts: Archivo 600/800 (headings), Inter 400/500/600 (body) | OFL |

**Sanity checks made:**
- Summit elevation from the tiles was 1,768 m (5,800 ft). NPS gives about 5,790 ft.
- Start at the Grotto was 1,304 m (4,279 ft).
- Net climb was 464 m (1,521 ft). The published figure is about 1,500 ft ([Visit Utah](https://www.visitutah.com/Places-To-Go/Parks-Outdoors/Zion/Outdoor-Experiences/Angels-Landing)), so that matches well.
- **Distance doesn't match:** our route measures 3.3 km one way, but the published figure is 5.4 mi round trip (about 4.3 km one way). The likely cause is that the OSM line simplifies the tight switchbacks (the lower switchbacks and Walter's Wiggles), which shortens the measured length. Elevation is unaffected.
- **Show the NPS distance** in user-facing text, or scale the HUD distance by the ratio (about 1.3×) before showing it as an official figure.

## 4. Trail numbers (Angels Landing)

| Item | Value |
|---|---|
| Start | The Grotto shuttle stop: 37.25897, −112.9509699 |
| End | Angels Landing summit node: 37.2693119, −112.9479191 |
| OSM bbox | W −112.965, S 37.25, E −112.935, N 37.275 |
| Core / mid / wide boxes | see `trails/angels_landing.json` |
| Route | 3,307 m, 332 points (every 10 m): 25 unnamed segments → West Rim Trail (396) → 1 bridged gap → West Rim Trail (12) → Angels Landing Trail (60) |
| Elevation | 1,304 m → 1,768 m. Net gain 464 m; summed climb 785 m (includes small ups and downs). |
| Scout Lookout | at 2,610 m along the route, 1,626 m elevation |

## 5. Photos used

Each one came from Commons, was resized to 900 px wide at JPEG quality 80, and is credited on its card.

| Card (`at`) | Commons file | Author | Licence |
|---|---|---|---|
| start (0.02) | Angel's Landing, Lower Trail 5-1-14e (13927327979).jpg | inkknife_2000 | CC BY-SA 2.0 |
| climb (0.30) | Angels Landing, Zion National Park, Utah (8096062363).jpg | Ken Lund | CC BY-SA 2.0 |
| refrigerator (0.62) | Zion NP33.jpg | Nikater | Public domain |
| wiggles (0.73) | Walter's Wiggles, Utah from below.JPG | Brian MacIntosh | CC BY-SA 4.0 |
| scout (0.80) | Towards Angel's Landing, Zion National Park, UT (8586599892).jpg | tsaiproject | CC BY 2.0 |
| chains (0.89) | Angels Landing Trail Zion NP 27-08-2025 01.jpg | Andrew Heneen | CC BY 4.0 |
| summit (0.985) | Zion angels landing view.jpg | Diliff | CC BY-SA 3.0 |

**How they were picked:**
- Search Commons for each landmark.
- Keep only open licences.
- Prefer photos that show the place as a hiker sees it.
- Avoid near-duplicates.
- Check visually that each one actually shows the named spot.

## 6. Build history

### v1: Proof that it works
- Fetched OSM trail lines, elevation and imagery for a box around Angels Landing.
- Built the route by graph shortest path.
- Drew a MapLibre 3D terrain map in a sticky full-screen stage.
- A 1500vh scroll track drives distance along the route, and the camera follows.
- Added a HUD (distance and elevation in m/ft), an SVG elevation profile with a cursor, and four text cards.

### v2: Fixes after the first screenshots
- **Holes in the terrain** at the edges. MapLibre draws missing terrain tiles at sea level. *Fix:* generate z13 elevation for the whole wide box by upsampling z12, and stop serving z14.
- **Camera stuck behind canyon walls** at pitch 72 / zoom 16.3. *Fix:* pitch 64 / zoom 15.9, and point the camera along the direction averaged over the next 60–260 m.
- **"Loading terrain…" never went away.** *Fix:* hide it on `load`, on `idle` and in `tick()`, plus the CSS `#status[hidden]{display:none}`.
- **Console warning about hillshade and terrain sharing one source.** *Fix:* a second raster-dem source (`demHs`) just for hillshade.

### v3: Photos and the Zion look (current)
Prompted by "whenever you have some text come up, bring a photo of that as well" and the Zion reference screenshot.
- Seven photo cards (section 5), each with credit and licence links.
- **Imagery colour:** saturation +0.38, contrast +0.18, brightness-min 0.03, hue −4°. This brings out the red sandstone and green valley.
- **Hillshade:** warm brown shadows, cream highlights, exaggeration 0.35, light from 300°.
- **Sky:** blue to warm-peach horizon fog, so the far canyon fades like the reference.
- **Imagery sources:** three by zoom and area (`imgLow` z12 wide, `imgMid` z13–14 mid, `imgHigh` z15–16 core), so no tile request ever 404s.
- **Known leftover:** a stray duplicate `<h2>Angels Landing</h2>` fragment after the cards. It was hidden behind the track, and it is removed in this kit's template.

### Kit (this folder)
- Moved every hard-coded value into `trails/angels_landing.json`, including the boxes, the camera, the profile labels and the stops.
- Rebuilt from the cache and checked:
  - `profile.json` is identical (332/332 points).
  - The 110 z13 elevation tiles match within 4 mm.
  - The start-frame screenshot is pixel-identical to the published v3.
- Added `<meta charset="utf-8">`. Without it, "·" showed as "Â·" when served by a plain web server; the artifact host had been adding it silently.

## 7. Problems hit and how each was solved

| Problem | Cause | Fix |
|---|---|---|
| Downloads failed from the build machine | Sandbox network allowed only package registries | Ran the downloads in a real browser (CORS is open on all four hosts), then saved them as JSON bundles. `tools/browser_fetch.js` + `import_browser_bundle.py` |
| Scripted `a.click()` downloads did nothing | Browsers block downloads not started by the user | Show visible links and click each one. Overlapping links caught the wrong click, so they are stacked with gaps. |
| Big file uploads failed | The ~10 MB bundles were too big for the transfer step | `split -b 1500000` into parts, retry failed parts, `cat` back together |
| Overpass POST hung | Server load / big box | GET request + 90 s AbortController + tighter `osm_bbox` |
| No path from the Grotto to the summit | OSM ways split into pieces that don't share nodes | Bridge nodes from different pieces less than 50 m apart, weighted ×3 so real trail wins |
| Terrain holes | Missing DEM tiles fall to sea level | z13 filler tiles upsampled from z12 (`fill_dem_z13`) |
| Commons 640 px thumbs returned HTTP 400 | Commons serves only standard thumbnail widths | Ask the API for `iiurlwidth=1280`, then resize locally |
| Artifact publish refused | `file_path` was a .jpg | `file_path` must be `index.html`; everything else goes in `files`, up to 255 per publish |
| Tiles blocked inside the artifact | Artifact CSP blocks outside requests | Bundle every tile and photo with the page |
| Headless screenshots timed out or were blank | No GPU; Google Fonts request hung | SwiftShader flags, 120 s timeout, block fonts in the test, wait for `map.areTilesLoaded()` |
| Camera inside rock | Pitch/zoom too aggressive for 10–20 m terrain | pitch 64, zoom 15.9, smoothed direction |

## 8. Everything that was saved

**In the build workspace** (temporary, now packaged in this kit):

| File | What it is |
|---|---|
| `osm.json` | Raw Overpass response |
| `route.json` | Ordered `[lat, lon]` route nodes |
| `profile.json` | Route resampled every 10 m as `[lon, lat, dist, elev]` |
| `dem.json`, `img.json` | Browser bundles, base64 tiles keyed `z/x/y` |
| `steps.html` | Card markup |
| `template.html` | Page with `__PROFILE__` placeholder |
| `site/` | Published output |

**On Utkarsh's Mac, in ~/Downloads** (leftovers from the browser fallback, safe to delete): `zion_dem.json`, `zion_img.json`, `zion_osm.json`, `zion_photo_review.json`, the `wtg_parts/` and `wtg_photos/` folders, and `wtg_test*.txt`.

**Published:**
- The Angels Landing Walk artifact (v3; link-shared).
- The project plan doc.
- The design canvas.
- The project doc `claude/ai-vs-data-check.md`.

## 9. Libraries and versions

| Where | Library | Version | Used for |
|---|---|---|---|
| Page | MapLibre GL JS | 4.7.1 | 3D terrain, raster imagery, hillshade, sky/fog, GeoJSON line and point layers |
| Python | networkx | 3.7 | Trail graph, connected components, shortest path |
| Python | numpy | 2.5.3 | Terrarium decode/encode, gap search |
| Python | Pillow | 12.3.0 | PNG/JPEG I/O, bilinear upsample, photo resize |
| Python | requests | 2.34.2 | Downloads |
| Test | Playwright (Chromium) | 1.63.0 | Headless screenshots with SwiftShader WebGL |
| Runtime | Python 3.13, Node 22 | | |

## 10. Course framing used

- **Martini-glass narrative** (Segel & Heer, 2010): an author-driven walk first, then free exploration.
- **Shneiderman's mantra:** overview (US map) → zoom (park) → details on demand (trail walk).
- **Mackinlay and Munzner:** position and length for the important numbers (profile, HUD), and colour only for the walked versus ahead state.
- **Answer-first:** the planner should answer "is this a good month for me?" before showing raw data.
- **Pitch line against "just ask AI":** "Is the travel advice still true?" — the project checks AI and blog claims against official data.

## 11. Next ideas (not built)

- **Month switch:** the same walk in August vs October, with hiker density from NPS visitor counts, heat from NOAA station data, and smoke haze from PM2.5 (fog colour).
- **Second trail:** Glacier Highline, to test the kit on a different landscape.
- **Smoother start view:** a pitch/zoom ramp over the first 100 m.
- **Lighter weight:** WebP imagery, and dropping the z16 tiles outside a 300 m corridor around the trail.


---

# Second trail: Bright Angel Trail, South Rim to Phantom Ranch (Grand Canyon)

Config: `trails/grand_canyon.json`. Read `docs/LESSONS_LEARNED.md` for the mistakes made on this build.

## Trail numbers (route measured by s3)

| | Built route | Official (NPS) |
|---|---|---|
| Start | Bright Angel Trailhead, 6,848 ft | 6,860 ft |
| Indian Garden (Havasupai Gardens) | 7.64 km (4.75 mi), 3,772 ft | 4.5 mi, 3,800 ft |
| River (Pipe Creek / River Resthouse area) | 12.55 km (7.8 mi), 2,446 ft | 7.7 mi, 2,480 ft |
| Silver Bridge (south end) | 14.5 km (9.0 mi), 2,450 ft | not checked |
| Phantom Ranch (end) | 15.76 km (9.79 mi), 2,545 ft | about 9.9 mi |
| Net descent | about 4,300 ft | 4,380 ft to Bright Angel Campground (6,860 to 2,480 ft) |

OSM ways used: Bright Angel Trail, River Trail, Bright Angel Suspension Bridge (Silver Bridge),
Bright Angel Campground Route, Phantom Ranch Village Trail. 143 small gaps were bridged
(`gap_bridge_m` 50). Final boxes: wide [-112.25,35.97,-111.97,36.19], mid [-112.18,36.01,-112.05,36.14],
core [-112.154,36.050,-112.086,36.114]. Camera `pitch 45, zoom 15.3, scroll_vh 6500` (412 vh per km).
471 files in the published site (22 MB): 2 publish batches. A first attempt with larger boxes had
612 files and was refused by the 511-file limit per artifact version, so the boxes were shrunk. The route
was unchanged by the shrink (same 1,577 points, elevation difference 0 m).

## Photos used (all Wikimedia Commons, open licences)

| Stop | File | Author | Licence |
|---|---|---|---|
| The edge of the canyon | `Last light in the Canyon. (51429129959).jpg` | Bernard Spragg. NZ from Christchurch, New Zealand | Public domain |
| Buttes at sunset | `Grand Canyon National Park, Sunset From Bright Angel Trail 3379 - Flickr - Grand Canyon NPS.jpg` | Grand Canyon National Park | Public domain |
| Jacob's Ladder | `408 Bright Angel Trail - Grand Canyon - Jacob's Ladder (4753750420).jpg` | Grand Canyon National Park | CC BY 2.0 |
| The second resthouse | `201003 3573 Bright Angel Trail - 3 Mile Resthouse. (4753113083).jpg` | Grand Canyon National Park | CC BY 2.0 |
| Buttes above the trail | `The Battleship - Flickr - brewbooks (2).jpg` | brewbooks from near Seattle, USA | CC BY-SA 2.0 |
| Indian Garden | `Grand Canyon National Park Indian Garden 3511 (6063712657).jpg` | Grand Canyon National Park | CC BY 2.0 |
| Devil's Corkscrew | `Grand Canyon NP- Bright Angel Trail - Devil's Corkscrew 50247 (52028292714).jpg` | Grand Canyon NPS | Public domain |
| The Colorado River | `Colorado River from Above - Flickr - brewbooks (1).jpg` | brewbooks from near Seattle, USA | CC BY-SA 2.0 |
| Beside the river | `Colorado River near sunset - Flickr - brewbooks.jpg` | brewbooks from near Seattle, USA | CC BY-SA 2.0 |
| Crossing the Colorado | `Grand Canyon National Park - Silver Bridge 1277 (50545174893).jpg` | Grand Canyon National Park | CC BY 2.0 |
| Bright Angel Creek | `Grand Canyon Bright Angel Campground 0649 (5941471259).jpg` | Grand Canyon National Park | CC BY 2.0 |
| Phantom Ranch | `Grand Canyon Phantom Ranch 0632 (5935382911).jpg` | Grand Canyon National Park | Public domain |

Notes on placement: "The Colorado River" and "Beside the river" are river photos whose geotags are
a few hundred metres off the route (north-east side), so their captions do not claim a vantage point.
The Devil's Corkscrew, Bright Angel Campground and Phantom Ranch photos are geotagged within about
50 m of the route. The Silver Bridge photo has no geotag; it is identified only by its Commons title.

## Build history (Grand Canyon)

1. **v1: rim to Indian Garden.** Built and published as the first version. It had no river, so it
   did not show what people picture when they hear "Bright Angel Trail".
2. **v2: new vista photos.** Replaced sunset photos with canyon vistas. Still stopped at Indian Garden.
3. **v3: rim to river.** Extended the route to Phantom Ranch, added river and inner-canyon stops.
   Needed new boxes, 266 new tiles, more OSM data (merged into the existing cache), 6 new photos,
   a new camera test, and a publish that had to be redone with smaller boxes to fit 511 files.

## Fixes made to the kit during this build

- `template.html`: net change uses `Math.abs(...)`, so a descent reads "about 1,300 m below the rim".
- `tools/screenshot_test.js`: emulates reduced motion so the page jumps to each position, and waits until it reports the target.
- `pipeline/s5_build_page.py`: wipes old `dem/`, `img/`, `photos/` in the output before copying (stale tiles were being published).
- New `pipeline/check_config.py` (step 0) and `pipeline/import_browser_parts.py`.
- New `docs/LESSONS_LEARNED.md`.

---

# North Cascades: Cascade Pass to Sahale Glacier

Built in one pass using `docs/LESSONS_LEARNED.md`. The trail and its end were chosen with the user before any config was written.

## How the trail was defined (step 0)

- North Cascades is a whole park, so the trail and the end point were put to the user with NPS figures (one way from the Cascade Pass Trailhead): Cascade Pass 3.7 mi / 1,700 ft; Sahale Glacier 5.9 mi / 3,940 ft; Hidden Lake Lookout 4.5 mi / 2,900 ft. The user picked **Cascade Pass to Sahale Glacier**.
- Source for the figures: the NPS "Cascade Pass / Sahale Arm Trail" page. NPS does not give trailhead or pass elevations on that page, so those are only checked against OSM (`ele` of the Cascade Pass saddle: 1,643 m) and the DEM.
- Start: the OSM node `highway=trailhead` "Cascade Pass Trailhead" (NPS), 48.47549, -121.07516. End: the last node of the OSM "Sahale Arm Trail" way (48.48525, -121.04600). That way ends 5.87 mi from the trailhead, which matches NPS's 5.9 mi to Sahale Glacier, so it was used as the end instead of guessing a point on the glacier.

## Trail numbers (route measured by s3)

| | This build | NPS / source |
|---|---|---|
| Length | 9.41 km (5.85 mi) | 5.9 mi to Sahale Glacier |
| Cascade Pass | 5.61 km (3.49 mi), 1,645 m (5,399 ft) | 3.7 mi; OSM saddle 1,643 m |
| Start / end elevation | 1,111 m (3,646 ft) / 2,309 m (7,575 ft) | not stated by NPS |
| Net climb | 1,198 m (3,929 ft) | 3,940 ft |
| Gain to the pass | 1,753 ft | 1,700 ft |

The OSM trail puts the pass about 0.2 mi (6%) closer than NPS's 3.7 mi; the end matches. The page therefore says "NPS lists it at 3.7 miles; the trail on this map measures about 3.5" on the pass card. The route is made of the OSM "Cascade Pass Trail" and "Sahale Arm Trail" ways (12 small gaps bridged, 9 m of unnamed path).

## Boxes and size

osm_bbox [-121.090, 48.458, -121.030, 48.495]; core [-121.092, 48.456, -121.028, 48.497]; mid [-121.125, 48.435, -120.995, 48.518]; wide [-121.20, 48.39, -120.92, 48.56]. 58 elevation + 286 imagery tiles planned (+33 generated filler), **372 files** in `output/` (limit 511), so two publish batches. `check_config.py` predicted 372 before anything was downloaded, and it was right.

## Camera

Not copied from another trail: pitch 50, zoom 15.4, scroll_vh 4060 (431 vh per km of real route). Tested at 0, 0.5 and 1 first.

## Photos used (all Wikimedia Commons, open licences, looked at on a contact sheet before choosing)

| Stop | File | Author | Licence | Geotag vs route |
|---|---|---|---|---|
| Into the high country | `Cascade Pass Trail at North Cascades in Washington 14.jpg` | Jeffhollett | CC BY-SA 4.0 | no geotag; title says Cascade Pass Trail, caption says it is from higher up |
| The high peaks appear | `Cascade Pass at North Cascades in WA - Flickr - landscapesinthewest.jpg` | Landscapes in The West | Public domain | 11 m, at 4.3 km |
| The valley opens up | `Cascade Pass (52313898664).jpg` | lamblukas | CC BY 2.0 | 6 m, at 5.2 km |
| Cascade Pass | `The Triplets and Cascade Peak.jpeg` | Ron Clausen | CC BY-SA 4.0 | 11 m, at the pass |
| Meadows on the arm | `The Triplets from Sahale Arm (42126630090).jpg` | Jeff Hollett | Public domain | 10 m, at 6.6 km |
| Doubtful Lake | `Doubtful Lake 4.jpg` | Peter Stevens | CC BY 2.0 | 6 m, at 7.1 km |
| Rock and snow | `NCNP.jpg` | Kyle Berquist | CC BY-SA 4.0 | 15 m, at 8.1 km |
| Clouds below you | `Clouds rolling over Cascade Pass.jpg` | Roy Luck | CC BY 4.0 | 24 m, at 8.5 km |
| The drop to Doubtful Lake | `Doubtful Lake from Sahale Glacier 3.jpg` | brewbooks | CC BY-SA 2.0 | about 290 m off the route, near 9.1 km |
| Sahale Glacier | `Sahale moraine.jpeg` | uploader Ron Clausen (photographer not named on Commons) | CC BY-SA 4.0 | no geotag; named by its title |
| Autumn colour on the arm (added in round 2) | `Sahale Arm and Cascade Pass at North Cascades in Washington 09.jpg` | Jeffhollett | CC BY-SA 4.0 | no geotag; title names Sahale Arm |

Two photos are 4:1 and 3:1 panoramas (the page crops cards to 4:3, so only the centre shows). Captions avoid naming peaks that the file titles do not name.

## How it was built here (sandbox blocked every data host)

1. Network test: Overpass, AWS tiles, USGS and Commons were all refused from the shell, so the browser fallback was used from the start, run from a page on `basemap.nationalmap.gov`.
2. OSM, 344 tiles and 10 photos were fetched in the browser, and saved as 16 + 2 parts of at most 1.35 MB.
3. Every save was checked by listing the folder, and the byte sizes were compared with the sizes generated in the browser. Staging failed ("upload failed") for 3 files and was retried.
4. A click-position mistake (wrong row spacing) cost a few retries. The rows were about 59 px apart, not the 45 px that was assumed. The folder listing caught it.

## Screenshot test and the one fix it caused

- Tested at 0, 0.5 and 1 first (camera pitch 50, zoom 15.4): the middle and the end looked right (end card, glacier visible, no camera inside rock).
- The start was very dark. Cause: the USGS aerial tile at the trailhead is itself nearly black (mean brightness 26/255; the first 4.5 km of the route are 26 to 55, the upper arm 120 to 200), and the template's contrast of 0.18 darkens shadows further. Fix: new optional `look.contrast` in the config (default 0.18, North Cascades uses 0). Re-tested at 0, 0.2 and 0.45: forest and trail are readable. The shaded valley is still darker than the upper trail because the source photo is.

## Round 2: feedback on the first publish

The user compared the page with online photos ("none look like this") and said the camera turned too much on the many switchbacks.

- **Photos:** the first set was correct but dull (snowy trailhead, dark dawn end). Replaced the trailhead and end photos with sunny ones from the Commons Sahale Arm / Cascade Pass Trail series (CC BY-SA 4.0, no geotags, so captions claim only what the titles say) and added one stop (autumn colour on Sahale Arm). Now 11 stops, 373 files. The online photos the user pasted were not used: many show other places (Diablo Lake, Thunder Knob) and none are openly licensed.
- **Camera:** heading was the average direction of the next 60 to 260 m, which turned about 4,800 degrees in total along the route (up to 156 degrees in 100 m). New `camera.heading_window_m: [500, 1200]` (straight line from 500 m behind to 1,200 m ahead): about 800 degrees in total, at most 34 degrees per 100 m. The page also low-pass filters the heading (not visible in the reduced-motion screenshot test, which jumps straight to each position).
- Screenshots at 0, 0.3 and 0.807 checked; republished as version 3 of the same link with 4 files replaced or added (sizes of the published photos match the local ones).

## Publish

- 372 files (index.html + 371), published in two batches (255 + 117) to one link, and confirmed by listing the published files: 372.

## Kit changes in this build

- New `pipeline/import_browser_photos.py` and a README note on doing photos in the browser.
- New optional config key `look.contrast` (`template.html` and `s5_build_page.py`), documented in README section 5.
- `template.html`: the net-change number now has a thousands separator ("1,197 m").
- New optional `camera.heading_window_m` (template + s5), `import_browser_photos.py` now skips photos that are already cached, and `docs/LESSONS_LEARNED.md` has mistake 10.
- Reminder for the screenshot test outside this sandbox: it needs `NODE_PATH` pointing at a folder with `playwright` and `MAPLIBRE_JS` pointing at a local MapLibre file when jsDelivr is blocked.


## Round 3: season toggle (Spring / Summer / Autumn / Winter)

The user asked for a season switch on the map, with the path and photos from that season. We agreed on "photos + illustrative map" because there is no free imagery of this trail for each season.

- **What changes with the season:** each stop's photo, title and text; the colour grading and sky of the map; and an overlay on the map: snow (winter, spring) or a green / red-and-amber tint (summer, autumn). The path itself is the same. The page opens on the season of the viewer's current month, and `?season=winter` etc. forces one.
- **Photos:** 155 Commons candidates (Cascade Pass / Sahale / Doubtful Lake / Pelton Basin) were put on contact sheets and sorted by eye. Commons "date taken" fields were not trusted (many are upload or scan dates). 21 season photos were added (all CC0, CC BY, CC BY-SA or public domain). Real winter photos exist for 5 of 11 stops (peaks, valley, arm, ridges, doubtful_top) and real spring photos for 5 (peaks, valley, pass, triplets, doubtful). Where a season has no photo for a stop, the card shows the nearest season (`seasons.fallback`) and says so in orange text on the card.
- **Map overlay:** `pipeline/s6_season_tiles.py` builds one 512 px RGBA tile per z12 tile (16 per season, 64 files, about 20 MB in all; only the chosen season is downloaded). Snow comes from the elevation model: snow line per season (winter 600 m, spring 1,450 m, with noise and about 250 to 300 m lower on north-facing slopes), less snow on steep rock. The tint is placed on vegetation found from the colours of the USGS imagery. These numbers are our assumptions, not measured snow cover, so the page says "Season view is illustrative".
- **Honest limit:** the underlying USGS imagery is an early-autumn picture (red and gold heather, leftover snow). Summer and autumn therefore look similar on the map close up. The green tint plus a hue shift greens the overall look, but the photos carry the summer/autumn difference.
- **Screenshot test:** all four seasons at 0.2, 0.62 and 0.81. Found and fixed: winter was flat grey (hillshade shadows were brown; added per-season hillshade colours and lowered alpha), summer was not green (stronger tint, hue shift), the credits box overlapped the profile when the note made it three lines (moved up 14 px).
- **Files:** 456 in total (the 511 limit per artifact version). `check_config.py` now counts season photos and overlay tiles.

## Round 4: season toggle made standard for all trails

The user asked that every upcoming trail has the four-season toggle, and that all lessons and problems are kept.
- `check_config.py` now reports a PROBLEM if there is no `seasons` block, a stop has no `season_photos`, a season has nothing to fall back to, or a season photo has no Commons file name; it prints how many stops have a real photo for each season and a reminder to tune the snow lines. It counts season photos and overlay tiles in the 511-file estimate (456 for North Cascades, which matched the real count).
- `s4_fetch_photos.py` also fetches `season_photo_files`; `run_all.sh` runs the new `s6_season_tiles.py` before s5; `trails/_seasons_default.json` is the block to copy; `tools/browser_season_photos.js` holds the browser snippets (contact sheet, packing).
- New `docs/NEW_TRAIL_RUNBOOK.md`: ordered steps 0 to 19 and the 11 problems in one line each; lessons mistake 11 and the checklist were extended.
- Angels Landing and Grand Canyon were built before the toggle and now fail the season check until they get a `seasons` block (not done).

## Round 5: summer tint softened
User: summer looks worse because there is so much green everywhere. Summer tint alpha 0.85 -> 0.3, greens muted, map saturation +0.5 -> +0.12, hue +28 -> +8. Checked at 20% and 62% of the walk; lakes no longer purple.

## Round 6: autumn tint softened
User: fix autumn like summer. Autumn tint alpha 0.5 -> 0.3, colours brighter amber, map saturation +0.38 -> +0.18, hue -4 -> 0. Brown wash on upper slopes and brown lake gone.

## Round 7: season toggle added to Angels Landing (Zion) and Grand Canyon (Bright Angel)
User: rebuild both older pages with what the kit now does; keep the same artifact links.
- **Zion:** cache restored from the published page (never re-run s2/s3). 8 new Commons season photos (15 base + 8). Winter snow line 1750 m, spring 1950 m, summer and autumn tints. `bounds.wide` shrunk to [-113.10,37.14,-112.80,37.38] to fit (441 files). Camera unchanged from the original (pitch 64, zoom 15.9). A first build with `heading_window_m [500,1200]` hid the hike behind the cliffs (user feedback); removed and republished.
- **Grand Canyon:** 27 new season photos (46 in cache). Winter snow line 1750 m, spring 2000 m; summer and autumn are colour grading only (no tint, desert). `heading_window_m [500,1200]` kept (6,930 degrees of turning). First build had 538 files: z16 imagery turned out to be used, so `bounds.corridor_m 1000` was added (432 files). Published version 7, 432 files.
- **Kit changes:** `corridor_m` (common.py `corridor_tiles`, s5, check_config), s5 serves only tiles inside the boxes, docs: lessons mistake 12, runbook, START_HERE, README.
- **Honest limits:** Zion borrows the nearest season for stops with no real photo; one Grand Canyon winter photo's date is uncertain; some December photos show autumn colour; map seasons are illustrative; Walter's Wiggles keeps the original camera.
