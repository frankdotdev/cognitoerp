import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field


class AttendanceEntry(BaseModel):
    student_id: uuid.UUID
    class_name: str
    date: date
    status: str = Field(pattern="^(present|absent|late|excused)$")
    marked_at_device: datetime  # client-supplied — when it was ACTUALLY marked, not when it synced


class AttendanceSyncBatch(BaseModel):
    """POST body for the offline-sync endpoint — a device's whole queue at once."""
    records: list[AttendanceEntry] = Field(max_length=200)  # a large school's single class roster, capped defensively
