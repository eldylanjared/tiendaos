import uuid
from datetime import datetime

from sqlalchemy import String, Float, Integer, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    rfc: Mapped[str] = mapped_column(String(20), default="")
    address: Mapped[str] = mapped_column(String(500), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    extra_phone: Mapped[str] = mapped_column(String(20), default="")
    contact_name: Mapped[str] = mapped_column(String(200), default="")
    extra_contact_name: Mapped[str] = mapped_column(String(200), default="")
    picture_url: Mapped[str] = mapped_column(String(500), default="")
    avg_weekly_purchase: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    products: Mapped[list["Product"]] = relationship("Product", back_populates="supplier")  # type: ignore
