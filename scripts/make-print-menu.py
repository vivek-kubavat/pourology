"""Printed menu with the live-menu QR in the footer (needs Pillow + Node for the QR matrix).

    python3 scripts/make-print-menu.py [menu-url]

Input : brand/pourology-menu-original.jpg  (designer artwork, 2160×3000 = 540×750 pt @ 288 dpi)
Output: brand/pourology-menu.jpg and brand/pourology-menu.pdf

Footer changes: the "[QR CODE]" placeholder becomes a real QR (with the Po tile) that opens the
digital menu, the "Scan to pay with UPI" label is replaced and the "[YOUR INSTAGRAM HANDLE]" line is
removed (replaced by what the QR offers). Text is set in DM Sans to match the artwork.
"""
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand" / "pourology-menu-original.jpg"
OUT_JPG = ROOT / "brand" / "pourology-menu.jpg"
OUT_PDF = ROOT / "brand" / "pourology-menu.pdf"
FONT = ROOT / "brand" / "fonts" / "DMSans-Variable.ttf"
LOGO = ROOT / "web" / "icons" / "logo-tile.png"
URL = sys.argv[1] if len(sys.argv) > 1 else "https://vivek-kubavat.github.io/pourology/menu.html"

CREAM = (255, 244, 224)
ESPRESSO = (59, 36, 20)
TEAL_DEEP = (24, 104, 100)      # sampled from the artwork's footer label
TEXT_DARK = (56, 36, 20)        # sampled from the artwork's footer line

LABEL = "SCAN FOR OUR MENU"
SUBLINE = "Find us  ·  Call  ·  WhatsApp  ·  Porter delivery"


def font(size, weight=400):
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_axes([min(max(size * 0.75 / 1, 9), 40), weight])  # optical size, weight
    return f


def tracked_width(draw, text, f, tracking):
    return sum(draw.textlength(ch, font=f) for ch in text) + tracking * (len(text) - 1)


def draw_tracked(draw, xy, text, f, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + tracking


def qr_matrix(url):
    """QR modules via the same `qrcode` npm package used by scripts/make-qr.js (error correction H)."""
    js = ("const Q=require('qrcode');const q=Q.create(process.argv[1],{errorCorrectionLevel:'H'});"
          "const n=q.modules.size;const r=[];for(let y=0;y<n;y++){let s='';for(let x=0;x<n;x++)s+=q.modules.get(y,x)?'1':'0';r.push(s)}"
          "console.log(JSON.stringify(r))")
    out = subprocess.check_output(["node", "-e", js, url], cwd=ROOT)
    return json.loads(out)


def qr_image(url, module_px, quiet=2):
    rows = qr_matrix(url)
    n = len(rows)
    size = (n + 2 * quiet) * module_px
    img = Image.new("RGB", (size, size), CREAM)
    d = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, bit in enumerate(row):
            if bit == "1":
                x0, y0 = (x + quiet) * module_px, (y + quiet) * module_px
                d.rectangle([x0, y0, x0 + module_px - 1, y0 + module_px - 1], fill=ESPRESSO)
    # Po tile in the centre on a cream pad (≈22% of the code, safe with error correction H)
    box = int(size * 0.22)
    pad = int(size * 0.025)
    c0 = (size - box) // 2
    d.rounded_rectangle([c0 - pad, c0 - pad, c0 + box + pad, c0 + box + pad], radius=int(pad * 1.5), fill=CREAM)
    logo = Image.open(LOGO).convert("RGBA").resize((box, box), Image.LANCZOS)
    img.paste(logo, (c0, c0), logo)
    return img, quiet * module_px


def main():
    im = Image.open(SRC).convert("RGB")
    d = ImageDraw.Draw(im)

    # Calibrate type to the original footer (measured on the 2160×3000 artwork):
    #   label "SCAN TO PAY WITH UPI": x=146, cap top y=2680, cap height 26 px, width 635 px
    #   line  "[YOUR INSTAGRAM HANDLE]": x=147, top y=2753, width 577 px
    label_f = font(37, 450)
    probe = "SCAN TO PAY WITH UPI"
    plain = tracked_width(d, probe, label_f, 0)
    tracking = (635 - plain) / (len(probe) - 1)
    sub_f = font(40, 400)

    # Clear the old footer text and the dashed placeholder box.
    d.rectangle([120, 2660, 1400, 2820], fill=CREAM)
    d.rectangle([1740, 2590, 2060, 2880], fill=CREAM)

    # Label (same position/size/tracking/colour as the original) + one explanatory line.
    cap_offset = label_f.getbbox("S")[1]
    draw_tracked(d, (146, 2680 - cap_offset), LABEL, label_f, TEAL_DEEP, tracking)
    sub_offset = sub_f.getbbox("F")[1]
    d.text((147, 2756 - sub_offset), SUBLINE, font=sub_f, fill=TEXT_DARK)

    # QR: 41 modules + 2-module quiet zone at 7 px/module → 315 px (≈2.8 cm on the 19 cm-wide page).
    # Starts below the Additives box border (y≈2590) and keeps a bottom margin.
    qr, quiet = qr_image(URL, 7)
    right_edge, top = 2015, 2610
    im.paste(qr, (right_edge + quiet - qr.width, top))

    im.save(OUT_JPG, quality=95, subsampling=0, dpi=(288, 288))
    im.save(OUT_PDF, "PDF", resolution=288.0, title="Pourology Menu", author="Pourology Coffee Lab")
    print("wrote", OUT_JPG.relative_to(ROOT), "and", OUT_PDF.relative_to(ROOT), "→", URL)


if __name__ == "__main__":
    main()
