"""Fetch product images from Open Food Facts by barcode and self-host them.

Walks active products that have no image, looks each up in Open Food Facts by
its EAN barcode, downloads the front image, saves it under the same folder
manual uploads use (backend/data/product_images), and sets image_url so the
POS serves it locally (works offline).

Idempotent: products that already have an image are skipped, so it is safe to
re-run — misses (barcodes not yet in Open Food Facts) are simply retried and
may resolve later.

Usage (from repo root, using the backend venv):
    backend/.venv/bin/python scripts/fetch_product_images.py            # all missing
    backend/.venv/bin/python scripts/fetch_product_images.py --limit 15 # test a few
"""
import argparse
import os
import sys
import time
import uuid

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal  # noqa: E402
from app.models.product import Product  # noqa: E402

BACKEND = os.path.join(os.path.dirname(__file__), "..", "backend")
IMG_DIR = os.path.abspath(os.path.join(BACKEND, "data", "product_images"))
os.makedirs(IMG_DIR, exist_ok=True)

OFF_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
OFF_FIELDS = "image_front_url,image_url"
# Open Food Facts asks every caller to identify itself with a real User-Agent.
HEADERS = {"User-Agent": "TiendaOS/1.0 (dylan@automatehumans.io)"}

CONTENT_TYPE_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def is_lookupable(barcode: str) -> bool:
    """Only query real numeric EAN/UPC barcodes (skip internal codes like SAMPLE-*)."""
    return barcode.isdigit() and 8 <= len(barcode) <= 14


def fetch_image_url(client: httpx.Client, barcode: str) -> str | None:
    try:
        r = client.get(
            OFF_URL.format(barcode=barcode),
            params={"fields": OFF_FIELDS},
            headers=HEADERS,
            timeout=15,
        )
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    data = r.json()
    if data.get("status") != 1:  # 0 = product not found
        return None
    product = data.get("product", {}) or {}
    return product.get("image_front_url") or product.get("image_url") or None


def download_image(client: httpx.Client, url: str) -> tuple[bytes, str] | None:
    try:
        r = client.get(url, headers=HEADERS, timeout=30)
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    ctype = r.headers.get("content-type", "").split(";")[0].strip().lower()
    ext = CONTENT_TYPE_EXT.get(ctype)
    if not ext:
        return None
    content = r.content
    if not content or len(content) > 5 * 1024 * 1024:  # sanity: skip empty / >5MB
        return None
    return content, ext


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max products to process (0 = all)")
    ap.add_argument("--delay", type=float, default=0.3, help="seconds between lookups")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        q = db.query(Product).filter(
            Product.is_active == True,  # noqa: E712
            (Product.image_url == None) | (Product.image_url == ""),  # noqa: E711
        ).order_by(Product.name)
        products = q.all()
    finally:
        pass

    total = len(products)
    if args.limit:
        products = products[: args.limit]
    print(f"{total} products without image; processing {len(products)}")

    downloaded = no_off = no_img = skipped = errors = 0
    with httpx.Client(follow_redirects=True) as client:
        for i, p in enumerate(products, 1):
            if not is_lookupable(p.barcode or ""):
                skipped += 1
                continue

            img_url = fetch_image_url(client, p.barcode)
            time.sleep(args.delay)  # be polite to Open Food Facts
            if not img_url:
                no_off += 1
                continue

            got = download_image(client, img_url)
            if not got:
                no_img += 1
                continue
            content, ext = got

            try:
                filename = f"{uuid.uuid4().hex}{ext}"
                with open(os.path.join(IMG_DIR, filename), "wb") as f:
                    f.write(content)
                p.image_url = f"/api/products/image/{filename}"
                downloaded += 1
            except Exception as e:  # noqa: BLE001
                errors += 1
                print(f"  ! {p.barcode} {p.name}: {e}")
                continue

            if downloaded % 25 == 0:
                db.commit()
                print(f"  [{i}/{len(products)}] downloaded={downloaded} "
                      f"no_off={no_off} no_img={no_img}")

    db.commit()
    db.close()
    print("\n=== done ===")
    print(f"downloaded={downloaded}  not_in_off={no_off}  no_usable_image={no_img}  "
          f"skipped_nonEAN={skipped}  errors={errors}")


if __name__ == "__main__":
    main()
