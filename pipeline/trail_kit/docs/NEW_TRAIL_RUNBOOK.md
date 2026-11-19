# Runbook for every new trail (with the four-season toggle)

Read `docs/START_HERE_NEW_TRAIL.md` first (common notes and the season problems), then read this, then `docs/LESSONS_LEARNED.md` for the story behind each step. Every trail gets the
Spring / Summer / Autumn / Winter toggle: the user asked for it on all trails.

## 0. Before downloading anything
1. Open the **official** trail page (NPS or the park). Write the landmark list in order: name, distance, elevation. (Mistakes 1, 9)
2. If there is more than one sensible end (turnaround, summit, river, camp), ask the user once, with the options and distances. Do not pick silently. (Mistake 1)
3. Test the network with one request per host: Overpass, AWS tiles, USGS tiles, Commons. If any fails, plan the browser fallback from the start (README section 6). (Mistake 5)
4. Copy a config, set start, end, the four boxes, and the stops. Copy the `seasons` block from `trails/_seasons_default.json` into it. (README section 4)
5. `python pipeline/check_config.py <id>`. It checks boxes, tile counts, the 511-file limit (with season photos and overlay tiles), and that every stop can show every season. (Mistakes 4, 8). Over the limit? Shrink `bounds.wide`, or set `bounds.corridor_m` (z15-16 imagery only near the route; s5 also serves only tiles inside the boxes). Never drop z16 without counting requests. (Mistake 12)

## 1. Data
6. s1 OSM, s2 tiles, s3 route. Compare the route with the official figures for the **same endpoints** and list the landmarks. Add up how much the camera would turn; set `camera.heading_window_m` ONLY if over about 1,500 degrees, and screenshot 8 or more positions to check the trail is still visible (a window on a 1,150-degree cliff trail hid the route behind rock). (Mistakes 3, 9, 10, 12)
7. Check the brightness of the imagery along the route; set `look.contrast` to 0 if it is dark. (Mistake 10)

## 2. Photos (one per stop, then the seasons)
8. Search Commons near the trail; make a **contact sheet** (`tools/browser_season_photos.js` has the grid). Judge look (sunny, sharp), what it shows, and the season **by eye**: Commons dates are often upload or scan dates. Open licences only (Public domain, CC0, CC BY, CC BY-SA). Never Google Images. (Mistakes 2, 10, 11)
9. For each stop choose a base photo (`commons_file`), then for each season the best real photo you have (`season_photos`, with the extra file names in `season_photo_files`). Not every stop has every season: that is fine, it borrows the nearest season (`seasons.fallback`) and says so on the card. Expect winter and spring to be the thin ones.
10. s4 downloads them all (or the browser fallback: `import_browser_photos.py`, which also accepts `<stop>_<season>` keys).
11. Where a stop's text names a season or a flower, give it a `season_text` override for the other seasons.

## 3. Seasons on the map
12. Tune `snowline_m` for the terrain (mountain numbers flood a canyon; in desert leave the summer/autumn tint out) (winter well below the trailhead, spring about mid-climb) and the tint bands for the trail's elevations.
13. `python pipeline/s6_season_tiles.py <id>` (16 tiles per season that draws something; 64 files for four). Look at the output: it must not be solid white or empty.
14. Say clearly to the user that the season map is illustrative (the page already says so).

## 4. Build and test
15. s5. Then the screenshot test for **each season** at the start, a middle stop and the end: `SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js <id>`. Start it with nohup and wait with Monitor; never `pkill -f` a word that is in your own command. (Mistake 7)
16. Look at the screenshots: dot visible, camera not in rock, card photo, wording and credit change together, no overlap with the profile or credits box.
17. Remove `output/<id>/_shots`, count files (under 511 in total), publish in batches of at most 255, list the published files, confirm the count. (Mistake 8)

## 5. Handing over
18. Tell the user: the route numbers and what they were compared with; which stops have no real winter/spring photo; that snow lines are assumptions; which Downloads files are safe to delete. (Mistakes 5, 9, 11)
19. Update `docs/BUILD_LOG.md` with the trail's numbers, photos, problems and fixes, and zip the kit.

## Problems that happened, in one line each
1. Built the wrong end of the trail. 2. Picked photos by name, not by what they show. 3. Copied camera settings from different terrain. 4. Planned boxes before the route was final. 5. Assumed the network and the fallback. 6. Trusted a number without checking its sign. 7. Screenshot test: too early, killed own shell. 8. Stale files; the 511-file limit. 9. Reported progress against the wrong question. 10. Dull photos; camera spun on switchbacks. 11. Season toggle: unreliable photo dates, missing winter/spring photos, one-season imagery. 12. Retrofitting an old trail: restore the cache from the published page, heading window only above 1,500 degrees, corridor_m for the file limit, arid season numbers.
