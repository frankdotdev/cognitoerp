"""
HR & Payroll (added to MVP scope, deliberately simple — no PAYE/pension
remittance automation, per the product scope decision). Covers staff
records beyond teachers (who have their own module), salary structure,
payslip generation, and leave tracking.
"""
import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class StaffRecord(Base, AuditMixin, TenantMixin):
    """
    Non-teaching staff (accountants, registrars, security, cleaners, etc.).
    Teachers already have their own module (teachers.Teacher) — this is
    deliberately NOT merged with it, since teaching staff have
    subject/class-assignment concerns HR doesn't need to know about, and HR
    concerns (salary, leave) teachers also have but modeled once here that
    Teacher rows can optionally link into via staff_record_id, rather than
    duplicating salary/leave fields onto the Teacher model itself.
    """
    __tablename__ = "staff_records"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    full_name: Mapped[str] = mapped_column(String(150))
    staff_id: Mapped[str] = mapped_column(String(40), index=True)
    role_title: Mapped[str] = mapped_column(String(100))  # e.g. "Accountant", "Security", "Cleaner"
    employment_date: Mapped[date] = mapped_column(Date)
    monthly_salary: Mapped[float] = mapped_column(Numeric(12, 2))
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | on_leave | terminated


class Payslip(Base, AuditMixin, TenantMixin):
    __tablename__ = "payslips"

    staff_record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff_records.id"), index=True)
    month: Mapped[str] = mapped_column(String(7))  # "2026-09"
    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2))
    deductions: Mapped[dict] = mapped_column(JSONB, default=dict)  # {"late_days": 5000} — simple, no tax engine
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(20), default="generated")  # generated | paid
    pdf_url: Mapped[str | None] = mapped_column(nullable=True)


class LeaveRequest(Base, AuditMixin, TenantMixin):
    __tablename__ = "leave_requests"

    staff_record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff_records.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
