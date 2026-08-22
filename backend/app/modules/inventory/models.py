"""Inventory (added to MVP scope by product decision — furniture, ICT equipment, lab supplies, low complexity)."""
import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class InventoryItem(Base, AuditMixin, TenantMixin):
    __tablename__ = "inventory_items"

    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(50))  # furniture | ict | lab | stationery | other
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit: Mapped[str] = mapped_column(String(20), default="pcs")
    reorder_level: Mapped[int] = mapped_column(Integer, default=0)  # triggers a low-stock flag, not auto-reorder
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "Science Lab", "Store Room"
    unit_cost: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | disposed | under_repair


class PurchaseRequest(Base, AuditMixin, TenantMixin):
    __tablename__ = "purchase_requests"

    item_name: Mapped[str] = mapped_column(String(150))
    quantity_requested: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    requested_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected | fulfilled
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
