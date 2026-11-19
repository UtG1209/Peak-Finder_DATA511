# Start here: notes for building any new trail

These notes apply to **every** new trail. They are about the kit and the method, not about one place.
Do them in order. The longer story behind each point is in `docs/LESSONS_LEARNED.md` (case history)
and the step-by-step list is `docs/NEW_TRAIL_RUNBOOK.md`.

**Every trail gets the four-season toggle (Spring / Summer / Autumn / Winter).** It is part of the
build, not an extra. Plan its photos, snow lines and file count from the first step.

---

## 1. Five habits that prevent most problems

1. **Define the whole trail before building anything.** From the official source (national park, agency
   or trail authority) write the landmark list in order: name, distance, elevation, what you see.
   Pick start, end, boxes and stops only after that. If the trail has several sensible ends
   (turnaround, summit, river, camp), ask the user once with the options and distances.
2. **Do not assume; check or ask.** Where the trail ends, what a photo shows, what a number means,
   what the network allows: test it in one line, or ask. Say any assumption out loud.
3. **Do the cheap check before the expensive step.** Config check, contact sheet and file listing take
   seconds. Downloads, screenshots and publishes take minutes and are painful to repeat.
4. **Check what you produced, not what you meant to produce.** Open the photos. Count the files. List
   the published folder. Look at the screenshots. "The command ran" is not "it worked".
5. **Compare with the user's mental picture, not only with a number.** A route length can match the
   official figure and still be the wrong stretch of trail. When you report a check, say what you
   compared with what.

---

## 2. Order of work

| # | Step | Command / where |
|---|------|-----------------|
| 0 | Landmark list from the official page; agree the end point | by hand |
| 1 | Network test: one request per host (Overpass, AWS tiles, USGS tiles, Commons). Plan the browser fallback now if any fails | README section 6 |
| 2 | Copy a config; set start, end, boxes, stops; **copy the `seasons` block from `trails/_seasons_default.json`** | `trails/<id>.json` |
| 3 | Config check (boxes, tile counts, 511-file limit, every stop can show every season) | `python pipeline/check_config.py <id>` |
| 4 | OSM, tiles, route | `s1`, `s2`, `s3` |
| 5 | Compare route with the official figures **for the same endpoints**; list the landmarks it passes | by hand |
| 6 | Photos: contact sheet, choose by eye, base photo per stop **and** season photos | `tools/browser_season_photos.js`, `s4` |
| 7 | Season map overlays | `s6_season_tiles.py <id>` (before `s5`) |
| 8 | Build the page | `s5_build_page.py <id>` |
| 9 | Screenshot **each season** at start, middle, end | `SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js <id>` |
| 10 | Remove `_shots`, count files, publish, list what was published, confirm the count | |
| 11 | Hand over (section 8), update `docs/BUILD_LOG.md`, zip the kit | |

`./run_all.sh <id>` runs s1 to s6 and s5 in the right order.

---

## 3. Config essentials

- **Boxes** (`osm_bbox`, `bounds.core`, `bounds.mid`, `bounds.wide`) must nest, and must contain the
  start and the end with margin. Size them around the **final** route. Changing them later means
  downloading again and leaves stale files.
- **File budget: an artifact version holds at most 511 files in total, and one publish at most 255.**
  The count is tiles + photos + season photos + season overlay tiles + the page. The season toggle adds
  roughly 15 to 25 photos and 16 overlay tiles for each season that draws an overlay. `check_config.py`
  estimates the total; trust the real count of `output/<id>/` before publishing.
- **Camera is untested for every new trail.** Do not copy `pitch` and `zoom` from another trail. Test
  start, middle and end with `SHOTS=0,0.5,1`, and change one value at a time. For a deep canyon start near
  `pitch 45, zoom 15.3`.
- **`scroll_vh`** comes from the real route length (about 430 vh per km), not the straight line.
  Switchbacks can double the length.
- **Switchbacks:** add up how much the camera turns along the route. Above about 1,500 degrees for a long
  trail, set `camera.heading_window_m` (for example `[500, 1200]`). Without it the screen spins on
  every bend. Below that it does harm: on a cliff trail it pointed the camera into the rock. Always
  screenshot many positions and compare with the previous build.
- **Too many files:** shrink `bounds.wide`, or set `bounds.corridor_m` (about 1000) so z15-16 imagery is
  kept only near the route. s5 serves only tiles inside the boxes.
- **Direction of travel:** if the trail goes down, check every line that uses `{gain}` reads correctly
  ("below the start", not "above").
- **Imagery brightness:** check it along the route. If it is dark, set `look.contrast` to 0.

---

## 4. Photos (base photo per stop)

- **Open licences only:** Public domain, CC0, CC BY, CC BY-SA, from Wikimedia Commons. Never Google
  Images or travel sites, not even as a placeholder. `s4` refuses other licences.
- **Always make a contact sheet** (grid of thumbnails with file name and licence) and look at it before
  choosing. Do not pick from file names or search order.
- Judge **look** as well as licence and geotag: sunny, sharp, in season, showing the landmark the stop
  names. A photo can pass every check and still be dull.
- **Geotag:** within about 100 m of the trail is a match; further is "nearby", and the caption must not
  claim you stand there.
- Every landmark should have a photo of *that* landmark. If no open photo exists, say so in the text or
  drop the stop.
- If a photo series has no geotag, use it only with a caption that claims what the file title says, and
  note it in the build log.

---

## 5. The four-season toggle

### What the user gets
A button row on the map (Spring, Summer, Autumn, Winter). Choosing a season changes the map look, the
sky, and every stop card's photo, wording and credit together. The page opens on the viewer's current
month; `?season=winter` overrides it. The page says that the season map is **illustrative**.

### What it is made of
| Part | Where | Notes |
|------|-------|-------|
| Per-stop photos | `stops[].season_photos` = `{season: photo key}` | Real photos only |
| File names | `season_photo_files` = `{photo key: Commons file name}` | Same open-licence rule |
| Season wording | `stops[].season_text` | Only where the base text names a season or flower |
| Fallback | `seasons.fallback` | Nearest season, shown on the card as a note |
| Map overlay | `seasons.map.<season>` | Snow (`snowline_m`) or vegetation tint (`band_m`) |
| Map look | `paint`, `sky`, `shade` in each season | Colour grading, sky and hillshade colours |
| Overlay tiles | `python pipeline/s6_season_tiles.py <id>` | 16 PNG tiles per season that draws something |

Start from `trails/_seasons_default.json` and then tune it for the trail's elevations. **Its numbers
were tuned on one forested mountain trail; treat them as a starting point, not as answers.**

### Tuning for a new trail
- **Snow line:** winter well *below* the trailhead (so the whole walk is in snow), spring around the
  middle of the climb. Look at the route's start, end and highest elevations first. Say to the user that
  snow lines are assumptions, not measurements. Check the printed "mean cover" after s6.
- **Steep rock stays bare** (`steep_from`/`steep_to`) and north-facing ground holds snow lower
  (`north_m`). Keep them: they stop the snow looking like a flat white sheet.
- **Vegetation band** (`band_m` for summer and autumn): set it to where vegetation actually grows on
  this trail, from the forest floor to the tree line or meadow top. The default band is for one mountain.
- **Check the mask:** s6 prints the "vegetated share". If it is tiny (desert, bare rock, snowfield) or
  huge, the tint will look wrong. For a trail with no vegetation worth tinting, leave `band_m` out of that
  season and use only `paint`/`sky` (colour grading) there.
- **Keep summer and autumn tints light.** Tested settings that looked right on real imagery:
  summer alpha about 0.3 with muted olive greens, saturation +0.12, hue +8; autumn alpha about 0.3 with
  amber/orange, saturation +0.18, hue 0. Strong tints looked worse (see problems below).

### Photos for the seasons
- Expect **summer and autumn to be easy and winter and spring to be thin**. Real winter and spring photos
  exist for only some stops. That is fine: the rest borrow the nearest season through `seasons.fallback`
  and the card says so. Do not pretend.
- **Judge the season by eye on the contact sheet.** The Commons "date taken" is often an upload or scan
  date, not the date of the photo.
- Make one contact sheet per stop with all candidate seasons, so you compare like with like.
- If a stop's text names a season ("the meadows turn red in autumn"), give it a `season_text` override for
  the other seasons or the card will contradict its own photo.
- Report honestly how many stops have a real photo per season. `check_config.py` prints the counts.

---

## 6. Problems met while building the seasons (and what to do)

| Problem | Cause | Fix / rule |
|---------|-------|------------|
| Vegetation mask covered only a few percent | Forest in aerial imagery is blue-teal, not green; hue range too narrow | Mask uses a wide hue range and a value cut; check the printed "vegetated share" |
| Winter looked flat grey and murky | Brown hillshade shadows under white; overlay too opaque | Per-season hillshade colours (bluish in winter), alpha about 0.8, steep rock bare, brighter snow shading |
| Summer looked bad: "so much green everywhere" | Tint alpha 0.85 with saturation +0.5 buried the real texture | Light tint: alpha about 0.3, muted greens, small saturation and hue change |
| Lakes turned purple | Whole-image hue shift above about +30 | Keep hue shift small (under about +10); use the overlay for colour instead |
| Autumn looked muddy brown, lake brownish | Alpha 0.5 with saturation +0.38 | Alpha about 0.3, bright amber, saturation +0.18. Tried 0.38 (brown returned) and 0.26 (too close to summer) |
| Summer still had red patches on upper slopes | Overlay is found from about 38 m/pixel imagery and cannot see small red plants; the base photo is one season | Say the map is illustrative; the real fix is imagery from the right season, which free sources do not give |
| Season photos in the wrong season | Commons dates are upload or scan dates | Choose by eye on contact sheets |
| Winter or spring had few photos | Few people photograph the trail then | Labelled fallback to the nearest season; report the counts |
| Card text contradicted its photo | Base text names a season | `season_text` override per season |
| Credits box overlapped the profile | The extra season buttons and note took room | Credits box sits above the profile (already in the template); look for overlap in every screenshot |
| Too many files | 16 overlay tiles per season plus about 20 photos | Check `check_config.py` before building; shrink the wide box if over 511 |
| A first look at each season was wrong three times | Changed several things at once | Screenshot every season at a high and a low position; change one thing at a time |
| Screenshot test killed my own shell | `pkill -f` matched my own command line | Start the test with `nohup`, wait with a monitor, stop leftovers with `pkill -x node` |
| Republishing refused | Files on the link were changed since last read | List the artifact's files first, then publish; send only changed files |

---

## 7. Network and browser fallback

- Sandboxes often block the data hosts. Test each host first; if any fails use the browser fallback from
  the start (README section 6).
- Run browser fetches from a page on a host that allows them, not from Commons.
- Save parts of at most about 1.4 MB. After every batch, **list the Downloads folder and compare with the
  expected file list**; links can silently fail to save, and clicks go to the wrong place if the page
  moved after the screenshot.
- Retry staging if it says "upload failed".
- Tools that write to the user's Downloads cannot delete afterwards. Tell the user which files are safe
  to delete.

---

## 8. Testing and publishing

- Screenshot **every season** at the start, a middle stop and the end. Look at them: dot visible, camera
  not inside rock, photo, wording and credit all change together, nothing overlaps the profile or the
  credits box.
- The test emulates reduced motion so the page jumps to each position. Software rendering is slow: run
  it in the background and wait for the files.
- Delete `output/<id>/_shots` before publishing. `s5` wipes `dem`, `img`, `photos`, `season` first, so
  stale files do not ship.
- Publish in batches of at most 255 files; the total stays under 511. When republishing, list the
  artifact's files first, and send only what changed. Set removed files to `null`.
- After publishing, list the files and confirm the count.

---

## 9. What to tell the user at the end

- The route numbers and the official figures they were compared with (same endpoints).
- Which stops have no real photo for winter and spring, and that those borrow another season.
- That snow lines and season colours are illustrative assumptions, and what the imagery's own season is.
- Which files in their Downloads folder are safe to delete.
- Anything that failed the checks and was accepted anyway, with the reason.

## 10. Before you hand the zip over

- [ ] `check_config.py` passes with no problems.
- [ ] Every season looked at in screenshots, high and low position.
- [ ] Real file count under 511; published count confirmed by listing.
- [ ] `docs/BUILD_LOG.md` has the trail's numbers, photos, problems and fixes.
- [ ] Any new lesson added to this file in general words, not tied to one place.
