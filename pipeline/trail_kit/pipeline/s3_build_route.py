"""Step 3: turn OSM trail pieces into one ordered route, then sample it every 10 m with elevation.

How it works
  1. Every OSM path/footway segment becomes a graph edge (length in metres).
  2. OSM trails are often split into pieces that almost-but-don't-quite touch. Any two nodes
     from different pieces closer than `gap_bridge_m` get a "link" edge (weighted x3 so real
     trail is preferred).
  3. Shortest path from the trail node nearest to `start` to the node nearest to `end`,
     restricted to the piece of network that contains the end point.
  4. Resample every 10 m and read elevation from the cached tiles (z14 where available).

Saves cache/<trail>/profile.json as [[lon, lat, distance_m, elevation_m], ...].
Usage: python pipeline/s3_build_route.py angels_landing
"""
import bisect
import sys
from itertools import groupby

import networkx as nx
import numpy as np

from common import ElevationSampler, cache_dir, haversine, load_config, read_json, write_json

STEP_M = 10


def build_graph(osm, gap_m):
    G = nx.Graph()
    for el in osm["elements"]:
        if el["type"] != "way":
            continue
        pts = [(p["lat"], p["lon"]) for p in el["geometry"]]
        for a, b in zip(pts, pts[1:]):
            G.add_edge(a, b, w=haversine(a, b), name=el.get("tags", {}).get("name"))
    nodes = list(G.nodes)
    arr = np.array(nodes)
    comp = {n: i for i, c in enumerate(nx.connected_components(G)) for n in c}
    links = 0
    for a in nodes:
        d = np.hypot((arr[:, 0] - a[0]) * 111000, (arr[:, 1] - a[1]) * 111000 * np.cos(np.radians(a[0])))
        for j in np.where(d < gap_m)[0]:
            b = nodes[j]
            if comp[a] != comp[b] and not G.has_edge(a, b):
                G.add_edge(a, b, w=float(d[j]) * 3, name="link")
                links += 1
    return G, links


def main(trail_id):
    cfg = load_config(trail_id)
    cdir = cache_dir(trail_id)
    osm = read_json(cdir / "osm.json")
    G, links = build_graph(osm, cfg.get("gap_bridge_m", 50))
    start = (cfg["start"]["lat"], cfg["start"]["lon"])
    end = (cfg["end"]["lat"], cfg["end"]["lon"])
    end_node = min(G.nodes, key=lambda k: haversine(k, end))
    reach = nx.node_connected_component(G, end_node)
    start_node = min(reach, key=lambda k: haversine(k, start))
    path = nx.shortest_path(G, start_node, end_node, weight="w")
    names = [G[u][v]["name"] for u, v in zip(path, path[1:])]
    print(f"[route] bridged {links} gaps; start node {haversine(start_node, start):.0f} m from start point")
    print("[route] trail pieces used:", [(k, len(list(g))) for k, g in groupby(names)])

    route = [start] + list(path)
    cum = [0.0]
    for a, b in zip(route, route[1:]):
        cum.append(cum[-1] + haversine(a, b))
    total = cum[-1]
    elev = ElevationSampler(cdir / "dem")
    out, d = [], 0.0
    while d <= total:
        i = min(max(0, bisect.bisect_right(cum, d) - 1), len(route) - 2)
        seg = cum[i + 1] - cum[i]
        t = 0 if seg == 0 else (d - cum[i]) / seg
        lat = route[i][0] + (route[i + 1][0] - route[i][0]) * t
        lon = route[i][1] + (route[i + 1][1] - route[i][1]) * t
        out.append([round(lon, 6), round(lat, 6), round(d), round(elev.at(lat, lon), 1)])
        d += STEP_M
    out.append([round(route[-1][1], 6), round(route[-1][0], 6), round(total), round(elev.at(*route[-1]), 1)])
    write_json(cdir / "profile.json", out)
    gain = sum(max(0, b[3] - a[3]) for a, b in zip(out, out[1:]))
    print(f"[route] {total:.0f} m, {len(out)} points, start {out[0][3]:.0f} m, end {out[-1][3]:.0f} m, "
          f"climb {gain:.0f} m -> {cdir / 'profile.json'}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "angels_landing")
