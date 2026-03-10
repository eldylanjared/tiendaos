import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, String, Float, Text, DateTime, ForeignKey, Integer
from app.database import Base


class FinanceEntry(Base):
    __tablename__ = "finance_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_to = Column(String(36), ForeignKey("users.id"), nullable=True)  # employee this entry belongs to
    entry_type = Column(String(20), nullable=False)  # "income" or "expense"
    category = Column(String(50), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(Text, default="")
    image_path = Column(String(500), default="")  # relative path to uploaded image
    is_personal = Column(Boolean, default=False)  # True = employee-only entry (e.g. nomina income)
    linked_entry_id = Column(String(36), nullable=True)  # links nomina expense <-> income pair
    date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VendorMapping(Base):
    """Learned vendor→category mapping. Improves over time as users confirm/correct."""
    __tablename__ = "vendor_mappings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vendor_name = Column(String(200), nullable=False, unique=True, index=True)
    category = Column(String(50), nullable=False)
    entry_type = Column(String(20), nullable=False, default="expense")
    times_seen = Column(Integer, default=1)
    updated_at = Column(DateTime, default=datetime.utcnow)
