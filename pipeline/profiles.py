#!/usr/bin/env python3
"""Build all hike-page profiles using the trail kit's OSM graph and Terrarium elevation data.

Usage: python3 pipeline/profiles.py [--no-download]
All downloads are cached by the trail kit under pipeline/trail_kit/cache/ (git-ignored).
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path
from typing import Any

from lane2_common import DATA, ROOT, hikes, read_json, write_json

KIT = ROOT / "pipeline" / "trail_kit"
KIT_PIPE = KIT / "pipeline"
WALKS = ROOT / "walks"
CONFIGS = ROOT / "data" / "raw" / "lane2" / "profile-configs"


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
    p = WALKS / walk_path / "profile.json"
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


def run_kit(hike: dict[str, Any], no_download: bool = False) -> dict[str, Any]:
    trail_id = f"profile-{hike['id']}"
    config_path = CONFIGS / f"{trail_id}.json"
    if not config_path.exists():
        write_json(config_path, profile_config(hike, trail_id))
    cache_profile = KIT / "cache" / trail_id / "profile.json"
    if not cache_profile.exists():
        if no_download:
            raise FileNotFoundError(f"No cached profile for {hike['id']}; rerun without --no-download")
        steps = [([sys.executable, str(KIT_PIPE / "s1_fetch_osm.py"), trail_id], "OSM trail line"),
                 ([sys.executable, str(KIT_PIPE / "s2_fetch_tiles.py"), trail_id, "--profile-only"], "z14 DEM"),
                 ([sys.executable, str(KIT_PIPE / "s3_build_route.py"), trail_id], "10 m profile")]
        for cmd, label in steps:
            print(f"[{hike['id']}] {label}", flush=True)
            subprocess.run(cmd, cwd=KIT_PIPE, check=True)
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
    args = parser.parse_args()
    rows = build_all(hikes(), args.no_download)
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
