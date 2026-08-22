"""
File upload endpoints for a school's own assets (logo, favicon, stamp,
signature). Deliberately a separate router file from schools/router.py
rather than crowding one file with two different concerns (branding CRUD
vs. file upload orchestration) — both still mount under the same
/schools prefix in main.py.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.storage import generate_upload_url, object_belongs_to_school, generate_download_url
from app.modules.auth.dependencies import require_permission, CurrentUser
from app.modules.schools.models import SchoolTheme

router = APIRouter()

_THEME_ASSET_FIELDS = {"logos": "logo_url", "favicons": "favicon_url", "stamps": "stamp_url", "signatures": "signature_url"}


class UploadUrlRequest(BaseModel):
    category: str  # logos | favicons | stamps | signatures
    filename: str
    content_type: str


class ConfirmUploadRequest(BaseModel):
    category: str
    object_key: str


@router.post("/me/assets/upload-url")
async def request_upload_url(
    payload: UploadUrlRequest,
    current_user: CurrentUser = Depends(require_permission("settings.edit")),
):
    """
    Step 1 of a branding-asset upload: backend issues a presigned URL, the
    frontend PUTs the actual file bytes directly to R2 (see core/storage.py's
    docstring for why — the backend never proxies the upload).
    """
    return generate_upload_url(
        school_id=current_user.school_id, category=payload.category, filename=payload.filename, content_type=payload.content_type
    )


@router.post("/me/assets/confirm")
async def confirm_asset_upload(
    payload: ConfirmUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("settings.edit")),
):
    """
    Step 2: after the direct-to-R2 upload succeeds, the frontend calls this
    to actually save the object_key against the school's theme. Verifies
    the key genuinely belongs to this school before trusting it — a client
    could otherwise submit an arbitrary object_key from a different tenant.
    """
    if payload.category not in _THEME_ASSET_FIELDS:
        return {"error": f"Unknown asset category '{payload.category}'"}

    if not object_belongs_to_school(object_key=payload.object_key, school_id=current_user.school_id):
        return {"error": "That file doesn't belong to your school."}

    field_name = _THEME_ASSET_FIELDS[payload.category]
    result = await db.execute(select(SchoolTheme).where(SchoolTheme.school_id == current_user.school_id))
    theme = result.scalar_one()
    setattr(theme, field_name, payload.object_key)
    theme.theme_version += 1
    await db.commit()

    return {"status": "saved", field_name: payload.object_key, "preview_url": generate_download_url(object_key=payload.object_key)}
