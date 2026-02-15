from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product, Category
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    CategoryCreate,
    CategoryResponse,
)
from app.services.auth import get_current_user, require_role

router = APIRouter(prefix="/api/products", tags=["products"])


# --- Categories ---

@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return db.query(Category).all()


@router.post("/categories", response_model=CategoryResponse)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    cat = Category(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# --- Products ---

@router.get("", response_model=list[ProductResponse])
def list_products(
    search: str = Query("", description="Search by name or barcode"),
    category_id: str | None = Query(None),
    active_only: bool = Query(True),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(Product)
    if active_only:
        q = q.filter(Product.is_active == True)
    if search:
        q = q.filter((Product.name.ilike(f"%{search}%")) | (Product.barcode == search))
    if category_id:
        q = q.filter(Product.category_id == category_id)
    return q.order_by(Product.name).offset(offset).limit(limit).all()


@router.get("/barcode/{barcode}", response_model=ProductResponse)
def get_by_barcode(barcode: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.barcode == barcode, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductResponse)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    if db.query(Product).filter(Product.barcode == data.barcode).first():
        raise HTTPException(status_code=400, detail="Barcode already exists")
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = data.model_dump(exclude_unset=True)
    if "barcode" in updates:
        existing = db.query(Product).filter(Product.barcode == updates["barcode"], Product.id != product_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Barcode already exists")

    for field, value in updates.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/adjust-stock")
def adjust_stock(
    product_id: str,
    quantity: int = Query(..., description="Positive to add, negative to subtract"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.stock += quantity
    if product.stock < 0:
        product.stock = 0
    db.commit()
    return {"id": product.id, "stock": product.stock}
