#!/usr/bin/env python3
"""Build, verify and integrate ONE 3D trail walk, the same way every time.

  python3 pipeline/walks/build_walk.py <trail_id> --hike-id <hike-id>      # build a new walk (shows the plan, asks first)
  python3 pipeline/walks/build_walk.py <trail_id> --hike-id <id> --plan    # only show what would happen
  python3 pipeline/walks/build_walk.py --verify <walk_id>                  # re-run the checks on a finished walk (no network)
  python3 pipeline/walks/build_walk.py --verify-all                        # every walk in walks/manifest.json (CI runs this)

Phases (docs/WALKS.md explains each step and how to cross-check the result by hand):
  A Prepare    A1 preflight  A2 config check
  B Build      B1 OSM route  B2 tiles  B3 route  B4 photos  B5 season overlays  B6 page          (the trail kit, pipeline/trail_kit)
  C Verify     C1 structure  C2 credits + seasons  C3 route vs the hike's NPS numbers  C4 size budget  C5 season photos
  D Integrate  D1 copy into walks/  D2 manifest  D3 hike-page profile  D4 fake data  D5 app tests
  E Report     E1 walks/<walk>/BUILD_REPORT.md with a checklist to cross-check by hand

Standard library only for everything except phase B (the kit needs pipeline/trail_kit/requirements.txt).
"""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KIT = ROOT / "pipeline" / "trail_kit"
WALKS = ROOT / "walks"
MANIFEST = WALKS / "manifest.json"
DATA = ROOT / "app" / "public" / "data"
SEASONS = ("spring", "summer", "autumn", "winter")

PLAN = [
    # id, title, what happens, what is checked, needs network
    ("A1", "Preflight", "Reads the kit config, the hike in app data and the manifest. Refuses to touch a finished walk unless --force. Tests that the 4 data hosts answer.",
     "config exists; hike id exists; kit Python packages import; hosts reachable (otherwise use the kit's browser fallback)", True),
    ("A2", "Config check", "Runs the kit's check_config.py: start/end inside every box, boxes nest, tile counts, stops can show every season. Downloads nothing.",
     "no problems reported", False),
    ("B1", "OSM trail line", "Kit s1_fetch_osm: downloads the trail ways from OpenStreetMap (Overpass) into the cache.", "file written", True),
    ("B2", "Elevation and imagery tiles", "Kit s2_fetch_tiles: AWS Terrarium DEM and USGS imagery tiles for the three nested boxes. NEVER re-run on a finished walk.", "tiles present", True),
    ("B3", "Route", "Kit s3_build_route: shortest path start to end, elevation every 10 m.", "route and profile written", False),
    ("B4", "Photos", "Kit s4_fetch_photos: Wikimedia Commons photos per stop and season; refuses licences other than Public domain, CC0, CC BY, CC BY-SA.", "licences allowed; credits stored", True),
    ("B5", "Season overlays", "Kit s6_season_tiles: snow and vegetation overlay tiles for each season.", "overlay tiles written", False),
    ("B6", "Walk page", "Kit s5_build_page: writes output/<trail>/index.html and copies the files the page needs.", "index.html written", False),
    ("C1", "Structure", "Every file the page names exists (photos, clouds); tile folders are not empty; the route profile parses.", "no missing files", False),
    ("C2", "Credits, seasons and navigation", "The page credits USGS, Terrain Tiles, OpenStreetMap and Wikimedia Commons, reads ?season= and optional ?back=/?times=, and has a keyboard-visible return link.", "all strings, query handlers and controls present", False),
    ("C3", "Route vs the hike", "Compares the walk's own route with the hike in app data: start near the trailhead, end near the end point, length vs the NPS length, highest point vs the NPS elevation.", "within tolerance (strict when data is real, loose while data is fake)", False),
    ("C4", "Size budget", "Total size must be within the manifest budget (30 MB after lossless optimization) for new walks; the 3 original walks are exempt; no single file over 5 MB. Pages publishes at most 1 GB for the whole site.", "size within budget", False),
    ("C5", "Season photos", "Counts real photos per season; seasons without one borrow another season (the page says so). Reported, never hidden.", "counts reported", False),
    ("D1", "Copy into walks/", "Copies output/<trail>/ to walks/<walk>/ (without screenshots).", "files copied", False),
    ("D1b", "Optimize (lossless)", "Runs optimize_walk.py on the copy: elevation tiles to lossless WebP (pixel-exact, verified per file), season overlays to lossless WebP, one shared copy of the cloud images in walks/_shared/. Never lowers quality; never prunes tiles.",
     "every converted tile checked against the original; page references re-checked", False),
    ("D2", "Manifest", "Adds the walk to walks/manifest.json. The app's `featured` and `walk_path` are derived from this file.", "manifest valid", False),
    ("D3", "Hike-page profile", "Writes walks/<walk>/profile.json from the walk's own route, in the app's profile shape, so the hike page and the walk agree.", "profile valid", False),
    ("D4", "App data", "While data is fake: regenerates app/public/data with scripts/make_fake_data.py. When data is real: tells you to run the pipeline build.", "data regenerated", False),
    ("D5", "App tests", "Runs `npm run validate:data` and the app tests (they check the manifest, every walk and the hike links).", "all pass", False),
    ("E1", "Report", "Writes walks/<walk>/BUILD_REPORT.md: what ran, the numbers, and a checklist to cross-check by hand.", "report written", False),
]


# ----------------------------------------------------------------------------- results
@dataclass
class Result:
    step: str
    status: str  # PASS WARN FAIL SKIP
    detail: str = ""


@dataclass
class Run:
    walk_id: str
    hike_id: str
    results: list[Result] = field(default_factory=list)
    numbers: dict = field(default_factory=dict)

    def add(self, step: str, status: str, detail: str = "") -> Result:
        r = Result(step, status, detail)
        self.results.append(r)
        mark = {"PASS": "[ ok ]", "WARN": "[warn]", "FAIL": "[FAIL]", "SKIP": "[skip]"}[status]
        title = next((p[1] for p in PLAN if p[0] == step), step)
        print(f"{mark} {step} {title}" + (f": {detail}" if detail else ""), flush=True)
        return r

    @property
    def failed(self) -> bool:
        return any(r.status == "FAIL" for r in self.results)


# ----------------------------------------------------------------------------- pure helpers (unit-tested)
def haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def parse_profile(html: str) -> list[list[float]]:
    """The walk page embeds its route as `const PROFILE = [[lon, lat, dist_m, elev_m], ...];`."""
    m = re.search(r"const PROFILE\s*=\s*", html)
    if not m:
        raise ValueError("no `const PROFILE =` in the page")
    pts, _ = json.JSONDecoder().raw_decode(html[m.end():])
    if len(pts) < 10 or any(len(p) != 4 for p in pts):
        raise ValueError("PROFILE is not a list of [lon, lat, dist_m, elev_m]")
    return pts


def route_summary(profile: list[list[float]]) -> dict:
    elev = [p[3] for p in profile]
    gain = sum(max(0.0, b - a) for a, b in zip(elev, elev[1:]))
    return {"length_m": profile[-1][2], "start": (profile[0][1], profile[0][0]), "end": (profile[-1][1], profile[-1][0]),
            "min_elev_m": min(elev), "max_elev_m": max(elev), "gain_m": gain, "points": len(profile)}


def referenced_files(html: str) -> list[str]:
    # clouds may live in walks/_shared/clouds/ (optimize_walk.py shares the identical cloud images across walks)
    files = set(re.findall(r"(?:\.\./_shared/)?(?:photos|clouds)/[A-Za-z0-9_.\-]+\.(?:jpg|jpeg|png|webp)", html))
    # the page preloads clouds with  'clouds/' + name + '.webp'  (dynamic): the three standard names must exist where the page points
    dyn = re.search(r"'((?:\.\./_shared/)?clouds/)'\s*\+", html)
    if dyn:
        files |= {f"{dyn.group(1)}{n}.webp" for n in ("cumulus", "mass", "wisps")}
    return sorted(files)


REQUIRED_CREDITS = {
    "USGS imagery": ("USGS",),
    "terrain tiles": ("Terrain Tiles", "Mapzen"),
    "OpenStreetMap": ("OpenStreetMap",),
    "Wikimedia Commons": ("Commons",),
    "illustrative season note": ("illustrative",),
}


def missing_credits(html: str) -> list[str]:
    return [name for name, needles in REQUIRED_CREDITS.items() if not any(n in html for n in needles)]


def missing_seasons(html: str) -> list[str]:
    miss = [s for s in ("Spring", "Summer", "Autumn", "Winter") if s not in html]
    if "URLSearchParams" not in html or "season" not in html:
        miss.append("?season= query parameter")
    return miss


def missing_walk_navigation(html: str) -> list[str]:
    required = {
        "back link": 'id="backToHike"',
        "return animation": 'id="backTransition"',
        "time marker layer": 'id="timeMarkers"',
        "back query handling": "get('back')",
        "times query handling": "get('times')",
    }
    return [name for name, needle in required.items() if needle not in html]


def dir_stats(d: Path) -> dict:
    files = [p for p in d.rglob("*") if p.is_file()]
    sizes = [p.stat().st_size for p in files]
    return {"files": len(files), "bytes": sum(sizes), "largest": max(sizes) if sizes else 0,
            "largest_file": str(max(files, key=lambda p: p.stat().st_size).relative_to(d)) if files else ""}


def season_photo_counts(walk_dir: Path) -> dict:
    ph = walk_dir / "photos"
    names = [p.stem for p in ph.glob("*.jpg")] if ph.exists() else []
    out = {s: sum(1 for n in names if n.endswith("_" + s)) for s in SEASONS}
    out["base"] = sum(1 for n in names if not any(n.endswith("_" + s) for s in SEASONS))
    return out


def compare_with_hike(summary: dict, hike: dict, fake: bool) -> list[tuple[str, str, str]]:
    """Returns [(check, status, detail)]. Tolerances are loose while the data is fake (approximate coordinates)."""
    tol_m = 3000 if fake else 300
    out = []
    d0 = haversine_m(*summary["start"], hike["trailhead"]["lat"], hike["trailhead"]["lon"])
    out.append(("start near trailhead", "PASS" if d0 <= tol_m else "WARN" if fake else "FAIL", f"{d0:.0f} m from '{hike['trailhead']['name']}' (limit {tol_m} m)"))
    if hike["route_type"] == "out-and-back" or hike["route_type"] == "point-to-point":
        d1 = haversine_m(*summary["end"], hike["end"]["lat"], hike["end"]["lon"])
        out.append(("end near end point", "PASS" if d1 <= tol_m else "WARN" if fake else "FAIL", f"{d1:.0f} m from '{hike['end']['name']}' (limit {tol_m} m)"))
    nps_one_way = hike["length_mi"] * 1609.344 / (2 if hike["route_type"] == "out-and-back" else 1)
    ratio = summary["length_m"] / nps_one_way
    out.append(("length vs NPS", "PASS" if 0.6 <= ratio <= 1.15 else "WARN", f"route {summary['length_m']/1000:.2f} km vs NPS {nps_one_way/1000:.2f} km one way (ratio {ratio:.2f}; OSM shortens switchbacks, 0.6 to 1.15 is normal)"))
    top_ft = summary["max_elev_m"] / 0.3048
    diff = abs(top_ft - hike["max_elev_ft"]) / hike["max_elev_ft"]
    out.append(("highest point vs NPS", "PASS" if diff <= 0.10 else "WARN", f"route {top_ft:,.0f} ft vs NPS {hike['max_elev_ft']:,} ft ({diff*100:.0f}% apart)"))
    return out


def profile_json(walk_id: str, cfg: dict, summary: dict, profile: list[list[float]], hike: dict) -> dict:
    total = int(round(summary["length_m"]))
    nps = int(round(hike["length_mi"] * 1609.344 / (2 if hike["route_type"] == "out-and-back" else 1)))
    cps = [{"id": "c0", "name": cfg["start"]["name"], "dist_m": 0, "photo": None}]
    interior = []
    for s in cfg["stops"]:
        d = int(round(s["at"] * total / 10) * 10)
        if d < 100 or total - d < 100:  # a stop right at the start or end would duplicate c0 / the last checkpoint
            continue
        interior.append({"name": s["title"], "dist_m": d, "photo": f"walks/{walk_id}/photos/{s['photo']}.jpg"})
    for s in cfg.get("profile_checkpoints", []):
        d = int(round(s["at"] * total / 10) * 10)
        if d < 100 or total - d < 100:
            continue
        interior.append({"name": s["name"], "dist_m": d, "photo": None})
    for cp in sorted(interior, key=lambda x: x["dist_m"]):
        if cps[-1]["dist_m"] == cp["dist_m"]:
            continue
        cps.append({"id": f"c{len(cps)}", **cp})
    cps.append({"id": f"c{len(cps)}", "name": cfg["end"]["name"], "dist_m": total, "photo": None})
    return {"hike_id": hike["id"], "step_m": 10, "points": [[round(p[2]), round(p[3], 1)] for p in profile],
            "osm_length_m": total, "nps_length_m": nps, "scale": round(nps / total, 3), "checkpoints": cps}


# ----------------------------------------------------------------------------- IO helpers
def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def load_manifest() -> dict:
    return load_json(MANIFEST)


def save_manifest(m: dict) -> None:
    MANIFEST.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_hike(hike_id: str) -> dict | None:
    return next((h for h in load_json(DATA / "hikes.json") if h["id"] == hike_id), None)


def data_is_fake() -> bool:
    try:
        return bool(load_json(DATA / "meta.json").get("fake"))
    except FileNotFoundError:
        return True


def mb(n: int) -> str:
    return f"{n / 1024 / 1024:.1f} MB"


def run_cmd(cmd: list[str], cwd: Path, env_extra: dict | None = None) -> int:
    import os
    env = {**os.environ, **(env_extra or {})}
    print("      $ " + " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=str(cwd), env=env)


# ----------------------------------------------------------------------------- plan
def print_plan(trail_id: str, walk_id: str, hike_id: str, verify_only: bool) -> None:
    print(f"\nWalk build plan: kit trail '{trail_id}' -> walks/{walk_id}/ for hike '{hike_id}'")
    print("Nothing below runs until you confirm. Each step prints [ ok ] / [warn] / [FAIL]; any FAIL stops the run.\n")
    phase = ""
    names = {"A": "A. Prepare", "B": "B. Build (trail kit)", "C": "C. Verify", "D": "D. Integrate", "E": "E. Report"}
    for sid, title, what, checks, net in PLAN:
        if sid[0] != phase:
            phase = sid[0]
            print(names[phase])
        skip = verify_only and sid[0] in "ABD" or (verify_only and sid in ("E1",) and False)
        flag = " (needs internet)" if net else ""
        print(f"  {sid}  {title}{flag}{'  [skipped in verify mode]' if skip else ''}")
        print(f"        does:    {what}")
        print(f"        checks:  {checks}")
    print("\nFiles this will create or change:")
    for line in (f"pipeline/trail_kit/cache/{trail_id}/   (download cache, git-ignored)", f"pipeline/trail_kit/output/{trail_id}/  (kit output, git-ignored)",
                 f"walks/{walk_id}/   (the finished walk, committed)", f"walks/{walk_id}/profile.json and BUILD_REPORT.md", "walks/manifest.json",
                 "app/public/data/*  (only regenerated while the data is fake)"):
        print("  - " + line)
    print("\nAfter the run, open walks/%s/BUILD_REPORT.md and tick the checklist at the bottom.\n" % walk_id)


# ----------------------------------------------------------------------------- phases
def phase_verify(run: Run, walk_dir: Path, hike: dict | None, legacy: bool, budget_mb: float) -> None:
    html_path = walk_dir / "index.html"
    if not html_path.exists():
        run.add("C1", "FAIL", f"{html_path} is missing")
        return
    html = html_path.read_text(encoding="utf-8")
    # C1 structure
    problems = []
    for f in referenced_files(html):
        if not (walk_dir / f).exists():
            problems.append(f)
    for d in ("dem", "img"):
        if not any((walk_dir / d).rglob("*")) if (walk_dir / d).exists() else True:
            problems.append(f"{d}/ (empty or missing)")
    try:
        profile = parse_profile(html)
        summary = route_summary(profile)
    except ValueError as e:
        problems.append(str(e))
        profile, summary = [], {}
    run.add("C1", "FAIL" if problems else "PASS", ", ".join(problems[:6]) if problems else f"{len(referenced_files(html))} referenced files exist, route has {summary['points']} points")
    # C2 credits and seasons
    miss = missing_credits(html) + missing_seasons(html) + missing_walk_navigation(html)
    run.add("C2", "FAIL" if miss else "PASS", "missing: " + ", ".join(miss) if miss else "credits, four seasons, back link and optional back/times parameters present")
    # C3 route vs hike
    if summary and hike:
        fake = data_is_fake()
        for name, status, detail in compare_with_hike(summary, hike, fake):
            run.add("C3", status, f"{name}: {detail}")
        run.numbers.update(route_km=round(summary["length_m"] / 1000, 2), gain_m=round(summary["gain_m"]), max_elev_m=round(summary["max_elev_m"]))
    elif not hike:
        run.add("C3", "FAIL", f"hike '{run.hike_id}' is not in app/public/data/hikes.json")
    # C4 size
    st = dir_stats(walk_dir)
    run.numbers.update(files=st["files"], size_mb=round(st["bytes"] / 1024 / 1024, 1))
    over = st["bytes"] > budget_mb * 1024 * 1024
    big = st["largest"] > 5 * 1024 * 1024
    if legacy:
        run.add("C4", "WARN" if over else "PASS", f"{mb(st['bytes'])} in {st['files']} files (legacy walk, exempt from the {budget_mb:g} MB budget)")
    else:
        run.add("C4", "FAIL" if over or big else "PASS", f"{mb(st['bytes'])} in {st['files']} files (budget {budget_mb:g} MB); largest {st['largest_file']} {mb(st['largest'])}")
    # C5 season photos
    counts = season_photo_counts(walk_dir)
    run.numbers["photos"] = counts
    thin = [s for s in SEASONS if counts[s] == 0]
    run.add("C5", "WARN" if thin else "PASS", f"base photos {counts['base']}; per season " + ", ".join(f"{s} {counts[s]}" for s in SEASONS) + (f"; no own photo in: {', '.join(thin)}" if thin else ""))
    run._summary = summary  # type: ignore[attr-defined]
    run._profile = profile  # type: ignore[attr-defined]


def phase_integrate(run: Run, trail_id: str, walk_id: str, hike: dict, cfg: dict, force: bool, copy: bool) -> None:
    walk_dir = WALKS / walk_id
    if copy:
        src = KIT / "output" / trail_id
        if walk_dir.exists() and not force:
            run.add("D1", "FAIL", f"{walk_dir} exists; pass --force to replace it (never re-run tile steps on a finished walk)")
            return
        if walk_dir.exists():
            shutil.rmtree(walk_dir)
        shutil.copytree(src, walk_dir, ignore=shutil.ignore_patterns("_shots"))
        run.add("D1", "PASS", f"copied {src.relative_to(ROOT)} -> walks/{walk_id}/")
        try:
            import optimize_walk  # Pillow and numpy come with the kit's requirements
            rep = optimize_walk.optimize(walk_dir, None, False)
            run.add("D1b", "PASS", f"{rep['before_bytes'] / 1048576:.1f} MB -> {rep['after_bytes'] / 1048576:.1f} MB, worst quality score " + ", ".join(f"{k} {t['worst']:.4f}" for k, t in rep["types"].items()))
        except ImportError:
            run.add("D1b", "WARN", "Pillow/numpy missing: not optimized (pip install -r pipeline/walks/requirements.txt); the size check below may fail")
        except SystemExit as e:
            run.add("D1b", "FAIL", str(e))
    else:
        run.add("D1", "SKIP", "verify mode: nothing to copy")


def write_manifest_entry(run: Run, trail_id: str, walk_id: str, hike_id: str) -> None:
    m = load_manifest()
    existing = m["walks"].get(walk_id, {})
    m["walks"][walk_id] = {**existing, "hike_id": hike_id, "kit_trail": trail_id, "built": existing.get("built", date.today().isoformat())}
    save_manifest(m)
    run.add("D2", "PASS", f"walks/manifest.json lists {len(m['walks'])} walks")


def write_profile(run: Run, walk_id: str, cfg: dict, hike: dict) -> None:
    summary, profile = run._summary, run._profile  # type: ignore[attr-defined]
    out = profile_json(walk_id, cfg, summary, profile, hike)
    (WALKS / walk_id / "profile.json").write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")
    run.add("D3", "PASS", f"profile.json: {len(out['points'])} points, {len(out['checkpoints'])} checkpoints, scale {out['scale']}")


def regenerate_data(run: Run) -> None:
    if data_is_fake():
        code = run_cmd([sys.executable, "scripts/make_fake_data.py"], ROOT)
        run.add("D4", "PASS" if code == 0 else "FAIL", "regenerated app/public/data (featured and walk_path come from walks/manifest.json)")
    else:
        run.add("D4", "WARN", "data is real: re-run the pipeline build (lane 1/2) so hikes.json picks up walk_path from walks/manifest.json")


def app_tests(run: Run) -> None:
    app = ROOT / "app"
    if not (app / "node_modules").exists():
        run.add("D5", "WARN", "app dependencies not installed (npm run setup): app tests not run")
        return
    code = run_cmd(["npm", "test", "--silent"], app)
    run.add("D5", "PASS" if code == 0 else "FAIL", "validate:data and app tests (incl. walks manifest checks)" if code == 0 else "app tests failed: read the output above")


def write_report(run: Run, trail_id: str, walk_id: str, hike: dict | None, mode: str) -> Path:
    n = run.numbers
    rows = "\n".join(f"| {r.step} | {next((p[1] for p in PLAN if p[0] == r.step), '')} | {r.status} | {r.detail.replace('|', '/')} |" for r in run.results)
    photos = n.get("photos", {})
    hike_line = f"{hike['name']} ({hike['park_name']})" if hike else run.hike_id
    nps = f"{hike['length_mi']} mi {hike['length_type']}, {hike['max_elev_ft']:,} ft high" if hike else "n/a"
    report = f"""# Walk build report: {walk_id}

- Hike: **{hike_line}** (`{run.hike_id}`)  ·  kit trail: `{trail_id}`  ·  mode: {mode}
- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}  ·  Python {sys.version.split()[0]}  ·  data fake: {data_is_fake()}
- Reproduce: `python3 pipeline/walks/build_walk.py {trail_id} --hike-id {run.hike_id}`  ·  re-check only: `python3 pipeline/walks/build_walk.py --verify {walk_id}`

## What ran
| Step | Name | Result | Detail |
|---|---|---|---|
{rows}

## Numbers
| | |
|---|---|
| Route length (walk) | {n.get('route_km', '?')} km |
| NPS length / highest point | {nps} |
| Climb along the route | {n.get('gain_m', '?')} m |
| Highest point on the route | {n.get('max_elev_m', '?')} m |
| Files / size | {n.get('files', '?')} files, {n.get('size_mb', '?')} MB |
| Real photos | base {photos.get('base', '?')}; spring {photos.get('spring', '?')}, summer {photos.get('summer', '?')}, autumn {photos.get('autumn', '?')}, winter {photos.get('winter', '?')} |

## Cross-check by hand (tick each box, then commit this file)
Open the walk locally: `npm run dev` then http://localhost:5173/walks/{walk_id}/index.html?season=summer (also winter, spring, autumn).

- [ ] **Start**: the first stop is the NPS trailhead (name and photo agree).
- [ ] **End**: the last stop is the end point the NPS page describes for this hike.
- [ ] **Length**: the walk says {n.get('route_km', '?')} km; the NPS says {nps}. Same endpoints? Any gap explained (OSM shortens switchbacks)?
- [ ] **Stops**: every stop photo shows what its title says; every credit is visible and not covered by the profile strip.
- [ ] **Seasons**: all four buttons work; `?season=` opens the right one; seasons with no own photo say they borrow another (counts above).
- [ ] **Camera**: scroll start to end once. The dot follows the trail, the camera is never inside rock, nothing spins on switchbacks.
      Screenshots: `cd pipeline/trail_kit && SEASON=winter SHOTS=0,0.5,1 node tools/screenshot_test.js {trail_id}`.
- [ ] **Illustrative**: the page says the season map is illustrative (snow lines are assumptions); you agree the snow line looks plausible.
- [ ] **Hike page**: open `#/hike/{run.hike_id}`; "Walk it in 3D" opens this walk on the season of the chosen quarter.
- [ ] **Size**: within the manifest budget (or an exemption is noted in walks/manifest.json).
- [ ] **Credits**: USGS, Terrain Tiles (Mapzen / AWS), OpenStreetMap and each photo's Commons credit appear on the page.
"""
    p = WALKS / walk_id / "BUILD_REPORT.md"
    p.write_text(report, encoding="utf-8")
    return p


# ----------------------------------------------------------------------------- main flows
def preflight(run: Run, trail_id: str, walk_id: str, hike_id: str, force: bool, network: bool) -> dict | None:
    cfg_path = KIT / "trails" / f"{trail_id}.json"
    problems = []
    if not cfg_path.exists():
        problems.append(f"no kit config at {cfg_path.relative_to(ROOT)} (copy a config and edit it: docs/WALKS.md)")
    if not load_hike(hike_id):
        problems.append(f"hike '{hike_id}' is not in app/public/data/hikes.json")
    if (WALKS / walk_id).exists() and not force:
        problems.append(f"walks/{walk_id}/ already exists (use --verify, or --force to rebuild; never re-run tile steps on a finished walk)")
    try:
        import numpy, PIL  # noqa: F401
    except ImportError:
        problems.append("kit packages missing: pip install -r pipeline/trail_kit/requirements.txt")
    if problems:
        run.add("A1", "FAIL", "; ".join(problems))
        return None
    note = ""
    if network:
        hosts = {"Overpass": "https://overpass-api.de/api/status", "AWS terrain": "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/0/0/0.png",
                 "USGS imagery": "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer?f=json", "Commons": "https://commons.wikimedia.org/w/api.php?action=query&format=json"}
        down = []
        for name, url in hosts.items():
            try:
                urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "PeakFinder-walk-build/1.0"}), timeout=10).close()
            except Exception:
                down.append(name)
        note = ("unreachable: " + ", ".join(down) + " (use the kit's browser fallback, README section 6)") if down else "all 4 data hosts reachable"
    run.add("A1", "WARN" if note.startswith("unreachable") else "PASS", note or "config, hike and packages ok")
    return load_json(cfg_path)


def cmd_build(a) -> int:
    trail, hike_id = a.trail_id, a.hike_id
    walk_id = a.walk_id or trail
    print_plan(trail, walk_id, hike_id, verify_only=False)
    if a.plan:
        return 0
    if not a.yes and not a.dry_run:
        if not sys.stdin.isatty() or input("Run these steps now? [y/N] ").strip().lower() != "y":
            print("Not run. Use --yes to skip this question.")
            return 0
    run = Run(walk_id, hike_id)
    cfg = preflight(run, trail, walk_id, hike_id, a.force, network=not (a.dry_run or a.skip_network_check))
    if cfg is None:
        return 1
    if a.dry_run:
        print("\nDry run: preflight passed, nothing was built.")
        return 0
    py = sys.executable
    steps = [("A2", "check_config.py"), ("B1", "s1_fetch_osm.py"), ("B2", "s2_fetch_tiles.py"), ("B3", "s3_build_route.py"),
             ("B4", "s4_fetch_photos.py"), ("B5", "s6_season_tiles.py"), ("B6", "s5_build_page.py")]
    for sid, script in steps:
        t = time.time()
        code = run_cmd([py, script, trail], KIT / "pipeline")
        run.add(sid, "PASS" if code == 0 else "FAIL", f"{time.time() - t:.0f}s" if code == 0 else f"{script} exited {code}: fix the problem above, then re-run (steps are cached)")
        if code != 0:
            write_failure_note(run, trail, walk_id)
            return 1
    hike = load_hike(hike_id)
    phase_integrate(run, trail, walk_id, hike, cfg, a.force, copy=True)
    if run.failed:
        return 1
    phase_verify(run, WALKS / walk_id, hike, legacy=False, budget_mb=load_manifest().get("size_budget_mb", 30))
    if run.failed:
        print("\nVerification failed: the walk was copied to walks/%s/ but is NOT added to the manifest. Fix it and re-run with --force." % walk_id)
        write_report(run, trail, walk_id, hike, "build (failed verification)")
        return 1
    write_manifest_entry(run, trail, walk_id, hike_id)
    write_profile(run, walk_id, cfg, hike)
    regenerate_data(run)
    app_tests(run)
    rp = write_report(run, trail, walk_id, hike, "build")
    run.add("E1", "PASS", str(rp.relative_to(ROOT)))
    return finish(run, rp)


def write_failure_note(run: Run, trail: str, walk_id: str) -> None:
    print(f"\nStopped. Everything the kit downloaded is cached in pipeline/trail_kit/cache/{trail}/; re-running continues where it stopped.")


def cmd_verify(walk_id: str, write_files: bool, run_tests: bool) -> Run | None:
    m = load_manifest()
    entry = m["walks"].get(walk_id)
    if not entry:
        print(f"'{walk_id}' is not in walks/manifest.json")
        return None
    run = Run(walk_id, entry["hike_id"])
    print(f"\nVerifying walk '{walk_id}' (hike '{entry['hike_id']}')")
    hike = load_hike(entry["hike_id"])
    phase_verify(run, WALKS / walk_id, hike, bool(entry.get("legacy")), m.get("size_budget_mb", 30))
    if write_files and hike and not run.failed:
        cfg = load_json(KIT / "trails" / f"{entry['kit_trail']}.json")
        write_profile(run, walk_id, cfg, hike)
        rp = write_report(run, entry["kit_trail"], walk_id, hike, "verify")
        run.add("E1", "PASS", str(rp.relative_to(ROOT)))
    if run_tests:
        app_tests(run)
    return run


def finish(run: Run, report: Path | None) -> int:
    fails = [r for r in run.results if r.status == "FAIL"]
    warns = [r for r in run.results if r.status == "WARN"]
    print("\n" + "=" * 60)
    print(f"{run.walk_id}: {len(run.results)} steps, {len(fails)} failed, {len(warns)} warnings")
    if report:
        print(f"Next: open {report.relative_to(ROOT)} and tick the cross-check list.")
    return 1 if fails else 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("trail_id", nargs="?", help="kit trail id (pipeline/trail_kit/trails/<id>.json)")
    ap.add_argument("--hike-id", help="the app hike this walk belongs to, e.g. angels-landing")
    ap.add_argument("--walk-id", help="folder name under walks/ (default: the trail id)")
    ap.add_argument("--plan", action="store_true", help="print the plan and stop")
    ap.add_argument("--yes", action="store_true", help="do not ask for confirmation")
    ap.add_argument("--dry-run", action="store_true", help="run only the offline preflight")
    ap.add_argument("--skip-network-check", action="store_true")
    ap.add_argument("--force", action="store_true", help="replace an existing walks/<walk>/")
    ap.add_argument("--verify", metavar="WALK_ID", help="re-run verification on a finished walk")
    ap.add_argument("--verify-all", action="store_true", help="verify every walk in the manifest (no network, no writes)")
    ap.add_argument("--no-write", action="store_true", help="with --verify: do not rewrite profile.json and BUILD_REPORT.md")
    ap.add_argument("--no-tests", action="store_true", help="with --verify: skip the app tests")
    a = ap.parse_args(argv)

    if a.verify_all:
        bad = 0
        for wid in load_manifest()["walks"]:
            r = cmd_verify(wid, write_files=False, run_tests=False)
            bad += 1 if (r is None or r.failed) else 0
        print("\nAll walks verified." if not bad else f"\n{bad} walk(s) failed verification.")
        return 1 if bad else 0
    if a.verify:
        print_plan(load_manifest()["walks"].get(a.verify, {}).get("kit_trail", a.verify), a.verify, load_manifest()["walks"].get(a.verify, {}).get("hike_id", "?"), verify_only=True)
        if a.plan:
            return 0
        r = cmd_verify(a.verify, write_files=not a.no_write, run_tests=not a.no_tests)
        return 1 if r is None else finish(r, WALKS / a.verify / "BUILD_REPORT.md" if not a.no_write else None)
    if not a.trail_id or not a.hike_id:
        ap.error("give a trail id and --hike-id, or use --verify / --verify-all")
    return cmd_build(a)


if __name__ == "__main__":
    sys.exit(main())
