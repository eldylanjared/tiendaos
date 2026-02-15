from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.sale import SaleCreate, SaleResponse, DailySummary, TopProduct
from app.services.auth import get_current_user, require_role

settings = get_settings()
router = APIRouter(prefix="/api/sales", tags=["sales"])


@router.post("", response_model=SaleResponse)
def create_sale(
    data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not data.items:
        raise HTTPException(status_code=400, detail="Sale must have at least one item")

    sale = Sale(
        store_id=settings.store_id,
        user_id=current_user.id,
        payment_method=data.payment_method,
    )

    subtotal = 0.0
    for item_data in data.items:
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")
        if product.stock < item_data.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}: {product.stock} available",
            )

        unit_price = product.price
        discount = item_data.discount_percent / 100.0
        line_total = round(unit_price * item_data.quantity * (1 - discount), 2)

        sale_item = SaleItem(
            product_id=product.id,
            product_name=product.name,
            quantity=item_data.quantity,
            unit_price=unit_price,
            discount_percent=item_data.discount_percent,
            line_total=line_total,
        )
        sale.items.append(sale_item)
        subtotal += line_total

        # Decrement stock
        product.stock -= item_data.quantity

    sale.subtotal = round(subtotal, 2)
    sale.tax = round(subtotal * settings.tax_rate, 2)
    sale.total = round(sale.subtotal + sale.tax, 2)
    sale.cash_received = data.cash_received
    sale.change_given = round(max(data.cash_received - sale.total, 0), 2)
    sale.status = "completed"

    db.add(sale)
    db.commit()
    db.refresh(sale)
    return sale


@router.get("", response_model=list[SaleResponse])
def list_sales(
    date: str | None = Query(None, description="YYYY-MM-DD"),
    status: str = Query("completed"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(Sale).filter(Sale.store_id == settings.store_id, Sale.status == status)
    if date:
        day = datetime.strptime(date, "%Y-%m-%d")
        q = q.filter(Sale.created_at >= day, Sale.created_at < day + timedelta(days=1))
    return q.order_by(Sale.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(sale_id: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


@router.post("/{sale_id}/void", response_model=SaleResponse)
def void_sale(
    sale_id: str,
    db: Session = Depends(get_db),
    _manager: User = Depends(require_role("admin", "manager")),
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if sale.status == "voided":
        raise HTTPException(status_code=400, detail="Sale already voided")

    # Restore stock
    for item in sale.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.stock += item.quantity

    sale.status = "voided"
    db.commit()
    db.refresh(sale)
    return sale


@router.get("/reports/daily", response_model=DailySummary)
def daily_summary(
    date: str = Query(None, description="YYYY-MM-DD, defaults to today"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if date:
        day = datetime.strptime(date, "%Y-%m-%d")
    else:
        day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    next_day = day + timedelta(days=1)

    sales = (
        db.query(Sale)
        .filter(Sale.store_id == settings.store_id, Sale.status == "completed")
        .filter(Sale.created_at >= day, Sale.created_at < next_day)
        .all()
    )

    total_sales = sum(s.total for s in sales)
    count = len(sales)
    avg_ticket = round(total_sales / count, 2) if count else 0.0

    # Top products by quantity
    product_totals: dict[str, dict] = {}
    for sale in sales:
        for item in sale.items:
            key = item.product_name
            if key not in product_totals:
                product_totals[key] = {"product_name": key, "quantity_sold": 0, "revenue": 0.0}
            product_totals[key]["quantity_sold"] += item.quantity
            product_totals[key]["revenue"] += item.line_total

    top = sorted(product_totals.values(), key=lambda x: x["quantity_sold"], reverse=True)[:10]

    return DailySummary(
        date=day.strftime("%Y-%m-%d"),
        total_sales=round(total_sales, 2),
        transaction_count=count,
        avg_ticket=avg_ticket,
        top_products=[TopProduct(**p) for p in top],
    )
