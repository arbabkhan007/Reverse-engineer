#!/usr/bin/env python3
"""Compose Etsy-ready NovalityStore logo and big shop banner from selected art."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).parent
DOWNLOADS = ROOT.parent / "downloads"
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
BOLD = str(FONT_DIR / "DejaVuSans-Bold.ttf")
REG = str(FONT_DIR / "DejaVuSans.ttf")
BG = (249, 244, 233)
INK = (27, 42, 60)
SAGE = (226, 237, 229)
TERRA = (185, 91, 60)
MUTED = (88, 104, 117)


def fit_font(text, path, initial, max_width):
    size = initial
    while size > 18:
        f = ImageFont.truetype(path, size)
        if ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(text, font=f) <= max_width:
            return f
        size -= 1
    return ImageFont.truetype(path, size)


def center_text(draw, text, y, font, fill, width):
    x = (width - draw.textlength(text, font=font)) / 2
    draw.text((x, y), text, font=font, fill=fill)


def make_icon():
    art = Image.open(ROOT / "NovalityStore-logo-art.png").convert("RGBA")
    alpha = art.getchannel("A")
    # Ignore faint single-pixel generation noise when determining the crop.
    bbox = alpha.point(lambda p: 255 if p > 12 else 0).getbbox()
    if bbox:
        l, t, r, b = bbox
        pad = 12
        bbox = (max(0, l-pad), max(0, t-pad), min(art.width, r+pad), min(art.height, b+pad))
        art = art.crop(bbox)
    art.thumbnail((700, 700), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (1000, 1000), BG)
    d = ImageDraw.Draw(canvas)
    d.ellipse((112, 28, 888, 804), fill=SAGE)
    x = (1000 - art.width) // 2
    y = 54 + (700 - art.height) // 2
    canvas.paste(art, (x, y), art.getchannel("A"))

    d = ImageDraw.Draw(canvas)
    word = "NovalityStore"
    wf = fit_font(word, BOLD, 72, 840)
    center_text(d, word, 803, wf, INK, 1000)
    tagline = "SPREADSHEETS  •  CROCHET PATTERNS"
    tf = fit_font(tagline, BOLD, 27, 900)
    center_text(d, tagline, 898, tf, TERRA, 1000)

    out = ROOT / "NovalityStore-Etsy-Shop-Icon.png"
    canvas.save(out, "PNG", optimize=True)
    return out


def make_banner():
    raw = Image.open(ROOT / "NovalityStore-banner-art.png").convert("RGB")
    # The selected source is square and has unwanted generated foliage bands at
    # top and bottom. Crop those away and retain the complete still life.
    still_life = raw.crop((465, 320, 990, 755))
    still_life = still_life.resize((485, 402), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (1600, 400), BG)
    # Soft warm tint at the right, with no hard seam behind the illustration.
    pix = canvas.load()
    for x in range(870, 1600):
        t = (x - 870) / (1600 - 870)
        col = tuple(round(BG[i] * (1-t) + (246, 238, 225)[i] * t) for i in range(3))
        for y in range(400):
            pix[x, y] = col
    # Place selected art on the right with a small crop-safe margin.
    canvas.paste(still_life, (1082, -1))

    d = ImageDraw.Draw(canvas)
    d.text((122, 62), "DIGITAL TOOLS  •  HANDMADE PATTERNS",
           font=ImageFont.truetype(BOLD, 23), fill=TERRA)
    d.text((116, 112), "NovalityStore", font=ImageFont.truetype(BOLD, 75), fill=INK)
    d.rounded_rectangle((124, 218, 202, 229), radius=5, fill=TERRA)
    d.text((122, 251), "Spreadsheets & planners", font=ImageFont.truetype(REG, 38), fill=MUTED)
    d.text((122, 303), "Crochet patterns for makers", font=ImageFont.truetype(REG, 38), fill=MUTED)

    out = ROOT / "NovalityStore-Etsy-Big-Shop-Banner.png"
    canvas.save(out, "PNG", optimize=True)
    return out


def main():
    icon = make_icon()
    banner = make_banner()
    readme = ROOT / "README.md"
    readme.write_text("""# NovalityStore Etsy brand assets

- `NovalityStore-Etsy-Shop-Icon.png` — 1000 × 1000 px, square PNG for Etsy shop logo/icon.
- `NovalityStore-Etsy-Big-Shop-Banner.png` — 1600 × 400 px PNG for Etsy's big shop banner.

The logo/banners use a consistent warm-ivory, sage, terracotta, and ink palette. The banner describes the shop's digital spreadsheet/planner and crochet-pattern categories. No product screenshot or specific finished crochet item is represented.

Etsy currently recommends 1600 × 400 px for a big banner and requires at least 500 × 500 px for a shop logo. Upload from Shop Manager → Shop Home/Settings. Source: [Etsy image requirements](https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop).
""", encoding="utf-8")

    DOWNLOADS.mkdir(exist_ok=True)
    package = DOWNLOADS / "NovalityStore-Etsy-Brand-Kit.zip"
    with ZipFile(package, "w", ZIP_DEFLATED, compresslevel=9) as z:
        for p in (icon, banner, readme):
            z.write(p, p.name)
    with ZipFile(package) as z:
        assert z.testzip() is None
        assert len(z.namelist()) == 3

    for p in (icon, banner, package):
        print(f"{p.relative_to(ROOT.parent)}  {p.stat().st_size:,} bytes")
    print("Logo: 1000x1000 RGB PNG; banner: 1600x400 RGB PNG; package integrity OK")


if __name__ == "__main__":
    main()
