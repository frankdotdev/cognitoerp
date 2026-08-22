"""
The tests that matter most in this whole codebase — they PROVE the core
security claim (doc 004: "School A can never see School B's data") rather
than just asserting it in a comment. Every test here follows the same
shape: create data as School A, switch tenant context to School B, assert
School B's queries never return School A's rows.

If ANY of these fail, the tenant_guard.py ORM-level filter (db/tenant_guard.py)
is broken, and that is a stop-everything, fix-before-anything-else problem —
not something to work around at the application layer.
"""
import uuid
from datetime import date

import pytest

from app.db.tenant_guard import set_current_tenant
from app.modules.students.models import Student
from app.modules.students.repository import StudentRepository
from app.modules.teachers.models import Teacher
from app.modules.finance.models import Invoice
from app.modules.attendance.models import AttendanceRecord


@pytest.mark.asyncio
async def test_school_b_cannot_see_school_a_students(db, school_a, school_b):
    student = Student(
        school_id=school_a, identity_code="TSA-STU-2026-00001", admission_number="TSA-ADMN-2026-00001",
        full_name="Amaka Test", class_name="SS2", admission_date=date(2026, 9, 1),
    )
    db.add(student)
    await db.flush()

    set_current_tenant(school_b)
    rows, total = await StudentRepository(db).paginate(page=1, page_size=25)

    assert total == 0
    assert all(r.id != student.id for r in rows)


@pytest.mark.asyncio
async def test_school_b_cannot_fetch_school_a_student_by_id_directly(db, school_a, school_b):
    """
    The more dangerous case than a list query: even a direct get_by_id
    lookup with School A's real student UUID must fail for School B,
    not just be absent from an unfiltered list. This is what actually
    stops someone who has (or guesses) a valid ID from a different tenant.
    """
    from fastapi import HTTPException

    student = Student(
        school_id=school_a, identity_code="TSA-STU-2026-00002", admission_number="TSA-ADMN-2026-00002",
        full_name="Chidi Test", class_name="JSS1", admission_date=date(2026, 9, 1),
    )
    db.add(student)
    await db.flush()
    student_id = student.id

    set_current_tenant(school_b)
    with pytest.raises(HTTPException) as exc_info:
        await StudentRepository(db).get_by_id(student_id)
    assert exc_info.value.status_code == 404  # not 403 — existence itself isn't confirmed to the wrong tenant


@pytest.mark.asyncio
async def test_school_b_cannot_see_school_a_teachers(db, school_a, school_b):
    teacher = Teacher(
        school_id=school_a, identity_code="TSA-TCH-2026-00001", staff_id="TSA-TCH-2026-00001",
        full_name="Mr. Bassey", employment_date=date(2020, 1, 1),
    )
    db.add(teacher)
    await db.flush()

    set_current_tenant(school_b)
    from sqlalchemy import select
    result = await db.execute(select(Teacher))
    rows = result.scalars().all()

    assert all(r.id != teacher.id for r in rows)


@pytest.mark.asyncio
async def test_school_b_cannot_see_school_a_invoices(db, school_a, school_b):
    student = Student(
        school_id=school_a, identity_code="TSA-STU-2026-00003", admission_number="TSA-ADMN-2026-00003",
        full_name="Grace Test", class_name="SS1", admission_date=date(2026, 9, 1),
    )
    db.add(student)
    await db.flush()
    invoice = Invoice(school_id=school_a, student_id=student.id, term="2026-Term1", total_amount=45000, due_date=date(2026, 9, 30))
    db.add(invoice)
    await db.flush()

    set_current_tenant(school_b)
    from sqlalchemy import select
    result = await db.execute(select(Invoice))
    rows = result.scalars().all()

    assert all(r.id != invoice.id for r in rows)


@pytest.mark.asyncio
async def test_school_b_cannot_see_school_a_attendance(db, school_a, school_b):
    student = Student(
        school_id=school_a, identity_code="TSA-STU-2026-00004", admission_number="TSA-ADMN-2026-00004",
        full_name="Segun Test", class_name="SS2", admission_date=date(2026, 9, 1),
    )
    db.add(student)
    await db.flush()
    record = AttendanceRecord(
        school_id=school_a, student_id=student.id, class_name="SS2", date=date(2026, 9, 5),
        status="present", marked_by=uuid.uuid4(), marked_at_device=date(2026, 9, 5),
    )
    db.add(record)
    await db.flush()

    set_current_tenant(school_b)
    from sqlalchemy import select
    result = await db.execute(select(AttendanceRecord))
    rows = result.scalars().all()

    assert all(r.id != record.id for r in rows)


@pytest.mark.asyncio
async def test_query_with_no_tenant_set_fails_loudly(db, school_a):
    """
    The failure mode when tenant context is somehow never set must be a
    hard error, not silently returning unfiltered (all-tenant) data — see
    db/tenant_guard.py's RuntimeError. This is arguably the single most
    important test in the file: it proves the fail-safe direction is
    correct.
    """
    from app.db.tenant_guard import clear_current_tenant
    clear_current_tenant()

    from sqlalchemy import select
    with pytest.raises(RuntimeError):
        await db.execute(select(Student))
