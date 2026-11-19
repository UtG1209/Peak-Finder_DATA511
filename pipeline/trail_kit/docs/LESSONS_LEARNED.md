# Lessons learned: the Grand Canyon build (read this before building a new trail)

This is an honest list of what went wrong when the kit was used to build a second trail
(Bright Angel Trail, Grand Canyon), why it went wrong, and the habit that prevents it.
Most of the lost time came from a few **assumptions** that were never checked, and from
**building before the whole route was defined**. The Grand Canyon page was built three times
(rim to Indian Garden, with new photos, then rim to river) when it should have been built once.

---

## The short version: five rules

1. **Define the whole trail, end to end, before building anything.** Write down the full list of
   landmarks a hiker would expect, in order, with distance and elevation from the official source.
   Only then choose start, end, boxes and stops.
2. **Do not assume. Check, or ask.** If something is a guess (where the trail ends, what a
   photo shows, what a number means, what a network allows), either verify it with a one-line test
   or ask the user. Say the assumption out loud when you proceed.
3. **Check each assumption cheaply, before the expensive step.** Downloads, screenshots and
   publishes are slow. A 10-second check (a config check, a contact sheet, a file listing) is
   always cheaper than redoing them.
4. **Verify what you produced, not what you intended to produce.** Open the photos, count the
   files, list the folder, look at the screenshot. "The command ran" is not "it worked".
5. **Compare to the user's mental picture, not just to a number.** The route length matched NPS
   and the page was still wrong, because it stopped at the wrong place.
6. **Every trail gets the four-season toggle** (Spring / Summer / Autumn / Winter). The user asked for
   this on all trails. It is part of the build, not an extra: plan its photos, its snow lines and its
   file count from step 0. `docs/NEW_TRAIL_RUNBOOK.md` has the order of work and lists every problem so far.

---

## Mistakes, in the order they happened

### 1. Built the wrong end of the trail (the biggest mistake)
- **What happened:** The task said "Grand Canyon". I picked the Bright Angel Trail, then ended it at
  Indian Garden (4.5 mi) because that is a common day-hike turnaround and the data was easy to get.
  I never checked how the trail is actually described. Anyone looking up "Bright Angel Trail" sees
  the Colorado River, the Silver Bridge and Phantom Ranch (9.5 to 9.9 mi). The finished page had
  no river at all, and the user had to point this out (twice, with screenshots).
- **Why:** I treated "end" as a free choice and optimised for easy data, not for what the trail is.
- **Avoid it:**
  - Before touching the config, read the official trail page (NPS, park or agency) and write the
    landmark list: name, distance, elevation, "what you see". Use the *farthest* well-known
    landmark as the default end, unless the user says otherwise.
  - If the trail has several reasonable end points (turnaround, summit, river, camp), **ask the
    user once, in one message, with the options and their distances**. Do not pick silently.
  - Run `pipeline/check_config.py` and compare its route length to the official figure for
    the *same endpoints*. A match against the wrong endpoint proves nothing.

### 2. Chose photos by name, not by what they show
- **What happened:** The first photo set was sunsets and generic rim views. They were open-licence
  and on the right trail, but none showed the canyon's best-known views. Later photos were picked
  from search results before I had looked at them or checked where they were taken.
- **Avoid it:**
  - Make a **contact sheet** of every candidate (a grid of thumbnails with the file name and
    licence) and look at it *before* choosing. See `docs/BUILD_LOG.md` for the script pattern.
  - Compare the geotag (`GPSLatitude/GPSLongitude` in Commons metadata) with the route. Within
    about 100 m of the trail is a match; further away is "nearby", and the caption must not claim
    you are standing there. Say "the Colorado River" and not "from the trail" when the photo was
    taken off-route.
  - Every stop in the landmark list from rule 1 should have a photo that shows *that* landmark.
    If none exists under an open licence, say so in the stop text or drop the stop.
  - Never use Google Images or travel-site photos, even as a placeholder. Commons only.

### 3. Copied camera settings from a different terrain
- **What happened:** Angels Landing used `pitch 64, zoom 15.9`. In a canyon with a 1,300 m drop
  that put the camera inside rock and behind ridges. Each check cost 1 to 2 minutes of software
  rendering, and I changed several values at once.
- **Avoid it:** Treat `camera` as untested for every new trail. Test three positions first
  (start, middle, end) with `SHOTS=0,0.5,1`. Change one value at a time. For deep canyons start at
  `pitch 45, zoom 15.3`. Set `scroll_vh` from the *real* route length (about 430 vh per km), not from
  the straight line: Bright Angel is 15.8 km of trail for 7.0 km straight.

### 4. Boxes and tile downloads were planned before the route was final
- **What happened:** I downloaded tiles for the rim-to-Indian-Garden boxes, then had to enlarge
  every box for the river and download again. The new run also left stale files behind.
- **Avoid it:** Decide the final end point first (rule 1), then size the boxes, then run
  `check_config.py` to see the tile counts and the number of publish batches. Only then download.
  When you must extend a trail later, download only the *new* tiles (diff against the cache) and
  use `pipeline/import_browser_parts.py`, which merges OSM data instead of overwriting it.

### 5. Assumed the network, and then assumed the fallback would be easy
- **What happened:** The sandbox returned 403 for every data host. The browser fallback then had
  its own problems: Overpass 502s and timeouts, a tab whose page security policy blocked tile
  fetches, files above about 1.5 MB failing to upload, and 4 of 11 download links silently not
  saving.
- **Avoid it:**
  - Test the network first with one request per host (OSM/Overpass, AWS tiles, USGS tiles, Commons).
    If anything fails, use the browser fallback from the start, not after a failed build.
  - Run the fallback from a page on a host that allows the requests (here
    `basemap.nationalmap.gov`), not from Commons.
  - Save **parts of at most about 1.4 MB**, not one big file.
  - After every batch of saves, **list the folder and compare it with the expected file list**.
    Do not assume a click worked. The page can reflow after a screenshot, so click positions from
    an older screenshot may hit the wrong link; take a new screenshot first.
  - Keep one heavy Overpass query per area, use the kit's own bbox query, and retry across the public
    mirrors with a 40 to 60 second abort.
  - The tools that save files in the user's Downloads folder cannot delete them afterwards. Tell the
    user which files are safe to delete.

### 6. Trusted a number without checking its sign or meaning
- **What happened:** The template computed "climb" as end minus start. For a descent that is
  negative, so the text said "-1,300 m above where you started". The route printout also reports
  *cumulative* climb, which is not the same as the net drop.
- **Avoid it:** For each number shown on the page, write down what it means and check one real
  example by hand. If the direction is down, check the wording of every line that uses `{gain}`
  ("below the rim", not "above where you started"). The template now uses the size of the net
  change.

### 7. Screenshot test: measured too early, and killed my own shell
- **What happened:** The first screenshots showed the HUD and camera from the *previous* scroll
  position because the page eases toward the target. `pkill -f screenshot_test` also matched the
  shell running the command and ended the session.
- **A third problem:** on the long trail the camera's easing never finished inside the 2-minute
  wait (software rendering draws a frame every few seconds), so the test crashed on the second shot.
- **Avoid it:** `tools/screenshot_test.js` now emulates reduced motion (the page jumps straight to
  each scroll position) and waits until the page reports that position. Set `REAL_EASING=1` only
  when you want to test the easing itself. Stop leftover test processes with `pkill -x node` (and `-x chrome`, `-x headless_shell`),
  never `pkill -f` with a word that appears in your own command line. Check that port 8765 is free
  first.

### 8. Left stale files and counted files wrongly
- **What happened:** Old photos stayed in `output/` after the stops changed. I also planned for
  "two batches" because the instructions said 255 files; the real trail needed three.
- **A bigger surprise:** one published version of an artifact can hold at most **511 files in total**,
  however many batches you use. The first rim-to-river build had 612 files and the last publish was
  refused after two batches had gone up. The fix was to shrink the wide/mid/core boxes (471 files).
  `check_config.py` now warns when the estimate goes over 511.
- **s5 did not clean up:** it copied new files into `output/<trail>/` but never removed old ones, so
  tiles from the earlier, larger boxes were counted and published. s5 now wipes `dem/`, `img/` and
  `photos/` first.
- **Avoid it:** Count the files in `output/<trail>/` (not the plan) before publishing, and keep the
  total under 511. When republishing, set removed files to `null` in `files` so old tiles do not remain
  on the link.

### 9. Reported progress against the wrong question
- **What happened:** The route check against NPS figures was correct for the endpoints I had
  picked (rim to Indian Garden), so it passed. But those endpoints were the wrong trail for what the
  page was meant to show, and a passing number made it look finished.
- **Avoid it:** When you report a check, say *what you compared with what* (for example
  "15.8 km, route rim to Phantom Ranch, against NPS 9.9 mi rim to Phantom Ranch"). If the comparison
  is only partly valid, say that.

### 10. (North Cascades) Photos that were correct but dull, and a camera that spun on switchbacks
- **What happened:** Every photo was open-licence and on the route, but I picked by geotag and licence and
  the set came out dim (a snowy early-season trailhead shot, a dawn view that was nearly black). The user
  compared the page with what people see online and said none of it looked like that. Separately, the
  Cascade Pass Trail has about 30 switchbacks, and the camera turned to face the next 60 to 260 m of trail, so it
  swung through about 4,800 degrees of turning along the route (up to 156 degrees inside 100 m).
- **Avoid it:**
  - A photo can pass every check (licence, geotag, caption) and still be a poor choice. Judge the contact
    sheet for *look* too: sunny, in season, sharp. Prefer summer or autumn colour shots. If the best-looking
    series has no geotags, use it with a caption that claims only what the file title says, and say so in the build log.
  - Before building, measure how much the camera will turn: run the heading window over the profile and
    add up the changes. Above about 1,500 degrees for a trail this long (and only then; see mistake 12), set `camera.heading_window_m`
    (for example `[500, 1200]` gave about 800 degrees and at most 34 degrees per 100 m). The page also
    low-pass filters the heading now.
  - Do not take other places' photos from a Google Images grid as the target. Many show other trails
    (Diablo Lake, Thunder Knob) and none of them are openly licensed.

---

### 11. (North Cascades) Season toggle: what the data could and could not give

- Free photo dates (Commons "date taken") often mean upload or scan date. Season was judged from the picture itself on contact sheets.
- Real photos of every stop in every season do not exist. Plan a labelled fallback to the nearest season instead of pretending, and write season-specific wording only where a photo exists.
- The base imagery has one season in it (here early autumn). An overlay can add snow convincingly, but it cannot remove autumn colour from the imagery, so say that a season look is illustrative.
- `pkill -f screenshot_test` inside the same command line kills your own shell (mistake 7 again). Start the test with nohup and wait with Monitor.
- Check the file count before building more layers: 16 overlay tiles per season added 64 files (456 of 511).
- The green/red tint is found from the colours of the z12 imagery (about 38 m per pixel). It cannot see the red heather that shows at close range (z16), so "summer" kept red patches on the upper slopes. A hue shift of the whole imagery greens it but turns blue lakes purple above about +30. A strong green tint (alpha 0.85, hue +28) was tried first and the user said summer "looks worse because so much green everywhere". Final: a light tint (alpha 0.3, muted olive greens, saturation +0.12, hue +8) so the real forest and rock texture shows through. Keep season tints light; the honest fix is a base image from the right season, which free imagery does not give.
- Autumn had the same problem as summer: tint alpha 0.5 with map saturation +0.38 turned the upper slopes muddy brown and the lake brownish. Final autumn: alpha 0.3, bright amber/orange colours, saturation +0.18, hue 0. Tried 0.38 (browning came back at the upper slopes) and 0.26 (too close to summer). Rule for every season tint: light touch, check a high and a low position.
- First looks at a new look were wrong three times (winter flat grey because the hillshade shadow colour was brown; summer not green; credits box overlapping the profile). Look at a screenshot of **every** season at a close and a far position before publishing, and change one thing at a time.
- Season-specific wording: stop text that names a season ("In autumn the meadows turn red") must be overridden per season (`season_text`) or the card contradicts its photo. Check each stop's text against its photos.
- Snow lines are numbers you choose. Set winter below the trailhead and spring around mid-climb, and tell the user they are assumptions (the winter view of North Cascades is about 72% snow by area; steep rock stays bare).

---

### 12. Retrofitting the season toggle onto a trail built earlier

- **Restore the cache from the published page first.** An old trail's `cache/` may be gone. Download the published `index.html` and its tiles/photos back into `cache/<id>/` and rebuild from that. Never re-run s2/s3 on a finished trail: a new download can give a different route or tiles.
- **Back up the config** (`cp trails/<id>.json /tmp/<id>.before.json`) and compare the new build with the old published page, not with what you remember.
- **`camera.heading_window_m` is only for routes with more than about 1,500 degrees of turning, and only after a screenshot check at many positions.** It was added to a short, cliff-hugging trail (about 1,150 degrees) and the camera looked into the cliff walls, so most of the hike was hidden behind rock; the user spotted it before I did. Rule: add it only above about 1,500 degrees, and screenshot 8 or more positions (every switchback group, every cliff section) next to the previous build before publishing. If the old page already worked, keep its camera.
- **Fit the file limit by shrinking boxes, in this order:** (1) s5 now serves only tiles inside the config boxes (it prints how many cached tiles it left out); (2) shrink `bounds.wide`; (3) set `bounds.corridor_m` (for example 1000) to keep z15 and z16 imagery only near the route. Do not drop z16 on assumption: MapLibre asks for z16 at camera zoom about 15.3 because pitch makes near tiles finer. Test it by counting the tile requests per zoom in a screenshot run (Grand Canyon: 82 requests for z16).
- **Arid and canyon terrain needs its own season numbers.** Snow lines copied from a mountain trail either covered the whole canyon or none of it. Winter about 1,750 m with `soft_m` 250 and `patchy` 0.4 left the canyon floor bare and the rims white. In desert, summer and autumn have no vegetation band to tint, so leave `band_m`, `colour_a`, `colour_b`, `alpha` out: those seasons then only change colour grading and photos, and the page must not claim otherwise.
- **Season by eye, and watch autumn colour in December.** Cottonwoods in a canyon turn yellow late, so a December photo can show autumn colour. Judge from the picture; when a date and the look disagree, say which one you used.
- **Date the base photos too.** The old base photo of a stop is also from some season. Put it into `season_photos` under its real season instead of assuming it is summer.
- **Commons search is sometimes "too busy".** Use abort timeouts, retry, and run several searches in parallel from the browser.
- **Route length against rounded official figures.** NPS gives rounded distances (and sometimes a different endpoint). Report both numbers and say what each is measured from.
- **Check the count of published files** against the local count (432 = 432) after every publish batch, and delete `output/<id>/_shots` before counting.

## Pre-flight checklist (do these before step 1)

- [ ] Wrote the trail's landmark list from the official source (name, distance, elevation).
- [ ] Chose the start and end from that list, or asked the user which one they want.
- [ ] Each landmark has an open-licence Commons photo, checked on a contact sheet, with geotag
      distance from the route noted.
- [ ] Tested the network for all four hosts (or decided to use the browser fallback up front).
- [ ] Set the boxes around the *final* route and ran `python pipeline/check_config.py <id>`.
- [ ] Planned the number of publish batches from the real file count (255 files per publish) and checked the
      total is **under 511**, the most one artifact version can hold (`check_config.py` estimates it).
- [ ] Treated `camera` as untested; plan to test start, middle and end first.

## After step 3 (route) and before step 5 (page)

- [ ] Route distance, start elevation, end elevation compared with the official figures for the
      **same endpoints**, and each intermediate landmark checked (for example "3-Mile Resthouse about
      4.8 km from the start, at about 1,447 m / 4,748 ft").
- [ ] The route follows the named trails you expect ("trail pieces used" in the s3 printout).
- [ ] `{gain}` wording reads correctly for the direction of travel.
- [ ] `scroll_vh` is about 430 times the route length in km.
- [ ] Added up the camera heading changes along the route (see mistake 10); long window set if it is over about 1,500 degrees.
- [ ] Looked at the photos for how they look, not only for licence and geotag.

## After step 5 (page)

- [ ] Screenshots at the start, a middle stop and the end; the hiker dot is visible and the camera
      is not inside rock.
- [ ] Every stop's card shows the right photo and a credit line.
- [ ] `output/<trail>/` contains only files the page uses; no `_shots` folder.
- [ ] Published, then listed the artifact's files to confirm the count.
- [ ] (Season toggle) `seasons` block copied from `trails/_seasons_default.json`, snow lines tuned to the trail's elevations; photos chosen by eye from contact sheets (not by date); `check_config.py` passes; file count under 511; `s6_season_tiles.py` run before s5.
- [ ] (Season toggle) Looked at each season at the start, a middle stop and the end; the photo, wording and credit change together; any borrowed-season photo says so on the card.
