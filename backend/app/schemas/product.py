from datetime import datetime
from pydantic import BaseModel


class CategoryBase(BaseModel):
    name: str
    color: str = "#3B82F6"
    parent_id: str | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: str
    model_config = {"from_attributes": True}


# --- Product Barcodes ---

class ProductBarcodeCreate(BaseModel):
    barcode: str
    units: int = 1
    pack_price: float


class ProductBarcodeResponse(BaseModel):
    id: str
    product_id: str
    barcode: str
    units: int
    pack_price: float
    model_config = {"from_attributes": True}


# --- Volume Promos ---

class VolumePromoCreate(BaseModel):
    min_units: int
    promo_price: float


class VolumePromoResponse(BaseModel):
    id: str
    product_id: str
    min_units: int
    promo_price: float
    model_config = {"from_attributes": True}


# --- Stock Adjustments ---

class StockAdjustmentCreate(BaseModel):
    quantity: int
    reason: str
    notes: str = ""


class StockAdjustmentResponse(BaseModel):
    id: str
    product_id: str
    user_id: str
    quantity: int
    reason: str
    notes: str
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Products ---

class ProductBase(BaseModel):
    barcode: str
    name: str
    description: str = ""
    category_id: str | None = None
    price: float
    cost: float = 0.0
    min_stock: int = 5
    image_url: str = ""
    sell_by_weight: bool = False


class ProductCreate(ProductBase):
    stock: int = 0


class ProductUpdate(BaseModel):
    barcode: str | None = None
    name: str | None = None
    description: str | None = None
    category_id: str | None = None
    price: float | None = None
    cost: float | None = None
    stock: int | None = None
    min_stock: int | None = None
    image_url: str | None = None
    is_active: bool | None = None
    sell_by_weight: bool | None = None


class ProductResponse(ProductBase):
    id: str
    stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    category: CategoryResponse | None = None
    barcodes: list[ProductBarcodeResponse] = []
    volume_promos: list[VolumePromoResponse] = []
    model_config = {"from_attributes": True}


# --- Barcode Lookup Response ---

class PackInfo(BaseModel):
    barcode_id: str
    barcode: str
    units: int
    pack_price: float


class BarcodeLookupResponse(BaseModel):
    product: ProductResponse
    pack: PackInfo | None = None
