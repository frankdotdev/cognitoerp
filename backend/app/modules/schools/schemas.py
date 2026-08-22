import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SchoolOnboardingRequest(BaseModel):
    """Step 1 of the onboarding wizard (doc 005) — creates the school + its first Super Admin."""
    name: str = Field(min_length=2, max_length=150)
    school_code: str = Field(min_length=2, max_length=10, pattern="^[A-Z0-9]+$")
    subdomain: str = Field(min_length=2, max_length=50, pattern="^[a-z0-9-]+$")
    motto: str | None = None
    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None

    principal_full_name: str = Field(min_length=2, max_length=150)
    principal_email: EmailStr
    principal_phone: str

    plan: str = Field(default="foundation", pattern="^(foundation|academy|excellence|enterprise)$")


class SchoolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    school_code: str
    subdomain: str
    plan: str
    student_limit: int
    is_active: bool
    trial_ends_at: datetime | None
    stella_ai_enabled: bool
    lms_enabled: bool
    cbt_enabled: bool


class SchoolThemeUpdate(BaseModel):
    """Every field optional — PATCH semantics from the Settings > Branding screen (doc 015)."""
    primary_color: str | None = Field(default=None, pattern="^#[0-9A-Fa-f]{6}$")
    secondary_color: str | None = Field(default=None, pattern="^#[0-9A-Fa-f]{6}$")
    accent_color: str | None = Field(default=None, pattern="^#[0-9A-Fa-f]{6}$")
    logo_url: str | None = None
    report_card_template: str | None = None
    certificate_template: str | None = None
    dark_mode_enabled: bool | None = None


class SchoolThemeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    primary_color: str
    secondary_color: str
    accent_color: str
    logo_url: str | None
    favicon_url: str | None
    report_card_template: str
    certificate_template: str
    dark_mode_enabled: bool
    theme_version: int


class SchoolClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    sections: list[str] = Field(default_factory=list)
    display_order: int = 0


class SchoolClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    sections: list[str]
    display_order: int
