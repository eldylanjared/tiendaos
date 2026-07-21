import uuid
from datetime import datetime

from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#3B82F6")
    parent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("categories.id"), nullable=True)
    # When true, this category shows as a single tile in POS Favoritos that opens
    # a picker of its products (e.g. "Bebidas" -> agua mineral, sal y limon, new mix).
    favorite_group: Mapped[bool] = mapped_column(Boolean, default=False)

    parent: Mapped["Category | None"] = relationship("Category", remote_side="Category.id")
    products: Mapped[list["Product"]] = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    barcode: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), default="")
    category_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("categories.id"), nullable=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=5)
    image_url: Mapped[str] = mapped_column(String(500), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    sell_by_weight: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    supplier_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("suppliers.id"), nullable=True)

    category: Mapped["Category | None"] = relationship("Category", back_populates="products")
    supplier: Mapped["Supplier | None"] = relationship("Supplier", back_populates="products")  # type: ignore
    barcodes: Mapped[list["ProductBarcode"]] = relationship("ProductBarcode", back_populates="product", cascade="all, delete-orphan")
    volume_promos: Mapped[list["VolumePromo"]] = relationship("VolumePromo", back_populates="product", cascade="all, delete-orphan")
    ticket_aliases: Mapped[list["ProductTicketAlias"]] = relationship("ProductTicketAlias", back_populates="product", cascade="all, delete-orphan")
    # Recipe: components this product is made of (made-to-order). Selling it deducts
    # each component's stock instead of this product's own stock.
    components: Mapped[list["ProductComponent"]] = relationship(
        "ProductComponent",
        foreign_keys="ProductComponent.parent_id",
        back_populates="parent",
        cascade="all, delete-orphan",
    )


class ProductBarcode(Base):
    __tablename__ = "product_barcodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    barcode: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    units: Mapped[int] = mapped_column(Integer, default=1)
    pack_price: Mapped[float] = mapped_column(Float, nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="barcodes")


class VolumePromo(Base):
    __tablename__ = "volume_promos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    min_units: Mapped[int] = mapped_column(Integer, nullable=False)
    promo_price: Mapped[float] = mapped_column(Float, nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="volume_promos")


class ProductTicketAlias(Base):
    """Name a product appears under on supplier tickets/invoices (many per product).
    Feeds future receipt-OCR: parsed ticket lines are matched against these aliases."""
    __tablename__ = "product_ticket_aliases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    alias: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    supplier_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("suppliers.id"), nullable=True)
    times_seen: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product: Mapped["Product"] = relationship("Product", back_populates="ticket_aliases")


class ProductComponent(Base):
    """One ingredient of a recipe product. parent_id is the sellable drink,
    component_id is the product consumed from inventory when it sells."""
    __tablename__ = "product_components"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    parent_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    component_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1)

    parent: Mapped["Product"] = relationship("Product", foreign_keys=[parent_id], back_populates="components")
    component: Mapped["Product"] = relationship("Product", foreign_keys=[component_id])

    # Convenience fields for API serialization (read from the related component product)
    @property
    def component_name(self) -> str:
        return self.component.name if self.component else ""

    @property
    def component_price(self) -> float:
        return self.component.price if self.component else 0

    @property
    def component_stock(self) -> int:
        return self.component.stock if self.component else 0


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)  # restock, damaged, correction, shrinkage
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
