"""
Parent Portal router. Every read endpoint here is scoped to links the
CURRENT parent owns — a parent requesting /children/{id}/summary for a
student they haven't been approved-linked to gets a 404, not a 403 (doc
008's anti-fishing principle applied at the API layer too: don't confirm
the student exists if this parent has no approved link to them).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.parents import service
from app.modules.parents.models import ParentStudentLink
from app.modules.parents.schemas import LinkChildRequest, ParentStudentLinkOut, ChildSummaryOut
from app.modules.students.models import Student
from app.modules.attendance.models import AttendanceRecord
from app.modules.finance.models import Invoice
from app.modules.results.models import ReportCard

router = APIRouter()


@router.post("/children/link", response_model=ParentStudentLinkOut, status_code=201)
async def link_child(
    payload: LinkChildRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("own_children.view")),
):
    link = await service.request_child_link(
        db, school_id=current_user.school_id, parent_user_id=current_user.user_id, payload=payload
    )
    await db.commit()
    return link


@router.get("/children", response_model=list[ParentStudentLinkOut])
async def list_my_children(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("own_children.view")),
):
    stmt = select(ParentStudentLink).where(
        ParentStudentLink.parent_user_id == current_user.user_id, ParentStudentLink.status == "approved"
    )
    return (await db.execute(stmt)).scalars().all()


@router.get("/children/{student_id}/summary", response_model=ChildSummaryOut)
async def child_summary(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("own_children.view")),
):
    link_check = await db.execute(
        select(ParentStudentLink).where(
            ParentStudentLink.parent_user_id == current_user.user_id,
            ParentStudentLink.student_id == student_id,
            ParentStudentLink.status == "approved",
        )
    )
    if link_check.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found.")  # not 403 — see module docstring

    student = (await db.execute(select(Student).where(Student.id == student_id))).scalar_one()

    # Attendance %: present+late / total records for this student
    att_total = (await db.execute(
        select(func.count()).select_from(AttendanceRecord).where(AttendanceRecord.student_id == student_id)
    )).scalar_one()
    att_present = (await db.execute(
        select(func.count()).select_from(AttendanceRecord).where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.status.in_(["present", "late"]),
        )
    )).scalar_one()
    attendance_percent = round(att_present / att_total * 100, 1) if att_total > 0 else None

    # Outstanding fees: sum of unpaid balance across this student's invoices
    outstanding_result = (await db.execute(
        select(
            func.coalesce(
                func.sum(Invoice.total_amount - Invoice.discount_amount - Invoice.amount_paid), 0
            )
        ).where(Invoice.student_id == student_id, Invoice.status != "paid")
    )).scalar_one()

    # Latest report card published status
    latest_card = (await db.execute(
        select(ReportCard).where(ReportCard.student_id == student_id)
        .order_by(ReportCard.term.desc()).limit(1)
    )).scalar_one_or_none()

    return ChildSummaryOut(
        student_id=student.id,
        full_name=student.full_name,
        class_name=student.class_name,
        attendance_percent=attendance_percent,
        outstanding_fees=float(outstanding_result),
        latest_report_card_published=latest_card.published if latest_card else False,
    )


@router.post("/children/links/{link_id}/approve", response_model=ParentStudentLinkOut)
async def approve_link(
    link_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("students.edit")),  # registrar-level permission
):
    link = await service.approve_link(db, school_id=current_user.school_id, link_id=link_id, approved_by=current_user.user_id)
    await db.commit()
    return link
