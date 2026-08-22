"""
Payslip generation: gross salary minus a simple flat deductions map (no tax
brackets, no pension percentage engine — per the deliberate scope decision
to keep HR simple at launch). If a school needs PAYE/pension automation
later, this is the seam to extend, not rearchitect.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.hr.models import StaffRecord, Payslip


async def generate_payslip(
    db: AsyncSession, *, school_id: uuid.UUID, staff_record_id: uuid.UUID, month: str, deductions: dict[str, float]
) -> Payslip:
    staff = (
        await db.execute(select(StaffRecord).where(StaffRecord.id == staff_record_id, StaffRecord.school_id == school_id))
    ).scalar_one_or_none()
    if staff is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff record not found.")

    total_deductions = sum(deductions.values())
    gross = float(staff.monthly_salary)
    net = gross - total_deductions

    if net < 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Deductions exceed gross salary.")

    payslip = Payslip(
        school_id=school_id, staff_record_id=staff_record_id, month=month,
        gross_salary=gross, deductions=deductions, net_salary=net,
    )
    db.add(payslip)
    await db.flush()
    return payslip
