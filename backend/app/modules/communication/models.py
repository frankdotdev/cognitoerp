"""Communication (doc 012). Structured channels, not an open group chat — see the product decision log."""
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import Base, AuditMixin, TenantMixin


class Announcement(Base, AuditMixin, TenantMixin):
    """Admin/Principal-only posts. Parents react, don't comment — enforced by having no reply model at all."""
    __tablename__ = "announcements"

    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column()
    posted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    target_classes: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)  # null = whole school


class HelpDeskTicket(Base, AuditMixin, TenantMixin):
    """Replaces ad-hoc phone/WhatsApp complaints — every issue tracked to resolution (doc 012)."""
    __tablename__ = "help_desk_tickets"

    raised_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    subject: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column()
    category: Mapped[str] = mapped_column(String(30))  # fees | academics | general
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | in_progress | resolved
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class TicketReply(Base, AuditMixin, TenantMixin):
    __tablename__ = "ticket_replies"

    ticket_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("help_desk_tickets.id"), index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    message: Mapped[str] = mapped_column()
