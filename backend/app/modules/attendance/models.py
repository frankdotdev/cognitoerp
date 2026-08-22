"""Attendance (doc 010) — the offline-first module. One row per student per day per class."""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class AttendanceRecord(Base, AuditMixin, TenantMixin):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("school_id", "student_id", "date", name="uq_attendance_student_day"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"), index=True)
    class_name: Mapped[str] = mapped_column(String(50))
    date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(10))  # present | absent | late | excused
    marked_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    # When this record was created on the device, vs created_at (when it hit
    # the server) — the gap between them is exactly how offline-sync latency
    # is measured and surfaced ("synced 40 minutes late") per doc 010.
    marked_at_device: Mapped[datetime] = mapped_column()
    synced_at: Mapped[datetime | None] = mapped_column(nullable=True)
