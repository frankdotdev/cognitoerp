import uuid
from datetime import date
from pydantic import BaseModel, ConfigDict


class LinkChildRequest(BaseModel):
    admission_number: str
    date_of_birth: date  # verification factor — must match the student record to auto-approve


class ParentStudentLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    student_id: uuid.UUID
    status: str


class ChildSummaryOut(BaseModel):
    """What a parent sees per linked child — assembled from Student + Attendance + Finance + Results."""
    student_id: uuid.UUID
    full_name: str
    class_name: str
    attendance_percent: float | None
    outstanding_fees: float
    latest_report_card_published: bool
