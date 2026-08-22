import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=1)
    target_classes: list[str] | None = None  # None = whole school


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    body: str
    target_classes: list[str] | None
    created_at: datetime


class TicketCreate(BaseModel):
    subject: str = Field(min_length=2, max_length=200)
    message: str = Field(min_length=1)
    category: str = Field(pattern="^(fees|academics|general)$")


class TicketReplyCreate(BaseModel):
    message: str = Field(min_length=1)


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    subject: str
    message: str
    category: str
    status: str
    created_at: datetime
