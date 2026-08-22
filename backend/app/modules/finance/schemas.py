import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class FeeStructureCreate(BaseModel):
    class_name: str
    term: str
    fee_category: str
    amount: float = Field(gt=0)
    due_date: date


class FeeStructureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    class_name: str
    term: str
    fee_category: str
    amount: float
    due_date: date


class GenerateInvoicesRequest(BaseModel):
    class_name: str
    term: str
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    student_id: uuid.UUID
    term: str
    total_amount: float
    discount_amount: float
    amount_paid: float
    due_date: date
    status: str


class RecordManualPaymentRequest(BaseModel):
    invoice_id: uuid.UUID
    amount: float = Field(gt=0)
    # Client-generated — the frontend generates one UUID per "Pay now" click
    # and reuses it on any automatic retry, which is what makes the
    # idempotency guarantee in finance/service.py actually work end-to-end.
    idempotency_key: str = Field(min_length=8, max_length=100)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: float
    method: str
    status: str
    receipt_number: str
    paid_at: datetime | None
