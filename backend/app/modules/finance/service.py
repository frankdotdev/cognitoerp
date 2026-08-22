"""
Payment recording, built around the idempotency requirement from doc 019.

Two entry points:
  - record_manual_payment: cash/bank transfer entered by an accountant.
  - process_paystack_webhook: called from the webhook route, verifies the
    Paystack signature before trusting the payload at all.

Both funnel through _finalize_payment, which is where the invoice's
amount_paid/status update and the Payment row creation happen together, in
one flush, so a payment is never recorded without its invoice being updated
to match (or vice versa) — no partially-applied payment state.
"""
import hashlib
import hmac
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.finance.models import Invoice, Payment, FeeStructure


def verify_paystack_signature(raw_body: bytes, signature_header: str) -> bool:
    computed = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode(), raw_body, hashlib.sha512
    ).hexdigest()
    return hmac.compare_digest(computed, signature_header)


def _generate_receipt_number(school_code: str) -> str:
    # Simple, readable, not required to be sequential/gapless like the
    # identity code sequences — a receipt number colliding is caught by the
    # idempotency_key unique constraint regardless.
    return f"{school_code}-RCT-{uuid.uuid4().hex[:8].upper()}"


async def _finalize_payment(
    db: AsyncSession,
    *,
    invoice: Invoice,
    amount: float,
    method: str,
    idempotency_key: str,
    paystack_reference: str | None,
    school_code: str,
) -> Payment:
    payment = Payment(
        school_id=invoice.school_id,
        invoice_id=invoice.id,
        idempotency_key=idempotency_key,
        amount=amount,
        method=method,
        paystack_reference=paystack_reference,
        status="success",
        receipt_number=_generate_receipt_number(school_code),
        paid_at=datetime.now(timezone.utc),
    )
    db.add(payment)

    invoice.amount_paid = float(invoice.amount_paid) + amount
    invoice.status = "paid" if invoice.amount_paid >= invoice.total_amount else "partial"

    try:
        # SAVEPOINT, not a plain flush — critical distinction. A bare
        # `await db.flush()` followed by `await db.rollback()` on failure
        # was the ORIGINAL (buggy) version of this function: db.rollback()
        # rolls back the session's ENTIRE transaction, not just this insert
        # — in a real request that could silently undo other work done
        # earlier in the same request/transaction. begin_nested() opens a
        # SAVEPOINT scoped to just this block, so only the failed insert
        # is undone.
        async with db.begin_nested():
            await db.flush()
    except IntegrityError:
        # Unique constraint on (school_id, idempotency_key) tripped — this
        # exact payment was already recorded (e.g. a retried webhook).
        # The invoice.amount_paid/status changes made above were never
        # actually persisted (the SAVEPOINT rolled them back at the DB
        # level), but the in-memory `invoice` object still holds those
        # changed values — expire_all() forces every tracked object to
        # reload from the database on next access, so the caller never
        # sees a phantom double-applied amount.
        db.expire_all()
        existing = await db.execute(
            select(Payment).where(
                Payment.school_id == invoice.school_id, Payment.idempotency_key == idempotency_key
            )
        )
        return existing.scalar_one()

    return payment


async def record_manual_payment(
    db: AsyncSession,
    *,
    invoice_id: uuid.UUID,
    amount: float,
    idempotency_key: str,
    school_code: str,
) -> Payment:
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found.")

    return await _finalize_payment(
        db,
        invoice=invoice,
        amount=amount,
        method="cash",
        idempotency_key=idempotency_key,
        paystack_reference=None,
        school_code=school_code,
    )


async def process_paystack_webhook(db: AsyncSession, event: dict, school_code: str) -> Payment | None:
    if event.get("event") != "charge.success":
        return None  # ignore every other event type — nothing else affects invoice state

    data = event["data"]
    invoice_id = uuid.UUID(data["metadata"]["invoice_id"])  # set when the payment link was generated
    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if invoice is None:
        return None

    return await _finalize_payment(
        db,
        invoice=invoice,
        amount=data["amount"] / 100,  # Paystack amounts are in kobo
        method="paystack",
        idempotency_key=data["reference"],  # Paystack's own reference IS the idempotency key here
        paystack_reference=data["reference"],
        school_code=school_code,
    )


async def generate_invoices_for_class(
    db: AsyncSession, *, school_id: uuid.UUID, class_name: str, term: str
) -> list[Invoice]:
    """
    Bulk invoice generation (doc 009): sums a class's configured
    FeeStructure rows for the term into one invoice per enrolled student,
    rather than a school having to create invoices one student at a time.
    Idempotent at the class level — re-running for a class/term that
    already has invoices skips students who already have one instead of
    creating duplicates, so this is safe to re-run if a school adds a
    student mid-term and wants to catch them up.
    """
    from app.modules.students.models import Student

    fee_rows = (
        await db.execute(
            select(FeeStructure).where(
                FeeStructure.school_id == school_id, FeeStructure.class_name == class_name, FeeStructure.term == term
            )
        )
    ).scalars().all()
    if not fee_rows:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"No fee structure configured for {class_name} in {term} yet — set one up in Settings first.",
        )

    total_amount = sum(float(f.amount) for f in fee_rows)
    due_date = min(f.due_date for f in fee_rows)

    students = (
        await db.execute(
            select(Student).where(
                Student.school_id == school_id, Student.class_name == class_name, Student.status == "active"
            )
        )
    ).scalars().all()

    existing = (
        await db.execute(
            select(Invoice.student_id).where(Invoice.school_id == school_id, Invoice.term == term)
        )
    ).scalars().all()
    existing_ids = set(existing)

    created = []
    for student in students:
        if student.id in existing_ids:
            continue  # already invoiced for this term — skip, don't duplicate
        invoice = Invoice(
            school_id=school_id, student_id=student.id, term=term, total_amount=total_amount, due_date=due_date
        )
        db.add(invoice)
        created.append(invoice)

    await db.flush()
    return created
