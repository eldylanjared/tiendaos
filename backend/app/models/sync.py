import uuid
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SyncMeta(Base):
    """Tracks the last sync timestamp per direction."""
    __tablename__ = "sync_meta"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. "pull_products", "push_sales"
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_result: Mapped[str] = mapped_column(String(500), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
