import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    category: str
    channel: str
    subject: str | None
    body: str
    status: str
    created_at: datetime


class NotificationPreferenceUpdate(BaseModel):
    category: str
    channel: str  # in_app | email | sms
    digest: str = "immediate"
    enabled: bool = True
