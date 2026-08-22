"""
Public onboarding endpoint — the only endpoint in the app that creates data
with no authenticated user yet (see docs/003 and schools/service.py for why).
Everything else under /schools requires an authenticated Super Admin.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission, get_current_user, CurrentUser
from app.modules.schools.schemas import SchoolOnboardingRequest, SchoolOut, SchoolThemeUpdate, SchoolThemeOut
from app.modules.schools.service import onboard_school
from app.modules.schools.models import School, SchoolTheme
from sqlalchemy import select

router = APIRouter()


@router.post("/onboard", response_model=SchoolOut, status_code=status.HTTP_201_CREATED)
async def onboard(
    payload: SchoolOnboardingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await onboard_school(db, payload)
    await db.commit()

    # Deliver credentials by email — the piece that makes genuine self-serve
    # signup real: a school reaching Cognitio through an ad, with zero contact
    # from anyone at Cognitio, needs a way to actually receive their login.
    # Runs as a background task with its OWN db session (see the identical
    # pattern and reasoning in communication/router.py's _fan_out_announcement
    # — the request's `db` session is closed by the time a BackgroundTask
    # runs, so reusing it here would be the same bug caught and fixed there).
    background_tasks.add_task(
        _send_welcome_email,
        result["school"].id,
        result["school"].name,
        result["admin_identity_code"],
        result["admin_temp_password"],
    )

    return result["school"]


async def _send_welcome_email(school_id: uuid.UUID, school_name: str, identity_code: str, temp_password: str) -> None:
    from app.db.session import AsyncSessionLocal
    from app.db.tenant_guard import set_current_tenant
    from app.modules.notifications.service import queue_notification
    from app.modules.auth.models import User

    async with AsyncSessionLocal() as bg_db:
        set_current_tenant(school_id)
        admin = (
            await bg_db.execute(select(User).where(User.school_id == school_id, User.identity_code == identity_code))
        ).scalar_one_or_none()
        if admin is None:
            return  # shouldn't happen — onboard_school just created this row in the same transaction

        await queue_notification(
            bg_db,
            school_id=school_id,
            recipient_user_id=admin.id,
            category="onboarding",
            subject=f"Welcome to Cognitio ERP, {school_name}",
            body=(
                f"Your school's Cognitio ERP account is ready.\n\n"
                f"Sign-in code: {identity_code}\n"
                f"Temporary password: {temp_password}\n\n"
                f"You'll be asked to set a new password on first sign-in."
            ),
            idempotency_key=f"onboarding-welcome:{school_id}",
            requested_channel="email",  # must reach them somewhere — they have no in-app inbox to check yet
        )
        await bg_db.commit()


@router.get("/me", response_model=SchoolOut)
async def get_my_school(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(School).where(School.id == current_user.school_id))
    return result.scalar_one()


@router.get("/me/theme", response_model=SchoolThemeOut)
async def get_my_theme(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("settings.edit")),
):
    result = await db.execute(select(SchoolTheme).where(SchoolTheme.school_id == current_user.school_id))
    return result.scalar_one()


@router.patch("/me/theme", response_model=SchoolThemeOut)
async def update_my_theme(
    payload: SchoolThemeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("settings.edit")),
):
    result = await db.execute(select(SchoolTheme).where(SchoolTheme.school_id == current_user.school_id))
    theme = result.scalar_one()
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(theme, key, value)
    theme.theme_version += 1  # frontend cache-busts logo/branding assets on this
    await db.commit()
    return theme


from app.modules.schools.models import SchoolClass
from app.modules.schools.schemas import SchoolClassCreate, SchoolClassOut


@router.get("/me/classes", response_model=list[SchoolClassOut])
async def list_classes(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    stmt = (
        select(SchoolClass)
        .where(SchoolClass.school_id == current_user.school_id, SchoolClass.deleted_at.is_(None))
        .order_by(SchoolClass.display_order)
    )
    return (await db.execute(stmt)).scalars().all()


@router.post("/me/classes", response_model=SchoolClassOut, status_code=201)
async def create_class(
    payload: SchoolClassCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("settings.edit")),
):
    row = SchoolClass(school_id=current_user.school_id, created_by=current_user.user_id, **payload.model_dump())
    db.add(row)
    await db.commit()
    return row


@router.delete("/me/classes/{class_id}", status_code=204)
async def delete_class(
    class_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("settings.edit")),
):
    row = (
        await db.execute(
            select(SchoolClass).where(
                SchoolClass.id == class_id, SchoolClass.school_id == current_user.school_id, SchoolClass.deleted_at.is_(None)
            )
        )
    ).scalar_one()
    row.deleted_at = datetime.now(timezone.utc)
    row.deleted_by = current_user.user_id
    await db.commit()


@router.get("/resolve", response_model=SchoolOut | None)
async def resolve_current_school(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Public, no auth — the frontend calls this on every page load (or once,
    cached) to answer "which school does this URL belong to." Powers the
    login page: instead of needing a hardcoded/placeholder school_id (the
    exact gap flagged in review), the login form now resolves the school
    from the browser's own hostname automatically via the subdomain
    middleware (core/subdomain.py), which already ran before this handler.
    """
    school_id = getattr(request.state, "school_id", None)
    if school_id is None:
        return None
    result = await db.execute(select(School).where(School.id == school_id).execution_options(skip_tenant_filter=True))
    return result.scalar_one_or_none()
