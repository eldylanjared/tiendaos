"""Import products from 'Producto (product.template).csv' (Odoo export) into TiendaOS."""
import csv
import hashlib
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal, init_db
from app.models.product import Product

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "Producto (product.template).csv")


def main():
    init_db()
    db = SessionLocal()

    added = 0
    skipped = 0
    errors = 0
    seen_barcodes = set()

    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("Nombre", "").strip()
            price_str = row.get("Precio de venta", "0").strip()
            cost_str = row.get("Costo", "0").strip()
            barcode = row.get("Referencia interna", "").strip()

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

            # Use barcode if provided, otherwise generate from name
            if not barcode:
                barcode = "GEN-" + hashlib.md5(name.encode()).hexdigest()[:12].upper()

            # Skip duplicates
            if barcode in seen_barcodes:
                skipped += 1
                continue
            seen_barcodes.add(barcode)

            existing = db.query(Product).filter(Product.barcode == barcode).first()
            if existing:
                skipped += 1
                continue

            # Check if product with same name already exists
            existing_name = db.query(Product).filter(Product.name == name).first()
            if existing_name:
                skipped += 1
                continue

            product = Product(
                barcode=barcode,
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
    print(f"  Added:   {added}")
    print(f"  Skipped: {skipped} (duplicate or already exists)")
    print(f"  Errors:  {errors} (bad/empty rows)")


if __name__ == "__main__":
    main()
