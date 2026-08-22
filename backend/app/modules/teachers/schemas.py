import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class TeacherCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    qualification: str | None = None
    employment_date: date
    subjects: list[str] = Field(default_factory=list)


class TeacherUpdate(BaseModel):
    full_name: str | None = None
    qualification: str | None = None
    subjects: list[str] | None = None
    status: str | None = None
    version: int


class TeacherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    identity_code: str
    staff_id: str
    full_name: str
    subjects: list[str]
    status: str
    photo_url: str | None
    employment_date: date
    version: int


class ClassAssignmentCreate(BaseModel):
    teacher_id: uuid.UUID
    class_name: str
    subject: str | None = None
    is_class_teacher: bool = False
