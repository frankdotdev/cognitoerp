"""
The actual delivery task queued by notifications/service.py. Runs in a
Celery worker process, NOT the request/response cycle — this is what
"queued, not synchronous" (doc 013) means concretely.
"""
import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.db.tenant_guard import set_current_tenant
from app.modules.auth.models import User
from app.modules.notifications.models import NotificationLog
from app.tasks.celery_app import celery_app


async def _deliver_async(log_id: str) -> None:
    async with AsyncSessionLocal() as db:
        log = (
            await db.execute(select(NotificationLog).where(NotificationLog.id == uuid.UUID(log_id)))
        ).scalar_one_or_none()
        if log is None or log.status != "queued":
            return  # already handled (idempotent retry) or was deleted

        set_current_tenant(log.school_id)

        # Resolve the actual recipient ONCE here, rather than in each
        # channel function — this was the gap flagged in prior sessions:
        # recipient_user_id is a foreign key, not an address, and every
        # send needs the User row's real email/phone before it can do
        # anything. If the User has no email/phone on file for the
        # requested channel, that's a real failure, not something to
        # silently skip.
        recipient = (await db.execute(select(User).where(User.id == log.recipient_user_id))).scalar_one_or_none()

        try:
            if log.channel == "email":
                if recipient is None or not recipient.email:
                    raise ValueError(f"No email on file for user {log.recipient_user_id}")
                await _send_via_resend(log, to_email=recipient.email)
            elif log.channel == "sms":
                if recipient is None or not recipient.phone:
                    raise ValueError(f"No phone on file for user {log.recipient_user_id}")
                await _send_via_termii(log, to_phone=recipient.phone)
            # in_app requires no external call — the log row itself IS the
            # delivery; the frontend reads unread NotificationLog rows directly.

            log.status = "sent"
            log.sent_at = datetime.now(timezone.utc)
        except Exception:
            log.status = "failed"
            # Celery's task_acks_late + retry policy (celery_app.py) handles
            # re-attempting transient failures; a permanently failed send
            # stays visible in NotificationLog for support to investigate,
            # rather than silently disappearing.
            raise
        finally:
            await db.commit()


async def _send_via_resend(log: NotificationLog, *, to_email: str) -> None:
    import httpx
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={"to": [to_email], "subject": log.subject or "Cognitio ERP", "html": log.body},
            timeout=10,
        )
        response.raise_for_status()  # a 4xx/5xx from Resend must surface as a failure, not be silently swallowed


def _format_nigerian_phone(phone: str) -> str:
    """
    Termii expects international format (234...). Normalizes the common
    local formats (0803..., +234803..., 234803...) a school's registrar is
    actually likely to type into a phone field, rather than rejecting
    anything that isn't already perfectly formatted.
    """
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("0"):
        return "234" + digits[1:]
    if digits.startswith("234"):
        return digits
    return digits  # non-Nigerian number — passed through as-is rather than guessed at


async def _send_via_termii(log: NotificationLog, *, to_phone: str) -> None:
    import httpx
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.ng.termii.com/api/sms/send",
            json={
                "api_key": settings.TERMII_API_KEY,
                "to": _format_nigerian_phone(to_phone),
                "sms": log.body,
                "type": "plain",
                "channel": "generic",
                "from": "Cognitio",
            },
            timeout=10,
        )
        response.raise_for_status()


@celery_app.task(name="app.tasks.notifications.deliver", bind=True, max_retries=3)
def deliver(self, log_id: str) -> None:
    try:
        asyncio.run(_deliver_async(log_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)
