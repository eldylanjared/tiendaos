"""Auto-categorize products without a category using keyword matching."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal, init_db
from app.models.product import Product, Category

# Keywords mapped to category names (case-insensitive matching)
KEYWORD_RULES = [
    # Bebidas
    (["coca-cola", "coca cola", "pepsi", "fanta", "sprite", "7up", "manzanita",
      "jarrito", "squirt", "fresca", "sidral", "delaware", "joya",
      "agua ciel", "agua bonafont", "epura", "pureza", "electrolit",
      "jumex", "del valle", "boing", "arizona", "v8", "vive 100",
      "monster", "red bull", "gatorade", "powerade", "peñafiel",
      "tang", "jugo", "refresco", "limonada", "horchata", "jamaica",
      "naranjada", "desechable 2", "desechable 3", "600ml", "355ml",
      "1l", "1.5l", "2l", "2.5l", "3l", "473ml", "250ml", "335ml",
      "lata", "pet"], "Bebidas"),
    # Lacteos
    (["leche lala", "leche entera", "leche light", "leche deslactosada",
      "yoghurt", "yogurt", "yoplait", "danone", "yakult", "media crema",
      "crema lala", "queso", "mantequilla", "margarina"], "Lacteos"),
    # Botanas Sabritas
    (["sabritas", "doritos", "cheetos", "ruffles", "tostitos", "fritos",
      "3d", "sabritones"], "Botanas Sabritas"),
    # Botanas Varias
    (["cacahuate", "semilla", "pistache", "nuez", "almendra",
      "palomitas", "act ii"], "Botanas Varias"),
    # Takis
    (["takis", "mini taki"], "Takis"),
    # Pan Dulce / Panaderia
    (["bimbo", "marinela", "gansito", "conchas", "cuernito",
      "mantecadas", "nito", "panque", "wonder", "submarinos",
      "barritas", "roles"], "Pan Dulce"),
    # Pan de Caja
    (["pan blanco", "pan integral", "pan molido", "medias noches",
      "pan tostado", "pan caja"], "Pan de Caja / Molido"),
    # Galletas
    (["galleta", "emperador", "chokis", "oreo", "principe",
      "maria", "animalito"], "Galletas Empacadas"),
    # Dulces
    (["mazapan", "de la rosa", "chicle", "trident", "paleta",
      "gomita", "pandita", "pelon pelo", "lucas", "skwinkle",
      "bubulubu", "duvalin", "carlos v", "milky way", "snickers",
      "m&m", "chocolate", "luneta", "pulparindo"], "Chocolates / Dulces"),
    # Maruchan / Sopas
    (["maruchan", "nissin", "sopa", "instant"], "Dulces / Condimentos Dulces"),
    # Frutas y verduras
    (["plátano", "platano", "manzana", "limon", "limón", "naranja",
      "aguacate", "tomate", "jitomate", "cebolla", "chile",
      "papa", "zanahoria", "lechuga", "pepino", "piña", "melón",
      "sandía", "sandia", "uva", "fresa", "mango", "pera",
      "durazno"], "Frutas y Verduras"),
    # Limpieza
    (["fabuloso", "pinol", "cloralex", "ariel", "ace", "downy",
      "suavitel", "papel higiénico", "papel higienico", "regio",
      "petalo", "servilleta", "bolsa basura", "escoba", "trapeador",
      "jabón zote", "jabon zote", "jabón roma", "jabon roma",
      "cloro", "detergente", "desinfectante"], "Limpieza / Hogar"),
    # Higiene
    (["shampoo", "jabón de baño", "jabon de baño", "pasta dental",
      "colgate", "cepillo dental", "desodorante", "toalla sanitaria",
      "kotex", "saba", "rastrillo", "gillette", "speed stick"], "Higiene Personal"),
    # Cigarros
    (["marlboro", "malboro", "camel", "pall mall", "montana",
      "cigarro", "delicado"], "Cigarros"),
]


def main():
    init_db()
    db = SessionLocal()

    # Build category name -> id map
    categories = db.query(Category).all()
    cat_map = {c.name: c.id for c in categories}

    uncategorized = db.query(Product).filter(Product.category_id == None).all()
    print(f"{len(uncategorized)} uncategorized products")

    assigned = 0
    still_uncategorized = []

    for product in uncategorized:
        name_lower = product.name.lower()
        matched = False

        for keywords, cat_name in KEYWORD_RULES:
            if cat_name not in cat_map:
                continue
            for kw in keywords:
                if kw.lower() in name_lower:
                    product.category_id = cat_map[cat_name]
                    assigned += 1
                    matched = True
                    break
            if matched:
                break

        if not matched:
            still_uncategorized.append(product.name)

    db.commit()
    db.close()

    print(f"\nAuto-categorized: {assigned}")
    print(f"Still uncategorized: {len(still_uncategorized)}")
    if still_uncategorized:
        print("\nRemaining uncategorized products:")
        for name in still_uncategorized[:50]:
            print(f"  - {name}")
        if len(still_uncategorized) > 50:
            print(f"  ... and {len(still_uncategorized) - 50} more")


if __name__ == "__main__":
    main()
