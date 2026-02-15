from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.store import Store
from app.models.user import User
from app.services.auth import require_role

router = APIRouter(prefix="/api/stores", tags=["stores"])


class StoreCreate(BaseModel):
    name: str
    address: str = ""
    phone: str = ""


class StoreResponse(BaseModel):
    id: str
    name: str
    address: str
    phone: str
    is_active: bool
    model_config = {"from_attributes": True}


@router.get("", response_model=list[StoreResponse])
def list_stores(db: Session = Depends(get_db), _admin: User = Depends(require_role("admin"))):
    return db.query(Store).all()


@router.post("", response_model=StoreResponse)
def create_store(data: StoreCreate, db: Session = Depends(get_db), _admin: User = Depends(require_role("admin"))):
    store = Store(**data.model_dump())
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.patch("/{store_id}", response_model=StoreResponse)
def update_store(
    store_id: str,
    data: StoreCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(store, field, value)
    db.commit()
    db.refresh(store)
    return store
