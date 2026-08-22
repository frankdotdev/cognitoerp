"""
Notifications (doc 013). Every send is a queued, auditable row — never fired
synchronously inside a request (an announcement to 800 parents must not
block the admin's UI). Cost discipline (doc 013): SMS defaults off except
for a school-configured allowlist of critical categories, since SMS is the
single largest recurring infra cost.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class NotificationPreference(Base, AuditMixin, TenantMixin):
    """Per-user opt-in/digest settings — checked BEFORE a job is queued, not after."""
    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("school_id", "user_id", "category", name="uq_notification_pref"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(30))  # attendance | fees | results | announcements
    channel: Mapped[str] = mapped_column(String(20), default="in_app")  # in_app | email | sms
    digest: Mapped[str] = mapped_column(String(10), default="immediate")  # immediate | daily
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class SchoolNotificationSettings(Base, AuditMixin, TenantMixin):
    """The school-level SMS allowlist from doc 013's cost-discipline rule."""
    __tablename__ = "school_notification_settings"

    sms_allowed_categories: Mapped[list[str]] = mapped_column(JSONB, default=list)  # e.g. ["fees_due", "attendance_absence"]
    sms_enabled: Mapped[bool] = mapped_column(Boolean, default=False)  # off by default — school opts in


class NotificationLog(Base, AuditMixin, TenantMixin):
    """
    One row per notification actually sent (or attempted). idempotency_key
    prevents a retried Celery task from double-sending the same alert —
    same guarantee pattern as Payment (doc 019).
    """
    __tablename__ = "notification_logs"
    __table_args__ = (UniqueConstraint("school_id", "idempotency_key", name="uq_notification_idempotency"),)

    recipient_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(30))
    channel: Mapped[str] = mapped_column(String(20))
    idempotency_key: Mapped[str] = mapped_column(String(100))
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    body: Mapped[str] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | sent | failed
    sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
