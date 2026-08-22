"""Notifications router — a user's own in-app notification feed and preference controls."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, CurrentUser
from app.modules.notifications.models import NotificationLog, NotificationPreference
from app.modules.notifications.schemas import NotificationOut, NotificationPreferenceUpdate

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
async def my_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    stmt = (
        select(NotificationLog)
        .where(NotificationLog.recipient_user_id == current_user.user_id, NotificationLog.channel == "in_app")
        .order_by(NotificationLog.created_at.desc())
        .limit(50)
    )
    return (await db.execute(stmt)).scalars().all()


@router.put("/preferences")
async def update_preference(
    payload: NotificationPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    stmt = pg_insert(NotificationPreference).values(
        id=uuid.uuid4(), school_id=current_user.school_id, user_id=current_user.user_id, **payload.model_dump()
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_notification_pref",
        set_={"channel": stmt.excluded.channel, "digest": stmt.excluded.digest, "enabled": stmt.excluded.enabled},
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "updated"}
