# When to Go: Trail Walk Kit

This kit turns any hiking trail into a scroll-driven 3D walk. Scrolling moves a hiker along the real trail over real terrain. A camera follows the hiker, an elevation profile fills in, and photo cards appear at each stop.

It rebuilds the **Angels Landing Walk** (Zion) exactly from `trails/angels_landing.json`, and it can build any other trail from a new config file.

- Live version: https://claude.ai/artifact/Pz6FoNxhKieBDwRQz5fQfY
- What was done and why: `docs/BUILD_LOG.md`
- **Building a new trail? Read `docs/START_HERE_NEW_TRAIL.md` first (common notes for every trail, season toggle and its problems included). Then follow `docs/NEW_TRAIL_RUNBOOK.md` (ordered steps, season toggle included), and read `docs/LESSONS_LEARNED.md` for the reasons.** The lessons list the mistakes made so far and a pre-flight checklist that would have avoided all of them.

---

## 1. Quick start

```bash
pip install -r requirements.txt
./run_all.sh angels_landing                         # or run pipeline/s1 … s5 one at a time
python -m http.server -d output/angels_landing 8000 # then open http://localhost:8000
```

Opening `index.html` by double-clicking won't work, because browsers block tile loading from `file://`. Always preview through a local server.

Every step caches its downloads in `cache/<trail>/`. If you re-run a step, it only does the missing work. If a zip of this kit includes `cache/angels_landing/`, the whole build runs offline.

## 2. What's in the folder

```
when-to-go-trail-kit/
├── README.md                ← you are here
├── docs/BUILD_LOG.md        ← the full story: sources, decisions, bugs hit, fixes
├── docs/START_HERE_NEW_TRAIL.md ← common notes for every new trail, incl. season toggle (read first)
├── docs/NEW_TRAIL_RUNBOOK.md ← the ordered checklist for every new trail (start here)
├── docs/LESSONS_LEARNED.md  ← mistakes to avoid + pre-flight checklist (read before a new trail)
├── requirements.txt         ← Python libraries (exact tested versions)
├── run_all.sh               ← runs steps 1–5 for one trail
├── trails/
│   ├── angels_landing.json  ← EVERYTHING trail-specific lives here
│   ├── grand_canyon.json    ← second trail: Bright Angel, South Rim to Phantom Ranch
│   ├── north_cascades.json  ← third trail, the first with the season toggle
│   └── _seasons_default.json ← the `seasons` block to copy into every new trail
├── pipeline/
│   ├── common.py            ← tile maths, Terrarium decode/encode, downloads
│   ├── check_config.py      ← step 0: sanity-check a config before downloading anything
│   ├── s1_fetch_osm.py      ← trail lines from OpenStreetMap (Overpass API)
│   ├── s2_fetch_tiles.py    ← elevation + aerial tiles, fills elevation gaps
│   ├── s3_build_route.py    ← stitches OSM pieces into one route, every 10 m + elevation
│   ├── s4_fetch_photos.py   ← stop photos + credits from Wikimedia Commons
│   ├── s5_build_page.py     ← fills the template, copies served files to output/
│   ├── s6_season_tiles.py   ← optional: illustrative snow / colour overlay tiles for the season toggle
│   ├── import_browser_bundle.py ← only for the browser fallback (section 6)
│   ├── import_browser_parts.py  ← browser fallback with small part files (merges OSM data)
│   └── import_browser_photos.py ← browser fallback for Commons photos (900 px JPEG + credits)
├── template/template.html   ← the page: MapLibre map, scroll logic, HUD, profile, cards
├── tools/
│   ├── browser_fetch.js     ← fallback downloader for blocked networks
│   ├── browser_season_photos.js ← browser snippets: contact sheet + packing for season photos
│   └── screenshot_test.js   ← headless visual test (Playwright); SEASON=winter tests one season
├── cache/<trail>/           ← downloaded and derived data (not hand-edited)
└── output/<trail>/          ← the finished site: index.html + dem/ img/ photos/
```

## 3. Pipeline at a glance

| Step | Input | Output | Library / source |
|---|---|---|---|
| s1 OSM | `osm_bbox` | `cache/osm.json` (paths, footways, viewpoints, peaks, bus stops) | Overpass API, `requests` |
| s2 Tiles | `bounds.wide/mid/core` | `cache/dem/{z}/{x}/{y}.png`, `cache/img/{z}/{x}/{y}.jpg` | AWS Terrain Tiles, USGS National Map, `Pillow`, `numpy` |
| s3 Route | `osm.json`, `start`, `end`, DEM | `cache/profile.json` = `[[lon, lat, dist_m, elev_m], …]` every 10 m | `networkx`, `numpy` |
| s4 Photos | `stops[].commons_file` | `cache/photos/*.jpg` (900 px), `cache/credits.json` | Wikimedia Commons API, `Pillow` |
| s5 Page | everything above + `template.html` | `output/<trail>/index.html` + data files | Python stdlib |

The browser side is **MapLibre GL JS 4.7.1**, loaded from jsDelivr: `https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js`. The page uses the Archivo and Inter fonts from Google Fonts. It needs nothing else: no framework and no API keys.

### Zoom plan (what s2 downloads)

| Layer | Zooms | Area | Angels Landing count |
|---|---|---|---|
| Elevation | 10, 11, 12 | wide | 6 + 12 + 36 |
| Elevation | 13 | mid (real) + rest of wide (generated from z12) | 20 real + 90 generated |
| Elevation | 14 | core (only for the profile, not served) | 12 |
| Imagery | 12 | wide | 36 |
| Imagery | 13, 14 | mid | 20 + 72 |
| Imagery | 15, 16 | core | 36 + 100 |

That comes to about 28 MB and 435 files per trail. In the page, terrain is capped at z13 (`maxzoom: 13`), and MapLibre over-zooms it smoothly. Imagery uses three sources, so each zoom only asks for tiles that exist.

## 4. Adding a new trail (for example, Glacier's Highline)

**Every trail gets the four-season toggle.** The ordered checklist, with every problem so far, is `docs/NEW_TRAIL_RUNBOOK.md`; follow it. Copy the `seasons` block from `trails/_seasons_default.json`, give each stop `season_photos`, and run `s6_season_tiles.py` before `s5` (`run_all.sh` does). Trails built before the toggle (Angels Landing, Grand Canyon) fail `check_config.py` until they get a `seasons` block.

**Step 0 (do this first, before copying anything):**
- Read `docs/LESSONS_LEARNED.md`.
- Open the official page for the trail (NPS or the park) and write down its landmarks in order, with distance and elevation. This is what you will check the route against, and it decides where the trail ends. On the Grand Canyon build the first version stopped at Indian Garden, the page had no river on it, and it had to be rebuilt.
- If the trail has more than one sensible end (turnaround, summit, river, camp), ask the user which one before building. Do not choose silently.
- Find one open-licence Commons photo per landmark and look at them on a contact sheet.
- Do not assume anything you can test: network access, what a photo shows, what a number means.

1. **Copy the config:** `cp trails/angels_landing.json trails/highline.json`, then set the `id`.
2. **Set start and end:** use lat/lon from OSM or Google Maps (right-click → coordinates). Use the trailhead or shuttle stop for the start and the destination for the end.
3. **Set the boxes.** Each is `[west, south, east, north]`:
   - `osm_bbox`: just around the trail. Keep it tight, because Overpass is slow on big boxes.
   - `core`: the trail plus about 1 km. This area gets the sharpest imagery (z15–16).
   - `mid`: about 5 km around the trail.
   - `wide`: about 15–20 km around, so the horizon has terrain.
4. **Run steps 1–3 only.** Check the s3 printout:
   - The climb should match the NPS or AllTrails figure. The distance usually comes out shorter, because OSM simplifies switchbacks: Angels Landing measured 3.3 km against the published figure of about 4.3 km (5.4 mi round trip).
   - "trail pieces used" should list the named trails you expect.
   - If the start node is more than 100 m from your start point, move `start` onto the trail.
5. **Write the stops.** For each stop:
   - `at` is the scroll position from 0 to 1 (the share of the trail's distance).
   - `elev_at_m` is the distance whose elevation `{elev}` shows. `"end"` means the summit.
   - `{gain}` in any text inserts the total climb.

   Find `at` values by looking up the distance in `profile.json` and dividing by the total.
6. **Pick photos on Wikimedia Commons:**
   - Search `commons.wikimedia.org` for the stop.
   - Use only Public domain, CC0, CC BY or CC BY-SA files. s4 refuses anything else.
   - Put the exact file name, without `File:`, in `commons_file`.
   - **Never use Google Images or travel-site photos.** They are all-rights-reserved.
7. **Set `profile_labels`:** the start and end labels, plus one `key_stop` that gets a dashed line on the profile.
8. **Check the config before you download anything:** `python pipeline/check_config.py <id>` catches boxes that do not contain the route, stops that overlap, and shows how many tiles and publish batches to expect.
9. **Build and check:** run s4 and s5, preview, then run the screenshot test (section 7). If the camera clips into walls, adjust `camera` (section 5).

## 5. Settings in the config that change the feel

| Key | Angels Landing | Effect |
|---|---|---|
| `camera.pitch` | 64 | Tilt in degrees. Higher feels more like eye level but hits canyon walls. 72 got stuck behind walls; 64 is the safe value. |
| `camera.zoom` | 15.9 | Closeness. 16.3 clipped into walls at switchbacks. |
| `camera.scroll_vh` | 1500 | Page length in screen-heights. Longer means slower walking. About 430 vh per km felt right. Use the real route length from s3, not the straight line. |
| `gap_bridge_m` | 50 | Joins OSM trail pieces that almost touch. Raise it if s3 says no path; lower it if the route jumps between parallel trails. |
| `camera.heading_window_m` (optional) | none | `[metres behind, metres ahead]`. Without it the camera faces the next 60 to 260 m of trail, which spins on switchbacks. With it, the camera faces along the straight line from the point behind to the point ahead. North Cascades uses `[500, 1200]` (turning along the route 4,800 degrees down to 800). Use it only above about 1,500 degrees of turning: on a short cliff trail it pointed the camera into the rock. The page also smooths the heading over time. |
| `bounds.corridor_m` (optional) | none | Keep z15 and z16 imagery only within this many metres of the route (to fit 511 files). Grand Canyon uses 1000. |
| `seasons` (optional) | none | Turns on the Spring/Summer/Autumn/Winter toggle. `map.<season>` holds either `snowline_m` (+ `soft_m`, `noise_m`, `north_m`, `steep_from`, `steep_to`, `patchy`, `alpha`) for a snow overlay, or `band_m`, `colour_a`, `colour_b`, `alpha` for a tint, plus `paint` (imagery grading), `sky` and optional `shade`. `fallback` says which season's photo to borrow. Each stop then needs `season_photos` (`{season: photo file name without .jpg}`) and may have `season_text` (per-season `title` / `text`). Run `python pipeline/s6_season_tiles.py <id>` before s5. Overlay tiles are 16 files per snow/tint season: count them against the 511-file limit (`check_config.py` does). |
| `look.contrast` (optional) | 0.18 | Contrast of the aerial imagery. The default (0.18) makes shadows very dark. If the source imagery of a shaded valley is dark (North Cascades: the trailhead tile has a mean brightness of 26 out of 255), set `"look": {"contrast": 0}` to lift them. Check the mean brightness of the z16 tiles along the route first. |

**Deep canyon (Grand Canyon, 1,300 m drop):** `pitch 45`, `zoom 15.3`, `scroll_vh 6500` for 15.8 km. `pitch 64 / zoom 15.9` put the camera inside rock. Always treat `camera` as untested on a new trail and check the start, middle and end first.

The camera code is in `template.html`. It:
- Eases 12% toward the scroll target each frame, or jumps straight there with `prefers-reduced-motion`.
- Points along the average direction 60–260 m ahead, so switchbacks don't spin the view.
- Turns off all map interaction, because scroll is the only control.
- Caps `pixelRatio` at 1.5 so laptops stay smooth.

## 6. If downloads are blocked (browser fallback)

Some networks and sandboxes block Python from reaching the data hosts but still let a browser through. In that case:

1. Open any normal page in Chrome (for example `https://commons.wikimedia.org`), then open DevTools → Console.
2. Paste `tools/browser_fetch.js`, edit the `TRAIL` block to match your config, and press Enter.
3. When it finishes, click the three **Save** links. If they overlap, click them one at a time; scripted clicks are blocked by most browsers.
4. Run `python pipeline/import_browser_bundle.py <id> ~/Downloads`, then `s2_fetch_tiles.py`. If your tools cannot move files above about 1.5 MB, save small parts instead (keys like `dem|z/x/y`, `img|z/x/y`, plus one `{"osm": …}` part) and import them with `python pipeline/import_browser_parts.py <id> "<folder>/*.json"`. After saving, list the folder and check every part arrived. Only download tiles that are not already cached. It finds everything cached and just generates the z13 filler tiles.
5. Continue with s3 → s5.

If Commons is blocked too, do the photos in the browser as well: ask the Commons API for each file (`iiurlwidth=1280`, with `origin=*`), resize to 900 px on a canvas, save parts `{"photos": {key: {"data": dataURL, "credit": {artist, license, license_url, page}}}}` (under about 1.4 MB each) and import them with `python pipeline/import_browser_photos.py <id> "<folder>/photos_*.json"`. It refuses licences that s4 would refuse. North Cascades was built this way (see `docs/BUILD_LOG.md`).

Photos can be downloaded by hand from each Commons page (use the 1280 px version), saved as `cache/<id>/photos/<photo>.jpg`, with matching entries in `cache/<id>/credits.json`. Copy the format from the Angels Landing cache.

## 7. Testing

```bash
npm install playwright@1.63.0 && npx playwright install chromium
node tools/screenshot_test.js angels_landing
# offline? point it at a local MapLibre copy:
MAPLIBRE_JS=/path/to/maplibre-gl.js node tools/screenshot_test.js angels_landing
# only some positions:
SHOTS=0,0.5,1 node tools/screenshot_test.js angels_landing
```

The test saves screenshots to `output/<id>/_shots/`. Delete that folder before publishing. It runs Chromium with software WebGL (SwiftShader), so it is slow: about 1–2 minutes per shot. A real browser is much faster.

Check for:
- The hiker dot visible near the centre.
- No camera inside rock.
- Cards and photos showing.
- The HUD numbers changing.
- The profile cursor moving.

## 8. Publishing

`output/<id>/` is a plain static site, so any static host works: GitHub Pages, Netlify, or a course server.

To publish as a Claude artifact:
- `index.html` must be the page (`file_path`), and every other file goes in `files`.
- Each publish takes at most 255 files. Count the real files in `output/<id>/` (Angels Landing: 435 → 2 batches; Grand Canyon: 471 → 2 batches) and publish in that many batches to the same URL. **One published version can hold at most 511 files in total**, so a trail that needs more has to use smaller `wide`/`mid`/`core` boxes (the first Grand Canyon build had 612 files and was refused). `pipeline/check_config.py` warns about this before you download anything. When you republish after changing the trail, send removed files as `null` so old tiles do not stay on the link.
- Artifacts block outside data requests, which is why all tiles are bundled with the page and not loaded from the tile servers.

## 9. Credits you must keep on the page

The page already shows these. Keep them if you change the design:
- **Imagery:** USGS The National Map (public domain).
- **Elevation:** Terrain Tiles on AWS (Mapzen). Source data from USGS 3DEP and others.
- **Trail:** © OpenStreetMap contributors (ODbL).
- **Each photo:** the author, the licence with a link, and "Wikimedia Commons". s5 writes these from `credits.json`.

## 10. Known limitations

- **Start view:** at the Grotto, the first frame sits low beside a canyon wall, so the near terrain looks stretched until you scroll. A later fix is to ease pitch and zoom from a higher view over the first ~100 m.
- **Cliff faces:** aerial imagery is shot from above, so vertical cliffs look smeared. That is normal for orthoimagery.
- **Drone view:** the camera follows from above and behind, not at eye level. Eye level clips into rock at this terrain resolution (about 10–20 m).
- **Distance:** the HUD distance comes from the OSM line and reads short (3.3 km against the published figure of about 4.3 km (5.4 mi round trip)). Quote official distances in text.
- **Weight:** about 28 MB per trail. Very weak laptops may stutter; lowering `pixelRatio` to 1 helps.
