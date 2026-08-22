"""
Core identity and access models. These live outside the tenant-filter guard
for the specific case of IdentitySequence (which is keyed by school_code, a
denormalized value, not school_id — the sequence generator runs before we
necessarily have a full User row) and User itself, which IS tenant-scoped.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import Base, AuditMixin, TenantMixin


class IdentitySequence(Base, AuditMixin):
    """One counter per (school_code, role, year) — see identity_code.py."""
    __tablename__ = "identity_sequences"
    __table_args__ = (UniqueConstraint("school_code", "role", "year", name="uq_identity_sequence"),)

    school_code: Mapped[str] = mapped_column(String(20), index=True)
    role: Mapped[str] = mapped_column(String(10))
    year: Mapped[int] = mapped_column(Integer)
    last_value: Mapped[int] = mapped_column(Integer, default=0)


class Role(Base, AuditMixin, TenantMixin):
    """
    RBAC role, scoped per school so each school can rename/tune roles without
    affecting others (e.g. one school calls it "Bursar", another "Accountant").
    Permissions are a flat list of string codes (e.g. "students.view",
    "fees.edit", "results.delete") — checked by the require_permission
    dependency in auth/dependencies.py. Deliberately not a bit-flag enum:
    string codes are easier to extend per-module without a migration.
    """
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50))
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=False)  # seeded defaults, not deletable
    permissions: Mapped[list[str]] = mapped_column(
        # Postgres ARRAY would also work; JSONB chosen for query flexibility later
        # (e.g. "which roles have fees.edit" across schools for support tooling).
        "permissions", type_=__import__("sqlalchemy").JSON, default=list
    )

    users: Mapped[list["User"]] = relationship(back_populates="role")


class User(Base, AuditMixin, TenantMixin):
    """
    One row per human on the platform, scoped to a single school. A parent
    with children in two different Cognitio schools would have two separate
    User rows today — deliberate for launch simplicity; a "linked accounts"
    concept can merge these later without a breaking migration since
    identity_code stays the stable key either way.
    """
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("school_id", "identity_code", name="uq_user_identity_code"),)

    identity_code: Mapped[str] = mapped_column(String(40), index=True)  # e.g. CMS-STU-2026-00341
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    password_hash: Mapped[str] = mapped_column(String(255))
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)  # forced on first login

    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)  # linked OAuth id

    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"))
    role: Mapped["Role"] = relationship(back_populates="users")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Delegation: e.g. Principal delegates their role's permissions to VP for 30 days.
    delegated_role_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True)
    delegation_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshTokenFamily(Base, AuditMixin, TenantMixin):
    """
    Tracks refresh token families so we can revoke an entire chain at once
    (password change, admin-forced logout, suspected compromise) rather than
    only the single token currently being rotated.
    """
    __tablename__ = "refresh_token_families"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)


class LoginAttempt(Base, AuditMixin, TenantMixin):
    """Audit trail for every login attempt — feeds brute-force lockout and suspicious-login detection."""
    __tablename__ = "login_attempts"

    identity_code: Mapped[str] = mapped_column(String(40), index=True)
    ip_address: Mapped[str] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    successful: Mapped[bool] = mapped_column(Boolean)
