"""Step 5: assemble the finished, self-contained site folder for one trail.

Reads the config, cache/<trail>/profile.json and credits.json, fills template/template.html,
and copies only the tiles the page serves:
  dem/  z10-13   (z14 is used for the profile only; serving it isn't needed)
  img/  z12-16
  photos/
Writes output/<trail>/index.html. Open it through any static web server, for example
  python -m http.server -d output/angels_landing 8000
Usage: python pipeline/s5_build_page.py angels_landing
"""
import html
import json
import shutil
import sys
from urllib.parse import quote

from common import ROOT, cache_dir, corridor_tiles, load_config, read_json, site_dir, tiles_in_bbox

SERVED_DEM_ZOOMS = {"10", "11", "12", "13"}


def esc(s):
    return html.escape(s, quote=True)


def fill_tokens(text, stop):
    t = esc(text)
    if "{elev}" in t:
        at = stop.get("elev_at_m", 0)
        at = 10 ** 9 if at == "end" else int(at)  # the page clamps to the trail length
        t = t.replace("{elev}", f'<span data-elev="{at}"></span>')
    return t.replace("{gain}", '<span data-gain></span>')


def credit_html(c, commons_file):
    page = c.get("page") or "https://commons.wikimedia.org/wiki/File:" + quote(commons_file.replace(" ", "_"), safe="(),")
    who = f'<a href="{esc(page)}" target="_blank" rel="noopener">{esc(c["artist"] or "Unknown")}</a>'
    lic = esc(c["license"])
    if c.get("license_url"):
        lic = f'<a href="{esc(c["license_url"])}" target="_blank" rel="noopener">{lic}</a>'
    return f'Photo: {who} · {lic} · Wikimedia Commons'


SEASONS = ("spring", "summer", "autumn", "winter")


def season_variants(cfg, s, credits):
    """Resolve, for one stop, what each season shows: photo, credit, title, text and a note when the photo is borrowed."""
    sc = cfg.get("seasons")
    photos = s.get("season_photos", {})
    texts = s.get("season_text", {})
    labels = sc["labels"]
    out = {}
    for season in SEASONS:
        src_season = season if season in photos else next(x for x in sc["fallback"][season] if x in photos)
        key = photos[src_season]
        t = texts.get(season, {})
        out[season] = {
            "src": f"photos/{key}.jpg", "key": key,
            "credit": credit_html(credits[key], s["commons_file"]),
            "title": esc(t.get("title", s["title"])),
            "text": fill_tokens(t.get("text", s["text"]), s),
            "note": "" if src_season == season else
                    f"No real {labels[season].lower()} photo of this spot, so this is the nearest season: {labels[src_season].lower()}.",
        }
    return out


def steps_html(cfg, credits):
    out = []
    for s in cfg["stops"]:
        if cfg.get("seasons"):
            v = season_variants(cfg, s, credits)
            first = v["autumn"]
            data = esc(json.dumps({k: {x: y for x, y in d.items() if x != "key"} for k, d in v.items()}, separators=(",", ":")))
            out.append(
                f'  <section class="step" data-at="{s["at"]}" data-seasons="{data}">'
                f'<img src="{first["src"]}" alt="{esc(s["alt"])}" loading="lazy" width="900" height="675">'
                f'<div class="body"><div class="eyebrow">{fill_tokens(s["eyebrow"], s)}</div>'
                f'<h2>{first["title"]}</h2><p class="txt">{first["text"]}</p>'
                f'<p class="note" hidden></p><p class="credit">{first["credit"]}</p></div></section>')
            continue
        c = credits[s["photo"]]
        out.append(
            f'  <section class="step" data-at="{s["at"]}">'
            f'<img src="photos/{s["photo"]}.jpg" alt="{esc(s["alt"])}" loading="lazy" width="900" height="675">'
            f'<div class="body"><div class="eyebrow">{fill_tokens(s["eyebrow"], s)}</div>'
            f'<h2>{esc(s["title"])}</h2><p>{fill_tokens(s["text"], s)}</p>'
            f'<p class="credit">{credit_html(c, s["commons_file"])}</p></div></section>')
    return "\n".join(out)


def season_js(cfg):
    sc = cfg.get("seasons")
    if not sc:
        return "null"
    m = {}
    for name, p in sc["map"].items():
        m[name] = {"overlay": "snowline_m" in p or "band_m" in p, "paint": p["paint"], "sky": p["sky"], "shade": p.get("shade")}
    return json.dumps({"default": sc["default"], "labels": sc["labels"], "map": m, "note": sc["note"]}, separators=(",", ":"))


def main(trail_id):
    cfg = load_config(trail_id)
    cdir = cache_dir(trail_id)
    out = site_dir(trail_id)
    profile = read_json(cdir / "profile.json")
    credits = read_json(cdir / "credits.json")
    b, cam, lab = cfg["bounds"], cfg["camera"], cfg["profile_labels"]
    page = (ROOT / "template" / "template.html").read_text(encoding="utf-8")
    values = {
        "__TITLE__": esc(cfg["title"]), "__HIKE_NAME__": esc(cfg.get("hike_name", cfg["title"].removesuffix(" Walk"))),
        "__PARK__": esc(cfg["park"]),
        "__BRAND__": esc(cfg["brand"]), "__MAP_LABEL__": esc(cfg["map_label"]),
        "__START_LABEL__": esc(lab["start"]), "__END_LABEL__": esc(lab["end"]),
        "__KEY_LABEL__": esc(lab["key_stop"]["label"]), "__KEY_M__": str(lab["key_stop"]["at_m"]),
        "__CONTRAST__": str(cfg.get("look", {}).get("contrast", 0.18)),
        "__HEADING__": json.dumps(cam.get("heading_window_m")),
        "__SCROLL_VH__": str(cam["scroll_vh"]), "__PITCH__": str(cam["pitch"]), "__ZOOM__": str(cam["zoom"]),
        "__WIDE__": json.dumps(b["wide"]), "__MID__": json.dumps(b["mid"]), "__CORE__": json.dumps(b["core"]),
        "__STEPS__": steps_html(cfg, credits),
        "__SEASONS__": season_js(cfg),
        "__PROFILE__": json.dumps(profile, separators=(",", ":")),
    }
    for k, v in values.items():
        if k not in page:
            raise SystemExit(f"template is missing {k}")
        page = page.replace(k, v)
    (out / "index.html").write_text(page, encoding="utf-8")

    # Start clean: tiles and photos left over from an earlier build of this trail would be published too.
    for sub in ("dem", "img", "photos", "season"):
        shutil.rmtree(out / sub, ignore_errors=True)

    n = 0
    # Serve only the tiles the page can ask for (the config's boxes), so a cache left over from an earlier,
    # larger box (or from a restored old build) does not push the file count over the artifact limit.
    wanted = {"dem": {}, "img": {}}
    for z in (10, 11, 12, 13):
        wanted["dem"][z] = {(x, y) for _, x, y in tiles_in_bbox(b["wide"], z)}
    wanted["img"][12] = {(x, y) for _, x, y in tiles_in_bbox(b["wide"], 12)}
    for z in (13, 14):
        wanted["img"][z] = {(x, y) for _, x, y in tiles_in_bbox(b["mid"], z)}
    for z in (15, 16):
        wanted["img"][z] = {(x, y) for _, x, y in tiles_in_bbox(b["core"], z)}
    # Optional: bounds.corridor_m keeps only the sharpest imagery (z15-16) within that many metres of the route.
    # A long diagonal trail makes the core box mostly empty space; elsewhere the z14 imagery shows through.
    if b.get("corridor_m"):
        for z in (15, 16):
            wanted["img"][z] &= corridor_tiles(profile, z, b["corridor_m"])
    skipped = 0
    for kind in ("dem", "img"):
        for f in (cdir / kind).rglob("*"):
            if f.is_file() and (kind == "img" or f.relative_to(cdir / kind).parts[0] in SERVED_DEM_ZOOMS):
                z, x, y = f.relative_to(cdir / kind).parts
                if (int(x), int(y.split(".")[0])) not in wanted[kind].get(int(z), set()):
                    skipped += 1
                    continue
                dst = out / f.relative_to(cdir)
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dst)
                n += 1
    keys = set()
    for s in cfg["stops"]:
        keys.add(s["photo"] if not cfg.get("seasons") else None)
        keys.update(s.get("season_photos", {}).values())
    keys.discard(None)
    for key in sorted(keys):
        dst = out / "photos" / f"{key}.jpg"
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(cdir / "photos" / f"{key}.jpg", dst)
        n += 1
    if cfg.get("seasons"):
        for name, p in cfg["seasons"]["map"].items():
            for f in (cdir / "season" / name).rglob("*.png") if ("snowline_m" in p or "band_m" in p) else []:
                dst = out / f.relative_to(cdir)
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dst)
                n += 1
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file()) / 1e6
    print(f"[page] {out / 'index.html'} + {n} data files, {size:.1f} MB total"
          + (f" ({skipped} cached tiles outside the config boxes were left out)" if skipped else ""))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "angels_landing")
