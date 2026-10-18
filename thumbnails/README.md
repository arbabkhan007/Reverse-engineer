# NovalityStore spreadsheet listing covers

This pack contains **20 covers for spreadsheet listings already captured from the shop** and **4 concept-only covers** for the proposed Salon, Cleaning, Food Truck, and Photography products.

## File specs

- PNG, RGB (opaque; no transparency)
- 3000 × 3000 pixels, square
- Every image under 1 MB
- Main content kept inside the centered crop-safe band
- Built above Etsy's official recommendation of at least 2000 px in both dimensions; the first listing photo must be at least 635 × 635 px to avoid appearing lower in search. See [Etsy's photo requirements](https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop).

## Important honesty note

The workspace did not contain the actual spreadsheet files or screenshots. Therefore, the worksheet grid in each cover is explicitly marked **ILLUSTRATIVE PREVIEW** and is not presented as a screenshot of the product. For best buyer trust, add a real screenshot of the actual file as listing photo 2, and make sure the feature callouts match the delivered spreadsheet.

The four images in `new-product-concepts/` are labelled **NEW PRODUCT CONCEPT** and **CONCEPT ONLY — BUILD AND VERIFY THE FILE BEFORE LISTING**. They are not ready-to-publish listings until those products exist and their claims are confirmed.

## Folders

- `existing-listings/` — 20 covers for the captured spreadsheet listings
- `new-product-concepts/` — 4 clearly marked concepts, separate from the live listings
- `index.html` — visual gallery; click an image to download its PNG
- `thumbnail-manifest.json` — file names, dimensions, feature labels, and byte sizes

To regenerate from the repository root, install Pillow (`python3 -m pip install Pillow`) and run `python3 make_thumbnails.py`.
