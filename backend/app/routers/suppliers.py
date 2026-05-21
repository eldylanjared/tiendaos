import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.supplier import Supplier
from app.models.product import Product
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from app.services.auth import get_current_user, require_role
from app.models.user import User

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])

SUPPLIER_IMG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "supplier_images"
)
os.makedirs(SUPPLIER_IMG_DIR, exist_ok=True)


def _to_response(supplier: Supplier, db: Session) -> SupplierResponse:
    product_count = db.query(Product).filter(Product.supplier_id == supplier.id).count()
    data = SupplierResponse.model_validate(supplier)
    data.product_count = product_count
    return data


@router.get("", response_model=list[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    suppliers = db.query(Supplier).order_by(Supplier.name).all()
    return [_to_response(s, db) for s in suppliers]


@router.post("", response_model=SupplierResponse)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return _to_response(supplier, db)


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _to_response(supplier, db)


@router.patch("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return _to_response(supplier, db)


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    # Unlink products before deleting
    db.query(Product).filter(Product.supplier_id == supplier_id).update(
        {"supplier_id": None}, synchronize_session=False
    )
    db.delete(supplier)
    db.commit()
    return {"ok": True}


@router.post("/{supplier_id}/image")
async def upload_supplier_image(
    supplier_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    content = await file.read()
    with open(os.path.join(SUPPLIER_IMG_DIR, filename), "wb") as f:
        f.write(content)
    supplier.picture_url = f"/api/suppliers/image/{filename}"
    db.commit()
    return {"picture_url": supplier.picture_url}


@router.get("/{supplier_id}/products")
def list_supplier_products(
    supplier_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    products = db.query(Product).filter(Product.supplier_id == supplier_id).order_by(Product.name).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "barcode": p.barcode,
            "price": p.price,
            "stock": p.stock,
            "is_active": p.is_active,
        }
        for p in products
    ]


@router.get("/image/{filename}")
def get_supplier_image(filename: str):
    filepath = os.path.join(SUPPLIER_IMG_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)
