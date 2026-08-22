"""
Offboarding — the real-world case the product description called out
explicitly: a teacher resigns, is terminated, or otherwise leaves, and
the school needs (a) their access revoked immediately, (b) their classes
not left orphaned, and (c) every record they ever touched (scores they
entered, attendance they marked) to stay exactly as-is for audit and
continuity — never deleted, never reassigned retroactively.

That third point is why this function does NOT touch ScoreEntry.entered_by
or AttendanceRecord.marked_by at all — those correctly keep pointing at
the departed teacher's User row forever, because "who actually entered
this score in April" is a fact that shouldn't change just because that
person later left. What DOES change is: their account can no longer sign
in, and their current/future class assignments move to whoever the
school designates next.
"""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.teachers.models import Teacher, TeacherClassAssignment
from app.modules.auth.models import User, RefreshTokenFamily


async def offboard_teacher(
    db: AsyncSession, *, school_id: uuid.UUID, teacher_id: uuid.UUID, reason: str, reassign_to_teacher_id: uuid.UUID | None
) -> dict:
    teacher = (
        await db.execute(select(Teacher).where(Teacher.id == teacher_id, Teacher.school_id == school_id))
    ).scalar_one_or_none()
    if teacher is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found.")

    teacher.status = "left"

    # Revoke login access — but the User row itself is never deleted, so
    # every historical record they touched stays validly linked.
    if teacher.user_id is not None:
        user = (await db.execute(select(User).where(User.id == teacher.user_id))).scalar_one_or_none()
        if user is not None:
            user.is_active = False
            # Force logout everywhere: revoke every refresh token family so
            # a session already open on some device can't keep working
            # after this moment, even if the access token hasn't expired yet.
            families = (
                await db.execute(select(RefreshTokenFamily).where(RefreshTokenFamily.user_id == user.id, RefreshTokenFamily.revoked.is_(False)))
            ).scalars().all()
            for family in families:
                family.revoked = True
                family.revoked_reason = f"teacher_offboarded:{reason}"

    reassigned_count = 0
    if reassign_to_teacher_id is not None:
        new_teacher = (
            await db.execute(select(Teacher).where(Teacher.id == reassign_to_teacher_id, Teacher.school_id == school_id, Teacher.status == "active"))
        ).scalar_one_or_none()
        if new_teacher is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The teacher to reassign classes to wasn't found or isn't active.")

        assignments = (
            await db.execute(select(TeacherClassAssignment).where(TeacherClassAssignment.teacher_id == teacher_id))
        ).scalars().all()
        for assignment in assignments:
            assignment.teacher_id = reassign_to_teacher_id
            reassigned_count += 1

    await db.flush()
    return {"status": "offboarded", "classes_reassigned": reassigned_count}


async def get_unassigned_classes(db: AsyncSession, *, school_id: uuid.UUID) -> list[TeacherClassAssignment]:
    """
    Surfaces class assignments still pointing at a teacher whose status is
    no longer active — the "these classes need a new teacher" list an
    admin checks after an offboarding that didn't specify a replacement.
    """
    stmt = (
        select(TeacherClassAssignment)
        .join(Teacher, Teacher.id == TeacherClassAssignment.teacher_id)
        .where(TeacherClassAssignment.school_id == school_id, Teacher.status != "active")
    )
    return (await db.execute(stmt)).scalars().all()
