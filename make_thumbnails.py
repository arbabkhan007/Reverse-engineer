#!/usr/bin/env python3
"""Create honest, Etsy-sized thumbnail covers for NovalityStore spreadsheets.

The shop's spreadsheet files were not supplied to this workspace. So these are
polished graphic covers with an explicitly labelled illustrative worksheet
layout — NOT fake screenshots of finished spreadsheets. The four planned
products are separated as concept-only images and labelled accordingly.

Usage:
    python3 make_thumbnails.py              # build 20 existing + 4 concepts
    python3 make_thumbnails.py --list        # list products
    python3 make_thumbnails.py --existing    # only existing shop listings
    python3 make_thumbnails.py --concepts    # only proposed products

Output: thumbnails/existing-listings/ and thumbnails/new-product-concepts/
"""
from __future__ import annotations

import argparse
import json
import textwrap
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).parent
OUT = ROOT / "thumbnails"
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
FONT_BOLD = FONT_DIR / "DejaVuSans-Bold.ttf"
FONT_REG = FONT_DIR / "DejaVuSans.ttf"

SIZE = 3000
SAFE_TOP, SAFE_BOTTOM = 375, 2625  # survives a centred 4:3 crop of a square image
OUTER = (120, 395, 2880, 2605)
SCREEN = (190, 1050, 2810, 1920)
PALETTE = {
    "navy":   {"accent": "#216A63", "pale": "#E8F3F0", "bg": "#F2F6F3"},
    "rust":   {"accent": "#BD694B", "pale": "#F8ECE6", "bg": "#F8F3EF"},
    "blue":   {"accent": "#3974A5", "pale": "#E9F1F8", "bg": "#F2F5F8"},
    "plum":   {"accent": "#80588D", "pale": "#F2EAF4", "bg": "#F7F3F8"},
    "green":  {"accent": "#45805C", "pale": "#EAF3EC", "bg": "#F3F7F2"},
    "gold":   {"accent": "#A7792E", "pale": "#F6F0E1", "bg": "#F8F5ED"},
    "teal":   {"accent": "#347F8B", "pale": "#E6F1F2", "bg": "#F1F6F6"},
    "coral":  {"accent": "#BD5F56", "pale": "#F7EAE8", "bg": "#F8F3F1"},
}
INK = "#1D2B3D"
MUTED = "#687486"
WHITE = "#FFFFFF"
LINE = "#DDE3E6"


def F(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), size)


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont,
               max_width: int) -> list[str]:
    lines: list[str] = []
    cur = ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if not cur or draw.textlength(trial, font=fnt) <= max_width:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def rounded(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def centered_text(draw: ImageDraw.ImageDraw, text: str, cx: float, y: int,
                  fnt, fill, anchor="lt"):
    width = draw.textlength(text, font=fnt)
    draw.text((cx - width / 2, y), text, font=fnt, fill=fill, anchor=anchor)


def shadow_panel(img: Image.Image, box, radius=52):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    sd.rounded_rectangle((x0 + 8, y0 + 22, x1 + 8, y1 + 22), radius=radius,
                         fill=(25, 38, 54, 38))
    layer = layer.filter(ImageFilter.GaussianBlur(24))
    img.paste(layer, (0, 0), layer)
    ImageDraw.Draw(img).rounded_rectangle(box, radius=radius, fill=WHITE)


def fitted_label(draw, text: str, max_width: int, max_size=48, min_size=34,
                 bold=False):
    for size in range(max_size, min_size - 1, -2):
        fnt = F(size, bold)
        if draw.textlength(text, font=fnt) <= max_width:
            return fnt
    return F(min_size, bold)


def draw_spreadsheet_preview(draw: ImageDraw.ImageDraw, spec: dict[str, Any],
                             palette: dict[str, str]):
    x0, y0, x1, y1 = SCREEN
    accent, pale = palette["accent"], palette["pale"]

    # App chrome and a deliberately explicit, readable disclosure.
    rounded(draw, SCREEN, 42, WHITE, outline="#D9E1E4", width=4)
    rounded(draw, (x0, y0, x1, y0 + 105), 42, "#F7F9FA")
    draw.rectangle((x0, y0 + 62, x1, y0 + 105), fill="#F7F9FA")
    for i, c in enumerate(("#E98274", "#E6BB61", "#79B78A")):
        cx = x0 + 52 + i * 48
        draw.ellipse((cx, y0 + 38, cx + 24, y0 + 62), fill=c)
    draw.text((x0 + 220, y0 + 26), "WORKSHEET VISUAL", font=F(36), fill=INK)

    disclosure = "ILLUSTRATIVE PREVIEW"
    db = draw.textbbox((0, 0), disclosure, font=F(34))
    dw = db[2] - db[0] + 56
    rounded(draw, (x1 - dw - 42, y0 + 20, x1 - 42, y0 + 82), 30,
            palette["pale"])
    draw.text((x1 - dw - 14, y0 + 28), disclosure, font=F(34), fill=accent)

    # Workbook heading, shown as a graphic mock-up rather than a claimed screenshot.
    draw.text((x0 + 62, y0 + 137), "Spreadsheet layout", font=F(46), fill=INK)
    draw.text((x1 - 500, y0 + 153), "Visual concept · not a product screenshot",
              font=F(28, False), fill=MUTED)

    # Toolbar / formula strip.
    bar_y = y0 + 208
    rounded(draw, (x0 + 50, bar_y, x1 - 50, bar_y + 72), 13, "#F4F6F7",
            outline=LINE, width=2)
    rounded(draw, (x0 + 72, bar_y + 12, x0 + 156, bar_y + 60), 8, WHITE,
            outline=LINE, width=2)
    draw.text((x0 + 98, bar_y + 15), "A1", font=F(30, False), fill=MUTED)
    draw.text((x0 + 180, bar_y + 11), "fx", font=F(32), fill=accent)
    draw.line((x0 + 245, bar_y + 36, x1 - 84, bar_y + 36), fill="#D3DCE0", width=2)

    # An empty, neutral grid uses only category/function labels supplied by the
    # listing brief. No fabricated customer records, metrics, formulas or claims.
    grid_x0, grid_y0 = x0 + 58, bar_y + 102
    grid_x1, grid_y1 = x1 - 58, y1 - 50
    headers = spec["columns"][:4]
    ncols = max(1, len(headers))
    row_h = 78
    nrows = 5
    rownum_w = 74
    col_w = (grid_x1 - grid_x0 - rownum_w) // ncols
    draw.rectangle((grid_x0, grid_y0, grid_x1, grid_y0 + row_h), fill=pale)
    draw.rectangle((grid_x0, grid_y0, grid_x0 + rownum_w, grid_y1), fill="#F7F9FA")
    draw.line((grid_x0 + rownum_w, grid_y0, grid_x0 + rownum_w, grid_y1),
              fill=LINE, width=3)

    # Column letters and feature-related headers.
    for c in range(ncols):
        left = grid_x0 + rownum_w + c * col_w
        right = grid_x0 + rownum_w + (c + 1) * col_w
        draw.line((left, grid_y0, left, grid_y1), fill=LINE, width=3)
        letter = chr(ord("A") + c)
        centered_text(draw, letter, (left + right) / 2, grid_y0 + 5,
                      F(25), MUTED)
        label = headers[c]
        lf = fitted_label(draw, label, col_w - 30, max_size=35, min_size=25, bold=True)
        # Two-line feature labels are wrapped to keep all headings visible.
        hlines = wrap_lines(draw, label, lf, col_w - 30)[:2]
        for li, ln in enumerate(hlines):
            centered_text(draw, ln, (left + right) / 2,
                          grid_y0 + 31 + li * (lf.size + 1), lf, INK)
    draw.line((grid_x1, grid_y0, grid_x1, grid_y1), fill=LINE, width=3)

    # Empty rows; numbered like a spreadsheet, with no invented sample data.
    for r in range(nrows + 1):
        yy = grid_y0 + row_h + r * ((grid_y1 - grid_y0 - row_h) // nrows)
        if yy <= grid_y1:
            draw.line((grid_x0, yy, grid_x1, yy), fill=LINE, width=3)
    for r in range(1, nrows + 1):
        yy = grid_y0 + row_h + (r - 1) * ((grid_y1 - grid_y0 - row_h) // nrows) + 4
        centered_text(draw, str(r), grid_x0 + rownum_w / 2, yy, F(24, False), MUTED)


def render(spec: dict[str, Any]) -> Image.Image:
    palette = PALETTE[spec["theme"]]
    accent, pale, bg = palette["accent"], palette["pale"], palette["bg"]
    img = Image.new("RGB", (SIZE, SIZE), bg)
    d = ImageDraw.Draw(img)

    # Clean cover, centred inside the area that survives desktop/search crops.
    shadow_panel(img, OUTER, 54)
    d = ImageDraw.Draw(img)
    x0, _, x1, _ = OUTER

    # Store label and product type.
    d.text((190, 445), "NOVALITYSTORE", font=F(42), fill=INK)
    d.text((190, 505), "SPREADSHEET TEMPLATES", font=F(28), fill=MUTED)
    pill = "NEW PRODUCT CONCEPT" if spec.get("concept") else "DIGITAL SPREADSHEET"
    pf = F(34)
    pw = d.textlength(pill, font=pf) + 62
    rounded(d, (x1 - 190 - pw, 445, x1 - 190, 510), 32,
            "#FFF1E7" if spec.get("concept") else pale)
    d.text((x1 - 190 - pw + 31, 458), pill, font=pf,
           fill="#A64A2F" if spec.get("concept") else accent)

    # Product name. Auto-fit so every title stays in the crop-safe band.
    size = 136
    while size >= 102:
        title_font = F(size)
        title_lines = wrap_lines(d, spec["title"], title_font, 2580)
        if len(title_lines) <= 2:
            break
        size -= 4
    title_lines = title_lines[:2]
    y = 585
    for line in title_lines:
        d.text((190, y), line, font=title_font, fill=INK)
        y += size + 16

    sub_y = max(860, y + 12)
    subtitle = spec["subtitle"]
    subf = fitted_label(d, subtitle, 2500, 52, 38, False)
    d.text((194, sub_y), subtitle, font=subf, fill=MUTED)

    draw_spreadsheet_preview(d, spec, palette)

    # Four feature chips: only phrases grounded in the playbook's stated title/spec.
    features = spec["features"][:4]
    chip_y = 1990
    chip_h, chip_gap = 104, 28
    chip_xs = (190, 1520)
    chip_w = 1290
    for i, feature in enumerate(features):
        row, col = divmod(i, 2)
        x = chip_xs[col]
        y = chip_y + row * (chip_h + chip_gap)
        rounded(d, (x, y, x + chip_w, y + chip_h), 30, pale)
        # Tiny check mark in a solid circle.
        d.ellipse((x + 24, y + 27, x + 72, y + 75), fill=accent)
        d.line((x + 36, y + 51, x + 46, y + 61, x + 62, y + 40),
               fill=WHITE, width=6)
        ff = fitted_label(d, feature, chip_w - 125, 46, 32, False)
        d.text((x + 95, y + (chip_h - ff.size) // 2 - 3), feature,
               font=ff, fill=INK)

    # The proposed products are unmistakably not ready for sale.
    if spec.get("concept"):
        footer = "CONCEPT ONLY — BUILD AND VERIFY THE FILE BEFORE LISTING"
        footer_color = "#A64A2F"
    else:
        footer = "ILLUSTRATIVE COVER • SHOW A REAL PRODUCT SCREENSHOT IN PHOTO 2"
        footer_color = MUTED
    ff = F(29)
    centered_text(d, footer, SIZE / 2, 2460, ff, footer_color)

    return img


# 20 captured spreadsheet listings from the Q4 playbooks. Four proposed product
# concepts are kept in their own folder and clearly stamped as not-yet-built.
PRODUCTS: list[dict[str, Any]] = [
    dict(key="pet-sitting", title="Pet Sitting Business Spreadsheet",
         subtitle="Excel + Google Sheets · Dog walkers & pet sitters",
         theme="navy", columns=["Client / Pet", "Visit date", "Service", "Payment"],
         features=["Client booking", "Payment tracker", "Mileage log", "Income & profit"]),
    dict(key="bakery", title="Cottage Bakery Business Spreadsheet",
         subtitle="Excel + Google Sheets · Home bakers",
         theme="rust", columns=["Product", "Recipe cost", "Order", "Profit"],
         features=["Recipe costing", "Bakery inventory", "Order tracking", "Profit tracker"]),
    dict(key="craft-fair", title="Craft Fair Tracker Spreadsheet",
         subtitle="Excel + Google Sheets · Crochet & handmade sellers",
         theme="plum", columns=["Item", "Yarn cost", "Price", "Sales"],
         features=["Vendor sales", "Inventory log", "Yarn cost", "Pricing calculator"]),
    dict(key="construction", title="Construction Estimate Spreadsheet",
         subtitle="Excel + Google Sheets · Contractors",
         theme="blue", columns=["Job", "Materials", "Labor", "Estimate"],
         features=["Job costing", "Bid proposals", "Material takeoff", "Profit tracker"]),
    dict(key="catering", title="Catering Business Spreadsheet",
         subtitle="Excel + Google Sheets · Caterers & event pros",
         theme="gold", columns=["Event", "Guests", "Food cost", "Invoice"],
         features=["Event planner", "Food cost calculator", "Client invoice", "Profit tracker"]),
    dict(key="christmas-gifts", title="Christmas Gift Tracker 2026",
         subtitle="Google Sheets · Holiday planning",
         theme="coral", columns=["Recipient", "Gift", "Budget", "Shipping"],
         features=["Gift list", "Holiday budget", "Shipping deadlines", "Sinking fund"]),
    dict(key="secret-santa", title="Secret Santa & White Elephant Tracker",
         subtitle="Excel + Google Sheets · Office, family & friends",
         theme="plum", columns=["Participant", "Gift", "Budget", "Exchange"],
         features=["Name picker", "Budget rules", "Party planner", "Gift exchange"]),
    dict(key="wedding", title="Wedding Planner Spreadsheet · 52 Tabs",
         subtitle="Excel + Google Sheets · Wedding planning",
         theme="rust", columns=["Vendor", "Payment", "Guest", "Status"],
         features=["Wedding budget", "Guest list", "Seating chart", "Vendor tracker"]),
    dict(key="travel", title="Travel Planner Spreadsheet",
         subtitle="Excel + Google Sheets · Trips & vacations",
         theme="teal", columns=["Date", "Destination", "Itinerary", "Budget"],
         features=["Trip itinerary", "Vacation budget", "Packing list", "Countdown"]),
    dict(key="investment", title="Rental Property Investment Analyzer",
         subtitle="Excel + Google Sheets · Real estate investors",
         theme="green", columns=["Property", "Cap rate", "Cash flow", "Return"],
         features=["Cap rate", "Cash flow", "Cash-on-cash", "DSCR & BRRRR"]),
    dict(key="church", title="Church Management Spreadsheet",
         subtitle="Excel + Google Sheets · Ministry administration",
         theme="blue", columns=["Member", "Group", "Donation", "Schedule"],
         features=["Member directory", "Tithe & donations", "Volunteer schedule", "Church records"]),
    dict(key="renovation", title="Home Renovation Budget Spreadsheet",
         subtitle="Excel + Google Sheets · Remodel planning",
         theme="rust", columns=["Room", "Estimate", "Quote", "Actual"],
         features=["Remodel estimate", "Quote comparison", "Room-by-room budget", "Expense tracker"]),
    dict(key="school", title="School Management Spreadsheet for Teachers",
         subtitle="Excel template · School administration",
         theme="blue", columns=["Student", "Attendance", "Fees", "Grade"],
         features=["Student roster", "Attendance", "Fees tracking", "Gradebook"]),
    dict(key="bookkeeping", title="Small Business Bookkeeping Spreadsheet",
         subtitle="Excel + Google Sheets · Small business",
         theme="navy", columns=["Date", "Income", "Expense", "Category"],
         features=["Income & expense", "Profit & loss", "Tax prep", "Cash flow"]),
    dict(key="rental", title="Rental Property Management Spreadsheet",
         subtitle="Excel + Google Sheets · Landlords",
         theme="green", columns=["Tenant", "Unit", "Rent due", "Status"],
         features=["Tenant & lease", "Rent roll", "Maintenance log", "Landlord dashboard"]),
    dict(key="personal-finance", title="Personal Finance Spreadsheet Bundle",
         subtitle="Google Sheets · Household money planning",
         theme="green", columns=["Pay date", "Income", "Bills", "Balance"],
         features=["Budget by paycheck", "Debt snowball", "Savings goals", "Net worth"]),
    dict(key="mega-bundle", title="50 Spreadsheet Mega Bundle",
         subtitle="Excel + Google Sheets · Business & personal finance",
         theme="gold", columns=["Template", "Category", "Format", "Use"],
         features=["50 templates", "Business tools", "Personal finance", "Invoice & inventory"]),
    dict(key="lifestyle", title="Lifestyle Planner Spreadsheet Bundle",
         subtitle="Excel + Google Sheets · Daily life planning",
         theme="teal", columns=["Week", "Meal plan", "Habit", "Activity"],
         features=["Meal planner", "Habit tracker", "Fitness log", "Water & budget"]),
    dict(key="etsy-seller", title="Etsy Seller Spreadsheet Kit · 11 Templates",
         subtitle="Excel + Google Sheets · Shop owner tools",
         theme="coral", columns=["Order", "Fees", "Inventory", "Keyword"],
         features=["Profit & fees", "Inventory", "Order tracker", "SEO keyword log"]),
    dict(key="meal-planner", title="Excel Meal Planner Spreadsheet",
         subtitle="Excel + Google Sheets · Meal planning",
         theme="green", columns=["Day", "Meal", "Ingredients", "Nutrition"],
         features=["Weekly menu", "Auto grocery list", "Recipe organizer", "Nutrition & macros"]),
]

CONCEPTS: list[dict[str, Any]] = [
    dict(key="salon-concept", title="Salon Business Spreadsheet for Hairstylists",
         subtitle="Proposed product · not yet built",
         theme="plum", columns=["Client", "Appointment", "Commission", "Retail"],
         features=["Client booking", "Appointment log", "Commission tracker", "Retail inventory"],
         concept=True),
    dict(key="cleaning-concept", title="Cleaning Business Spreadsheet",
         subtitle="Proposed product · not yet built",
         theme="teal", columns=["Client", "Quote", "Schedule", "Invoice"],
         features=["Client quote calculator", "Recurring schedule", "Supplies cost", "Invoice tracker"],
         concept=True),
    dict(key="food-truck-concept", title="Food Truck Business Spreadsheet",
         subtitle="Proposed product · not yet built",
         theme="rust", columns=["Recipe", "Menu price", "Sales", "Event"],
         features=["Recipe costing", "Menu pricing", "Daily sales log", "Route & event log"],
         concept=True),
    dict(key="photography-concept", title="Photography Business Spreadsheet",
         subtitle="Proposed product · not yet built",
         theme="blue", columns=["Client", "Package", "Shot list", "Delivery"],
         features=["Client pipeline", "Package pricing", "Shot list", "Delivery & invoice"],
         concept=True),
]


def save_image(spec: dict[str, Any], folder: Path) -> dict[str, Any]:
    folder.mkdir(parents=True, exist_ok=True)
    img = render(spec)
    path = folder / f"{spec['key']}.png"
    img.save(path, "PNG", optimize=True)
    return {
        "key": spec["key"], "file": str(path.relative_to(OUT)),
        "title": spec["title"], "concept_only": bool(spec.get("concept")),
        "width": img.width, "height": img.height,
        "bytes": path.stat().st_size, "format": "PNG / RGB / opaque",
        "safe_content_band_y": [SAFE_TOP, SAFE_BOTTOM],
        "features": spec["features"],
    }


def make_gallery(items: list[dict[str, Any]]) -> None:
    existing_cards, concept_cards = [], []
    for item in items:
        rel = item["file"]
        flag = "<span class='flag'>CONCEPT — NOT BUILT</span>" if item["concept_only"] else ""
        card = f"""<article><a href='{rel}' download><img src='{rel}' alt='{item['title']}'></a>
          {flag}<h2>{item['title']}</h2><p>{' · '.join(item['features'])}</p>
          <a class='download' href='{rel}' download>Download PNG ↓</a></article>"""
        (concept_cards if item["concept_only"] else existing_cards).append(card)
    html = """<!doctype html><html lang='en'><head><meta charset='utf-8'>
    <meta name='viewport' content='width=device-width,initial-scale=1'><title>NovalityStore Spreadsheet Thumbnails</title>
    <style>
    *{box-sizing:border-box}body{margin:0;background:#f7f5f0;color:#1d2b3d;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
    main{max-width:1500px;margin:0 auto;padding:40px 24px}h1{margin:0 0 6px;font-size:30px}header p{color:#647184;margin:0 0 28px}
    section{margin:34px 0 12px;font-size:22px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
    article{background:#fff;border:1px solid #e3e0d8;border-radius:14px;padding:12px;box-shadow:0 3px 12px #1d2b3d0a}
    img{display:block;width:100%;height:auto;border-radius:9px}h2{font-size:16px;margin:12px 3px 4px}article p{font-size:13px;color:#687486;margin:0 3px 12px}
    .download{display:inline-block;margin:0 3px 4px;color:#a94f36;font-size:14px;font-weight:650;text-decoration:none}
    .flag{display:inline-block;margin:10px 2px 0;background:#fff1e7;color:#9c452d;border-radius:30px;padding:4px 10px;font-size:11px;font-weight:700}
    .notice{border-left:4px solid #bd694b;padding:10px 14px;background:#fff;border-radius:6px;color:#526074;margin:18px 0}
    </style></head><body><main><header><h1>NovalityStore — Spreadsheet Thumbnail Pack</h1>
    <p>20 existing listing covers + 4 separate new-product concepts · 3000×3000 px · PNG</p>
    <div class='notice'><b>Transparency:</b> worksheet visuals are illustrative, not screenshots of the actual files.
    Add a genuine product screenshot as listing photo 2. Four concept images are for products not yet built — do not publish them until the files exist and features are verified.</div>
    </header><section>Existing shop listings (20)</section><div class='grid'>""" + "".join(existing_cards) + """</div>
    <section>New product concepts (4 — not ready to publish)</section><div class='grid'>""" + "".join(concept_cards) + """</div>
    </main></body></html>"""
    (OUT / "index.html").write_text(html, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--existing", action="store_true", help="build only the 20 live listing covers")
    group.add_argument("--concepts", action="store_true", help="build only the 4 new-product concept covers")
    parser.add_argument("--list", action="store_true", help="list product keys")
    args = parser.parse_args()

    if args.list:
        for group_name, products in (("EXISTING", PRODUCTS), ("CONCEPTS — NOT YET BUILT", CONCEPTS)):
            print(group_name)
            for p in products:
                print(f"  {p['key']:<24} {p['title']}")
        return 0

    if args.existing:
        selected = PRODUCTS
    elif args.concepts:
        selected = CONCEPTS
    else:
        selected = PRODUCTS + CONCEPTS

    manifest = []
    for spec in selected:
        folder = OUT / ("new-product-concepts" if spec.get("concept") else "existing-listings")
        item = save_image(spec, folder)
        manifest.append(item)
        print(f"{item['file']:<48} {item['bytes']/1024:6.1f} KB")

    manifest_path = OUT / "thumbnail-manifest.json"
    existing_manifest = []
    if args.existing or args.concepts:
        if manifest_path.exists():
            try:
                existing_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                existing_manifest = []
    by_key = {x["key"]: x for x in existing_manifest}
    by_key.update({x["key"]: x for x in manifest})
    all_items = [by_key[k] for k in sorted(by_key)]
    manifest_path.write_text(json.dumps(all_items, indent=2), encoding="utf-8")
    make_gallery(all_items)

    print(f"\nBuilt {len(manifest)} image(s); max {max(x['bytes'] for x in manifest)/1024:.1f} KB each.")
    print(f"Gallery: {OUT / 'index.html'}")
    print(f"Manifest: {manifest_path}")
    print("All are opaque 3000x3000 RGB PNGs with crop-safe text placement.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
