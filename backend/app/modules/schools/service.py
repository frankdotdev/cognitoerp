"""
Onboarding is the one place in the system that creates a User OUTSIDE the
normal admin-issues-identity flow (doc 003) — there's no admin yet for a
brand-new school. Everything here runs in a single DB transaction: if any
step fails, nothing is left half-created (no orphaned school with no admin,
no admin pointing at a school that doesn't exist).
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.modules.schools.models import School, SchoolTheme
from app.modules.schools.schemas import SchoolOnboardingRequest
from app.modules.auth.models import Role, User
from app.modules.auth.identity_code import generate_identity_code, RolePrefix
from app.modules.auth.service import generate_temp_password
from app.core.security import hash_password

PLAN_STUDENT_LIMITS = {"foundation": 200, "academy": 450, "excellence": 1000, "enterprise": 100000}

# Default RBAC permission sets seeded for every new school (doc 005).
# Kept here, not in a migration, so onboarding-time seeding logic and the
# actual permission strings stay next to each other and easy to keep in sync.
DEFAULT_ROLE_PERMISSIONS = {
    "Super Admin": ["*"],  # wildcard, resolved specially in require_permission — always allowed
    "Principal": [
        "students.view", "students.edit", "students.delete", "teachers.view", "teachers.edit",
        "attendance.view", "results.view", "results.publish", "fees.view", "fees.edit",
        "settings.edit", "reports.view", "staff.manage", "inventory.view", "inventory.edit",
    ],
    "Vice Principal": ["students.view", "students.edit", "teachers.view", "attendance.view", "results.view", "reports.view", "inventory.view"],
    "Registrar": ["students.view", "students.edit", "students.create"],
    "Accountant": ["fees.view", "fees.edit", "reports.view", "staff.manage"],  # payroll sits with Finance at most schools
    "Teacher": ["students.view", "attendance.mark", "results.enter", "inventory.view"],
    "Librarian": ["students.view", "inventory.view", "inventory.edit"],
    "ICT Admin": ["settings.edit", "staff.manage", "students.view", "teachers.view", "inventory.view", "inventory.edit"],  # the "main IT guy" role — full operational access without the Super Admin wildcard
    "Parent": ["own_children.view"],
    "Student": ["own_profile.view"],
}


async def onboard_school(db: AsyncSession, payload: SchoolOnboardingRequest) -> dict:
    existing = await db.execute(
        select(School)
        .where((School.school_code == payload.school_code) | (School.subdomain == payload.subdomain))
        .execution_options(skip_tenant_filter=True)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That school code or subdomain is already taken.")

    school = School(
        name=payload.name,
        school_code=payload.school_code,
        subdomain=payload.subdomain,
        motto=payload.motto,
        address=payload.address,
        phone=payload.phone,
        email=payload.email,
        plan=payload.plan,
        student_limit=PLAN_STUDENT_LIMITS[payload.plan],
        principal_name=payload.principal_full_name,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(school)
    await db.flush()  # need school.id for everything below

    db.add(SchoolTheme(school_id=school.id))

    roles_by_name: dict[str, Role] = {}
    for role_name, permissions in DEFAULT_ROLE_PERMISSIONS.items():
        role = Role(
            school_id=school.id, name=role_name, is_system_role=True, permissions=permissions
        )
        db.add(role)
        await db.flush()
        roles_by_name[role_name] = role

    identity_code = await generate_identity_code(
        db, school_code=school.school_code, role=RolePrefix.ADMIN, year=datetime.now().year
    )
    temp_password = generate_temp_password()
    admin_user = User(
        school_id=school.id,
        identity_code=identity_code,
        full_name=payload.principal_full_name,
        email=payload.principal_email,
        phone=payload.principal_phone,
        password_hash=hash_password(temp_password),
        must_change_password=True,
        role_id=roles_by_name["Super Admin"].id,
    )
    db.add(admin_user)
    await db.flush()

    # Caller (router) commits the transaction and is responsible for delivering
    # identity_code + temp_password out-of-band (email) — never returned in a
    # response that could be logged or cached.
    return {"school": school, "admin_identity_code": identity_code, "admin_temp_password": temp_password}
