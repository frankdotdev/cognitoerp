"""
Base declarative model every table inherits from.

Two mixins:
  - AuditMixin: created_at/by, updated_at/by, deleted_at/by (soft delete), version
    (optimistic locking). Applied to every table without exception.
  - TenantMixin: school_id foreign key. Applied to every table that stores
    school-specific data (i.e. everything except the platform-level tables:
    schools themselves, plans, and system config).

Soft delete: nothing is hard-deleted through the ORM layer. deleted_at is set,
and every repository query filters WHERE deleted_at IS NULL by default. This
protects against accidental data loss and keeps a school's history intact for
audit purposes. Hard deletes (e.g. GDPR-style erasure requests) go through an
explicit, logged admin-only operation — never through the standard delete path.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AuditMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Optimistic locking: every UPDATE must match the version it read, then increment it.
    # Prevents two staff members silently overwriting each other's concurrent edits.
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class TenantMixin:
    """
    Every tenant-scoped table gets this. school_id is indexed and is the column
    the tenant-isolation query guard (see db/tenant_guard.py) enforces on every
    read and write — this is what makes School A structurally unable to see
    School B's data, independent of any application-layer check.
    """
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False, index=True
    )
