"""
Idempotency tests, per doc 018/019: payments, attendance sync, and
notifications must never double-apply when retried with the same
idempotency key — this is what actually protects a school from a
double-tapped "Pay now" button charging twice, or a retried webhook
creating a duplicate receipt.
"""
from datetime import date, datetime

import pytest

from app.modules.students.models import Student
from app.modules.finance.models import Invoice
from app.modules.finance import service as finance_service
from app.modules.attendance import schemas as attendance_schemas
from app.modules.attendance import service as attendance_service


@pytest.mark.asyncio
async def test_duplicate_payment_idempotency_key_does_not_double_charge(db, school_a):
    student = Student(
        school_id=school_a, identity_code="TSA-STU-2026-00005", admission_number="TSA-ADMN-2026-00005",
        full_name="Ifeoma Test", class_name="SS2", admission_date=date(2026, 9, 1),
    )
    db.add(student)
    await db.flush()

    invoice = Invoice(school_id=school_a, student_id=student.id, term="2026-Term1", total_amount=50000, due_date=date(2026, 9, 30))
    db.add(invoice)
    await db.flush()

    key = "test-idempotency-key-001"

    first = await finance_service.record_manual_payment(
        db, invoice_id=invoice.id, amount=20000, idempotency_key=key, school_code="TSA"
    )
    # Simulate a retried request — SAME idempotency key, called again.
    second = await finance_service.record_manual_payment(
        db, invoice_id=invoice.id, amount=20000, idempotency_key=key, school_code="TSA"
    )

    assert first.id == second.id  # same payment row returned, not a new one
    assert invoice.amount_paid == 20000  # NOT 40000 — the second call must not have applied again


@pytest.mark.asyncio
async def test_attendance_sync_upsert_does_not_duplicate_on_retry(db, school_a):
    student = Student(
        school_id=school_a, identity_code="TSA-STU-2026-00006", admission_number="TSA-ADMN-2026-00006",
        full_name="Tunde Test", class_name="SS1", admission_date=date(2026, 9, 1),
    )
    db.add(student)
    await db.flush()

    batch = attendance_schemas.AttendanceSyncBatch(records=[
        attendance_schemas.AttendanceEntry(
            student_id=student.id, class_name="SS1", date=date(2026, 9, 5),
            status="present", marked_at_device=datetime(2026, 9, 5, 8, 0),
        )
    ])

    import uuid
    marker_id = uuid.uuid4()

    count_first = await attendance_service.sync_attendance_batch(db, school_id=school_a, marked_by=marker_id, batch=batch)
    count_second = await attendance_service.sync_attendance_batch(db, school_id=school_a, marked_by=marker_id, batch=batch)

    assert count_first == 1
    assert count_second == 1  # upserted, not duplicated

    from sqlalchemy import select
    from app.modules.attendance.models import AttendanceRecord
    rows = (await db.execute(select(AttendanceRecord).where(AttendanceRecord.student_id == student.id))).scalars().all()
    assert len(rows) == 1  # exactly one row exists, not two


@pytest.mark.asyncio
async def test_attendance_sync_second_mark_updates_status_not_creates_duplicate(db, school_a):
    """A student marked 'late' then corrected to 'present' on the same day should update, not add a second row."""
    student = Student(
        school_id=school_a, identity_code="TSA-STU-2026-00007", admission_number="TSA-ADMN-2026-00007",
        full_name="Funke Test", class_name="SS1", admission_date=date(2026, 9, 1),
    )
    db.add(student)
    await db.flush()

    import uuid
    marker_id = uuid.uuid4()

    batch_1 = attendance_schemas.AttendanceSyncBatch(records=[
        attendance_schemas.AttendanceEntry(student_id=student.id, class_name="SS1", date=date(2026, 9, 6), status="late", marked_at_device=datetime(2026, 9, 6, 8, 0)),
    ])
    batch_2 = attendance_schemas.AttendanceSyncBatch(records=[
        attendance_schemas.AttendanceEntry(student_id=student.id, class_name="SS1", date=date(2026, 9, 6), status="present", marked_at_device=datetime(2026, 9, 6, 8, 5)),
    ])

    await attendance_service.sync_attendance_batch(db, school_id=school_a, marked_by=marker_id, batch=batch_1)
    await attendance_service.sync_attendance_batch(db, school_id=school_a, marked_by=marker_id, batch=batch_2)

    from sqlalchemy import select
    from app.modules.attendance.models import AttendanceRecord
    rows = (await db.execute(select(AttendanceRecord).where(AttendanceRecord.student_id == student.id))).scalars().all()
    assert len(rows) == 1
    assert rows[0].status == "present"  # the correction won, not the original
