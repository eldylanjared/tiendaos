from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.product import Product, Category
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.services.auth import get_current_user, require_role

settings = get_settings()
router = APIRouter(prefix="/api/reports", tags=["reports"])


def _parse_date_range(start: str | None, end: str | None, default_days: int = 7):
    if end:
        end_dt = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)
    else:
        end_dt = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    if start:
        start_dt = datetime.strptime(start, "%Y-%m-%d")
    else:
        start_dt = end_dt - timedelta(days=default_days + 1)
    return start_dt, end_dt


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Today's KPIs + sales by hour + top products."""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    yesterday = today - timedelta(days=1)

    base = db.query(Sale).filter(
        Sale.store_id == settings.store_id,
        Sale.status == "completed",
    )

    # Today's sales
    today_sales = base.filter(Sale.created_at >= today, Sale.created_at < tomorrow).all()
    today_total = sum(s.total for s in today_sales)
    today_count = len(today_sales)
    today_avg = round(today_total / today_count, 2) if today_count else 0.0
    today_cost = 0.0
    for s in today_sales:
        for item in s.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product and product.cost:
                today_cost += product.cost * item.quantity * item.pack_units

    today_profit = round(today_total - today_cost, 2)

    # Yesterday for comparison
    yesterday_sales = base.filter(Sale.created_at >= yesterday, Sale.created_at < today).all()
    yesterday_total = sum(s.total for s in yesterday_sales)

    # Sales by hour (today)
    hours = []
    for h in range(24):
        h_start = today + timedelta(hours=h)
        h_end = today + timedelta(hours=h + 1)
        h_sales = [s for s in today_sales if h_start <= s.created_at < h_end]
        h_total = sum(s.total for s in h_sales)
        hours.append({"hour": h, "sales": round(h_total, 2), "transactions": len(h_sales)})

    # Top 10 products today
    product_totals: dict[str, dict] = {}
    for s in today_sales:
        for item in s.items:
            key = item.product_name
            if key not in product_totals:
                product_totals[key] = {"product_name": key, "quantity_sold": 0, "revenue": 0.0}
            product_totals[key]["quantity_sold"] += item.quantity * item.pack_units
            product_totals[key]["revenue"] += item.line_total
    top_products = sorted(product_totals.values(), key=lambda x: x["revenue"], reverse=True)[:10]

    # Payment method breakdown
    cash_total = sum(s.total for s in today_sales if s.payment_method == "cash")
    card_total = sum(s.total for s in today_sales if s.payment_method == "card")
    mixed_total = sum(s.total for s in today_sales if s.payment_method == "mixed")

    return {
        "date": today.strftime("%Y-%m-%d"),
        "total_sales": round(today_total, 2),
        "transaction_count": today_count,
        "avg_ticket": today_avg,
        "total_profit": today_profit,
        "yesterday_total": round(yesterday_total, 2),
        "sales_by_hour": hours,
        "top_products": top_products,
        "payment_breakdown": {
            "cash": round(cash_total, 2),
            "card": round(card_total, 2),
            "mixed": round(mixed_total, 2),
        },
    }


@router.get("/sales-summary")
def sales_summary(
    start: str | None = Query(None, description="YYYY-MM-DD"),
    end: str | None = Query(None, description="YYYY-MM-DD"),
    group_by: str = Query("day", description="day, week, or month"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "manager")),
):
    """Sales totals grouped by day/week/month."""
    start_dt, end_dt = _parse_date_range(start, end, default_days=30)

    sales = (
        db.query(Sale)
        .filter(
            Sale.store_id == settings.store_id,
            Sale.status == "completed",
            Sale.created_at >= start_dt,
            Sale.created_at < end_dt,
        )
        .order_by(Sale.created_at)
        .all()
    )

    buckets: dict[str, dict] = {}
    for s in sales:
        if group_by == "week":
            key = s.created_at.strftime("%Y-W%W")
        elif group_by == "month":
            key = s.created_at.strftime("%Y-%m")
        else:
            key = s.created_at.strftime("%Y-%m-%d")

        if key not in buckets:
            buckets[key] = {"period": key, "total_sales": 0.0, "transactions": 0, "avg_ticket": 0.0}
        buckets[key]["total_sales"] += s.total
        buckets[key]["transactions"] += 1

    result = []
    for b in buckets.values():
        b["total_sales"] = round(b["total_sales"], 2)
        b["avg_ticket"] = round(b["total_sales"] / b["transactions"], 2) if b["transactions"] else 0.0
        result.append(b)

    return result


@router.get("/product-profitability")
def product_profitability(
    start: str | None = Query(None, description="YYYY-MM-DD"),
    end: str | None = Query(None, description="YYYY-MM-DD"),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "manager")),
):
    """Product-level revenue, cost, profit, margin."""
    start_dt, end_dt = _parse_date_range(start, end, default_days=30)

    items = (
        db.query(SaleItem)
        .join(Sale)
        .filter(
            Sale.store_id == settings.store_id,
            Sale.status == "completed",
            Sale.created_at >= start_dt,
            Sale.created_at < end_dt,
        )
        .all()
    )

    product_data: dict[str, dict] = {}
    for item in items:
        pid = item.product_id
        if pid not in product_data:
            product = db.query(Product).filter(Product.id == pid).first()
            cost = product.cost if product else 0.0
            product_data[pid] = {
                "product_id": pid,
                "product_name": item.product_name,
                "cost": cost,
                "units_sold": 0,
                "revenue": 0.0,
                "total_cost": 0.0,
            }
        units = item.quantity * item.pack_units
        product_data[pid]["units_sold"] += units
        product_data[pid]["revenue"] += item.line_total
        product_data[pid]["total_cost"] += product_data[pid]["cost"] * units

    result = []
    for p in product_data.values():
        profit = round(p["revenue"] - p["total_cost"], 2)
        margin = round((profit / p["revenue"]) * 100, 1) if p["revenue"] else 0.0
        result.append({
            "product_id": p["product_id"],
            "product_name": p["product_name"],
            "units_sold": round(p["units_sold"], 2),
            "revenue": round(p["revenue"], 2),
            "cost": round(p["total_cost"], 2),
            "profit": profit,
            "margin_pct": margin,
        })

    result.sort(key=lambda x: x["profit"], reverse=True)
    return result[:limit]


@router.get("/category-performance")
def category_performance(
    start: str | None = Query(None, description="YYYY-MM-DD"),
    end: str | None = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "manager")),
):
    """Revenue and units by category."""
    start_dt, end_dt = _parse_date_range(start, end, default_days=30)

    items = (
        db.query(SaleItem)
        .join(Sale)
        .filter(
            Sale.store_id == settings.store_id,
            Sale.status == "completed",
            Sale.created_at >= start_dt,
            Sale.created_at < end_dt,
        )
        .all()
    )

    cat_data: dict[str, dict] = {}
    for item in items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            continue
        cat_name = "Sin Categoria"
        if product.category_id:
            cat = db.query(Category).filter(Category.id == product.category_id).first()
            if cat:
                cat_name = cat.name

        if cat_name not in cat_data:
            cat_data[cat_name] = {"category": cat_name, "units_sold": 0, "revenue": 0.0, "products_count": set()}

        cat_data[cat_name]["units_sold"] += item.quantity * item.pack_units
        cat_data[cat_name]["revenue"] += item.line_total
        cat_data[cat_name]["products_count"].add(item.product_id)

    result = []
    for c in cat_data.values():
        result.append({
            "category": c["category"],
            "units_sold": round(c["units_sold"], 2),
            "revenue": round(c["revenue"], 2),
            "products_count": len(c["products_count"]),
        })
    result.sort(key=lambda x: x["revenue"], reverse=True)
    return result


@router.get("/cashier-performance")
def cashier_performance(
    start: str | None = Query(None, description="YYYY-MM-DD"),
    end: str | None = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "manager")),
):
    """Sales per cashier: total, transactions, avg ticket, void count."""
    start_dt, end_dt = _parse_date_range(start, end, default_days=30)

    sales = (
        db.query(Sale)
        .filter(
            Sale.store_id == settings.store_id,
            Sale.created_at >= start_dt,
            Sale.created_at < end_dt,
        )
        .all()
    )

    user_data: dict[str, dict] = {}
    for s in sales:
        uid = s.user_id
        if uid not in user_data:
            user = db.query(User).filter(User.id == uid).first()
            user_data[uid] = {
                "user_id": uid,
                "full_name": user.full_name if user else "Desconocido",
                "total_sales": 0.0,
                "transactions": 0,
                "voided": 0,
                "items_sold": 0,
            }
        if s.status == "completed":
            user_data[uid]["total_sales"] += s.total
            user_data[uid]["transactions"] += 1
            user_data[uid]["items_sold"] += sum(i.quantity * i.pack_units for i in s.items)
        elif s.status == "voided":
            user_data[uid]["voided"] += 1

    result = []
    for u in user_data.values():
        avg_ticket = round(u["total_sales"] / u["transactions"], 2) if u["transactions"] else 0.0
        result.append({
            "user_id": u["user_id"],
            "full_name": u["full_name"],
            "total_sales": round(u["total_sales"], 2),
            "transactions": u["transactions"],
            "avg_ticket": avg_ticket,
            "voided": u["voided"],
            "items_sold": round(u["items_sold"], 2),
        })
    result.sort(key=lambda x: x["total_sales"], reverse=True)
    return result


@router.get("/inventory")
def inventory_report(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "manager")),
):
    """Inventory overview: stock value, below-minimum, reorder suggestions."""
    products = db.query(Product).filter(Product.is_active == True).all()

    total_stock_value = 0.0
    total_retail_value = 0.0
    below_minimum = []
    out_of_stock = []

    for p in products:
        cost_value = (p.cost or 0.0) * p.stock
        retail_value = p.price * p.stock
        total_stock_value += cost_value
        total_retail_value += retail_value

        if p.stock <= 0:
            out_of_stock.append({
                "product_id": p.id,
                "name": p.name,
                "barcode": p.barcode,
                "stock": p.stock,
                "min_stock": p.min_stock,
                "cost": p.cost or 0.0,
                "price": p.price,
                "reorder_qty": max(p.min_stock * 3 - p.stock, p.min_stock),
            })
        elif p.stock <= p.min_stock:
            below_minimum.append({
                "product_id": p.id,
                "name": p.name,
                "barcode": p.barcode,
                "stock": p.stock,
                "min_stock": p.min_stock,
                "cost": p.cost or 0.0,
                "price": p.price,
                "reorder_qty": max(p.min_stock * 3 - p.stock, p.min_stock),
            })

    # Sort by urgency (lowest stock first)
    out_of_stock.sort(key=lambda x: x["stock"])
    below_minimum.sort(key=lambda x: x["stock"])

    return {
        "total_products": len(products),
        "total_stock_value": round(total_stock_value, 2),
        "total_retail_value": round(total_retail_value, 2),
        "potential_profit": round(total_retail_value - total_stock_value, 2),
        "out_of_stock_count": len(out_of_stock),
        "below_minimum_count": len(below_minimum),
        "out_of_stock": out_of_stock,
        "below_minimum": below_minimum,
    }


@router.get("/export/sales-csv")
def export_sales_csv(
    start: str | None = Query(None, description="YYYY-MM-DD"),
    end: str | None = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "manager")),
):
    """Export sales as CSV text."""
    from fastapi.responses import Response
    import csv
    import io

    start_dt, end_dt = _parse_date_range(start, end, default_days=30)

    sales = (
        db.query(Sale)
        .filter(
            Sale.store_id == settings.store_id,
            Sale.status == "completed",
            Sale.created_at >= start_dt,
            Sale.created_at < end_dt,
        )
        .order_by(Sale.created_at)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Fecha", "Hora", "ID Venta", "Producto", "Cantidad", "Precio Unitario",
        "Descuento %", "Total Linea", "Metodo Pago", "Total Venta",
    ])

    for s in sales:
        for item in s.items:
            writer.writerow([
                s.created_at.strftime("%Y-%m-%d"),
                s.created_at.strftime("%H:%M:%S"),
                s.id[:8].upper(),
                item.product_name,
                item.quantity * item.pack_units,
                item.unit_price,
                item.discount_percent,
                item.line_total,
                s.payment_method,
                s.total,
            ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=ventas_{start_dt.strftime('%Y%m%d')}_{(end_dt - timedelta(days=1)).strftime('%Y%m%d')}.csv"},
    )
