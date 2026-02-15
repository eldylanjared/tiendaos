"""
Business Insights Module

Allows natural language questions about business data:
- "¿Qué se vendió más la semana pasada?"
- "¿Cuál tienda tiene mejor rendimiento?"
- "Compara ventas de lunes vs viernes"

Translates questions into data queries, then uses LLM to narrate results.
"""

from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai import llm
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are a business intelligence assistant for a chain of convenience stores in Mexico.
You receive sales data and answer questions about it clearly and concisely.
Always respond in Spanish.
Use tables when comparing data. Format currency as $ MXN.
Be specific with numbers — don't just say "sold well", say "vendió 245 unidades ($4,532 MXN)"."""


def _gather_context(db: Session, days: int = 7) -> str:
    """Build a text summary of recent sales data for the LLM."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Total sales
    total_result = (
        db.query(func.count(Sale.id), func.sum(Sale.total))
        .filter(Sale.status == "completed", Sale.created_at >= cutoff)
        .first()
    )
    txn_count = total_result[0] or 0
    total_revenue = total_result[1] or 0

    # Top products by revenue
    top_products = (
        db.query(
            SaleItem.product_name,
            func.sum(SaleItem.quantity).label("qty"),
            func.sum(SaleItem.line_total).label("revenue"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.status == "completed", Sale.created_at >= cutoff)
        .group_by(SaleItem.product_name)
        .order_by(func.sum(SaleItem.line_total).desc())
        .limit(15)
        .all()
    )

    # Sales by day of week
    # SQLite: strftime('%w', date), PostgreSQL: extract(dow from date)
    daily_sales = (
        db.query(
            func.strftime("%w", Sale.created_at).label("dow"),
            func.count(Sale.id).label("txns"),
            func.sum(Sale.total).label("revenue"),
        )
        .filter(Sale.status == "completed", Sale.created_at >= cutoff)
        .group_by("dow")
        .all()
    )

    # Sales by hour
    hourly = (
        db.query(
            func.strftime("%H", Sale.created_at).label("hour"),
            func.count(Sale.id).label("txns"),
        )
        .filter(Sale.status == "completed", Sale.created_at >= cutoff)
        .group_by("hour")
        .order_by("hour")
        .all()
    )

    # Low stock products
    low_stock = (
        db.query(Product.name, Product.stock, Product.min_stock)
        .filter(Product.is_active == True, Product.stock <= Product.min_stock)
        .all()
    )

    dow_names = {
        "0": "Domingo", "1": "Lunes", "2": "Martes", "3": "Miércoles",
        "4": "Jueves", "5": "Viernes", "6": "Sábado",
    }

    lines = [
        f"DATOS DE VENTAS — Últimos {days} días (Tienda: {settings.store_name})",
        f"Total transacciones: {txn_count}",
        f"Ingreso total: ${total_revenue:,.2f} MXN",
        f"Ticket promedio: ${(total_revenue / txn_count if txn_count else 0):,.2f} MXN",
        "",
        "TOP PRODUCTOS POR INGRESO:",
    ]
    for p in top_products:
        lines.append(f"  - {p.product_name}: {p.qty} uds, ${p.revenue:,.2f}")

    lines.append("\nVENTAS POR DÍA DE LA SEMANA:")
    for d in daily_sales:
        name = dow_names.get(d.dow, d.dow)
        lines.append(f"  - {name}: {d.txns} txns, ${d.revenue:,.2f}")

    lines.append("\nVENTAS POR HORA:")
    for h in hourly:
        lines.append(f"  - {h.hour}:00 — {h.txns} transacciones")

    if low_stock:
        lines.append("\nPRODUCTOS CON BAJO INVENTARIO:")
        for ls in low_stock:
            lines.append(f"  - {ls.name}: {ls.stock} uds (mín: {ls.min_stock})")

    return "\n".join(lines)


async def ask(question: str, db: Session, days: int = 7, force_cloud: bool = False) -> str:
    """
    Answer a natural language question about business data.
    Gathers recent sales context, then sends it + the question to the LLM.
    """
    context = _gather_context(db, days)

    prompt = (
        f"Usando los siguientes datos de la tienda:\n\n{context}\n\n"
        f"Pregunta del usuario: {question}\n\n"
        f"Responde de forma clara, concisa y con datos específicos."
    )

    return await llm.query(prompt, system=SYSTEM_PROMPT, force_cloud=force_cloud)
