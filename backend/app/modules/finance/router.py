"""
Finance router. The Paystack webhook route is deliberately NOT behind
get_current_user — Paystack calls it directly, with no JWT — so it verifies
the payload's signature itself (see verify_paystack_signature) instead.
"""
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.tenant_guard import set_current_tenant
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.finance.models import Invoice, FeeStructure
from app.modules.finance.schemas import (
    InvoiceOut, RecordManualPaymentRequest, PaymentOut,
    FeeStructureCreate, FeeStructureOut, GenerateInvoicesRequest,
)
from app.modules.finance import service
from app.modules.schools.models import School

router = APIRouter()


@router.get("/fee-structures", response_model=list[FeeStructureOut])
async def list_fee_structures(
    class_name: str | None = None,
    term: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("fees.view")),
):
    stmt = select(FeeStructure)
    if class_name:
        stmt = stmt.where(FeeStructure.class_name == class_name)
    if term:
        stmt = stmt.where(FeeStructure.term == term)
    return (await db.execute(stmt)).scalars().all()


@router.post("/fee-structures", response_model=FeeStructureOut, status_code=201)
async def create_fee_structure(
    payload: FeeStructureCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("fees.edit")),
):
    row = FeeStructure(school_id=current_user.school_id, created_by=current_user.user_id, **payload.model_dump())
    db.add(row)
    await db.commit()
    return row


@router.post("/invoices/generate", response_model=list[InvoiceOut], status_code=201)
async def generate_invoices(
    payload: GenerateInvoicesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("fees.edit")),
):
    invoices = await service.generate_invoices_for_class(
        db, school_id=current_user.school_id, class_name=payload.class_name, term=payload.term
    )
    await db.commit()
    return invoices


@router.get("/invoices", response_model=list[InvoiceOut])
async def list_invoices(
    student_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("fees.view")),
):
    stmt = select(Invoice)
    if student_id:
        stmt = stmt.where(Invoice.student_id == student_id)
    if status_filter:
        stmt = stmt.where(Invoice.status == status_filter)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/payments/manual", response_model=PaymentOut, status_code=201)
async def record_manual_payment(
    payload: RecordManualPaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("fees.edit")),
):
    school = (await db.execute(select(School).where(School.id == current_user.school_id))).scalar_one()
    payment = await service.record_manual_payment(
        db,
        invoice_id=payload.invoice_id,
        amount=payload.amount,
        idempotency_key=payload.idempotency_key,
        school_code=school.school_code,
    )
    await db.commit()
    return payment


@router.post("/webhooks/paystack", status_code=200, include_in_schema=False)
async def paystack_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    raw_body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    if not service.verify_paystack_signature(raw_body, signature):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid webhook signature.")

    event = await request.json()
    # Paystack webhooks carry no school context by default — the
    # payment-link metadata (set when we generate the invoice link) must
    # include school_id, resolved here BEFORE any tenant-scoped query runs.
    school_id = uuid.UUID(event["data"]["metadata"]["school_id"])
    set_current_tenant(school_id)

    school = (
        await db.execute(select(School).where(School.id == school_id).execution_options(skip_tenant_filter=True))
    ).scalar_one()

    await service.process_paystack_webhook(db, event, school_code=school.school_code)
    await db.commit()
    return {"status": "ok"}


@router.post("/invoices/{invoice_id}/initialize-payment")
async def initialize_payment(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("fees.view")),
):
    """
    Generates a Paystack payment link for a specific invoice. This is the
    missing counterpart to the webhook receiver above — without this, a
    parent has no URL to click to actually pay online. The webhook handles
    what happens AFTER they pay; this initiates the payment.
    """
    from app.modules.students.models import Student

    invoice = (await db.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found.")

    balance = float(invoice.total_amount) - float(invoice.discount_amount) - float(invoice.amount_paid)
    if balance <= 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "This invoice is already fully paid.")

    # Resolve the payer's email — guardian first, school fallback
    student = (await db.execute(select(Student).where(Student.id == invoice.student_id))).scalar_one_or_none()
    school = (await db.execute(select(School).where(School.id == current_user.school_id))).scalar_one()
    email = (student.guardian_email if student and student.guardian_email else school.email) or "parent@example.com"

    if not settings.PAYSTACK_SECRET_KEY:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Online payments are not configured yet — the school's Paystack account is pending setup.",
        )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.paystack.co/transaction/initialize",
            headers={"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"},
            json={
                "email": email,
                "amount": int(balance * 100),  # Paystack expects kobo
                "metadata": {
                    "invoice_id": str(invoice_id),
                    "school_id": str(current_user.school_id),
                },
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Payment gateway error — please try again.")

    data = resp.json().get("data", {})
    return {
        "authorization_url": data.get("authorization_url"),
        "reference": data.get("reference"),
    }
