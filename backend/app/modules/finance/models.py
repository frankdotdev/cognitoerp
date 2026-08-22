"""
Finance module (doc 009). Two payment paths, both covered by the same
Payment model: recurring platform-subscription charges (Paystack native
Plan/Subscription, monthly/annual) and everything else — termly platform
billing and all parent-paid school fees — as one-time transactions against
a school's own invoice/due-date schedule, since Paystack has no native
"termly" interval and school terms don't align to a fixed calendar cycle.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class FeeStructure(Base, AuditMixin, TenantMixin):
    """Defined per class per term — e.g. 'SS2 - Term 1: tuition + PTA levy'."""
    __tablename__ = "fee_structures"

    class_name: Mapped[str] = mapped_column(String(50))
    term: Mapped[str] = mapped_column(String(20))       # e.g. "2026-Term1"
    fee_category: Mapped[str] = mapped_column(String(50))  # e.g. "Tuition", "PTA Levy", "Boarding"
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    due_date: Mapped[date] = mapped_column(Date)


class Invoice(Base, AuditMixin, TenantMixin):
    __tablename__ = "invoices"

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"), index=True)
    term: Mapped[str] = mapped_column(String(20))
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="unpaid")  # unpaid | partial | paid | overdue


class Payment(Base, AuditMixin, TenantMixin):
    __tablename__ = "payments"
    __table_args__ = (
        # The idempotency guarantee from doc 019: a retried request or a
        # duplicated webhook can never create two payment rows for one
        # actual transaction.
        UniqueConstraint("school_id", "idempotency_key", name="uq_payment_idempotency"),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(100))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    method: Mapped[str] = mapped_column(String(20))  # paystack | cash | bank_transfer
    paystack_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | success | failed
    receipt_number: Mapped[str] = mapped_column(String(40), index=True)
    paid_at: Mapped[datetime | None] = mapped_column(nullable=True)
