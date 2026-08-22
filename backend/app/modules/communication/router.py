"""
Communication router. Posting an announcement is where the notification
fan-out (doc 013) will eventually hook in via BackgroundTasks — stubbed
with a TODO rather than faked, matching this project's rule of never
claiming a wired integration that isn't actually wired yet.
"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, AsyncSessionLocal
from app.db.tenant_guard import set_current_tenant
from app.modules.auth.dependencies import require_permission, get_current_user, CurrentUser
from app.modules.auth.models import User
from app.modules.communication.models import Announcement, HelpDeskTicket, TicketReply
from app.modules.communication.schemas import (
    AnnouncementCreate, AnnouncementOut, TicketCreate, TicketReplyCreate, TicketOut,
)
from app.modules.notifications.service import queue_notification

router = APIRouter()


async def _fan_out_announcement(school_id: uuid.UUID, announcement_id: uuid.UUID) -> None:
    """
    Runs as a BackgroundTask, AFTER the response is sent (doc 013's "must
    not block the admin's UI" requirement) — which means it must NOT reuse
    the request's `db` session, since that session is closed by the time
    this runs. Opens its own session instead; takes IDs, not ORM objects,
    for the same reason (the announcement object above was bound to the
    now-closed session).
    """
    async with AsyncSessionLocal() as db:
        set_current_tenant(school_id)

        announcement = (await db.execute(select(Announcement).where(Announcement.id == announcement_id))).scalar_one()
        stmt = select(User).where(User.school_id == school_id, User.is_active.is_(True))
        recipients = (await db.execute(stmt)).scalars().all()

        for recipient in recipients:
            await queue_notification(
                db,
                school_id=school_id,
                recipient_user_id=recipient.id,
                category="announcements",
                subject=announcement.title,
                body=announcement.body,
                idempotency_key=f"announcement:{announcement.id}:{recipient.id}",
            )
        await db.commit()


@router.get("/announcements", response_model=list[AnnouncementOut])
async def list_announcements(db: AsyncSession = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    stmt = select(Announcement).order_by(Announcement.created_at.desc()).limit(50)
    announcements = (await db.execute(stmt)).scalars().all()

    # Admins/principals (who have settings.edit or wildcard) see everything
    if "*" in current_user.permissions or "settings.edit" in current_user.permissions:
        return announcements

    # Determine which classes this user belongs to
    from app.modules.students.models import Student
    from app.modules.teachers.models import Teacher, TeacherClassAssignment

    user_classes: set[str] = set()

    # If student, their class_name
    student = (await db.execute(
        select(Student).where(Student.user_id == current_user.user_id)
    )).scalar_one_or_none()
    if student and student.class_name:
        user_classes.add(student.class_name)

    # If teacher, their assigned classes
    teacher = (await db.execute(
        select(Teacher).where(Teacher.user_id == current_user.user_id)
    )).scalar_one_or_none()
    if teacher:
        assignments = (await db.execute(
            select(TeacherClassAssignment.class_name).where(TeacherClassAssignment.teacher_id == teacher.id)
        )).scalars().all()
        user_classes.update(assignments)

    # If parent, their children's classes
    from app.modules.parents.models import ParentStudentLink
    child_ids = (await db.execute(
        select(ParentStudentLink.student_id).where(
            ParentStudentLink.parent_user_id == current_user.user_id,
            ParentStudentLink.status == "approved",
        )
    )).scalars().all()
    if child_ids:
        children = (await db.execute(select(Student).where(Student.id.in_(child_ids)))).scalars().all()
        user_classes.update(c.class_name for c in children if c.class_name)

    # Filter: school-wide (target_classes is None) OR user has a class in target_classes
    return [
        a for a in announcements
        if a.target_classes is None or bool(user_classes & set(a.target_classes))
    ]


@router.post("/announcements", response_model=AnnouncementOut, status_code=201)
async def post_announcement(
    payload: AnnouncementCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("settings.edit")),  # Principal/admin-level, per doc 012
):
    announcement = Announcement(school_id=current_user.school_id, posted_by=current_user.user_id, **payload.model_dump())
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)
    background_tasks.add_task(_fan_out_announcement, current_user.school_id, announcement.id)
    return announcement


@router.get("/tickets", response_model=list[TicketOut])
async def list_tickets(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    # A parent sees only their own tickets; staff with fees/settings permission see all.
    stmt = select(HelpDeskTicket)
    if "*" not in current_user.permissions and "fees.edit" not in current_user.permissions:
        stmt = stmt.where(HelpDeskTicket.raised_by == current_user.user_id)
    stmt = stmt.order_by(HelpDeskTicket.created_at.desc())
    return (await db.execute(stmt)).scalars().all()


@router.post("/tickets", response_model=TicketOut, status_code=201)
async def create_ticket(
    payload: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    ticket = HelpDeskTicket(school_id=current_user.school_id, raised_by=current_user.user_id, **payload.model_dump())
    db.add(ticket)
    await db.commit()
    return ticket


@router.post("/tickets/{ticket_id}/replies", status_code=201)
async def reply_to_ticket(
    ticket_id: uuid.UUID,
    payload: TicketReplyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    reply = TicketReply(school_id=current_user.school_id, ticket_id=ticket_id, author_id=current_user.user_id, message=payload.message)
    db.add(reply)
    await db.commit()
    return {"status": "reply_added"}
