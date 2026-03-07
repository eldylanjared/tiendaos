"""Import categories from 'base de datos productos.csv' and assign them to existing products.

The CSV has columns: id, category_id, name, ??, barcode, stock, price, active, date
Category IDs are mapped to Spanish category names based on product groupings.
"""
import csv
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal, init_db
from app.models.product import Product, Category

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "base de datos productos.csv")

# Category mapping derived from product groupings
CATEGORY_MAP = {
    "2": ("Botanas Sabritas", "#EF4444"),
    "3": ("Galletas a Granel", "#F59E0B"),
    "4": ("Galletas Empacadas", "#F97316"),
    "5": ("Pan Dulce", "#D97706"),
    "6": ("Pan de Caja / Molido", "#92400E"),
    "7": ("Frituras / Chicharron", "#DC2626"),
    "10": ("Botanas Varias", "#E11D48"),
    "11": ("Lacteos", "#3B82F6"),
    "12": ("Bebidas", "#06B6D4"),
    "13": ("Micheladas / Chamoy", "#8B5CF6"),
    "16": ("Dulces / Condimentos Dulces", "#EC4899"),
    "17": ("Limpieza / Hogar", "#14B8A6"),
    "18": ("Desechables / Plasticos", "#6B7280"),
    "19": ("Panales / Bebe", "#A78BFA"),
    "20": ("Higiene Personal", "#2DD4BF"),
    "21": ("Farmacia / Remedios", "#10B981"),
    "22": ("Leche Sabor", "#60A5FA"),
    "24": ("Ferreteria", "#78716C"),
    "25": ("Chocolates / Dulces", "#F472B6"),
    "26": ("Aceites / Automotriz", "#475569"),
    "28": ("Botanas Sueltas", "#FB923C"),
    "30": ("Botanas Importadas", "#FBBF24"),
    "31": ("Takis", "#B91C1C"),
    "32": ("Farmacia / Curacion", "#059669"),
    "33": ("Cigarros", "#64748B"),
    "34": ("Papeleria / Escolar", "#7C3AED"),
    "35": ("Electronica / Cables", "#0EA5E9"),
    "36": ("Chocolates Ricolino", "#DB2777"),
}


def main():
    init_db()
    db = SessionLocal()

    # Create categories
    cat_id_map = {}  # csv_cat_id -> db Category object
    created = 0
    for csv_id, (name, color) in CATEGORY_MAP.items():
        existing = db.query(Category).filter(Category.name == name).first()
        if existing:
            cat_id_map[csv_id] = existing
            print(f"  Category exists: {name}")
        else:
            cat = Category(name=name, color=color)
            db.add(cat)
            db.flush()
            cat_id_map[csv_id] = cat
            created += 1
            print(f"  Created category: {name} ({color})")

    db.commit()
    print(f"\nCategories: {created} created, {len(CATEGORY_MAP) - created} already existed")

    # Read CSV and assign categories to products by barcode match
    assigned = 0
    not_found = 0
    already_set = 0

    with open(CSV_PATH, encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 7:
                continue

            csv_cat_id = row[1].strip()
            name = row[2].strip()
            barcode = row[4].strip()

            if csv_cat_id not in cat_id_map:
                continue

            category = cat_id_map[csv_cat_id]

            # Find product by barcode first, then by name
            product = None
            if barcode and barcode != "----":
                product = db.query(Product).filter(Product.barcode == barcode).first()
            if not product:
                product = db.query(Product).filter(Product.name == name).first()

            if not product:
                not_found += 1
                continue

            if product.category_id:
                already_set += 1
                continue

            product.category_id = category.id
            assigned += 1

            if assigned % 100 == 0:
                db.commit()
                print(f"  ... {assigned} products assigned so far")

    db.commit()
    db.close()

    print(f"\nAssignment complete:")
    print(f"  Assigned:    {assigned}")
    print(f"  Already set: {already_set}")
    print(f"  Not found:   {not_found} (product not in DB)")


if __name__ == "__main__":
    main()
