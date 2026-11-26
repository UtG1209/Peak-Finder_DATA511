"""Write a trail-kit config (pipeline/trail_kit/trails/<id>.json) from a small spec file.

Usage: python3 pipeline/walks/make_config.py pipeline/walks/specs/<id>.json
The spec holds only what a person decides (start, end, extra points the route passes, stops with Commons files,
snow lines); boxes, camera length and the season block are derived here so every walk is configured the same way.
Start and end default to the hike's trailhead and end in app/public/data/hikes.json.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KIT = ROOT / "pipeline" / "trail_kit" / "trails"


def box(pts, pad_lon, pad_lat):
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    return [round(min(lons) - pad_lon, 5), round(min(lats) - pad_lat, 5), round(max(lons) + pad_lon, 5), round(max(lats) + pad_lat, 5)]


def season_block(spec):
    wash = json.loads((KIT / "mount_washburn.json").read_text())["seasons"]
    s = json.loads(json.dumps(wash))
    sn = spec["snow"]
    s["map"]["winter"].update(snowline_m=sn["winter"])
    if "spring" in sn:
        s["map"]["spring"].update(snowline_m=sn["spring"])
    else:
        s["map"]["spring"] = {k: v for k, v in s["map"]["spring"].items() if k not in ("snowline_m", "soft_m", "noise_m", "north_m", "steep_from", "steep_to", "patchy")}
        s["map"]["spring"]["alpha"] = 0
    for name, patch in (spec.get("season_patch") or {}).items():
        s["map"][name].update(patch)
    return s


def main(spec_path):
    spec = json.loads(Path(spec_path).read_text())
    hikes = {h["id"]: h for h in json.loads((ROOT / "app/public/data/hikes.json").read_text())}
    h = hikes[spec["hike_id"]]
    start = spec.get("start") or {"name": h["trailhead"]["name"], "lat": h["trailhead"]["lat"], "lon": h["trailhead"]["lon"]}
    end = spec.get("end") or {"name": h["end"]["name"], "lat": h["end"]["lat"], "lon": h["end"]["lon"]}
    route_via = [{"lat": la, "lon": lo} for la, lo in spec.get("route_via", [])]  # the route passes these, in order (loops)
    pts = [(start["lon"], start["lat"]), (end["lon"], end["lat"])] + [tuple(p) for p in spec.get("via", [])] + [(v["lon"], v["lat"]) for v in route_via]
    km = h["length_mi"] * 1.609 / (2 if h["route_type"] == "out-and-back" else 1)
    cfg = {
        "id": spec["id"],
        "title": spec["title"] + " Walk",
        "hike_name": spec["title"],
        "brand": "Peak Finder · Trail walk",
        "map_label": spec["map_label"],
        "park": h["park_name"] + ", " + h["state"],
        "start": start,
        "end": end,
        "gap_bridge_m": 80,
        "osm_bbox": box(pts, 0.018, 0.012),
        "bounds": {
            "wide": box(pts, max(spec.get("pad_wide", 0.06), 0.045), max(spec.get("pad_wide", 0.06), 0.045) * 0.8),
            "mid": box(pts, 0.036, 0.029),
            "core": box(pts, 0.026, 0.020),
            "corridor_m": spec.get("corridor_m", 850),
        },
        "camera": {"pitch": spec.get("pitch", 50), "zoom": spec.get("zoom", 15.2), "scroll_vh": spec.get("scroll_vh", round(km * 450, -1))},
        "profile_labels": {"start": "Trailhead", "end": spec.get("end_label", "Summit"), "key_stop": {"label": spec.get("end_label", "Summit"), "at_m": round(km * 1000)}},
        "profile_checkpoints": spec.get("checkpoints", []),
        "stops": [],
        "look": {"contrast": 0.0},
        "seasons": season_block(spec),
    }
    if route_via:
        cfg["route_via"] = route_via
        cfg["route_loop"] = bool(spec.get("route_loop"))
    if spec.get("heading_window_m"):
        cfg["camera"]["heading_window_m"] = spec["heading_window_m"]
    stops = spec["stops"]
    for i, st in enumerate(stops):
        first, last = i == 0, i == len(stops) - 1
        key = "trailhead" if first else "destination" if last else st["key"]
        cfg["stops"].append({
            "at": 0.01 if first else 0.99 if last else st["at"],
            "photo": key,
            "commons_file": st["file"],
            "alt": st["alt"],
            "eyebrow": ("Start · " if first else "End · " if last else "") + st["title"],
            "title": st["title"],
            "text": st["text"],
            "elev_at_m": 0 if first else "end" if last else st.get("elev_at_m", 0),
            "season_photos": {"summer": key},
        })
    (KIT / f"{spec['id']}.json").write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n")
    print("wrote", KIT / f"{spec['id']}.json", f"(about {km:.1f} km one way, scroll_vh {cfg['camera']['scroll_vh']})")


if __name__ == "__main__":
    main(sys.argv[1])
