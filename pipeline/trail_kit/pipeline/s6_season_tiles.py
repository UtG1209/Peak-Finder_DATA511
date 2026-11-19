"""Step 6 (optional): draw the ILLUSTRATIVE seasonal map layers for the season toggle.

There is no free imagery of this trail for every season, so the page keeps one real photograph of the
ground (USGS imagery, a late-summer/early-autumn snapshot) and lays a stylised, clearly labelled
overlay on top of it for the chosen season:
  winter, spring  white snow, drawn from the elevation model (snow line + slope + north-facing slopes)
  summer, autumn  a green or red/amber tint over the vegetated ground (found from the imagery's own colours)
Nothing here is measured snow cover or measured leaf colour. The snow lines and tints come from the
numbers in the trail config ("seasons" -> "map") and the page says "illustrative".

Output: cache/<id>/season/<season>/12/<x>/<y>.png  (RGBA, 512 px, one per z12 tile over the wide box)
Run WITHOUT python -I.  Usage: python pipeline/s6_season_tiles.py north_cascades
"""
import math
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

from common import cache_dir, load_config, tiles_in_bbox

OUT_PX = 512        # pixels per z12 tile in the output
WORK = 4            # working resolution = WORK * 256 px per z12 tile


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def load_dem(cdir, tiles):
    """Elevation (m) for the whole z12 block at (WORK*256) px per tile, z13 tiles where cached, z12 elsewhere."""
    xs = sorted({t[1] for t in tiles}); ys = sorted({t[2] for t in tiles})
    x0, y0, nx, ny = xs[0], ys[0], len(xs), len(ys)

    def decode(p):
        a = np.asarray(Image.open(p).convert("RGB"), dtype=np.float64)
        return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

    e12 = np.zeros((ny * 256, nx * 256))
    for x in xs:
        for y in ys:
            e12[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = decode(cdir / "dem" / "12" / str(x) / f"{y}.png")
    e13 = ndimage.zoom(e12, 2, order=1)  # filler where there is no z13 tile
    for X in range(2 * x0, 2 * (x0 + nx)):
        for Y in range(2 * y0, 2 * (y0 + ny)):
            p = cdir / "dem" / "13" / str(X) / f"{Y}.png"
            if p.exists():
                e13[(Y - 2 * y0) * 256:(Y - 2 * y0 + 1) * 256, (X - 2 * x0) * 256:(X - 2 * x0 + 1) * 256] = decode(p)
    big = ndimage.zoom(e13, WORK / 2, order=3)
    return big, x0, y0, nx, ny


def load_img(cdir, x0, y0, nx, ny):
    im = Image.new("RGB", (nx * 256, ny * 256))
    for x in range(x0, x0 + nx):
        for y in range(y0, y0 + ny):
            im.paste(Image.open(cdir / "img" / "12" / str(x) / f"{y}.jpg").convert("RGB"), ((x - x0) * 256, (y - y0) * 256))
    return im.resize((nx * 256 * WORK, ny * 256 * WORK), Image.BICUBIC)


def fbm(shape, rng, octaves):
    out = np.zeros(shape)
    amp, tot = 1.0, 0.0
    for n in octaves:
        g = rng.random((n, n))
        out += amp * ndimage.zoom(g, (shape[0] / n, shape[1] / n), order=3, mode="reflect")[:shape[0], :shape[1]]
        tot += amp
        amp *= 0.55
    out /= tot
    return (out - out.min()) / (out.max() - out.min())


def terrain(e, lat):
    mpp = 156543.03392 * math.cos(math.radians(lat)) / 2 ** (12 + math.log2(WORK * 256 / 256))
    es = ndimage.gaussian_filter(e, 2.0)
    gy, gx = np.gradient(es, mpp)  # y grows southward in the image
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    north = np.clip(gy / (np.hypot(gx, gy) + 1e-6), -1, 1)  # +1 = the slope faces north
    # sun in the north-west, 40 degrees up: soft relief shading on the white snow
    az, alt = math.radians(315), math.radians(40)
    sx, sy = math.sin(az), -math.cos(az)
    shade = (math.sin(alt) * np.cos(np.radians(slope))
             + math.cos(alt) * np.sin(np.radians(slope)) * (-(gx * sx + gy * sy)) / (np.hypot(gx, gy) + 1e-6))
    return slope, north, np.clip(shade, 0, 1)


def vegetation(img):
    hsv = np.asarray(img.convert("HSV"), dtype=np.float64) / 255.0
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    warm_green = smooth(h, 30, 60) * (1 - smooth(h, 195, 225))   # yellow-green .. green .. dark teal (shaded forest)
    autumn_red = (1 - smooth(h, 22, 45)) * smooth(s, 0.30, 0.50) * 0.9      # red/orange heather and blueberry: meadow in its autumn colours
    warm_green = np.maximum(warm_green, autumn_red)
    return ndimage.gaussian_filter(warm_green * smooth(s, 0.10, 0.28) * (1 - smooth(v, 0.60, 0.85)), 3)


def snow_layer(e, slope, north, shade, rng, p):
    soft = p.get("soft_m", 200)
    coarse = fbm(e.shape, rng, (4, 8, 16))
    fine = fbm(e.shape, rng, (64, 128, 256))
    line = p["snowline_m"] + p.get("noise_m", 200) * (coarse - 0.5) * 2 - p.get("north_m", 250) * north
    cover = smooth(e - line, -soft, soft)
    cover *= 1 - smooth(slope, p.get("steep_from", 42), p.get("steep_to", 62))
    cover = smooth(cover + p.get("patchy", 0.3) * (fine - 0.5), 0.35, 0.65)
    alpha = cover * p.get("alpha", 0.92) * (0.88 + 0.12 * fine)
    base = np.array([236, 243, 252], dtype=np.float64)
    k = (0.80 + 0.28 * shade)[..., None]
    rgb = np.clip(base * k, 0, 255)
    return rgb, alpha


def tint_layer(e, veg, rng, p):
    band = smooth(e, p["band_m"][0] - 150, p["band_m"][0] + 150) * (1 - smooth(e, p["band_m"][1] - 150, p["band_m"][1] + 150))
    fine = fbm(e.shape, rng, (32, 64, 128))
    a, b = np.array(p["colour_a"], dtype=np.float64), np.array(p["colour_b"], dtype=np.float64)
    rgb = a + (b - a) * smooth(fine, 0.3, 0.7)[..., None]
    alpha = veg * band * p["alpha"] * (0.75 + 0.5 * fine)
    return rgb, np.clip(alpha, 0, 1)


def main(trail_id):
    cfg = load_config(trail_id)
    cdir = cache_dir(trail_id)
    seasons = cfg["seasons"]["map"]
    tiles = tiles_in_bbox(cfg["bounds"]["wide"], 12)
    lat = (cfg["bounds"]["wide"][1] + cfg["bounds"]["wide"][3]) / 2
    e, x0, y0, nx, ny = load_dem(cdir, tiles)
    slope, north, shade = terrain(e, lat)
    veg = vegetation(load_img(cdir, x0, y0, nx, ny))
    print(f"[season] dem {e.shape}, elevation {e.min():.0f}..{e.max():.0f} m, vegetated share {float((veg > 0.3).mean()):.0%}")
    for i, (name, p) in enumerate(seasons.items()):
        rng = np.random.default_rng(100 + i)
        if "snowline_m" in p:
            rgb, alpha = snow_layer(e, slope, north, shade, rng, p)
        elif "band_m" in p:
            rgb, alpha = tint_layer(e, veg, rng, p)
        else:
            continue  # this season is only a change of colour grading
        full = np.dstack([rgb, alpha * 255]).astype(np.uint8)
        im = Image.fromarray(full, "RGBA").resize((nx * OUT_PX, ny * OUT_PX), Image.LANCZOS)
        n = 0
        for z, x, y in tiles:
            tile = im.crop(((x - x0) * OUT_PX, (y - y0) * OUT_PX, (x - x0 + 1) * OUT_PX, (y - y0 + 1) * OUT_PX))
            out = cdir / "season" / name / str(z) / str(x) / f"{y}.png"
            out.parent.mkdir(parents=True, exist_ok=True)
            tile.save(out, optimize=True)
            n += 1
        size = sum(f.stat().st_size for f in (cdir / "season" / name).rglob("*.png")) / 1e6
        print(f"[season] {name}: {n} tiles, {size:.1f} MB, mean cover {float(alpha.mean()):.0%}")


if __name__ == "__main__":
    main(sys.argv[1])
