#!/usr/bin/env python3
"""Build all hike-page profiles using the trail kit's OSM graph and Terrarium elevation data.

Usage: python3 pipeline/profiles.py [--no-download]
All downloads are cached by the trail kit under pipeline/trail_kit/cache/ (git-ignored).
"""
from __future__ import annotations

import argparse
import csv
import json
import bisect
import math
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from lane2_common import DATA, ROOT, hikes, read_json, write_json

KIT = ROOT / "pipeline" / "trail_kit"
KIT_PIPE = KIT / "pipeline"
WALKS = ROOT / "walks"
CONFIGS = ROOT / "data" / "raw" / "lane2" / "profile-configs"
LOOP_WAYPOINTS = ROOT / "pipeline" / "catalogue" / "loop_waypoints.csv"


def profile_config(hike: dict[str, Any], trail_id: str) -> dict[str, Any]:
    start, end = hike["trailhead"], hike["end"]
    length_m = float(hike["length_mi"]) * 1609.344
    # A generous length-based margin contains loops and winding paths even when start=end.
    lat_margin = max(0.025, min(0.35, length_m / 111_000 * 1.25))
    mid_lat = (float(start["lat"]) + float(end["lat"])) / 2
    lon_margin = lat_margin / max(0.35, math.cos(math.radians(mid_lat)))
    west = min(float(start["lon"]), float(end["lon"])) - lon_margin
    east = max(float(start["lon"]), float(end["lon"])) + lon_margin
    south = min(float(start["lat"]), float(end["lat"])) - lat_margin
    north = max(float(start["lat"]), float(end["lat"])) + lat_margin
    core = [west, south, east, north]
    # The profile-only tile step reads only z14 DEM across core; the wider boxes are required by kit config shape.
    return {"id": trail_id, "title": hike["name"], "start": start, "end": end,
            "gap_bridge_m": 80, "osm_bbox": core,
            "bounds": {"wide": [west - lon_margin, south - lat_margin, east + lon_margin, north + lat_margin],
                       "mid": core, "core": core}}


def profile_from_walk(hike: dict[str, Any]) -> dict[str, Any] | None:
    walk_path = hike.get("walk_path")
    if not walk_path:
        return None
    p = ROOT / walk_path / "profile.json"  # walk_path already starts with "walks/"
    if not p.is_file():
        return None
    profile = read_json(p)
    if profile.get("hike_id") != hike["id"]:
        raise ValueError(f"{p} has hike_id {profile.get('hike_id')!r}; expected {hike['id']!r}")
    return profile


def route_type_one_way(hike: dict[str, Any]) -> bool:
    return hike.get("route_type") != "out-and-back"


def make_checkpoints(hike: dict[str, Any], osm_length: float, named: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    if named:
        return named
    end_name = str(hike.get("end", {}).get("name") or "Summit or turnaround")
    labels = [(0, str(hike.get("trailhead", {}).get("name") or "Trailhead")),
              (0.25, "Quarter point"), (0.5, "Halfway point"), (0.75, "Three-quarter point"), (1, end_name)]
    out = []
    for i, (fraction, name) in enumerate(labels):
        out.append({"id": f"c{i}", "name": name, "dist_m": round(osm_length * fraction), "photo": None})
    return out


def convert_route(hike: dict[str, Any], raw: list[list[float]]) -> dict[str, Any]:
    if len(raw) < 3:
        raise ValueError(f"{hike['id']}: OSM route has fewer than three samples")
    if any(len(p) < 4 or p[2] is None or p[3] is None for p in raw):
        raise ValueError(f"{hike['id']}: route contains missing distance/elevation samples")
    points = [[round(float(p[2])), round(float(p[3]), 1)] for p in raw]
    points[0][0] = 0
    length = float(points[-1][0])
    nps = float(hike["length_mi"]) * 1609.344
    if hike.get("length_type") == "round-trip" and hike.get("route_type") == "out-and-back":
        nps /= 2
    checkpoints = make_checkpoints(hike, length)
    scale = nps / length
    return {"hike_id": hike["id"], "step_m": 10, "points": points, "osm_length_m": round(length),
            "nps_length_m": round(nps), "scale": round(scale, 3), "checkpoints": checkpoints}


def loop_waypoints(hike_id: str) -> list[tuple[float, float]]:
    """Via points (order given) a loop must pass through; OSM routing start to end cannot find a loop by itself."""
    if not LOOP_WAYPOINTS.is_file():
        return []
    with LOOP_WAYPOINTS.open(encoding="utf-8", newline="") as handle:
        rows = [r for r in csv.DictReader(handle) if r["id"] == hike_id]
    return [(float(r["lat"]), float(r["lon"])) for r in sorted(rows, key=lambda r: int(r["order"]))]


def route_loop(trail_id: str, hike: dict[str, Any], via: list[tuple[float, float]]) -> list[list[float]]:
    """Trailhead -> each via point -> trailhead over the cached OSM graph, sampled every 10 m like kit step 3."""
    sys.path.insert(0, str(KIT_PIPE))
    import s3_build_route as s3  # noqa: PLC0415 (kit module, only importable once KIT_PIPE is on the path)
    from common import ElevationSampler, cache_dir, haversine, load_config  # noqa: PLC0415
    import networkx as nx  # noqa: PLC0415

    cdir = cache_dir(trail_id)
    G, _ = s3.build_graph(read_json(cdir / "osm.json"), load_config(trail_id).get("gap_bridge_m", 50))
    th = (float(hike["trailhead"]["lat"]), float(hike["trailhead"]["lon"]))
    stops = [th, *via, th]
    nodes = [min(G.nodes, key=lambda k: haversine(k, pt)) for pt in stops]
    path = [nodes[0]]
    for a, b in zip(nodes, nodes[1:]):
        # shortcut: OSM leaves a few trail pieces unjoined (Skyline above Paradise); via points under 80 m apart join straight
        path += [b] if haversine(a, b) <= 80 else nx.shortest_path(G, a, b, weight="w")[1:]
    route = [th, *path]
    cum = [0.0]
    for a, b in zip(route, route[1:]):
        cum.append(cum[-1] + haversine(a, b))
    elev, out, d = ElevationSampler(cdir / "dem"), [], 0.0
    while d <= cum[-1]:
        i = min(max(0, bisect.bisect_right(cum, d) - 1), len(route) - 2)
        t = 0 if cum[i + 1] == cum[i] else (d - cum[i]) / (cum[i + 1] - cum[i])
        lat = route[i][0] + (route[i + 1][0] - route[i][0]) * t
        lon = route[i][1] + (route[i + 1][1] - route[i][1]) * t
        out.append([round(lon, 6), round(lat, 6), round(d), round(elev.at(lat, lon), 1)])
        d += s3.STEP_M
    out.append([round(route[-1][1], 6), round(route[-1][0], 6), round(cum[-1]), round(elev.at(*route[-1]), 1)])
    write_json(cdir / "profile.json", out)
    return out


def run_kit(hike: dict[str, Any], no_download: bool = False) -> dict[str, Any]:
    trail_id = f"profile-{hike['id']}"
    config_path = CONFIGS / f"{trail_id}.json"
    config = profile_config(hike, trail_id)
    cache = KIT / "cache" / trail_id
    if config_path.exists() and read_json(config_path) != config:
        # Coordinates changed: the route is stale; the OSM and DEM downloads stay if they still cover the new box.
        (cache / "profile.json").unlink(missing_ok=True)
        old_w, old_s, old_e, old_n = read_json(config_path)["osm_bbox"]
        w, s, e, n = config["osm_bbox"]
        if not (old_w <= w and old_s <= s and e <= old_e and n <= old_n):
            shutil.rmtree(cache, ignore_errors=True)
    write_json(config_path, config)
    cache_profile = cache / "profile.json"
    via = loop_waypoints(hike["id"]) if hike.get("route_type") == "loop" else []
    if not cache_profile.exists() or via:  # kit steps skip what is cached; a loop is cheap to re-route
        if no_download and not (cache / "osm.json").exists():
            raise FileNotFoundError(f"No cached profile for {hike['id']}; rerun without --no-download")
        steps = [([sys.executable, str(KIT_PIPE / "s1_fetch_osm.py"), trail_id], "OSM trail line"),
                 ([sys.executable, str(KIT_PIPE / "s2_fetch_tiles.py"), trail_id, "--profile-only"], "z14 DEM")]
        if not via:
            steps.append(([sys.executable, str(KIT_PIPE / "s3_build_route.py"), trail_id], "10 m profile"))
        for cmd, label in steps:
            print(f"[{hike['id']}] {label}", flush=True)
            subprocess.run(cmd, cwd=KIT_PIPE, check=True)
        if via:
            print(f"[{hike['id']}] loop through {len(via)} via points", flush=True)
            route_loop(trail_id, hike, via)
    return convert_route(hike, read_json(cache_profile))


def build_all(hike_rows: list[dict[str, Any]], no_download: bool = False) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    for hike in hike_rows:
        p = profile_from_walk(hike)
        if p is None:
            p = run_kit(hike, no_download)
        profiles.append(p)
    return profiles


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-download", action="store_true", help="only use verified walk profiles and cached kit routes")
    parser.add_argument("--only", type=Path, help="CSV with an id column: build and write only those hikes")
    args = parser.parse_args()
    hike_rows = hikes()
    if args.only:
        ids = {r["id"] for r in csv.DictReader(args.only.open())}
        hike_rows = [h for h in hike_rows if h["id"] in ids]
    rows = build_all(hike_rows, args.no_download)
    # Stage the complete set before publishing individual profile files.
    staging = ROOT / "data" / "processed" / "lane2" / "profiles"
    staging.mkdir(parents=True, exist_ok=True)
    for p in rows:
        write_json(staging / f"{p['hike_id']}.json", p)
    out = DATA / "profiles"
    out.mkdir(parents=True, exist_ok=True)
    for p in rows:
        write_json(out / f"{p['hike_id']}.json", p)
    print(f"Wrote {len(rows)} profiles ({sum(len(p['points']) for p in rows):,} total elevation samples)")


if __name__ == "__main__":
    main()
