import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from app.database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), nullable=False, default="nuevo")  # nuevo, en_progreso, completado, cerrado
    priority = Column(String(20), nullable=False, default="normal")  # baja, normal, alta, urgente
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_to = Column(String(36), ForeignKey("users.id"), nullable=True)
    due_date = Column(DateTime, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
