import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product, Category
from app.models.store import Store
from app.models.user import User
from app.services.auth import require_role, require_sync_key
from app.services.sync import get_sync_status, run_sync

router = APIRouter(prefix="/api/sync", tags=["sync"])


class RegisterStoreRequest(BaseModel):
    name: str
    address: str = ""
    phone: str = ""


class RegisterStoreResponse(BaseModel):
    store_id: str
    store_name: str
    sync_api_key: str


@router.post("/register", response_model=RegisterStoreResponse)
def register_store(
    body: RegisterStoreRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Create a new store and issue its sync API key. Admin only."""
    api_key = secrets.token_hex(32)
    store = Store(
        name=body.name,
        address=body.address,
        phone=body.phone,
        sync_api_key=api_key,
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return RegisterStoreResponse(
        store_id=store.id,
        store_name=store.name,
        sync_api_key=api_key,
    )


@router.post("/rotate-key/{store_id}", response_model=RegisterStoreResponse)
def rotate_store_key(
    store_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Issue a new API key for a store (old key is immediately invalidated)."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    store.sync_api_key = secrets.token_hex(32)
    db.commit()
    db.refresh(store)
    return RegisterStoreResponse(
        store_id=store.id,
        store_name=store.name,
        sync_api_key=store.sync_api_key,
    )


@router.get("/stores")
def list_stores(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """List all registered stores with their IDs (keys not exposed)."""
    stores = db.query(Store).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "address": s.address,
            "is_active": s.is_active,
            "has_api_key": s.sync_api_key is not None,
        }
        for s in stores
    ]


@router.get("/products")
def sync_pull_products(
    updated_since: str | None = Query(None),
    db: Session = Depends(get_db),
    _store: Store = Depends(require_sync_key),
):
    """Return products (and categories) updated since a given timestamp. Used by local store servers."""
    categories = db.query(Category).all()
    q = db.query(Product).filter(Product.is_active == True)
    if updated_since:
        try:
            since_dt = datetime.fromisoformat(updated_since.replace("Z", "+00:00"))
            q = q.filter(Product.updated_at >= since_dt)
        except ValueError:
            pass
    products = q.limit(10000).all()
    return {
        "categories": [{"id": c.id, "name": c.name, "color": c.color} for c in categories],
        "products": [
            {
                "id": p.id,
                "barcode": p.barcode,
                "name": p.name,
                "description": p.description,
                "category_id": p.category_id,
                "supplier_id": p.supplier_id,
                "price": p.price,
                "cost": p.cost,
                "stock": p.stock,
                "min_stock": p.min_stock,
                "image_url": p.image_url,
                "is_active": p.is_active,
                "is_favorite": p.is_favorite,
                "sell_by_weight": p.sell_by_weight,
                "updated_at": p.updated_at.isoformat(),
            }
            for p in products
        ],
    }


@router.get("/status")
def sync_status(_user: User = Depends(require_role("admin", "manager"))):
    """Return last sync timestamps and pending sale count."""
    return get_sync_status()


@router.post("/now")
async def sync_now(_user: User = Depends(require_role("admin", "manager"))):
    """Trigger an immediate sync cycle."""
    results = await run_sync()
    return results
