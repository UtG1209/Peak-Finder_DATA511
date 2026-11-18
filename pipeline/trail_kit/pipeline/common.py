"""Shared helpers for the When to Go trail-walk pipeline.

Tile maths (Web Mercator / slippy map), distances, Terrarium elevation
encoding, and small file helpers used by every step.
"""
import json
import math
import os
import time
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT = "WhenToGo-TrailKit/1.0 (UW data-viz class project)"

# Public data endpoints (all free, no API key)
DEM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
IMG_URL = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"


def load_config(trail_id):
    with open(ROOT / "trails" / f"{trail_id}.json", encoding="utf-8") as f:
        return json.load(f)


def cache_dir(trail_id):
    d = ROOT / "cache" / trail_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def site_dir(trail_id):
    d = ROOT / "output" / trail_id
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---------- tile maths ----------
def lon2x(lon, z):
    return int((lon + 180.0) / 360.0 * 2 ** z)


def lat2y(lat, z):
    r = math.radians(lat)
    return int((1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0 * 2 ** z)


def tiles_in_bbox(bbox, z):
    """bbox = [west, south, east, north] in degrees. Returns [(z, x, y), ...]."""
    w, s, e, n = bbox
    out = []
    for x in range(lon2x(w, z), lon2x(e, z) + 1):
        for y in range(lat2y(n, z), lat2y(s, z) + 1):
            out.append((z, x, y))
    return out


def corridor_tiles(profile, z, radius_m):
    """Set of (x, y) tiles at zoom z within about radius_m metres of the route (profile = [[lon, lat, ...], ...])."""
    import math
    keep = set()
    for lon, lat, *_ in profile[::3]:
        dlat = radius_m / 111000
        dlon = radius_m / (111000 * math.cos(math.radians(lat)))
        for x in range(lon2x(lon - dlon, z), lon2x(lon + dlon, z) + 1):
            for y in range(lat2y(lat + dlat, z), lat2y(lat - dlat, z) + 1):
                keep.add((x, y))
    return keep


def haversine(a, b):
    """Distance in metres between (lat, lon) points."""
    R = 6371000.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


# ---------- Terrarium elevation encoding ----------
# elevation_m = R * 256 + G + B / 256 - 32768
def decode_terrarium(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float64)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768


def encode_terrarium(elev):
    v = elev + 32768
    r = np.floor(v / 256)
    g = np.floor(v - r * 256)
    b = np.clip(np.round((v - r * 256 - g) * 256), 0, 255)
    return Image.fromarray(np.stack([r, g, b], -1).astype(np.uint8), "RGB")


class ElevationSampler:
    """Reads elevations from cached Terrarium tiles, preferring the highest zoom available."""

    def __init__(self, dem_dir, zmax=14, zmin=10):
        self.dem_dir = Path(dem_dir)
        self.zmax, self.zmin = zmax, zmin
        self._cache = {}

    def _tile(self, z, x, y):
        k = (z, x, y)
        if k not in self._cache:
            p = self.dem_dir / str(z) / str(x) / f"{y}.png"
            self._cache[k] = decode_terrarium(p) if p.exists() else None
        return self._cache[k]

    def at(self, lat, lon):
        for z in range(self.zmax, self.zmin - 1, -1):
            n = 2 ** z
            xf = (lon + 180) / 360 * n
            r = math.radians(lat)
            yf = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n
            x, y = int(xf), int(yf)
            t = self._tile(z, x, y)
            if t is None:
                continue
            i = min(int((xf - x) * 256), 255)
            j = min(int((yf - y) * 256), 255)
            return float(t[j, i])
        return None


# ---------- downloads ----------
def http_get(url, params=None, retries=3, timeout=60):
    import requests

    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, headers={"User-Agent": USER_AGENT}, timeout=timeout)
            if r.status_code == 200:
                return r
            if r.status_code in (404, 400):
                return r
        except requests.RequestException:
            pass
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Download failed after {retries} tries: {url}")


def save_bytes(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def write_json(path, obj):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def exists(path):
    return os.path.exists(path)
