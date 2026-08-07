"""
Generate Business Manager launcher icons from a source JPG:
- Square crop, high-res master
- Flood-fill remove near-white outer background → transparent PNG
- Write Android adaptive foreground sizes (mipmap-*)
- Write PWA icons in public/

Requires: pip install Pillow
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Android adaptive foreground: 108dp canvas per density (px = 108 * density/160)
FOREGROUND_SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
# Legacy full launcher icon (48dp) for API < 26
LEGACY_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

MASTER = 1024
FLOOD_THRESH = 42  # higher = more aggressive white removal at edges


def square_crop(im: Image.Image) -> Image.Image:
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return im.crop((left, top, left + side, top + side))


def strip_white_edges(im: Image.Image) -> Image.Image:
    """Remove contiguous near-white background from image corners (typical app icon on white)."""
    im = im.convert("RGBA")
    w, h = im.size
    draw = ImageDraw.Draw(im)
    seeds = [
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ]
    for xy in seeds:
        try:
            ImageDraw.floodfill(im, xy, (0, 0, 0, 0), thresh=FLOOD_THRESH)
        except ValueError:
            pass
    # Light anti-fringe: soften semi-transparent edge (optional 1px blur alpha only is heavy; skip)
    return im


def main() -> int:
    root = Path(__file__).resolve().parents[1]  # frontend/
    src = Path(r"C:\Users\rrdeveloper\Development\Mobile\image.jpg")
    if not src.is_file():
        print("Source not found:", src, file=sys.stderr)
        return 1

    android_res = root / "android" / "app" / "src" / "main" / "res"
    public = root / "public"

    raw = Image.open(src).convert("RGB")
    raw = square_crop(raw)
    raw = raw.resize((MASTER, MASTER), Image.Resampling.LANCZOS)
    icon = strip_white_edges(raw)

    for folder, px in FOREGROUND_SIZES.items():
        out_dir = android_res / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        out = icon.resize((px, px), Image.Resampling.LANCZOS)
        out_path = out_dir / "ic_launcher_foreground.png"
        out.save(out_path, format="PNG", optimize=True)
        print("Wrote", out_path.relative_to(root))

    for folder, px in LEGACY_SIZES.items():
        out_dir = android_res / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        out = icon.resize((px, px), Image.Resampling.LANCZOS)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            out_path = out_dir / name
            out.save(out_path, format="PNG", optimize=True)
            print("Wrote", out_path.relative_to(root))

    # PWA / web
    public.mkdir(parents=True, exist_ok=True)
    for name, px in (("icon-192.png", 192), ("icon-512.png", 512)):
        out = icon.resize((px, px), Image.Resampling.LANCZOS)
        p = public / name
        out.save(p, format="PNG", optimize=True)
        print("Wrote", p.relative_to(root))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
