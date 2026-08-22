"""HR/Payroll router — staff records, payslip generation, leave requests."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission, get_current_user, CurrentUser
from app.modules.auth.identity_code import generate_identity_code, RolePrefix
from app.modules.hr.models import StaffRecord, LeaveRequest
from app.modules.hr.schemas import (
    StaffRecordCreate, StaffRecordOut, GeneratePayslipRequest, PayslipOut, LeaveRequestCreate, LeaveRequestOut,
)
from app.modules.hr import service
from app.modules.schools.models import School
from datetime import datetime

router = APIRouter()


@router.get("/staff", response_model=list[StaffRecordOut])
async def list_staff(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("staff.manage")),
):
    stmt = select(StaffRecord).order_by(StaffRecord.full_name)
    return (await db.execute(stmt)).scalars().all()


@router.post("/staff", response_model=StaffRecordOut, status_code=201)
async def create_staff(
    payload: StaffRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("staff.manage")),
):
    school = (await db.execute(select(School).where(School.id == current_user.school_id))).scalar_one()
    staff_id = await generate_identity_code(db, school_code=school.school_code, role=RolePrefix.STAFF, year=datetime.now().year)
    staff = StaffRecord(school_id=current_user.school_id, staff_id=staff_id, created_by=current_user.user_id, **payload.model_dump())
    db.add(staff)
    await db.commit()
    return staff


@router.post("/payslips", response_model=PayslipOut, status_code=201)
async def generate_payslip(
    payload: GeneratePayslipRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("staff.manage")),
):
    payslip = await service.generate_payslip(db, school_id=current_user.school_id, **payload.model_dump())
    await db.commit()
    return payslip


@router.post("/leave-requests", response_model=LeaveRequestOut, status_code=201)
async def request_leave(
    payload: LeaveRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    leave = LeaveRequest(school_id=current_user.school_id, **payload.model_dump())
    db.add(leave)
    await db.commit()
    return leave


@router.post("/leave-requests/{leave_id}/approve", response_model=LeaveRequestOut)
async def approve_leave(
    leave_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("staff.manage")),
):
    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == leave_id))
    leave = result.scalar_one()
    leave.status = "approved"
    leave.approved_by = current_user.user_id
    await db.commit()
    return leave


@router.post("/leave-requests/{leave_id}/reject", response_model=LeaveRequestOut)
async def reject_leave(
    leave_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("staff.manage")),
):
    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == leave_id))
    leave = result.scalar_one()
    leave.status = "rejected"
    leave.approved_by = current_user.user_id
    await db.commit()
    return leave
