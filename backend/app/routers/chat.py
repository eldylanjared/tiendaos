"""
Free-form chat assistant — understands natural language, confirms before acting.
Supports text commands AND receipt photo uploads (OCR → finance entry).

Flow:
1. User says anything naturally or sends a receipt photo
2. Bot parses intent + entities, shows what it will do, asks for confirmation
3. User says "si" / "yes" / "confirmar" → bot executes
4. Max 1 action per message (no bulk), max 5 pending per session
"""
import os
import re
import uuid as _uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product, ProductBarcode, Category
from app.models.finance import FinanceEntry
from app.models.user import User
from app.config import get_settings
from app.services.auth import get_current_user, require_role

settings = get_settings()
router = APIRouter(prefix="/api/chat", tags=["chat"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory pending actions per user (cleared on confirm/cancel/timeout)
_pending: dict[str, dict] = {}
# Track how many actions executed this session (reset on "listo"/"clear")
_action_counts: dict[str, int] = {}
MAX_ACTIONS = 5

EXPENSE_CATEGORIES = [
    "proveedores", "renta", "servicios", "nomina", "transporte",
    "mantenimiento", "impuestos", "publicidad", "varios",
]
INCOME_CATEGORIES = [
    "ventas_efectivo", "ventas_tarjeta", "otros_ingresos", "prestamo", "devolucion",
]
ALL_CATEGORIES = EXPENSE_CATEGORIES + INCOME_CATEGORIES


class ChatResponse(BaseModel):
    reply: str
    action: str | None = None
    pending: bool = False  # true = waiting for confirmation


def find_product(db: Session, identifier: str) -> Product | None:
    identifier = identifier.strip()
    if not identifier:
        return None
    p = db.query(Product).filter(Product.barcode == identifier, Product.is_active == True).first()
    if p:
        return p
    pack = db.query(ProductBarcode).filter(ProductBarcode.barcode == identifier).first()
    if pack:
        return db.query(Product).filter(Product.id == pack.product_id).first()
    p = db.query(Product).filter(Product.name.ilike(f"%{identifier}%"), Product.is_active == True).first()
    return p


def extract_numbers(text: str) -> list[float]:
    """Extract all numbers from text."""
    nums = re.findall(r"\$?\s*([\d,]+\.?\d*)", text)
    result = []
    for n in nums:
        try:
            result.append(float(n.replace(",", "")))
        except ValueError:
            pass
    return result


def extract_barcode(text: str) -> str | None:
    """Find a barcode-like number (6+ digits)."""
    matches = re.findall(r"\b(\d{6,14})\b", text)
    return matches[0] if matches else None


def extract_category(text: str) -> str | None:
    """Find a finance category in the text."""
    lower = text.lower()
    for cat in ALL_CATEGORIES:
        if cat in lower:
            return cat
    # Fuzzy: check for partial matches
    cat_aliases = {
        "proveedor": "proveedores", "luz": "servicios", "agua": "servicios",
        "telefono": "servicios", "internet": "servicios", "sueldo": "nomina",
        "salario": "nomina", "gasolina": "transporte", "impuesto": "impuestos",
        "efectivo": "ventas_efectivo", "tarjeta": "ventas_tarjeta",
    }
    for alias, cat in cat_aliases.items():
        if alias in lower:
            return cat
    return None


def extract_product_ref(text: str, db: Session) -> Product | None:
    """Try to find a product reference in the text."""
    # Try barcode first
    bc = extract_barcode(text)
    if bc:
        p = find_product(db, bc)
        if p:
            return p

    # Remove common command words and try the rest as product name
    cleaned = re.sub(
        r"\b(cambiar?|precio|costo|cost[oe]?|pesos?|ponle|ponlo|subir|bajar|"
        r"agregar?|quitar|stock|unidades?|el|la|los|las|de|del|al|a|en|que|"
        r"por favor|mxn|\$|actualizar?|modificar?)\b",
        "", text.lower()
    )
    cleaned = re.sub(r"\d+\.?\d*", "", cleaned)  # remove numbers
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    if len(cleaned) >= 3:
        p = find_product(db, cleaned)
        if p:
            return p
    return None


def detect_intent(text: str) -> str:
    """Score-based intent detection from free text."""
    lower = text.lower()
    scores: dict[str, int] = {
        "price_change": 0,
        "cost_change": 0,
        "stock_add": 0,
        "stock_remove": 0,
        "expense": 0,
        "income": 0,
        "search": 0,
        "category_change": 0,
    }

    # Price signals
    for w in ["precio", "price", "ponle", "ponlo", "subir precio", "bajar precio", "cobrar", "vale", "cueste"]:
        if w in lower:
            scores["price_change"] += 3
    if re.search(r"\b\d+\s*pesos\b", lower):
        scores["price_change"] += 1

    # Cost signals
    for w in ["costo", "cost", "me cuesta", "cuesta", "compro a"]:
        if w in lower:
            scores["cost_change"] += 3

    # Stock add signals
    for w in ["agregar", "sumar", "add", "llegaron", "recibir", "entrada", "meter"]:
        if w in lower:
            scores["stock_add"] += 3
    if re.search(r"(?:agregar?|sumar?|meter|llegaron?)\s+\d+", lower):
        scores["stock_add"] += 2

    # Stock remove signals
    for w in ["quitar", "restar", "sacar", "remove", "salida", "merma"]:
        if w in lower:
            scores["stock_remove"] += 3

    # Expense signals
    for w in ["gasto", "expense", "pague", "pagar", "recibo", "factura", "compre"]:
        if w in lower:
            scores["expense"] += 3

    # Income signals
    for w in ["ingreso", "income", "cobr", "recibi", "me pagaron", "entrada de dinero"]:
        if w in lower:
            scores["income"] += 3

    # Search signals
    for w in ["buscar", "search", "donde", "cuanto", "tiene", "hay", "info", "ver"]:
        if w in lower:
            scores["search"] += 2

    # Category signals
    for w in ["categoria", "category", "mover a", "clasificar", "poner en"]:
        if w in lower:
            scores["category_change"] += 3

    # Get top intent
    best = max(scores, key=lambda k: scores[k])
    if scores[best] == 0:
        return "unknown"
    return best


def format_product_short(p: Product) -> str:
    return f"**{p.name}** ({p.barcode}) — ${p.price:.2f}"


def process_message(msg: str, db: Session, user: User) -> ChatResponse:
    text = msg.strip()
    lower = text.lower().strip()
    user_id = user.id

    # --- Check for confirmation of pending action ---
    if user_id in _pending:
        pending = _pending[user_id]
        if lower in ("si", "sí", "yes", "confirmar", "dale", "ok", "hazlo", "adelante", "confirmo"):
            return execute_pending(user_id, db, user)
        elif lower in ("no", "cancelar", "cancel", "olvidalo", "nah", "nel"):
            del _pending[user_id]
            return ChatResponse(reply="Cancelado. ¿Que mas necesitas?")
        else:
            # They sent something else — cancel the pending and process new message
            del _pending[user_id]

    # --- Check action limit ---
    count = _action_counts.get(user_id, 0)
    if count >= MAX_ACTIONS:
        if lower in ("listo", "reset", "clear", "nueva sesion"):
            _action_counts[user_id] = 0
            return ChatResponse(reply="Contador reiniciado. ¿En que te ayudo?")
        return ChatResponse(
            reply=f"Ya hiciste {MAX_ACTIONS} cambios en esta sesion. Escribe **listo** para reiniciar el contador."
        )

    # --- Help ---
    if lower in ("help", "ayuda", "?", "comandos", "que puedes hacer"):
        return ChatResponse(reply=(
            "Puedes escribirme lo que necesites de forma natural. Algunos ejemplos:\n\n"
            "• *ponle 30 pesos al barcode 7501234567890*\n"
            "• *la coca cola subela a 25*\n"
            "• *agregar gasto de 500 de proveedores, compra de refrescos*\n"
            "• *llegaron 20 unidades de 7501234567890*\n"
            "• *buscar galletas*\n"
            "• *mover 7501234567890 a bebidas*\n\n"
            "Siempre te voy a preguntar antes de hacer cualquier cambio.\n"
            f"Maximo {MAX_ACTIONS} cambios por sesion (escribe **listo** para reiniciar)."
        ))

    # --- Categories list ---
    if lower in ("categorias", "categories", "cats", "ver categorias"):
        cats = db.query(Category).order_by(Category.name).all()
        if cats:
            lines = ["**Categorias de productos:**"]
            for c in cats:
                cnt = db.query(Product).filter(Product.category_id == c.id, Product.is_active == True).count()
                lines.append(f"• {c.name} ({cnt})")
            lines.append(f"\n**Categorias de gasto:** {', '.join(EXPENSE_CATEGORIES)}")
            lines.append(f"**Categorias de ingreso:** {', '.join(INCOME_CATEGORIES)}")
            return ChatResponse(reply="\n".join(lines))
        return ChatResponse(reply="No hay categorias registradas.")

    # --- Detect intent ---
    intent = detect_intent(text)
    numbers = extract_numbers(text)
    barcode = extract_barcode(text)

    if intent == "price_change":
        product = extract_product_ref(text, db)
        price = None
        for n in numbers:
            # Skip numbers that look like barcodes (6+ digits)
            if n < 100000 and n > 0:
                price = n
                break
        if not product:
            return ChatResponse(reply="¿De cual producto? Dame el barcode o nombre.")
        if price is None:
            return ChatResponse(reply=f"Encontre **{product.name}** (${product.price:.2f}). ¿A cuanto lo quieres poner?")
        _pending[user_id] = {
            "action": "price_change",
            "product_id": product.id,
            "product_name": product.name,
            "product_barcode": product.barcode,
            "old_value": product.price,
            "new_value": price,
        }
        return ChatResponse(
            reply=f"Voy a cambiar el precio de:\n**{product.name}** ({product.barcode})\n${product.price:.2f} → **${price:.2f}**\n\n¿Confirmas? (si/no)",
            pending=True,
        )

    if intent == "cost_change":
        product = extract_product_ref(text, db)
        cost = None
        for n in numbers:
            if n < 100000 and n > 0:
                cost = n
                break
        if not product:
            return ChatResponse(reply="¿De cual producto? Dame el barcode o nombre.")
        if cost is None:
            return ChatResponse(reply=f"Encontre **{product.name}** (costo: ${product.cost:.2f}). ¿Cual es el nuevo costo?")
        _pending[user_id] = {
            "action": "cost_change",
            "product_id": product.id,
            "product_name": product.name,
            "product_barcode": product.barcode,
            "old_value": product.cost,
            "new_value": cost,
        }
        return ChatResponse(
            reply=f"Voy a cambiar el costo de:\n**{product.name}** ({product.barcode})\n${product.cost:.2f} → **${cost:.2f}**\n\n¿Confirmas? (si/no)",
            pending=True,
        )

    if intent in ("stock_add", "stock_remove"):
        product = extract_product_ref(text, db)
        qty = None
        for n in numbers:
            if n < 100000 and n > 0 and n == int(n):
                qty = int(n)
                break
        if not product:
            return ChatResponse(reply="¿De cual producto? Dame el barcode o nombre.")
        if qty is None:
            return ChatResponse(reply=f"Encontre **{product.name}** (stock: {product.stock}). ¿Cuantas unidades?")
        if intent == "stock_remove":
            qty = -qty
        new_stock = max(0, product.stock + qty)
        _pending[user_id] = {
            "action": "stock_change",
            "product_id": product.id,
            "product_name": product.name,
            "product_barcode": product.barcode,
            "old_value": product.stock,
            "new_value": new_stock,
            "qty": qty,
        }
        direction = f"+{qty}" if qty > 0 else str(qty)
        return ChatResponse(
            reply=f"Voy a ajustar stock de:\n**{product.name}** ({product.barcode})\n{product.stock} → **{new_stock}** uds ({direction})\n\n¿Confirmas? (si/no)",
            pending=True,
        )

    if intent == "expense":
        amount = None
        for n in numbers:
            if 0 < n < 1000000:
                amount = n
                break
        category = extract_category(text)
        # Extract description — everything that's not the amount/category/command words
        desc = re.sub(
            r"\b(agregar?|gasto|expense|registrar?|pague|recibo|factura|compre|de|del|por|para|pesos?|\$)\b",
            "", lower
        )
        desc = re.sub(r"[\d,.$]+", "", desc)
        if category:
            desc = desc.replace(category, "")
        desc = re.sub(r"\s+", " ", desc).strip()

        if amount is None:
            return ChatResponse(reply="¿De cuanto es el gasto?")
        if category is None:
            return ChatResponse(
                reply=f"Gasto de **${amount:.2f}**. ¿En que categoria?\n{', '.join(EXPENSE_CATEGORIES)}"
            )
        _pending[user_id] = {
            "action": "expense",
            "amount": amount,
            "category": category,
            "description": desc[:100],
        }
        reply = f"Voy a registrar un gasto:\n**${amount:.2f}** — {category}"
        if desc:
            reply += f"\nDescripcion: {desc[:100]}"
        reply += "\n\n¿Confirmas? (si/no)"
        return ChatResponse(reply=reply, pending=True)

    if intent == "income":
        amount = None
        for n in numbers:
            if 0 < n < 1000000:
                amount = n
                break
        category = extract_category(text)
        desc = re.sub(
            r"\b(agregar?|ingreso|income|registrar?|cobr[eé]?|recibi|de|del|por|para|pesos?|\$)\b",
            "", lower
        )
        desc = re.sub(r"[\d,.$]+", "", desc)
        if category:
            desc = desc.replace(category, "")
        desc = re.sub(r"\s+", " ", desc).strip()

        if amount is None:
            return ChatResponse(reply="¿De cuanto es el ingreso?")
        if category is None:
            return ChatResponse(
                reply=f"Ingreso de **${amount:.2f}**. ¿En que categoria?\n{', '.join(INCOME_CATEGORIES)}"
            )
        _pending[user_id] = {
            "action": "income",
            "amount": amount,
            "category": category,
            "description": desc[:100],
        }
        reply = f"Voy a registrar un ingreso:\n**${amount:.2f}** — {category}"
        if desc:
            reply += f"\nDescripcion: {desc[:100]}"
        reply += "\n\n¿Confirmas? (si/no)"
        return ChatResponse(reply=reply, pending=True)

    if intent == "category_change":
        product = extract_product_ref(text, db)
        if not product:
            return ChatResponse(reply="¿De cual producto? Dame el barcode o nombre.")
        # Try to find category name in text
        cat_found = None
        for cat in db.query(Category).all():
            if cat.name.lower() in lower:
                cat_found = cat
                break
        if not cat_found:
            cats = db.query(Category).order_by(Category.name).all()
            cat_list = ", ".join(c.name for c in cats)
            return ChatResponse(reply=f"Encontre **{product.name}**. ¿A cual categoria?\n{cat_list}")
        _pending[user_id] = {
            "action": "category_change",
            "product_id": product.id,
            "product_name": product.name,
            "product_barcode": product.barcode,
            "category_id": cat_found.id,
            "category_name": cat_found.name,
        }
        return ChatResponse(
            reply=f"Voy a mover:\n**{product.name}** ({product.barcode}) → categoria **{cat_found.name}**\n\n¿Confirmas? (si/no)",
            pending=True,
        )

    if intent == "search":
        product = extract_product_ref(text, db)
        if product:
            cat_name = product.category.name if product.category else "Sin categoria"
            return ChatResponse(
                reply=(
                    f"**{product.name}**\n"
                    f"Barcode: {product.barcode}\n"
                    f"Precio: ${product.price:.2f} | Costo: ${product.cost:.2f}\n"
                    f"Stock: {product.stock} uds (min: {product.min_stock})\n"
                    f"Categoria: {cat_name}"
                ),
                action="search",
            )
        # Broader search
        search_text = re.sub(r"\b(buscar|search|find|ver|info|precio|cuanto|hay)\b", "", lower).strip()
        if search_text:
            results = (
                db.query(Product)
                .filter(Product.name.ilike(f"%{search_text}%"), Product.is_active == True)
                .limit(5)
                .all()
            )
            if results:
                lines = [f"Encontre {len(results)} producto(s):"]
                for p in results:
                    lines.append(f"• **{p.name}** — ${p.price:.2f} — {p.barcode}")
                return ChatResponse(reply="\n".join(lines), action="search")
        return ChatResponse(reply="No encontre ese producto. Intenta con el barcode o nombre exacto.")

    # --- Fallback: try product lookup ---
    product = extract_product_ref(text, db)
    if product:
        cat_name = product.category.name if product.category else "Sin categoria"
        return ChatResponse(
            reply=(
                f"**{product.name}**\n"
                f"Barcode: {product.barcode}\n"
                f"Precio: ${product.price:.2f} | Costo: ${product.cost:.2f}\n"
                f"Stock: {product.stock} uds\n"
                f"Categoria: {cat_name}\n\n"
                "¿Que quieres hacer con este producto?"
            ),
        )

    return ChatResponse(
        reply="No entendi bien. Puedes decirme cosas como:\n"
              "• *ponle 30 pesos al 7501234567890*\n"
              "• *gasto de 500 de proveedores*\n"
              "• *buscar coca cola*\n\n"
              "Escribe **ayuda** para mas ejemplos."
    )


def execute_pending(user_id: str, db: Session, user: User) -> ChatResponse:
    """Execute a confirmed pending action."""
    pending = _pending.pop(user_id)
    action = pending["action"]

    if action == "price_change":
        product = db.query(Product).filter(Product.id == pending["product_id"]).first()
        if not product:
            return ChatResponse(reply="Producto no encontrado.")
        old = product.price
        product.price = pending["new_value"]
        db.commit()
        _action_counts[user_id] = _action_counts.get(user_id, 0) + 1
        return ChatResponse(
            reply=f"Listo! Precio actualizado:\n**{product.name}** — ${old:.2f} → **${pending['new_value']:.2f}**",
            action="price_change",
        )

    if action == "cost_change":
        product = db.query(Product).filter(Product.id == pending["product_id"]).first()
        if not product:
            return ChatResponse(reply="Producto no encontrado.")
        old = product.cost
        product.cost = pending["new_value"]
        db.commit()
        _action_counts[user_id] = _action_counts.get(user_id, 0) + 1
        return ChatResponse(
            reply=f"Listo! Costo actualizado:\n**{product.name}** — ${old:.2f} → **${pending['new_value']:.2f}**",
            action="cost_change",
        )

    if action == "stock_change":
        product = db.query(Product).filter(Product.id == pending["product_id"]).first()
        if not product:
            return ChatResponse(reply="Producto no encontrado.")
        old = product.stock
        product.stock = pending["new_value"]
        db.commit()
        _action_counts[user_id] = _action_counts.get(user_id, 0) + 1
        return ChatResponse(
            reply=f"Listo! Stock actualizado:\n**{product.name}** — {old} → **{pending['new_value']}** uds",
            action="stock_change",
        )

    if action in ("expense", "income"):
        entry_date = pending.get("date", datetime.utcnow())
        if isinstance(entry_date, str):
            try:
                entry_date = datetime.strptime(entry_date, "%Y-%m-%d")
            except ValueError:
                entry_date = datetime.utcnow()
        entry = FinanceEntry(
            store_id=settings.store_id,
            user_id=user.id,
            entry_type=action if action == "income" else "expense",
            category=pending["category"],
            amount=pending["amount"],
            description=pending.get("description", ""),
            image_path=pending.get("image_path", ""),
            date=entry_date,
        )
        db.add(entry)
        db.commit()

        # Learn vendor mapping if we have a description from OCR
        if pending.get("image_path") and pending.get("description"):
            try:
                from app.services.receipt_parser import learn_vendor
                learn_vendor(db, pending["description"], pending["category"], action if action == "income" else "expense")
            except Exception:
                pass

        _action_counts[user_id] = _action_counts.get(user_id, 0) + 1
        label = "Ingreso" if action == "income" else "Gasto"
        return ChatResponse(
            reply=f"Listo! {label} registrado:\n**${pending['amount']:.2f}** — {pending['category']}",
            action=f"{action}_added",
        )

    if action == "category_change":
        product = db.query(Product).filter(Product.id == pending["product_id"]).first()
        if not product:
            return ChatResponse(reply="Producto no encontrado.")
        product.category_id = pending["category_id"]
        db.commit()
        _action_counts[user_id] = _action_counts.get(user_id, 0) + 1
        return ChatResponse(
            reply=f"Listo! **{product.name}** ahora esta en **{pending['category_name']}**",
            action="category_change",
        )

    return ChatResponse(reply="Algo salio mal. Intenta de nuevo.")


@router.post("")
async def chat(
    message: str = Form(""),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "manager")),
):
    # If image is attached, run OCR and propose a finance entry
    if image and image.filename:
        from app.services.receipt_parser import parse_receipt

        content = await image.read()
        if len(content) > 10 * 1024 * 1024:
            return ChatResponse(reply="Imagen muy grande (max 10MB).")

        # Save the image for later attachment
        ext = os.path.splitext(image.filename)[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".heic"):
            return ChatResponse(reply="Formato no soportado. Usa jpg, png o webp.")

        filename = f"{_uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(content)

        try:
            result = parse_receipt(content, db)
        except Exception:
            return ChatResponse(reply="No pude leer la imagen. Intenta con otra foto mas clara.")

        amount = result.get("amount", 0)
        category = result.get("category", "varios")
        entry_type = result.get("entry_type", "expense")
        description = result.get("description", "")
        date_str = result.get("date", "")
        confidence = result.get("confidence", "low")

        # Validate date — if too old or missing, use today
        display_date = "hoy"
        parsed_date = datetime.utcnow()
        if date_str:
            try:
                d = datetime.strptime(date_str, "%Y-%m-%d")
                one_year_ago = datetime.utcnow().replace(year=datetime.utcnow().year - 1)
                tomorrow = datetime.utcnow().replace(hour=23, minute=59)
                if one_year_ago <= d <= tomorrow:
                    parsed_date = d
                    display_date = date_str
            except ValueError:
                pass

        # Use user's message as override hint (e.g. "gasto de luz")
        hint = message.strip().lower() if message else ""
        if hint:
            # Check if user specified gasto/ingreso
            if any(w in hint for w in ["ingreso", "income", "cobr", "venta"]):
                entry_type = "income"
            elif any(w in hint for w in ["gasto", "expense", "pague", "compre"]):
                entry_type = "expense"
            # Check if user specified a category
            user_cat = extract_category(hint)
            if user_cat:
                category = user_cat

        label = "Ingreso" if entry_type == "income" else "Gasto"
        confidence_txt = (
            "Datos extraidos con confianza alta" if confidence == "high" else
            "Datos parciales — revisa" if confidence == "medium" else
            "No pude leer bien — revisa los datos"
        )

        _pending[user.id] = {
            "action": entry_type,
            "amount": amount,
            "category": category,
            "description": description,
            "date": parsed_date,
            "image_path": filename,
        }

        reply = f"Recibo procesado ({confidence_txt}):\n\n"
        reply += f"**{label}**: ${amount:.2f}\n"
        reply += f"**Categoria**: {category}\n"
        reply += f"**Fecha**: {display_date}\n"
        if description:
            reply += f"**Descripcion**: {description}\n"
        reply += "\n¿Confirmas? (si/no)"

        return ChatResponse(reply=reply, pending=True)

    # Text-only message
    return process_message(message, db, user)
