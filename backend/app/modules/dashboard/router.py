"""
Principal Dashboard summary endpoint (doc 014).

Returns aggregated metrics the frontend's DashboardSummary screen consumes:
student/teacher counts, today's attendance rate, fee collection progress,
outstanding balance, and pending admissions (hardcoded 0 until the admissions
pipeline is built — see doc 020's §7 deferred list).
"""
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, CurrentUser
from app.modules.students.models import Student
from app.modules.teachers.models import Teacher
from app.modules.attendance.models import AttendanceRecord
from app.modules.finance.models import Invoice

router = APIRouter()


class DashboardSummary(BaseModel):
    student_count: int
    attendance_today_percent: float
    fees_collected_percent: float
    teacher_count: int
    outstanding_fees_total: float
    pending_admissions: int


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    school_id = current_user.school_id

    # Active students
    student_count = (
        await db.execute(
            select(func.count()).select_from(Student).where(
                Student.school_id == school_id, Student.status == "active"
            )
        )
    ).scalar_one()

    # Active teachers
    teacher_count = (
        await db.execute(
            select(func.count()).select_from(Teacher).where(
                Teacher.school_id == school_id, Teacher.status == "active"
            )
        )
    ).scalar_one()

    # Today's attendance
    today = date.today()
    total_today = (
        await db.execute(
            select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.date == today,
            )
        )
    ).scalar_one()

    present_today = (
        await db.execute(
            select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.school_id == school_id,
                AttendanceRecord.date == today,
                AttendanceRecord.status.in_(["present", "late"]),
            )
        )
    ).scalar_one()

    attendance_today_percent = (
        round(present_today / total_today * 100, 1) if total_today > 0 else 0.0
    )

    # Fee collection across all invoices for this school
    fee_agg = (
        await db.execute(
            select(
                func.coalesce(func.sum(Invoice.amount_paid), 0),
                func.coalesce(func.sum(Invoice.total_amount - Invoice.discount_amount), 0),
            ).where(Invoice.school_id == school_id)
        )
    ).one()

    total_paid = float(fee_agg[0])
    total_billed = float(fee_agg[1])
    fees_collected_percent = (
        round(total_paid / total_billed * 100, 1) if total_billed > 0 else 0.0
    )

    # Outstanding fees (unpaid invoices only)
    outstanding = (
        await db.execute(
            select(
                func.coalesce(
                    func.sum(Invoice.total_amount - Invoice.discount_amount - Invoice.amount_paid),
                    0,
                )
            ).where(Invoice.school_id == school_id, Invoice.status != "paid")
        )
    ).scalar_one()

    return DashboardSummary(
        student_count=student_count,
        attendance_today_percent=attendance_today_percent,
        fees_collected_percent=fees_collected_percent,
        teacher_count=teacher_count,
        outstanding_fees_total=float(outstanding),
        pending_admissions=0,
    )
