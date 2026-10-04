"""Build web/icons/* from the official brand artwork in brand/pourology-icon.jpg (needs Pillow).

    python3 scripts/make-icons.py

- icon-192/512.png   the "Po" tile, full bleed (home-screen icon; the OS rounds the corners)
- maskable-192/512   full-bleed espresso, artwork inside the safe zone (Android circle/squircle icons)
- logo-tile.png      tile with transparent rounded corners (header, login, menu)
- favicon-64.png     small tab icon
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand" / "pourology-icon.jpg"
OUT = ROOT / "web" / "icons"
ESPRESSO = (59, 36, 20)
CREAM = (255, 244, 224)


def tile_bounds(img):
    w, h = img.size
    dark = lambda p: sum(p) < 250
    xs = [x for x in range(w) if dark(img.getpixel((x, h // 2)))]
    ys = [y for y in range(h) if dark(img.getpixel((w // 2, y)))]
    return xs[0], ys[0], xs[-1] + 1, ys[-1] + 1


def square(img, box):
    """Crop the tile and pad it to a square of espresso brown."""
    tile = img.crop(box)
    side = max(tile.size)
    sq = Image.new("RGB", (side, side), ESPRESSO)
    sq.paste(tile, ((side - tile.width) // 2, (side - tile.height) // 2))
    return sq


def fill_corners(img, radius):
    """Paint the cream rounded-corner pixels espresso so the tile is full bleed."""
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=radius, fill=255)
    bg = Image.new("RGB", img.size, ESPRESSO)
    return Image.composite(img, bg, mask)


def rounded_alpha(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def main():
    src = Image.open(SRC).convert("RGB")
    box = tile_bounds(src)
    # inset 2px to drop anti-aliased cream edge
    box = (box[0] + 2, box[1] + 2, box[2] - 2, box[3] - 2)
    crop = src.crop(box)
    radius = int(max(crop.size) * 0.075)
    # Fill the artwork's own cream corners first, then pad to a square, so no cream notches remain.
    # (a slightly larger fill radius also covers the anti-aliased rim of the original corners)
    tile = square(fill_corners(crop, int(radius * 1.6)), (0, 0, crop.width, crop.height))
    full = tile

    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        full.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png", optimize=True)
    full.resize((64, 64), Image.LANCZOS).save(OUT / "favicon-64.png", optimize=True)
    rounded_alpha(tile, radius).resize((256, 256), Image.LANCZOS).save(OUT / "logo-tile.png", optimize=True)

    # Maskable (Android masks it to a circle/squircle): full-bleed espresso background with the tile
    # artwork scaled to 72%, so "1:16" in the corner still sits inside the 80% safe circle
    # (corner text is ~12% in from the tile edge → 0.38·√2·0.72 ≈ 0.39 < 0.40 from the centre).
    canvas = Image.new("RGB", (512, 512), ESPRESSO)
    inner = int(512 * 0.72)
    t = full.resize((inner, inner), Image.LANCZOS)
    canvas.paste(t, ((512 - inner) // 2, (512 - inner) // 2))
    canvas.save(OUT / "maskable-512.png", optimize=True)
    canvas.resize((192, 192), Image.LANCZOS).save(OUT / "maskable-192.png", optimize=True)
    print("wrote", ", ".join(sorted(p.name for p in OUT.glob("*.png"))))


if __name__ == "__main__":
    main()
