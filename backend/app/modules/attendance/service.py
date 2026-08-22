"""
The sync endpoint a device calls once connectivity returns, per doc 010.
Accepts a BATCH of queued attendance records (a teacher may have marked an
entire class offline) and upserts each one — a record that syncs twice
(flaky connection causing a retry) updates in place rather than duplicating,
enforced by the (school_id, student_id, date) unique constraint doing double
duty as both a business rule and an idempotency guard.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.attendance.models import AttendanceRecord
from app.modules.attendance.schemas import AttendanceSyncBatch


async def sync_attendance_batch(
    db: AsyncSession, *, school_id: uuid.UUID, marked_by: uuid.UUID, batch: AttendanceSyncBatch
) -> int:
    """
    Uses Postgres's native ON CONFLICT (upsert) rather than a select-then-
    insert-or-update round trip — matters here specifically because this
    endpoint receives batches (a full class roster) and doing N sequential
    read-then-write pairs would be both slow and race-prone if two devices
    somehow sync overlapping records concurrently.
    """
    if not batch.records:
        return 0

    rows = [
        {
            "id": uuid.uuid4(),
            "school_id": school_id,
            "student_id": r.student_id,
            "class_name": r.class_name,
            "date": r.date,
            "status": r.status,
            "marked_by": marked_by,
            "marked_at_device": r.marked_at_device,
        }
        for r in batch.records
    ]

    stmt = pg_insert(AttendanceRecord).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_attendance_student_day",
        set_={
            "status": stmt.excluded.status,
            "marked_by": stmt.excluded.marked_by,
            "marked_at_device": stmt.excluded.marked_at_device,
            "synced_at": stmt.excluded.updated_at,  # server-side "now" via the AuditMixin's onupdate default
        },
    )
    await db.execute(stmt)
    return len(rows)
