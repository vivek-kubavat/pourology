"""Cuts the photos used by the web menu (web/img/*.webp) out of the poster brand/pourology-menu-2026.jpg.
   python3 scripts/make-menu-photos.py   (needs Pillow)
Photos on the cream cards get a feathered transparent edge so they sit on the page without a visible box."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'web' / 'img'
OUT.mkdir(exist_ok=True)
src = Image.open(ROOT / 'brand' / 'pourology-menu-2026.jpg').convert('RGB')

# name: (crop box, feather px or None for an opaque photo, [boxes inside the crop to erase: poster text])
CUTS = {
    'header': ((0, 0, 1086, 236), None, []),
    'footer': ((0, 1346, 1086, 1448), None, []),
    'brewed': ((745, 250, 1040, 624), None, []),
    'latte': ((34, 742, 232, 902), 7, []),
    'mocha': ((897, 672, 1046, 898), 7, []),
    'cold': ((912, 928, 1040, 1092), 7, []),
    'hotchoc': ((275, 1140, 530, 1328), 8, [(0, 0, 120, 28)]),
    'flask': ((904, 1146, 1040, 1326), 7, [(0, 0, 10, 18)]),
}
for name, (box, feather, erase) in CUTS.items():
    im = src.crop(box)
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    if feather:
        f = feather * 2
        mask = Image.new('L', im.size, 0)
        d = ImageDraw.Draw(mask)
        d.rectangle((f, f, im.width - f, im.height - f), fill=255)
        for (x0, y0, x1, y1) in erase:
            d.rectangle((x0 * 2 - f, y0 * 2 - f, x1 * 2 + f, y1 * 2 + f), fill=0)
        im.putalpha(mask.filter(ImageFilter.GaussianBlur(f * 0.55)))
    im.save(OUT / f'{name}.webp', quality=82, method=6)
    print(name, im.size)
