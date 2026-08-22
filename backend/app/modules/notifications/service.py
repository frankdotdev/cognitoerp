"""
The actual send pipeline referenced by TODOs in finance/router.py and
communication/router.py. Two entry points:

  - queue_notification: called from application code (e.g. after posting an
    announcement) — checks the recipient's preference and the school's SMS
    allowlist BEFORE deciding a channel, then hands off to Celery.
  - _deliver (Celery task): does the actual Resend/Termii API call, records
    the result, and is idempotent via NotificationLog's unique constraint —
    a retried task for the same idempotency_key updates the existing log
    row rather than sending twice.

This module deliberately does not send synchronously from a request handler
— see doc 013's "must not block the admin's UI" requirement.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import (
    NotificationPreference, SchoolNotificationSettings, NotificationLog,
)
from app.tasks.celery_app import celery_app


async def _resolve_channel(
    db: AsyncSession, *, school_id: uuid.UUID, user_id: uuid.UUID, category: str, requested_channel: str
) -> tuple[str, bool]:
    """Returns (effective_channel, should_send) after applying preference + SMS-allowlist rules."""
    pref_stmt = select(NotificationPreference).where(
        NotificationPreference.school_id == school_id,
        NotificationPreference.user_id == user_id,
        NotificationPreference.category == category,
    )
    pref = (await db.execute(pref_stmt)).scalar_one_or_none()

    if pref is not None and not pref.enabled:
        return requested_channel, False  # user opted out of this category entirely

    channel = pref.channel if pref is not None else requested_channel

    if channel == "sms":
        settings_stmt = select(SchoolNotificationSettings).where(SchoolNotificationSettings.school_id == school_id)
        school_settings = (await db.execute(settings_stmt)).scalar_one_or_none()
        allowed = school_settings is not None and school_settings.sms_enabled and category in school_settings.sms_allowed_categories
        if not allowed:
            # Cost discipline (doc 013): fall back to email rather than silently drop.
            channel = "email"

    return channel, True


async def queue_notification(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
    category: str,
    subject: str | None,
    body: str,
    idempotency_key: str,
    requested_channel: str = "in_app",
) -> NotificationLog | None:
    channel, should_send = await _resolve_channel(
        db, school_id=school_id, user_id=recipient_user_id, category=category, requested_channel=requested_channel
    )
    if not should_send:
        return None

    log = NotificationLog(
        school_id=school_id,
        recipient_user_id=recipient_user_id,
        category=category,
        channel=channel,
        idempotency_key=idempotency_key,
        subject=subject,
        body=body,
        status="queued",
    )
    db.add(log)
    try:
        # SAVEPOINT, not a bare flush — see finance/service.py's
        # _finalize_payment for the full explanation of why a plain
        # db.rollback() here would be a bug (it rolls back the entire
        # session transaction, not just this insert).
        async with db.begin_nested():
            await db.flush()
    except IntegrityError:
        # Already queued under this idempotency key — return the existing row,
        # don't queue a second send.
        existing = await db.execute(
            select(NotificationLog).where(
                NotificationLog.school_id == school_id, NotificationLog.idempotency_key == idempotency_key
            )
        )
        return existing.scalar_one()

    celery_app.send_task("app.tasks.notifications.deliver", args=[str(log.id)])
    return log
