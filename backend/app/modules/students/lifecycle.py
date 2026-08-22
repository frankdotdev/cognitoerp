"""
The real-world student lifecycle events (doc 006): graduation, transfer to
another school, withdrawal/expulsion, and — a school register genuinely
lives through this — death. Every path here follows the same principle as
teacher offboarding: revoke access, never delete data. A departed
student's full history (results, attendance, fees) stays queryable
forever, because the product's stated design goal is that this data
outlives the student's time at any one school — a future school (using
Cognitio or not) can be handed a complete, portable record.
"""
import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.students.models import Student
from app.modules.auth.models import User, RefreshTokenFamily

_VALID_EXIT_STATUSES = {"graduated", "withdrawn", "suspended", "transferred", "deceased"}


async def process_student_exit(
    db: AsyncSession, *, school_id: uuid.UUID, student_id: uuid.UUID, new_status: str, exit_date: date, exit_reason: str | None
) -> Student:
    if new_status not in _VALID_EXIT_STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"'{new_status}' isn't a valid exit status.")

    student = (
        await db.execute(select(Student).where(Student.id == student_id, Student.school_id == school_id))
    ).scalar_one_or_none()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")

    student.status = new_status
    student.exit_date = exit_date
    student.exit_reason = exit_reason

    # Revoke login access — same principle as teacher offboarding. "Suspended"
    # is deliberately treated the same as the permanent exits here: a
    # suspended student shouldn't be able to log in during the suspension
    # either. Re-activation (status back to "active") is a separate,
    # explicit admin action, not automatic.
    if student.user_id is not None:
        user = (await db.execute(select(User).where(User.id == student.user_id))).scalar_one_or_none()
        if user is not None:
            user.is_active = False
            families = (
                await db.execute(select(RefreshTokenFamily).where(RefreshTokenFamily.user_id == user.id, RefreshTokenFamily.revoked.is_(False)))
            ).scalars().all()
            for family in families:
                family.revoked = True
                family.revoked_reason = f"student_{new_status}"

    await db.flush()
    return student


async def reactivate_student(db: AsyncSession, *, school_id: uuid.UUID, student_id: uuid.UUID) -> Student:
    """Reverses a suspension (or corrects a mistaken exit) — explicit, not automatic, and re-enables login."""
    student = (
        await db.execute(select(Student).where(Student.id == student_id, Student.school_id == school_id))
    ).scalar_one_or_none()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")

    student.status = "active"
    student.exit_date = None
    student.exit_reason = None

    if student.user_id is not None:
        user = (await db.execute(select(User).where(User.id == student.user_id))).scalar_one_or_none()
        if user is not None:
            user.is_active = True

    await db.flush()
    return student
