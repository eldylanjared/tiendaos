"""Import products from 'base de datos productos.csv' into TiendaOS database."""
import csv
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal, init_db
from app.models.product import Product

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "base de datos productos.csv")


def main():
    init_db()
    db = SessionLocal()

    added = 0
    skipped = 0
    errors = 0
    seen_barcodes = set()

    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 9:
                errors += 1
                continue

            name = row[2].strip()
            upc = row[4].strip()
            price_str = row[6].strip()

            if not upc or not name:
                errors += 1
                continue

            # Skip duplicate barcodes within the CSV
            if upc in seen_barcodes:
                skipped += 1
                continue
            seen_barcodes.add(upc)

            try:
                price = float(price_str)
            except ValueError:
                errors += 1
                continue

            # Skip if barcode already exists in DB
            existing = db.query(Product).filter(Product.barcode == upc).first()
            if existing:
                skipped += 1
                continue

            product = Product(
                barcode=upc,
                name=name,
                price=price,
                cost=0.0,
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
    print(f"  Errors:  {errors} (bad rows)")


if __name__ == "__main__":
    main()
