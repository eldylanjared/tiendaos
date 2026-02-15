"""
Smart Alerts Module

Detects anomalies and generates actionable alerts:
- Low stock warnings (below min_stock threshold)
- Unusual sales patterns (spikes or drops vs average)
- High-void-rate detection (potential fraud or training issue)

Runs a scheduled scan + on-demand check via API.
"""

from datetime import datetime, timedelta
from dataclasses import dataclass

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai import llm
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.config import get_settings

settings = get_settings()


@dataclass
class Alert:
    type: str  # low_stock, sales_spike, sales_drop, high_void_rate
    severity: str  # critical, warning, info
    title: str
    detail: str
    product_id: str | None = None


def check_low_stock(db: Session) -> list[Alert]:
    """Products at or below their minimum stock level."""
    products = (
        db.query(Product)
        .filter(Product.is_active == True, Product.stock <= Product.min_stock)
        .all()
    )
    alerts = []
    for p in products:
        severity = "critical" if p.stock == 0 else "warning"
        alerts.append(Alert(
            type="low_stock",
            severity=severity,
            title=f"{'Sin stock' if p.stock == 0 else 'Bajo stock'}: {p.name}",
            detail=f"Stock actual: {p.stock}, mínimo: {p.min_stock}",
            product_id=p.id,
        ))
    return alerts


def check_sales_anomalies(db: Session, days_baseline: int = 7) -> list[Alert]:
    """
    Compare today's sales velocity against the recent daily average.
    Flag significant spikes (>2x) or drops (<0.3x).
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    baseline_start = today_start - timedelta(days=days_baseline)

    # Baseline: average daily revenue over past N days
    baseline = (
        db.query(func.sum(Sale.total))
        .filter(Sale.status == "completed", Sale.created_at >= baseline_start, Sale.created_at < today_start)
        .scalar()
    ) or 0
    avg_daily = baseline / days_baseline if days_baseline > 0 else 0

    # Today so far
    today_total = (
        db.query(func.sum(Sale.total))
        .filter(Sale.status == "completed", Sale.created_at >= today_start)
        .scalar()
    ) or 0

    # Scale today's partial day to a full-day estimate
    hours_elapsed = max((now - today_start).total_seconds() / 3600, 1)
    projected = today_total * (14 / hours_elapsed)  # assume ~14 operating hours

    alerts = []
    if avg_daily > 0:
        ratio = projected / avg_daily
        if ratio > 2.0:
            alerts.append(Alert(
                type="sales_spike",
                severity="info",
                title="Pico de ventas detectado",
                detail=(
                    f"Ventas proyectadas hoy: ${projected:,.0f} vs promedio ${avg_daily:,.0f} "
                    f"({ratio:.1f}x del promedio)"
                ),
            ))
        elif ratio < 0.3 and hours_elapsed >= 4:
            alerts.append(Alert(
                type="sales_drop",
                severity="warning",
                title="Ventas por debajo del promedio",
                detail=(
                    f"Ventas proyectadas hoy: ${projected:,.0f} vs promedio ${avg_daily:,.0f} "
                    f"({ratio:.1%} del promedio)"
                ),
            ))

    return alerts


def check_void_rate(db: Session, days: int = 1) -> list[Alert]:
    """Flag if void rate is unusually high (>5% of transactions)."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    total_sales = db.query(func.count(Sale.id)).filter(Sale.created_at >= cutoff).scalar() or 0
    voided = (
        db.query(func.count(Sale.id))
        .filter(Sale.created_at >= cutoff, Sale.status == "voided")
        .scalar()
    ) or 0

    if total_sales >= 10 and voided / total_sales > 0.05:
        return [Alert(
            type="high_void_rate",
            severity="warning",
            title="Tasa de cancelaciones alta",
            detail=f"{voided} cancelaciones de {total_sales} ventas ({voided/total_sales:.1%}) en las últimas 24h",
        )]
    return []


async def run_all_checks(db: Session) -> dict:
    """Run all alert checks and optionally generate an AI summary."""
    alerts: list[Alert] = []
    alerts.extend(check_low_stock(db))
    alerts.extend(check_sales_anomalies(db))
    alerts.extend(check_void_rate(db))

    result = {
        "generated_at": datetime.utcnow().isoformat(),
        "alert_count": len(alerts),
        "alerts": [
            {
                "type": a.type,
                "severity": a.severity,
                "title": a.title,
                "detail": a.detail,
                "product_id": a.product_id,
            }
            for a in alerts
        ],
        "ai_summary": None,
    }

    # Generate AI narrative if enabled and there are alerts
    if settings.ai_smart_alerts and alerts:
        alert_text = "\n".join(f"[{a.severity}] {a.title}: {a.detail}" for a in alerts)
        prompt = (
            f"Estas son las alertas actuales de la tienda {settings.store_name}:\n\n"
            f"{alert_text}\n\n"
            f"Da un resumen ejecutivo breve con las acciones recomendadas, priorizadas por urgencia."
        )
        try:
            result["ai_summary"] = await llm.query(
                prompt,
                system="Eres un asistente de gestión para tiendas de conveniencia en México. Responde en español, sé conciso y accionable.",
            )
        except Exception as e:
            result["ai_summary"] = f"[AI no disponible: {e}]"

    return result
