"""Import products from 'Producto (product.template).csv' (Odoo export) into TiendaOS.

Handles:
- Adding new products
- Updating prices/costs for existing products
- Fixing generated barcodes (GEN-*) when CSV has a real barcode
"""
import csv
import hashlib
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal, init_db
from app.models.product import Product

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "Producto (product.template).csv")

# Also check Downloads folder if local copy not found
if not os.path.exists(CSV_PATH):
    CSV_PATH = os.path.expanduser("~/Downloads/Producto (product.template).csv")


def main():
    init_db()
    db = SessionLocal()

    added = 0
    updated = 0
    skipped = 0
    errors = 0
    barcodes_fixed = 0
    seen_barcodes = set()

    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("Nombre", "").strip()
            price_str = row.get("Precio de venta", "0").strip()
            cost_str = row.get("Costo", "0").strip()
            barcode = row.get("Código de barras", "").strip()

            if not name:
                errors += 1
                continue

            try:
                price = float(price_str)
                cost = float(cost_str)
            except ValueError:
                errors += 1
                continue

            if price <= 0:
                errors += 1
                continue

            # Determine the real barcode from CSV, or generate one
            real_barcode = barcode if barcode else None
            db_barcode = barcode if barcode else "GEN-" + hashlib.md5(name.encode()).hexdigest()[:12].upper()

            # Skip duplicates within CSV
            if db_barcode in seen_barcodes:
                skipped += 1
                continue
            seen_barcodes.add(db_barcode)

            # Look up existing product: by real barcode, by generated barcode, or by name
            existing = db.query(Product).filter(Product.barcode == db_barcode).first()
            if not existing and real_barcode:
                gen_barcode = "GEN-" + hashlib.md5(name.encode()).hexdigest()[:12].upper()
                existing = db.query(Product).filter(Product.barcode == gen_barcode).first()
            if not existing:
                existing = db.query(Product).filter(Product.name == name).first()

            if existing:
                changed = False

                # Fix generated barcode if we now have a real one
                if real_barcode and existing.barcode.startswith("GEN-"):
                    existing.barcode = real_barcode
                    barcodes_fixed += 1
                    changed = True

                # Update price/cost if different
                if existing.price != price or existing.cost != cost:
                    existing.price = price
                    existing.cost = cost
                    changed = True

                if changed:
                    updated += 1
                else:
                    skipped += 1
                continue

            product = Product(
                barcode=db_barcode,
                name=name,
                price=price,
                cost=cost,
                stock=0,
                min_stock=5,
            )
            db.add(product)
            db.flush()
            added += 1

            if added % 200 == 0:
                db.commit()
                print(f"  ... {added} products added so far")

    db.commit()
    db.close()

    print(f"\nImport complete:")
    print(f"  Added:    {added}")
    print(f"  Updated:  {updated} (price/cost/barcode changed)")
    print(f"  Barcodes: {barcodes_fixed} fixed (GEN-* replaced with real barcode)")
    print(f"  Skipped:  {skipped} (no changes needed)")
    print(f"  Errors:   {errors} (bad/empty rows)")


if __name__ == "__main__":
    main()
