# Building a 3D walk: one process, every time

Every walk is built, checked and added to the app by **one command**. It shows you the plan first, runs the steps in order, tests the result,
integrates it into the app and writes a report with a checklist you tick by hand. Nobody improvises, so every walk is comparable.

```bash
# 1. Make a config (once per hike): copy a finished one and edit start, end, boxes and stops
cp pipeline/trail_kit/trails/angels_landing.json pipeline/trail_kit/trails/<new_trail>.json
python3 pipeline/trail_kit/pipeline/check_config.py <new_trail>        # offline sanity check

# 2. See exactly what will happen (changes nothing)
python3 pipeline/walks/build_walk.py <new_trail> --hike-id <app-hike-id> --plan

# 3. Run it (asks "Run these steps now? [y/N]" unless --yes)
pip install -r pipeline/trail_kit/requirements.txt                     # first time only
python3 pipeline/walks/build_walk.py <new_trail> --hike-id <app-hike-id>

# 4. Cross-check by hand: open walks/<new_trail>/BUILD_REPORT.md and tick the checklist
npm run dev      # http://localhost:5173/walks/<new_trail>/index.html?season=summer
```
Read `pipeline/trail_kit/docs/START_HERE_NEW_TRAIL.md` and `LESSONS_LEARNED.md` before the first walk. The 3 existing walks are already built: **never re-run the tile steps on a finished walk**.

## The steps (the same list the tool prints)

| | Step | What happens | What is checked |
|---|---|---|---|
| A1 | Preflight | Reads the kit config, the hike in app data, the manifest. Refuses to touch a finished walk without `--force`. Tests the 4 data hosts. | config, hike id and kit packages exist; hosts reachable (else use the kit's browser fallback) |
| A2 | Config check | Kit `check_config.py`, downloads nothing | boxes nest, start/end inside, tile counts, stops fit every season |
| B1 | OSM trail line | Kit `s1_fetch_osm` | file written |
| B2 | Tiles | Kit `s2_fetch_tiles`: AWS Terrarium DEM, USGS imagery | tiles present |
| B3 | Route | Kit `s3_build_route`: path start to end, elevation every 10 m | route written |
| B4 | Photos | Kit `s4_fetch_photos`: Commons only, open licences only | licences allowed, credits stored |
| B5 | Season overlays | Kit `s6_season_tiles` | overlay tiles written |
| B6 | Walk page | Kit `s5_build_page` | `index.html` written |
| C1 | Structure | Every file the page names exists, the route parses | no missing files |
| C2 | Credits and seasons | USGS, Terrain Tiles, OpenStreetMap, Commons credited; "illustrative"; four seasons; `?season=` | all present |
| C3 | Route vs the hike | Start near the trailhead, end near the end point, length vs NPS (0.6 to 1.15), highest point vs NPS (10%) | strict when data is real, loose while fake |
| C4 | Size budget | **30 MB or less after optimization** per new walk (aim for 25; the original three are exempt), no file over 5 MB | within budget |
| C5 | Season photos | Real photos per season (others borrow one, and the page says so) | counts reported |
| D1 | Copy | `output/<trail>/` to `walks/<walk>/` | files copied |
| D1b | Optimize | `optimize_walk.py`: elevation tiles and season overlays to **lossless** WebP, one shared copy of the clouds; every tile checked against the original | pixel-exact; page references re-checked |
| D2 | Manifest | Adds the walk to `walks/manifest.json` (the single source of truth: `featured` and `walk_path` in app data come from it) | manifest valid |
| D3 | Hike-page profile | Writes `walks/<walk>/profile.json` from the walk's own route, in the app's profile shape, so the hike page and the walk agree | profile valid |
| D4 | App data | Fake data: regenerated. Real data: you re-run the pipeline build | data regenerated |
| D5 | App tests | `npm test`: schemas, manifest, every walk, hike links, route equals profile | all pass |
| E1 | Report | `walks/<walk>/BUILD_REPORT.md`: what ran, numbers, **checklist to cross-check by hand** | written |

Any `[FAIL]` stops the run (the kit's downloads stay cached, so a re-run continues where it stopped). A failed verification copies the walk but does **not** add it to the manifest.

## Re-checking a finished walk (no network)
```bash
python3 pipeline/walks/build_walk.py --verify angels_landing      # C1 to C5, rewrites profile.json and BUILD_REPORT.md, runs app tests
python3 pipeline/walks/build_walk.py --verify-all                 # all walks, read-only (CI runs this)
python3 -m unittest discover -s pipeline/walks -v                 # unit tests of the tooling itself (standard library only)
```

## How it is tested
- **Python** (`pipeline/walks/test_build_walk.py`): route parsing, credits and season checks, size budget (new vs legacy), route-vs-hike tolerances (strict vs fake), profile export, manifest consistency.
- **App** (`app/src/data/walks.test.ts`, part of `npm test`): manifest and `hikes.json` agree both ways (no walk without a hike, no 3D button without a walk), every file a walk names exists,
  credits and seasons are on every page, the walk's route length equals the hike page profile, size budget.
- **CI** (`walks` job): the unit tests and `--verify-all`; plus the performance budget that fails if the first screen ever references `walks/`.

## Rules
1. Walks are **30 MB or less after optimization, aim for 25** (GitHub Pages stops at 1 GB for the whole site; see `docs/DECISIONS.md`, "Walks: size and hosting"). Never reduce size by lowering image quality.
2. A walk exists only if it is in `walks/manifest.json` and its report checklist is ticked. Commit `BUILD_REPORT.md` with the walk.
3. Never hand-edit `featured` or `walk_path` in app data: they come from the manifest.
4. Photos: Public domain, CC0, CC BY, CC BY-SA from Wikimedia Commons only, always credited.
5. The walk page must have a **Back button** to the hike page and keep the Peak Finder look: tracked in `docs/work/design-track.md` (template change, then rebuild pages from cache only).

## Optimizing (quality-safe trimming)
`pipeline/walks/optimize_walk.py` runs inside the build (step D1b) and can be run alone: `python3 pipeline/walks/optimize_walk.py walks/<id> [--source <pristine copy>] [--dry-run]` (needs `pip install -r pipeline/walks/requirements.txt`).

| What | How | Measured on Angels Landing | Quality |
|---|---|---|---|
| Elevation tiles (`dem/`) | PNG to lossless WebP | 11.5 to 8.4 MB | **pixel-exact**, checked file by file (elevation is stored in the colours) |
| Season overlays (`season/`) | PNG to lossless WebP (`--season-lossy` allows q95 where PSNR >= 45 dB) | 14.3 to 9.5 MB | identical pixels |
| Clouds | one shared copy in `walks/_shared/clouds/` | 0.8 to 0 MB | identical files (refuses to merge differing images) |
| Photos, imagery | left alone (re-encoding saved nothing or cost quality) | 2.4 and 6.8 MB | unchanged |
| Tile pruning | **not done**: wide screens request terrain up to 11 km from the trail | | |

**How we know quality did not drop:** (1) per-file checks inside the optimizer (it aborts if a lossless conversion is not exact); (2) the page is patched and every reference re-checked (an unredirected cloud
reference aborts); (3) before/after screenshots of the real walks at the same scroll positions: 100% identical pixels on 3 of 4 screens, 98.5% on the 4th with a maximum difference of 1/255 (SSIM 0.99996);
(4) a full-walk replay shows the same failed requests as the original (none new). Re-run the comparison for any new walk before committing it:
serve the pristine and optimized copies, scroll to the same positions with `prefers-reduced-motion` set, screenshot both and compare (SSIM/pixel diff).
