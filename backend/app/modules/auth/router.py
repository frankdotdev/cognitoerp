"""
Auth routes. Public (no auth required): login, refresh, forced password reset.
Everything else in the app requires get_current_user (see dependencies.py).
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import hash_password, verify_password
from app.core.rate_limit import rate_limit_auth
from app.modules.auth import service, oauth
from app.modules.auth.dependencies import get_current_user, CurrentUser
from app.modules.auth.models import User

router = APIRouter()


class LoginRequest(BaseModel):
    school_id: uuid.UUID  # resolved by the frontend from subdomain before this call — see doc 004
    identity_code: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    must_change_password: bool


class ForcedPasswordResetRequest(BaseModel):
    school_id: uuid.UUID
    identity_code: str
    current_password: str
    new_password: str


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    rate_limit_auth(request)
    user = await service.authenticate_with_identity_code(
        db, school_id=payload.school_id, identity_code=payload.identity_code, password=payload.password
    )
    tokens = await service.issue_tokens_for_user(db, user)
    await db.commit()
    return tokens


@router.post("/reset-password")
async def reset_password(payload: ForcedPasswordResetRequest, request: Request, db: AsyncSession = Depends(get_db)):
    rate_limit_auth(request)
    user = await service.authenticate_with_identity_code(
        db, school_id=payload.school_id, identity_code=payload.identity_code, password=payload.current_password
    )
    if len(payload.new_password) < 8:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Password must be at least 8 characters.")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    await db.commit()
    return {"status": "password_updated"}


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=LoginResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    tokens = await service.refresh_access_token(db, refresh_token=payload.refresh_token)
    await db.commit()
    return tokens


class GoogleLoginRequest(BaseModel):
    school_id: uuid.UUID
    google_id_token: str


class LinkGoogleRequest(BaseModel):
    google_id_token: str


@router.post("/login/google", response_model=LoginResponse)
async def login_with_google(payload: GoogleLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Only succeeds if this Google account was already linked to an existing
    Cognitio account (see oauth.py's docstring) — Google can never create or
    take over an account on its own, only serve as an alternate login for
    one that already exists via the school-issued Identity Code.
    """
    rate_limit_auth(request)
    user = await oauth.authenticate_with_google(db, school_id=payload.school_id, google_id_token_str=payload.google_id_token)
    tokens = await service.issue_tokens_for_user(db, user)
    await db.commit()
    return tokens


@router.post("/link-google")
async def link_google(
    payload: LinkGoogleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Requires being already logged in via Identity Code — linking is something an existing account does to itself."""
    await oauth.link_google_account(
        db, school_id=current_user.school_id, user_id=current_user.user_id, google_id_token_str=payload.google_id_token
    )
    await db.commit()
    return {"status": "linked"}
