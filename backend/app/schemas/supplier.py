from datetime import datetime
from pydantic import BaseModel


class SupplierBase(BaseModel):
    name: str
    rfc: str = ""
    address: str = ""
    phone: str = ""
    extra_phone: str = ""
    contact_name: str = ""
    extra_contact_name: str = ""
    avg_weekly_purchase: float = 0.0
    notes: str = ""


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: str | None = None
    rfc: str | None = None
    address: str | None = None
    phone: str | None = None
    extra_phone: str | None = None
    contact_name: str | None = None
    extra_contact_name: str | None = None
    avg_weekly_purchase: float | None = None
    notes: str | None = None
    picture_url: str | None = None


class SupplierResponse(SupplierBase):
    id: str
    picture_url: str = ""
    product_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
