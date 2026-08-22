"""Parent Portal (doc 008). A parent is a User (role=Parent); this module is just the linking table."""
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class ParentStudentLink(Base, AuditMixin, TenantMixin):
    __tablename__ = "parent_student_links"
    __table_args__ = (UniqueConstraint("school_id", "parent_user_id", "student_id", name="uq_parent_student_link"),)

    parent_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"), index=True)
    # pending until auto-verified (DOB match) or registrar-approved — see doc 008's
    # "guards against someone fishing for a match" note.
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(nullable=True)
