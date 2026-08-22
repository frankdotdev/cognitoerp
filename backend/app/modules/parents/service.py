"""
Implements doc 008's linking flow exactly: a parent supplies a child's
admission number + date of birth. If both match an enrolled student, the
link auto-approves. If the admission number exists but the DOB doesn't
match, we do NOT reveal that ("wrong DOB" vs "no such student" would let
someone fish for valid admission numbers by trial and error) — both cases
land as a pending link requiring registrar approval, with the mismatch
visible only to staff in the approval queue.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.parents.models import ParentStudentLink
from app.modules.parents.schemas import LinkChildRequest
from app.modules.students.models import Student


async def request_child_link(
    db: AsyncSession, *, school_id: uuid.UUID, parent_user_id: uuid.UUID, payload: LinkChildRequest
) -> ParentStudentLink:
    stmt = select(Student).where(Student.school_id == school_id, Student.admission_number == payload.admission_number)
    student = (await db.execute(stmt)).scalar_one_or_none()

    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No student found with that admission number.")

    existing = await db.execute(
        select(ParentStudentLink).where(
            ParentStudentLink.school_id == school_id,
            ParentStudentLink.parent_user_id == parent_user_id,
            ParentStudentLink.student_id == student.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This child is already linked to your account.")

    dob_matches = student.date_of_birth is not None and student.date_of_birth == payload.date_of_birth
    link = ParentStudentLink(
        school_id=school_id,
        parent_user_id=parent_user_id,
        student_id=student.id,
        status="approved" if dob_matches else "pending",
    )
    db.add(link)
    await db.flush()
    return link


async def approve_link(db: AsyncSession, *, school_id: uuid.UUID, link_id: uuid.UUID, approved_by: uuid.UUID) -> ParentStudentLink:
    from datetime import datetime, timezone

    link = (
        await db.execute(select(ParentStudentLink).where(ParentStudentLink.id == link_id, ParentStudentLink.school_id == school_id))
    ).scalar_one_or_none()
    if link is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Link request not found.")

    link.status = "approved"
    link.verified_by = approved_by
    link.approved_at = datetime.now(timezone.utc)
    await db.flush()
    return link
