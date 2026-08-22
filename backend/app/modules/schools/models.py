"""
The `schools` table is the one core table that is NOT tenant-scoped by
TenantMixin — it IS the tenant. Every other table's school_id points here.

school_theme is one-to-one with schools and holds everything from doc 015
(Settings & Branding) — kept as a separate table rather than columns on
`schools` so branding can be read/written independently of core school
identity, and so future per-school feature flags can live alongside it
without bloating the core table.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, AuditMixin, TenantMixin


class School(Base, AuditMixin):
    __tablename__ = "schools"

    name: Mapped[str] = mapped_column(String(150))
    school_code: Mapped[str] = mapped_column(String(10), unique=True, index=True)  # e.g. "CMS" — used in Identity Codes
    motto: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    principal_name: Mapped[str | None] = mapped_column(String(150), nullable=True)

    plan: Mapped[str] = mapped_column(String(20), default="foundation")  # foundation | academy | excellence | enterprise
    student_limit: Mapped[int] = mapped_column(Integer, default=200)
    billing_cycle: Mapped[str] = mapped_column(String(10), default="monthly")  # monthly | termly | annual

    # Addon products — Stella AI, Cognitio LMS (LMS), Cognitio Assess (CBT) are each
    # standalone products with their OWN pricing (someone can subscribe to
    # Stella AI directly with no Cognitio ERP account at all — see doc 015).
    # These flags are what a school's Cognitio plan can ALSO unlock: e.g. an
    # Excellence-plan school gets Stella AI included, while a Foundation
    # school would pay for it separately. Nothing reads these flags yet
    # (LMS/CBT don't exist as products), but the gate is real and ready —
    # when those products launch, they check `stella_ai_enabled` etc. via
    # the same JWT/SSO handoff described in the ecosystem architecture,
    # rather than needing a schema change at that point.
    stella_ai_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    lms_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    cbt_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    subdomain: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # e.g. "caritas" -> caritas.cognitioerp.com
    custom_domain: Mapped[str | None] = mapped_column(String(150), nullable=True, unique=True)  # Enterprise only

    current_session_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    trial_ends_at: Mapped[datetime | None] = mapped_column(nullable=True)

    theme: Mapped["SchoolTheme"] = relationship(back_populates="school", uselist=False)


class SchoolTheme(Base, AuditMixin):
    __tablename__ = "school_themes"

    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"), unique=True)
    school: Mapped["School"] = relationship(back_populates="theme")

    primary_color: Mapped[str] = mapped_column(String(7), default="#0E7C4A")   # Cognitio green default
    secondary_color: Mapped[str] = mapped_column(String(7), default="#12161F")
    accent_color: Mapped[str] = mapped_column(String(7), default="#12A25C")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    favicon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    stamp_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    signature_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    report_card_template: Mapped[str] = mapped_column(String(30), default="standard")
    certificate_template: Mapped[str] = mapped_column(String(30), default="standard")
    dark_mode_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    theme_version: Mapped[int] = mapped_column(Integer, default=1)  # bumped on any change; frontend cache-busts on this


class SchoolClass(Base, AuditMixin, TenantMixin):
    """
    A school's defined classes/sections — e.g. "SS2" with sections
    ["Gold", "Silver"]. Filled a real gap: every other module (Student,
    Teacher, Attendance, Results, Finance) treats class_name as free text,
    with nothing anywhere defining which classes a school actually has.
    This table is that source of truth, used by the Settings > Classes
    screen — existing free-text usage elsewhere is intentionally left
    as-is for now (changing every module to a foreign key here is a
    larger migration than this fix warrants), but new schools onboarding
    should be steered toward picking from this list.

    Uses TenantMixin (not a hand-declared school_id) specifically so this
    table gets the automatic ORM-level tenant guard (db/tenant_guard.py)
    like every other tenant-scoped table — a manually-declared FK here
    would silently bypass that protection and rely entirely on every
    endpoint remembering to filter by hand, which is exactly the failure
    mode doc 004's whole design exists to prevent.
    """
    __tablename__ = "school_classes"

    name: Mapped[str] = mapped_column(String(50))  # e.g. "SS2"
    sections: Mapped[list[str]] = mapped_column("sections", type_=__import__("sqlalchemy").JSON, default=list)  # e.g. ["Gold", "Silver"]
    display_order: Mapped[int] = mapped_column(default=0)  # lets a school order JSS1..SS3 sensibly in dropdowns
