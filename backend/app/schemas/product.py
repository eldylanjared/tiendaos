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


class ProductBase(BaseModel):
    barcode: str
    name: str
    description: str = ""
    category_id: str | None = None
    price: float
    cost: float = 0.0
    min_stock: int = 5
    image_url: str = ""


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


class ProductResponse(ProductBase):
    id: str
    stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    category: CategoryResponse | None = None
    model_config = {"from_attributes": True}
