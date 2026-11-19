"""Step 1: download trail lines and named points from OpenStreetMap (Overpass API).

Saves cache/<trail>/osm.json. Skips the download if the file already exists.
Usage: python pipeline/s1_fetch_osm.py angels_landing
"""
import sys

from common import OVERPASS_URL, cache_dir, exists, http_get, load_config, write_json


def main(trail_id):
    cfg = load_config(trail_id)
    out = cache_dir(trail_id) / "osm.json"
    if exists(out):
        print(f"[osm] cached: {out}")
        return
    w, s, e, n = cfg["osm_bbox"]  # [west, south, east, north]
    bb = f"{s},{w},{n},{e}"       # Overpass wants south,west,north,east
    query = f"""[out:json][timeout:60];
(
  way["highway"~"path|footway"]({bb});
  node["tourism"="viewpoint"]({bb});
  node["natural"~"peak|saddle"]({bb});
  node["highway"="bus_stop"]({bb});
);
out geom;"""
    r = http_get(OVERPASS_URL, params={"data": query}, timeout=120)
    r.raise_for_status()
    data = r.json()
    write_json(out, data)
    ways = sum(1 for el in data["elements"] if el["type"] == "way")
    print(f"[osm] saved {len(data['elements'])} elements ({ways} ways) -> {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "angels_landing")
