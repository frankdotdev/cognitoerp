import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class StudentCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    date_of_birth: date | None = None
    gender: str | None = None
    class_name: str = Field(min_length=1, max_length=50)
    section: str | None = None
    admission_date: date
    guardian_name: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    # A school with an existing official registration-number scheme (many
    # do) can supply their own number here instead of getting an
    # Cognitio-generated one — the admin "officially registers" it into the
    # portal, per the real-world requirement, rather than the platform
    # imposing its own numbering on a school that already has one.
    official_admission_number: str | None = Field(default=None, max_length=40)


class StudentUpdate(BaseModel):
    """All fields optional — PATCH semantics. Only supplied fields are changed."""
    full_name: str | None = None
    class_name: str | None = None
    section: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    status: str | None = None
    # Required for optimistic locking: the client must send back the version
    # it last read. A mismatch means someone else edited this record first.
    version: int


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    identity_code: str
    admission_number: str
    full_name: str
    class_name: str
    section: str | None
    status: str
    photo_url: str | None
    admission_date: date
    exit_date: date | None
    exit_reason: str | None
    created_at: datetime
    version: int


class StudentListParams(BaseModel):
    """Query params for GET /students — every list endpoint follows this shape."""
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)
    class_name: str | None = None
    status: str | None = None
    search: str | None = None  # matches full_name or admission_number
    sort_by: str = "full_name"
    sort_dir: str = Field(default="asc", pattern="^(asc|desc)$")
