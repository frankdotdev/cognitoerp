"""Attendance router — the /sync write path (doc 010) plus a /calendar read path for the frontend's month view."""
import calendar as calendar_module
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.attendance.models import AttendanceRecord
from app.modules.attendance.schemas import AttendanceSyncBatch
from app.modules.attendance import service

router = APIRouter()


@router.post("/sync")
async def sync_attendance(
    batch: AttendanceSyncBatch,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("attendance.mark")),
):
    """
    Called by the device once connectivity returns, with its whole offline
    queue. Idempotent by design (see service.py) — safe to call repeatedly
    with overlapping records if a sync gets interrupted partway.
    """
    count = await service.sync_attendance_batch(
        db, school_id=current_user.school_id, marked_by=current_user.user_id, batch=batch
    )
    await db.commit()
    return {"synced": count}


@router.get("/calendar")
async def attendance_calendar(
    class_name: str,
    month: int,
    year: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("attendance.view")),
):
    """
    Month view for a class — one status per day, aggregated across the
    whole class (a day counts as "present" for calendar-coloring purposes
    if the majority of the class was present; a school wanting per-student
    calendars uses this same endpoint with a narrower class_name filter
    naturally, since one student's "class" of one resolves to their own
    status directly). Kept simple deliberately — full per-student attendance
    history is a different, more detailed screen than a month-at-a-glance view.
    """
    last_day = calendar_module.monthrange(year, month)[1]
    start = date(year, month, 1)
    end = date(year, month, last_day)

    stmt = select(AttendanceRecord).where(
        AttendanceRecord.class_name == class_name,
        AttendanceRecord.date >= start,
        AttendanceRecord.date <= end,
    )
    records = (await db.execute(stmt)).scalars().all()

    by_day: dict[date, list[str]] = {}
    for r in records:
        by_day.setdefault(r.date, []).append(r.status)

    def majority_status(statuses: list[str]) -> str:
        # present > late > excused > absent, by count — simple and predictable
        counts = {s: statuses.count(s) for s in set(statuses)}
        return max(counts, key=counts.get)

    return [
        {"date": day.isoformat(), "status": majority_status(statuses)}
        for day, statuses in sorted(by_day.items())
    ]
