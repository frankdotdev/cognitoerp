"""
Generic staff account issuance — the gap between "Students and Teachers
have their own create flows" and "everyone else has no way to get a
login at all." A Principal, Registrar, Accountant, Librarian, or ICT
Admin account is issued through here.

This is specifically what makes the real-world pattern the product
description settled on possible: the person who actually runs onboarding
is often not the Principal — it's whoever is the school's de facto "IT
person," non-technical schools included. That person becomes the Super
Admin from `POST /schools/onboard`, and then uses THIS endpoint to issue
a separate, appropriately-scoped Principal account (or Registrar,
Accountant, etc.) — the Principal never needs to touch the onboarding
wizard at all if they don't want to.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, AsyncSessionLocal
from app.db.tenant_guard import set_current_tenant
from app.core.security import hash_password
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.auth.identity_code import generate_identity_code, RolePrefix
from app.modules.auth.models import User, Role
from app.modules.auth.service import generate_temp_password
from app.modules.schools.models import School

router = APIRouter()

# Roles issuable through this endpoint. Deliberately excludes "Super Admin"
# and "Student" — Super Admin is only ever created once, at onboarding
# (schools/service.py), and Student has its own richer create flow
# (students/router.py) with admission-specific fields this generic
# endpoint doesn't collect.
_ISSUABLE_ROLES = {"Principal", "Vice Principal", "Registrar", "Accountant", "Librarian", "ICT Admin", "Teacher", "Parent"}


class StaffAccountCreate(BaseModel):
    full_name: str
    role_name: str
    email: EmailStr | None = None
    phone: str | None = None


class StaffAccountOut(BaseModel):
    identity_code: str
    full_name: str
    role_name: str


@router.post("/me/staff-accounts", response_model=StaffAccountOut, status_code=status.HTTP_201_CREATED)
async def create_staff_account(
    payload: StaffAccountCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("staff.manage")),
):
    if payload.role_name not in _ISSUABLE_ROLES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"'{payload.role_name}' isn't an issuable role here. Use one of: {', '.join(sorted(_ISSUABLE_ROLES))}.",
        )
    if not payload.email and not payload.phone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide at least an email or phone number so this person can receive their login.")

    school = (await db.execute(select(School).where(School.id == current_user.school_id))).scalar_one()
    role = (
        await db.execute(select(Role).where(Role.school_id == current_user.school_id, Role.name == payload.role_name))
    ).scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Role '{payload.role_name}' hasn't been set up for this school.")

    # Reuses the same role-prefix scheme as every other identity — a
    # Principal/Registrar/Accountant/Librarian/ICT Admin all get an ADM-
    # prefixed code (they're all "admin-tier" staff for identity purposes);
    # Teacher and Parent keep their own established prefixes.
    prefix = {"Teacher": RolePrefix.TEACHER, "Parent": RolePrefix.PARENT}.get(payload.role_name, RolePrefix.ADMIN)
    identity_code = await generate_identity_code(db, school_code=school.school_code, role=prefix, year=datetime.now().year)
    temp_password = generate_temp_password()

    user = User(
        school_id=current_user.school_id,
        identity_code=identity_code,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(temp_password),
        must_change_password=True,
        role_id=role.id,
        created_by=current_user.user_id,
    )
    db.add(user)
    await db.flush()
    user_id = user.id
    await db.commit()

    if payload.email:
        background_tasks.add_task(_send_staff_welcome_email, current_user.school_id, school.name, user_id, identity_code, temp_password, payload.role_name)

    return StaffAccountOut(identity_code=identity_code, full_name=payload.full_name, role_name=payload.role_name)


async def _send_staff_welcome_email(
    school_id: uuid.UUID, school_name: str, user_id: uuid.UUID, identity_code: str, temp_password: str, role_name: str
) -> None:
    """Same pattern as the onboarding welcome email (schools/router.py) — its own db session, since a BackgroundTask outlives the request's."""
    from app.modules.notifications.service import queue_notification

    async with AsyncSessionLocal() as bg_db:
        set_current_tenant(school_id)
        await queue_notification(
            bg_db,
            school_id=school_id,
            recipient_user_id=user_id,
            category="onboarding",
            subject=f"Your {role_name} account at {school_name}",
            body=(
                f"You've been added as {role_name} at {school_name} on Cognitio ERP.\n\n"
                f"Sign-in code: {identity_code}\n"
                f"Temporary password: {temp_password}\n\n"
                f"You'll be asked to set a new password on first sign-in."
            ),
            idempotency_key=f"staff-welcome:{user_id}",
            requested_channel="email",
        )
        await bg_db.commit()
