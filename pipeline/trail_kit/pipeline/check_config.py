"""Step 0: sanity-check a trail config BEFORE downloading or building anything.

Every problem below cost real time on the Grand Canyon build (see docs/LESSONS_LEARNED.md).
It downloads nothing. Run it after editing trails/<id>.json, and again after any change to
the route, the boxes or the stops.

Usage: python pipeline/check_config.py grand_canyon
"""
import sys

from common import cache_dir, corridor_tiles, exists, haversine, load_config, read_json, tiles_in_bbox


def inside(pt, box):
    return box[0] <= pt["lon"] <= box[2] and box[1] <= pt["lat"] <= box[3]


def main(trail_id):
    cfg = load_config(trail_id)
    cdir = cache_dir(trail_id)
    problems, notes = [], []
    b = cfg["bounds"]

    # 1. start/end must sit inside every box, with margin
    for name, box in (("osm_bbox", cfg["osm_bbox"]), ("core", b["core"]), ("mid", b["mid"]), ("wide", b["wide"])):
        for end in ("start", "end"):
            if not inside(cfg[end], box):
                problems.append(f"{end} point is outside {name}")
    # 2. boxes must nest
    for inner, outer in (("osm_bbox", "core"), ("core", "mid"), ("mid", "wide")):
        ib = cfg["osm_bbox"] if inner == "osm_bbox" else b[inner]
        ob = b[outer]
        if not (ob[0] <= ib[0] and ob[1] <= ib[1] and ob[2] >= ib[2] and ob[3] >= ib[3]):
            problems.append(f"{inner} is not inside {outer} (the sharp imagery would not cover the route)")

    # 3. how much will s2 download? (so you do not enlarge the boxes later and download twice)
    dem = sum(len(tiles_in_bbox(b["wide"], z)) for z in (10, 11, 12)) + len(tiles_in_bbox(b["mid"], 13)) + len(tiles_in_bbox(b["core"], 14))
    img = len(tiles_in_bbox(b["wide"], 12)) + sum(len(tiles_in_bbox(b["mid"], z)) for z in (13, 14)) + sum(len(tiles_in_bbox(b["core"], z)) for z in (15, 16))
    filler = len(tiles_in_bbox(b["wide"], 13)) - len(tiles_in_bbox(b["mid"], 13))
    served = dem - len(tiles_in_bbox(b["core"], 14)) + filler + img + len(cfg["stops"]) + 1   # z14 DEM is not served
    if b.get("corridor_m") and (cache_dir(trail_id) / "profile.json").exists():   # sharp imagery only near the route (see s5)
        prof = read_json(cache_dir(trail_id) / "profile.json")
        for z in (15, 16):
            served -= len(tiles_in_bbox(b["core"], z)) - len({t for t in tiles_in_bbox(b["core"], z) if t[1:] in corridor_tiles(prof, z, b["corridor_m"])})
        notes.append(f"corridor_m {b['corridor_m']}: z15-16 imagery is limited to tiles near the route")
    if cfg.get("seasons"):  # season photos replace the one-photo-per-stop count; overlays are one z12 tile per box tile
        photos = {k for s_ in cfg["stops"] for k in s_.get("season_photos", {}).values()}
        overlays = sum(1 for m in cfg["seasons"]["map"].values() if "snowline_m" in m or "band_m" in m)
        served += len(photos) - len(cfg["stops"]) + overlays * len(tiles_in_bbox(b["wide"], 12))
        if served > 511:
            problems.append(f"the season version would hold about {served} files; an artifact version holds at most 511")
    notes.append(f"s2 will plan {dem} elevation + {img} imagery tiles (+{filler} generated z13 filler); the published site will hold "
                 f"about {served} files (max 255 per publish -> {-(-served // 255)} batches)")

    if served + 1 > 511:
        problems.append(f"about {served + 1} files is more than the 511 one published artifact version can hold; shrink wide/mid/core "
                        f"(Grand Canyon needed wide 0.28 x 0.22 deg, mid 0.13 x 0.13, core 0.068 x 0.064 to fit)")
    # 4. straight-line length -> scroll length (about 450 vh per km felt right on flat-ish trails)
    straight = haversine((cfg["start"]["lat"], cfg["start"]["lon"]), (cfg["end"]["lat"], cfg["end"]["lon"]))
    notes.append(f"straight-line start->end is only {straight / 1000:.1f} km (switchbacks can double it: Bright Angel is 2.2x). "
                 f"scroll_vh is {cfg['camera']['scroll_vh']}; re-check it against the real route length after s3")

    # 5. stops
    ats = [s["at"] for s in cfg["stops"]]
    if ats != sorted(ats):
        problems.append("stops are not in order of 'at'")
    vh = cfg["camera"]["scroll_vh"]
    for a, c in zip(cfg["stops"], cfg["stops"][1:]):
        if (c["at"] - a["at"]) * vh < 100:
            problems.append(f"stops '{a['photo']}' and '{c['photo']}' are only {(c['at'] - a['at']) * vh:.0f} vh apart: their cards will overlap")
    if not 0 <= min(ats) and max(ats) <= 1:
        problems.append("a stop has 'at' outside 0..1")
    for s in cfg["stops"]:
        if not exists(cdir / "photos" / f"{s['photo']}.jpg"):
            notes.append(f"photo '{s['photo']}' is not in the cache yet (s4 will fetch it)")
    keys = [s["photo"] for s in cfg["stops"]]
    if len(keys) != len(set(keys)):
        problems.append("two stops share a photo key")

    # 6. if the route exists already, check it against the config
    prof = cdir / "profile.json"
    if exists(prof):
        p = read_json(prof)
        total = p[-1][2]
        d_end = haversine((p[-1][1], p[-1][0]), (cfg["end"]["lat"], cfg["end"]["lon"]))
        d_start = haversine((p[0][1], p[0][0]), (cfg["start"]["lat"], cfg["start"]["lon"]))
        notes.append(f"route: {total / 1000:.2f} km ({total / 1609.34:.2f} mi), start {p[0][3]:.0f} m ({p[0][3] * 3.281:.0f} ft), "
                     f"end {p[-1][3]:.0f} m ({p[-1][3] * 3.281:.0f} ft), end is {d_end:.0f} m / start {d_start:.0f} m from the config points")
        notes.append(f"scroll speed: {vh / (total / 1000):.0f} vh per km (about 430 felt right)")
        if d_end > 100 or d_start > 100:
            problems.append("route start/end is more than 100 m from the configured points")
        for s in cfg["stops"]:
            m = s.get("elev_at_m")
            if isinstance(m, (int, float)) and m > total:
                problems.append(f"stop '{s['photo']}' has elev_at_m {m} beyond the route length {total:.0f}")
        key = cfg["profile_labels"]["key_stop"]["at_m"]
        if key > total:
            problems.append("profile_labels.key_stop.at_m is beyond the route length")

    # 4. seasons are part of every trail (the user asked for the four-season toggle on all trails)
    sc = cfg.get("seasons")
    if not sc:
        problems.append("no \"seasons\" block: every trail gets the Spring/Summer/Autumn/Winter toggle. "
                        "Copy it from trails/_seasons_default.json (see docs/NEW_TRAIL_RUNBOOK.md)")
    else:
        seasons = ("spring", "summer", "autumn", "winter")
        for st in cfg["stops"]:
            sp = st.get("season_photos")
            if not sp:
                problems.append(f"stop '{st['photo']}' has no season_photos")
                continue
            for season in seasons:
                if season not in sp and not any(x in sp for x in sc["fallback"][season]):
                    problems.append(f"stop '{st['photo']}': no photo for {season} and none to fall back to")
        for season in seasons:
            real = sum(1 for st in cfg["stops"] if season in st.get("season_photos", {}))
            notes.append(f"season photos: {season} has a real photo for {real} of {len(cfg['stops'])} stops "
                         "(the rest borrow the nearest season and say so on the card)")
        extra = set(cfg.get("season_photo_files", {}))
        used = {v for st in cfg["stops"] for v in st.get("season_photos", {}).values()} - {st["photo"] for st in cfg["stops"]}
        if used - extra:
            problems.append(f"season photos without a Commons file name in season_photo_files: {sorted(used - extra)}")
        for name, m in sc["map"].items():
            if "snowline_m" in m:
                notes.append(f"{name} snow line {m['snowline_m']} m: check it against the trail's elevations "
                             "(winter below the trailhead, spring about mid-climb)")

    print(f"[check] {trail_id}")
    for n in notes:
        print("  note:", n)
    for p in problems:
        print("  PROBLEM:", p)
    print("  ->", "fix the problems above before building" if problems else "config looks consistent")
    print("  Reminder: compare the route with the OFFICIAL source (NPS/trail page) for the WHOLE trail you "
          "described to the user, and list the landmarks a hiker would expect to see. See docs/LESSONS_LEARNED.md.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
