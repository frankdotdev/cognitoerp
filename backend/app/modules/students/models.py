import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class Student(Base, AuditMixin, TenantMixin):
    __tablename__ = "students"

    identity_code: Mapped[str] = mapped_column(String(40), index=True)  # links to users.identity_code
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    full_name: Mapped[str] = mapped_column(String(150))
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # R2 object key, same pattern as SchoolTheme's logo_url

    class_name: Mapped[str] = mapped_column(String(50))     # e.g. "SS2"
    section: Mapped[str | None] = mapped_column(String(20), nullable=True)  # e.g. "Gold"
    admission_number: Mapped[str] = mapped_column(String(40), index=True)
    admission_date: Mapped[date] = mapped_column(Date)

    guardian_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    guardian_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    guardian_email: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # active | graduated | withdrawn | suspended | transferred | deceased —
    # deliberately a status set covering the real events a school's
    # register lives through, not just "enrolled or not." See
    # students/service.py's `process_student_exit` for how each of these
    # is handled (access revocation, data preservation, never deletion).
    status: Mapped[str] = mapped_column(String(20), default="active")
    exit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    exit_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
