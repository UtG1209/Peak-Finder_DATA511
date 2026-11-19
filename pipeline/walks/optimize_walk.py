#!/usr/bin/env python3
"""Make a finished 3D walk smaller WITHOUT making it look worse, and prove it.

  python3 pipeline/walks/optimize_walk.py walks/<walk_id> [--source <original_dir>] [--dry-run]

What it does (every step is gated by a quality check against the original; a step that would lower quality is skipped, never forced):
  O1 Elevation tiles   PNG -> lossless WebP. Elevation is encoded in the pixel colours, so this must be pixel-exact: verified file by file.
  O2 Season overlays   PNG -> lossless WebP (identical pixels). --season-lossy allows q95 only where PSNR >= 45 dB and SSIM >= 0.985.
  O3 Photos            Resized to what the page can show (max width PHOTO_MAX_W, never enlarged) and re-encoded as progressive JPEG.
  O4 Clouds            The three cloud images are identical in every walk: one shared copy in walks/_shared/clouds/.
  O5 Page              Tile URL templates in index.html point at the new files; every reference is re-checked.
  O6 Report            walks/<walk>/OPTIMIZE_REPORT.json: sizes before/after and the WORST quality number per file type.

Needs Pillow and numpy (pipeline/walks/requirements.txt); scikit-image is used for SSIM when present.
Original files are read from --source (default: the walk folder itself, in which case it is only optimized once; a marker file stops a second pass).
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from skimage.metrics import structural_similarity as _ssim
except ImportError:  # pragma: no cover
    _ssim = None

ROOT = Path(__file__).resolve().parents[2]
SHARED = ROOT / "walks" / "_shared"
MARKER = ".optimized.json"

# ---- the recipe (tuned from measurements on the three existing walks: see docs/WALKS.md "Optimizing") ----
WEBP_METHOD = 5
SEASON_LOSSY_Q = (95,)         # only used with --season-lossy; q95 measured at PSNR >= 48 dB (visually identical) and ~15% smaller than lossless
SEASON_SSIM_FLOOR = 0.985      # RGB composited on grey (lossy mode only)
SEASON_PSNR_FLOOR = 45.0
SEASON_ALPHA_MAX_ERR = 2       # of 255
PHOTO_MAX_W = 1200             # photos arrive at 900 px and re-encoding gave no saving: they are kept unless a smaller file passes the floor
PHOTO_Q = 85
PHOTO_SSIM_FLOOR = 0.97        # judged at a 720 px wide display size
# NOT done on purpose: pruning tiles far from the route. A 2844 px-wide window requests terrain up to 11 km from the trail
# (measured), which is almost the whole downloaded area, so pruning would lower quality on big screens. Imagery JPEGs are kept as they are
# (re-encoding saved ~18% but compounds JPEG loss).
SHARED_CLOUDS = ("cumulus.webp", "mass.webp", "wisps.webp")


# ----------------------------------------------------------------------------- quality metrics
def ssim_rgb(a: np.ndarray, b: np.ndarray) -> float:
    if (a == b).all():
        return 1.0
    if _ssim is not None:
        return float(_ssim(a, b, channel_axis=2, data_range=255))
    # fallback: global correlation based score (coarser than SSIM, stricter in practice for tiny differences)
    d = a.astype(np.float64) - b.astype(np.float64)
    return float(1 - (d ** 2).mean() / (255.0 ** 2) * 50)


def over_grey(im: Image.Image) -> np.ndarray:
    bg = Image.new("RGBA", im.size, (128, 128, 128, 255))
    bg.alpha_composite(im.convert("RGBA"))
    return np.asarray(bg.convert("RGB"))


def decode(b: bytes) -> Image.Image:
    return Image.open(io.BytesIO(b))


def webp(im: Image.Image, **kw) -> bytes:
    out = io.BytesIO()
    im.save(out, "WEBP", method=WEBP_METHOD, **kw)
    return out.getvalue()


# ----------------------------------------------------------------------------- per-type converters (pure: bytes in, bytes + metric out)
def convert_dem(png_path: Path) -> tuple[bytes, float]:
    im = Image.open(png_path).convert("RGB")
    b = webp(im, lossless=True, quality=100)
    exact = bool((np.asarray(im) == np.asarray(decode(b).convert("RGB"))).all())
    return b, (1.0 if exact else 0.0)


def convert_season(png_path: Path, lossy: bool = False) -> tuple[bytes, float, int, str]:
    """Returns (bytes, ssim, max alpha error, mode). Lossless by default; lossy only when asked AND it clears the floors."""
    im = Image.open(png_path).convert("RGBA")
    ref = over_grey(im)
    ref_a = np.asarray(im)[..., 3].astype(int)
    best = webp(im, lossless=True, quality=100)
    mode = "lossless"
    for q in (SEASON_LOSSY_Q if lossy else ()):
        b = webp(im, quality=q, alpha_quality=100)
        d = decode(b).convert("RGBA")
        s = ssim_rgb(ref, over_grey(d))
        aerr = int(np.abs(np.asarray(d)[..., 3].astype(int) - ref_a).max())
        mse = float(((ref.astype(float) - over_grey(d).astype(float)) ** 2).mean())
        p = 99.0 if mse == 0 else 10 * np.log10(255.0 ** 2 / mse)
        if s >= SEASON_SSIM_FLOOR and p >= SEASON_PSNR_FLOOR and aerr <= SEASON_ALPHA_MAX_ERR and len(b) < len(best):
            best, mode = b, f"q{q}"
            break
    d = decode(best).convert("RGBA")
    return best, ssim_rgb(ref, over_grey(d)), int(np.abs(np.asarray(d)[..., 3].astype(int) - ref_a).max()), mode


def convert_photo(jpg_path: Path) -> tuple[bytes, float]:
    im = Image.open(jpg_path).convert("RGB")
    sc = min(1.0, PHOTO_MAX_W / im.width)
    small = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS) if sc < 1 else im
    out = io.BytesIO()
    small.save(out, "JPEG", quality=PHOTO_Q, optimize=True, progressive=True)
    b = out.getvalue()
    ref = im.resize((720, round(im.height * 720 / im.width)), Image.LANCZOS)
    test = decode(b).convert("RGB").resize(ref.size, Image.LANCZOS)
    return b, ssim_rgb(np.asarray(ref), np.asarray(test))


# ----------------------------------------------------------------------------- walk-level
def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def dir_bytes(d: Path) -> int:
    return sum(p.stat().st_size for p in d.rglob("*") if p.is_file())


def patch_page(html: str) -> tuple[str, int]:
    """Point the tile templates at .webp, and the clouds at the shared copy. Returns (html, number of replacements)."""
    n = 0
    for old, new in (("dem/{z}/{x}/{y}.png'", "dem/{z}/{x}/{y}.webp'"), ("'/{z}/{x}/{y}.png'", "'/{z}/{x}/{y}.webp'")):
        n += html.count(old)
        html = html.replace(old, new)
    # every way the page names a cloud file: CSS url(clouds/x.webp), and the preloader  im.src = 'clouds/' + n + '.webp'
    for c in SHARED_CLOUDS:
        n += html.count(f"url(clouds/{c})")
        html = html.replace(f"url(clouds/{c})", f"url(../_shared/clouds/{c})")
    n += html.count("'clouds/' + ")
    html = html.replace("'clouds/' + ", "'../_shared/clouds/' + ")
    stray = re.findall(r"(?<!_shared/)clouds/", html)
    if stray:
        raise SystemExit(f"FAIL O5: {len(stray)} reference(s) to clouds/ were not redirected to the shared copy; the page would 404")
    return html, n


def optimize(walk: Path, source: Path | None, dry: bool, season_lossy: bool = False) -> dict:
    src = source or walk
    if not dry and (walk / MARKER).exists() and source is None:
        print(f"{walk.name}: already optimized ({MARKER}); pass --source <original> to redo from the originals")
        return json.loads((walk / MARKER).read_text())
    before = dir_bytes(src)
    rep: dict = {"walk": walk.name, "before_bytes": before, "types": {}}
    out = walk if source is None else walk
    if source is not None and not dry:
        if walk.exists():
            shutil.rmtree(walk)
        shutil.copytree(src, walk)

    def track(kind, o, n, metric):
        t = rep["types"].setdefault(kind, {"files": 0, "before": 0, "after": 0, "worst": 1.0})
        t["files"] += 1; t["before"] += o; t["after"] += n; t["worst"] = min(t["worst"], metric)

    # O1 elevation tiles
    for p in sorted((src / "dem").rglob("*.png")):
        b, m = convert_dem(p)
        if m < 1.0:
            raise SystemExit(f"FAIL O1: lossless conversion of {p} is not pixel-exact")
        rel = p.relative_to(src).with_suffix(".webp")
        track("dem", p.stat().st_size, len(b), m)
        if not dry:
            (walk / rel).parent.mkdir(parents=True, exist_ok=True)
            (walk / rel).write_bytes(b)
            if (walk / p.relative_to(src)).exists():
                (walk / p.relative_to(src)).unlink()
    # O2 season overlays
    modes: dict[str, int] = {}
    for p in sorted((src / "season").rglob("*.png")) if (src / "season").exists() else []:
        b, s, aerr, mode = convert_season(p, season_lossy)
        modes[mode] = modes.get(mode, 0) + 1
        track("season", p.stat().st_size, len(b), s)
        if not dry:
            rel = p.relative_to(src).with_suffix(".webp")
            (walk / rel).write_bytes(b)
            (walk / p.relative_to(src)).unlink()
    rep["season_modes"] = modes
    # O3 photos
    for p in sorted((src / "photos").glob("*.jpg")):
        b, s = convert_photo(p)
        if s < PHOTO_SSIM_FLOOR:
            b = p.read_bytes()  # would look worse: keep the original
            s = 1.0
        elif len(b) > 0.85 * p.stat().st_size:  # not worth any loss: keep the original unless it saves at least 15%
            b, s = p.read_bytes(), 1.0
        track("photos", p.stat().st_size, len(b), s)
        if not dry:
            (walk / "photos" / p.name).write_bytes(b)
    # O4 shared clouds
    cl = src / "clouds"
    if cl.exists():
        for name in SHARED_CLOUDS:
            f = cl / name
            if not f.exists():
                continue
            shared = SHARED / "clouds" / name
            if shared.exists() and sha(shared) != sha(f):
                raise SystemExit(f"FAIL O4: {name} differs from the shared copy; refusing to merge different images")
            track("clouds", f.stat().st_size, 0, 1.0)
            if not dry:
                shared.parent.mkdir(parents=True, exist_ok=True)
                if not shared.exists():
                    shutil.copy2(f, shared)
        if not dry:
            shutil.rmtree(walk / "clouds", ignore_errors=True)
    # O5 page
    page = (src / "index.html").read_text(encoding="utf-8")
    new, n = patch_page(page)
    rep["page_replacements"] = n
    left = re.findall(r"\{y\}\.png", new)
    if left:
        raise SystemExit("FAIL O5: some tile templates still point at .png: " + str(len(left)))
    if not dry:
        (walk / "index.html").write_text(new, encoding="utf-8")
        rep["after_bytes"] = dir_bytes(walk)
        (walk / MARKER).write_text(json.dumps(rep, indent=2))
    else:
        rep["after_bytes"] = before - sum(t["before"] - t["after"] for t in rep["types"].values())
    return rep


def print_report(rep: dict) -> None:
    mb = lambda n: f"{n / 1048576:6.1f} MB"
    print(f"\n{rep['walk']}: {mb(rep['before_bytes'])} -> {mb(rep['after_bytes'])}  ({rep['after_bytes'] / rep['before_bytes'] * 100:.0f}%)")
    for k, t in rep["types"].items():
        print(f"  {k:7s} {t['files']:4d} files {mb(t['before'])} -> {mb(t['after'])}   worst quality score {t['worst']:.4f}")
    if rep.get("season_modes"):
        print("  season overlays by mode:", rep["season_modes"])


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("walk", type=Path, help="walks/<id> folder to optimize")
    ap.add_argument("--source", type=Path, help="pristine copy of the walk to read from (the walk folder is rebuilt from it)")
    ap.add_argument("--dry-run", action="store_true", help="measure only; write nothing")
    ap.add_argument("--season-lossy", action="store_true", help="allow near-lossless WebP q95 for season overlays (PSNR >= 45 dB per tile); default is lossless")
    a = ap.parse_args(argv)
    rep = optimize(a.walk.resolve(), a.source.resolve() if a.source else None, a.dry_run, a.season_lossy)
    print_report(rep)
    return 0


if __name__ == "__main__":
    sys.exit(main())
