import uuid
from datetime import date
from pydantic import BaseModel, ConfigDict, Field


class StaffRecordCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    role_title: str = Field(min_length=2, max_length=100)
    employment_date: date
    monthly_salary: float = Field(gt=0)
    bank_name: str | None = None
    bank_account_number: str | None = None


class StaffRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    staff_id: str
    full_name: str
    role_title: str
    monthly_salary: float
    status: str


class GeneratePayslipRequest(BaseModel):
    staff_record_id: uuid.UUID
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    deductions: dict[str, float] = Field(default_factory=dict)


class PayslipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    staff_record_id: uuid.UUID
    month: str
    gross_salary: float
    deductions: dict
    net_salary: float
    status: str


class LeaveRequestCreate(BaseModel):
    staff_record_id: uuid.UUID
    start_date: date
    end_date: date
    reason: str | None = None


class LeaveRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    staff_record_id: uuid.UUID
    start_date: date
    end_date: date
    status: str
