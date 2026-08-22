"""Results (doc 011). Grading scheme is per-school config, not hardcoded — Nigerian schools vary here."""
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class GradingScheme(Base, AuditMixin, TenantMixin):
    __tablename__ = "grading_schemes"

    name: Mapped[str] = mapped_column(String(50), default="Default")
    # e.g. {"CA1": 20, "CA2": 20, "Exam": 60} — must sum to 100, validated in service.py
    component_weights: Mapped[dict] = mapped_column(JSONB)
    # e.g. [{"grade": "A", "min": 70, "max": 100}, {"grade": "B", "min": 60, "max": 69}, ...]
    grade_boundaries: Mapped[list] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(default=True)


class ScoreEntry(Base, AuditMixin, TenantMixin):
    __tablename__ = "score_entries"
    __table_args__ = (
        UniqueConstraint("school_id", "student_id", "subject", "term", "component", name="uq_score_entry"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"), index=True)
    subject: Mapped[str] = mapped_column(String(50))
    term: Mapped[str] = mapped_column(String(20))
    component: Mapped[str] = mapped_column(String(20))  # "CA1" | "CA2" | "Exam" — matches grading_scheme keys
    score: Mapped[float] = mapped_column(Numeric(5, 2))
    entered_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class ReportCard(Base, AuditMixin, TenantMixin):
    """
    One row per student per term, generated once all subjects' scores are in
    and the Class Teacher publishes — NOT computed on every read, since
    class-wide ranking needs a stable snapshot rather than shifting under
    parents' feet as late scores trickle in.
    """
    __tablename__ = "report_cards"
    __table_args__ = (UniqueConstraint("school_id", "student_id", "term", name="uq_report_card_term"),)

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"), index=True)
    term: Mapped[str] = mapped_column(String(20))
    subject_scores: Mapped[dict] = mapped_column(JSONB)  # {"Mathematics": {"total": 82, "grade": "A"}, ...}
    overall_average: Mapped[float] = mapped_column(Numeric(5, 2))
    class_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attendance_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    teacher_comment: Mapped[str | None] = mapped_column(nullable=True)
    published: Mapped[bool] = mapped_column(default=False)
    published_at: Mapped[datetime | None] = mapped_column(nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(nullable=True)
