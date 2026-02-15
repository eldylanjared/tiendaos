"""
Customer Insights Module

Analyzes purchase patterns to find:
- Frequently bought together (basket analysis)
- Top product combinations for cross-selling
- Peak purchase times per product category

Phase 4 will add per-customer tracking with loyalty system.
For now, operates on anonymous aggregate transaction data.
"""

from datetime import datetime, timedelta
from collections import Counter
from itertools import combinations

from sqlalchemy.orm import Session

from app.ai import llm
from app.models.sale import Sale, SaleItem
from app.config import get_settings

settings = get_settings()


def get_frequently_bought_together(db: Session, days: int = 30, min_occurrences: int = 3) -> list[dict]:
    """
    Find product pairs that frequently appear in the same transaction.
    Classic market basket analysis — no AI needed, pure SQL/Python.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Get all completed sales with 2+ items
    sales = (
        db.query(Sale)
        .filter(Sale.status == "completed", Sale.created_at >= cutoff)
        .all()
    )

    pair_counter: Counter[tuple[str, str]] = Counter()

    for sale in sales:
        if len(sale.items) < 2:
            continue
        product_names = sorted(set(item.product_name for item in sale.items))
        for pair in combinations(product_names, 2):
            pair_counter[pair] += 1

    results = []
    for (prod_a, prod_b), count in pair_counter.most_common(20):
        if count >= min_occurrences:
            results.append({
                "product_a": prod_a,
                "product_b": prod_b,
                "times_bought_together": count,
            })

    return results


async def analyze_patterns(db: Session, days: int = 30) -> dict:
    """
    Run basket analysis and optionally generate AI-powered promotion suggestions.
    """
    pairs = get_frequently_bought_together(db, days)

    result = {
        "period_days": days,
        "generated_at": datetime.utcnow().isoformat(),
        "frequently_bought_together": pairs,
        "ai_suggestions": None,
    }

    if settings.ai_customer_insights and pairs:
        pairs_text = "\n".join(
            f"- {p['product_a']} + {p['product_b']}: {p['times_bought_together']} veces"
            for p in pairs[:15]
        )
        prompt = (
            f"Estos son los productos que se compran juntos frecuentemente "
            f"en la tienda {settings.store_name} (últimos {days} días):\n\n"
            f"{pairs_text}\n\n"
            f"Sugiere 3-5 promociones o combos basados en estos patrones. "
            f"Incluye precio sugerido del combo y el ahorro para el cliente."
        )
        try:
            result["ai_suggestions"] = await llm.query(
                prompt,
                system=(
                    "Eres un experto en merchandising para tiendas de conveniencia en México. "
                    "Responde en español. Sé específico con precios en MXN."
                ),
            )
        except Exception as e:
            result["ai_suggestions"] = f"[AI no disponible: {e}]"

    return result
