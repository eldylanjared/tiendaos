"""
Demand Forecasting Module

Analyzes sales history to predict:
- Which products need restocking and when
- Estimated quantities to order
- Seasonal patterns and trends

Runs on local GPU (Ollama) — zero cost for daily use.
"""

from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai import llm
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are a demand forecasting assistant for a convenience store in Mexico.
You analyze sales data and predict restocking needs.
Always respond in Spanish.
Be concise and actionable. Use bullet points.
Format currency as MXN with $ symbol."""


async def get_restock_suggestions(db: Session, days_history: int = 14) -> dict:
    """
    Analyze recent sales velocity and current stock to suggest restocks.
    Returns both a structured list and an AI-generated summary.
    """
    cutoff = datetime.utcnow() - timedelta(days=days_history)

    # Get sales velocity per product over the period
    velocity_query = (
        db.query(
            SaleItem.product_id,
            Product.name,
            Product.stock,
            Product.min_stock,
            Product.cost,
            func.sum(SaleItem.quantity).label("total_sold"),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .filter(Sale.status == "completed", Sale.created_at >= cutoff)
        .group_by(SaleItem.product_id, Product.name, Product.stock, Product.min_stock, Product.cost)
        .order_by(func.sum(SaleItem.quantity).desc())
        .all()
    )

    restock_items = []
    product_summary_lines = []

    for row in velocity_query:
        daily_avg = row.total_sold / days_history
        days_until_empty = row.stock / daily_avg if daily_avg > 0 else 999
        suggested_order = max(0, int(daily_avg * 14) - row.stock)  # 2-week supply

        item = {
            "product_id": row.product_id,
            "product_name": row.name,
            "current_stock": row.stock,
            "min_stock": row.min_stock,
            "daily_avg_sales": round(daily_avg, 1),
            "days_until_empty": round(days_until_empty, 1),
            "suggested_order_qty": suggested_order,
            "estimated_cost": round(suggested_order * row.cost, 2),
            "urgency": "critical" if days_until_empty <= 2 else "soon" if days_until_empty <= 5 else "normal",
        }
        restock_items.append(item)

        product_summary_lines.append(
            f"- {row.name}: stock={row.stock}, venta diaria={daily_avg:.1f}, "
            f"días restantes={days_until_empty:.0f}, pedir={suggested_order} unidades"
        )

    # Generate AI narrative if module is enabled and there's data
    ai_summary = None
    if settings.ai_demand_forecast and product_summary_lines:
        prompt = (
            f"Analiza estos datos de inventario de los últimos {days_history} días "
            f"y da recomendaciones de resurtido priorizadas:\n\n"
            + "\n".join(product_summary_lines[:20])  # top 20 products
            + "\n\nDa un resumen ejecutivo con las 5 acciones más urgentes."
        )
        try:
            ai_summary = await llm.query(prompt, system=SYSTEM_PROMPT)
        except Exception as e:
            ai_summary = f"[AI no disponible: {e}]"

    # Sort by urgency
    urgency_order = {"critical": 0, "soon": 1, "normal": 2}
    restock_items.sort(key=lambda x: (urgency_order.get(x["urgency"], 3), -x["daily_avg_sales"]))

    return {
        "period_days": days_history,
        "generated_at": datetime.utcnow().isoformat(),
        "items": restock_items,
        "ai_summary": ai_summary,
    }
