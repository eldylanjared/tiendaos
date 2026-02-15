from datetime import datetime
from pydantic import BaseModel


class SaleItemCreate(BaseModel):
    product_id: str
    quantity: float = 1
    discount_percent: float = 0.0
    pack_units: int = 1


class SaleItemResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    quantity: float
    unit_price: float
    discount_percent: float
    line_total: float
    pack_units: int = 1
    model_config = {"from_attributes": True}


class SaleCreate(BaseModel):
    items: list[SaleItemCreate]
    payment_method: str = "cash"
    cash_received: float = 0.0


class SaleResponse(BaseModel):
    id: str
    store_id: str
    user_id: str
    items: list[SaleItemResponse]
    subtotal: float
    tax: float
    total: float
    payment_method: str
    cash_received: float
    change_given: float
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class TopProduct(BaseModel):
    product_name: str
    quantity_sold: float
    revenue: float


class DailySummary(BaseModel):
    date: str
    total_sales: float
    transaction_count: int
    avg_ticket: float
    top_products: list[TopProduct]
