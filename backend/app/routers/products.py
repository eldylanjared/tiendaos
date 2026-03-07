import csv
import io
import os
import uuid as _uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product, ProductBarcode, Category, VolumePromo, StockAdjustment
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    CategoryCreate,
    CategoryResponse,
    ProductBarcodeCreate,
    ProductBarcodeResponse,
    VolumePromoCreate,
    VolumePromoResponse,
    StockAdjustmentCreate,
    StockAdjustmentResponse,
    BarcodeLookupResponse,
    PackInfo,
)
from app.services.auth import get_current_user, require_role

router = APIRouter(prefix="/api/products", tags=["products"])

PRODUCT_IMG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "product_images")
os.makedirs(PRODUCT_IMG_DIR, exist_ok=True)


# --- Export / Import ---

@router.get("/export-csv")
def export_products_csv(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    """Export all products as CSV."""
    products = db.query(Product).order_by(Product.name).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "barcode", "name", "description", "category", "price", "cost",
        "stock", "min_stock", "sell_by_weight", "is_active",
    ])
    for p in products:
        cat_name = ""
        if p.category_id:
            cat = db.query(Category).filter(Category.id == p.category_id).first()
            if cat:
                cat_name = cat.name
        writer.writerow([
            p.barcode, p.name, p.description or "", cat_name,
            p.price, p.cost, p.stock, p.min_stock,
            "1" if p.sell_by_weight else "0",
            "1" if p.is_active else "0",
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=productos.csv"},
    )


@router.post("/import-csv")
async def import_products_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    """Import products from CSV. Updates existing products by barcode, creates new ones."""
    content = await file.read()
    text = content.decode("utf-8-sig")  # handle BOM from Excel
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    updated = 0
    errors = []

    # Cache categories by name
    cat_cache: dict[str, str] = {}
    for cat in db.query(Category).all():
        cat_cache[cat.name.lower().strip()] = cat.id

    for i, row in enumerate(reader, start=2):
        barcode = (row.get("barcode") or row.get("Código de barras") or "").strip()
        name = (row.get("name") or row.get("Nombre") or "").strip()
        if not barcode or not name:
            errors.append(f"Row {i}: missing barcode or name")
            continue

        try:
            price = float(row.get("price") or row.get("Precio de venta") or 0)
        except ValueError:
            price = 0
        try:
            cost = float(row.get("cost") or row.get("Coste") or 0)
        except ValueError:
            cost = 0
        try:
            stock = int(float(row.get("stock") or row.get("Cantidad a mano") or 0))
        except ValueError:
            stock = 0
        try:
            min_stock = int(float(row.get("min_stock") or 5))
        except ValueError:
            min_stock = 5

        cat_name = (row.get("category") or row.get("Categoría del punto de venta") or "").strip()
        cat_id = None
        if cat_name:
            cat_id = cat_cache.get(cat_name.lower().strip())

        sell_by_weight = (row.get("sell_by_weight") or "0").strip() in ("1", "true", "True")

        existing = db.query(Product).filter(Product.barcode == barcode).first()
        if existing:
            existing.name = name
            existing.price = price
            existing.cost = cost
            if cat_id:
                existing.category_id = cat_id
            if stock > 0 and existing.stock == 0:
                existing.stock = stock
            updated += 1
        else:
            product = Product(
                barcode=barcode,
                name=name,
                price=price,
                cost=cost,
                stock=stock,
                min_stock=min_stock,
                category_id=cat_id,
                sell_by_weight=sell_by_weight,
            )
            db.add(product)
            created += 1

    db.commit()
    return {"created": created, "updated": updated, "errors": errors[:20]}


# --- Product Images ---

@router.post("/{product_id}/image")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(status_code=400, detail="Image must be jpg, png, or webp")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

    # Delete old image if exists
    if product.image_url and product.image_url.startswith("/api/products/image/"):
        old_name = product.image_url.split("/")[-1]
        old_path = os.path.join(PRODUCT_IMG_DIR, old_name)
        if os.path.exists(old_path):
            os.remove(old_path)

    filename = f"{_uuid.uuid4().hex}{ext}"
    with open(os.path.join(PRODUCT_IMG_DIR, filename), "wb") as f:
        f.write(content)

    product.image_url = f"/api/products/image/{filename}"
    db.commit()
    return {"image_url": product.image_url}


@router.get("/image/{filename}")
def get_product_image(filename: str):
    filepath = os.path.join(PRODUCT_IMG_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)


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
        # Also search pack barcodes
        pack_product_ids = (
            db.query(ProductBarcode.product_id)
            .filter(ProductBarcode.barcode == search)
            .all()
        )
        pack_ids = [pid for (pid,) in pack_product_ids]
        q = q.filter(
            (Product.name.ilike(f"%{search}%"))
            | (Product.barcode == search)
            | (Product.id.in_(pack_ids))
        )
    if category_id:
        q = q.filter(Product.category_id == category_id)
    return q.order_by(Product.name).offset(offset).limit(limit).all()


@router.get("/barcode/{barcode}", response_model=BarcodeLookupResponse)
def get_by_barcode(barcode: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    # Check pack barcodes first
    pack = db.query(ProductBarcode).filter(ProductBarcode.barcode == barcode).first()
    if pack:
        product = db.query(Product).filter(Product.id == pack.product_id, Product.is_active == True).first()
        if product:
            return BarcodeLookupResponse(
                product=ProductResponse.model_validate(product),
                pack=PackInfo(
                    barcode_id=pack.id,
                    barcode=pack.barcode,
                    units=pack.units,
                    pack_price=pack.pack_price,
                ),
            )

    # Then check main product barcode
    product = db.query(Product).filter(Product.barcode == barcode, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return BarcodeLookupResponse(product=ProductResponse.model_validate(product))


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


# --- Stock Adjustments ---

@router.post("/{product_id}/adjust-stock", response_model=StockAdjustmentResponse)
def adjust_stock(
    product_id: str,
    data: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin", "manager")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.stock += data.quantity
    if product.stock < 0:
        product.stock = 0

    adjustment = StockAdjustment(
        product_id=product.id,
        user_id=admin.id,
        quantity=data.quantity,
        reason=data.reason,
        notes=data.notes,
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)
    return adjustment


@router.get("/{product_id}/stock-history", response_model=list[StockAdjustmentResponse])
def get_stock_history(
    product_id: str,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    return (
        db.query(StockAdjustment)
        .filter(StockAdjustment.product_id == product_id)
        .order_by(StockAdjustment.created_at.desc())
        .limit(limit)
        .all()
    )


# --- Pack Barcodes ---

@router.post("/{product_id}/barcodes", response_model=ProductBarcodeResponse)
def add_barcode(
    product_id: str,
    data: ProductBarcodeCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check barcode uniqueness across products and pack barcodes
    if db.query(Product).filter(Product.barcode == data.barcode).first():
        raise HTTPException(status_code=400, detail="Barcode already exists as a product barcode")
    if db.query(ProductBarcode).filter(ProductBarcode.barcode == data.barcode).first():
        raise HTTPException(status_code=400, detail="Barcode already exists as a pack barcode")

    pack = ProductBarcode(product_id=product_id, **data.model_dump())
    db.add(pack)
    db.commit()
    db.refresh(pack)
    return pack


@router.delete("/{product_id}/barcodes/{barcode_id}")
def delete_barcode(
    product_id: str,
    barcode_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    pack = db.query(ProductBarcode).filter(
        ProductBarcode.id == barcode_id, ProductBarcode.product_id == product_id
    ).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack barcode not found")
    db.delete(pack)
    db.commit()
    return {"ok": True}


# --- Volume Promos ---

@router.post("/{product_id}/promos", response_model=VolumePromoResponse)
def add_promo(
    product_id: str,
    data: VolumePromoCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    promo = VolumePromo(product_id=product_id, **data.model_dump())
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo


@router.delete("/{product_id}/promos/{promo_id}")
def delete_promo(
    product_id: str,
    promo_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    promo = db.query(VolumePromo).filter(
        VolumePromo.id == promo_id, VolumePromo.product_id == product_id
    ).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    db.delete(promo)
    db.commit()
    return {"ok": True}
