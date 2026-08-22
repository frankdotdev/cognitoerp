"""Teacher Management (doc 007)."""
import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, Table, Column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class Teacher(Base, AuditMixin, TenantMixin):
    __tablename__ = "teachers"

    identity_code: Mapped[str] = mapped_column(String(40), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    full_name: Mapped[str] = mapped_column(String(150))
    staff_id: Mapped[str] = mapped_column(String(40), index=True)
    qualification: Mapped[str | None] = mapped_column(String(150), nullable=True)
    employment_date: Mapped[date] = mapped_column(Date)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    subjects: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)  # e.g. ["Mathematics", "Further Maths"]
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | on_leave | left


class TeacherClassAssignment(Base, AuditMixin, TenantMixin):
    """
    Many-to-many: a teacher can be assigned to several classes, and a class
    has several subject teachers plus exactly one class teacher (doc 007's
    is_class_teacher distinction — broader visibility for that one role,
    modeled as an attribute rather than a separate Role so one teacher's
    permission set stays coherent across both responsibilities).
    """
    __tablename__ = "teacher_class_assignments"

    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"), index=True)
    class_name: Mapped[str] = mapped_column(String(50))
    subject: Mapped[str | None] = mapped_column(String(50), nullable=True)  # null when this row IS the class-teacher assignment
    is_class_teacher: Mapped[bool] = mapped_column(Boolean, default=False)
