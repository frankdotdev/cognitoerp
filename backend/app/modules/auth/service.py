"""
Auth service. Implements the issuance-and-first-login flow:

  1. Admin creates a person's record -> generate_identity_code() + a random
     temporary password -> both handed to the person (SMS/email/printed slip).
  2. First login with (identity_code, temp_password) succeeds but the token
     response tells the client `must_change_password: true` — the frontend
     is required to route straight to a forced password-reset screen before
     anything else is reachable.
  3. After password reset, the person MAY link a Google account for a fcognitio
     login next time (see link_google_account) — this is always additive,
     never a replacement for the identity code login.
  4. Every subsequent login accepts EITHER (identity_code, password) OR a
     verified Google ID token whose `sub` matches a linked google_sub.

Brute-force protection: failed_login_attempts increments on every bad
password: after LOGIN_LOCKOUT_ATTEMPTS, the account is locked for
LOGIN_LOCKOUT_MINUTES. This applies per-account, not per-IP, because
identity codes are semi-guessable by design (sequential), so account-level
lockout is the meaningful defense here.
"""
import uuid
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.modules.auth.models import User, RefreshTokenFamily, Role


def generate_temp_password() -> str:
    # Human-typeable, unambiguous character set (no 0/O, 1/l confusion).
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(10))


async def issue_new_account(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    identity_code: str,
    full_name: str,
    role_id: uuid.UUID,
    created_by: uuid.UUID,
) -> tuple[User, str]:
    """Called by an admin-facing endpoint after generate_identity_code(). Returns (user, temp_password) — the
    caller is responsible for delivering temp_password out-of-band (SMS/email/printed slip) and MUST NOT log it."""
    temp_password = generate_temp_password()
    user = User(
        school_id=school_id,
        identity_code=identity_code,
        full_name=full_name,
        role_id=role_id,
        password_hash=hash_password(temp_password),
        must_change_password=True,
        created_by=created_by,
    )
    db.add(user)
    await db.flush()
    return user, temp_password


async def authenticate_with_identity_code(
    db: AsyncSession, *, school_id: uuid.UUID, identity_code: str, password: str
) -> User:
    stmt = select(User).where(User.school_id == school_id, User.identity_code == identity_code)
    result = await db.execute(stmt.execution_options(skip_tenant_filter=True))  # school_id given explicitly pre-auth
    user = result.scalar_one_or_none()

    generic_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "That identity code or password isn't right.")

    if user is None:
        raise generic_error

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status.HTTP_423_LOCKED,
            f"Too many failed attempts. Try again after {user.locked_until.strftime('%H:%M')}.",
        )

    if not verify_password(password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.LOGIN_LOCKOUT_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
        await db.flush()
        raise generic_error

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

    user.failed_login_attempts = 0
    user.locked_until = None
    await db.flush()
    return user


async def refresh_access_token(db: AsyncSession, *, refresh_token: str) -> dict:
    """
    Verifies a refresh token and issues a new access token — WITHOUT
    re-checking password/lockout, since presenting a valid, unexpired,
    unrevoked refresh token is itself the proof of identity here. Two
    things are checked beyond signature/expiry that a naive implementation
    would miss:
      1. token type must be "refresh" — an access token presented here is rejected,
         so a stolen short-lived access token can't be replayed as a refresh token.
      2. the token's family must not be revoked (RefreshTokenFamily.revoked) —
         this is what makes "log out everywhere" / "revoke on password change"
         actually work: revoking the family invalidates every refresh token
         issued under it, even ones already handed out, without needing to
         track or blocklist individual JWTs.
    """
    try:
        payload = decode_token(refresh_token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session expired. Sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token.")

    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type.")

    family_id = uuid.UUID(payload["family"])
    family = (await db.execute(select(RefreshTokenFamily).where(RefreshTokenFamily.id == family_id))).scalar_one_or_none()
    if family is None or family.revoked:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This session has been signed out. Sign in again.")

    user_id = uuid.UUID(payload["sub"])
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or inactive.")

    # Re-issues a full token pair under the SAME family — the access token
    # is short-lived and rotates freely; the family itself (and therefore
    # the ability to revoke everything at once) persists across refreshes.
    return await issue_tokens_for_user(db, user, existing_family_id=family.id)


async def revoke_refresh_family(db: AsyncSession, *, family_id: uuid.UUID, reason: str) -> None:
    """Called on password change / explicit logout-everywhere / suspected compromise."""
    family = (await db.execute(select(RefreshTokenFamily).where(RefreshTokenFamily.id == family_id))).scalar_one_or_none()
    if family is not None:
        family.revoked = True
        family.revoked_reason = reason
        await db.flush()


async def issue_tokens_for_user(db: AsyncSession, user: User, existing_family_id: uuid.UUID | None = None) -> dict:
    role_stmt = select(Role).where(Role.id == user.role_id).execution_options(skip_tenant_filter=True)
    role = (await db.execute(role_stmt)).scalar_one()

    # Delegation: an active, unexpired delegated role overrides the base role's permissions.
    active_permissions = role.permissions
    if user.delegated_role_id and user.delegation_expires_at and user.delegation_expires_at > datetime.now(timezone.utc):
        delegated_stmt = select(Role).where(Role.id == user.delegated_role_id).execution_options(skip_tenant_filter=True)
        delegated_role = (await db.execute(delegated_stmt)).scalar_one()
        active_permissions = delegated_role.permissions

    if existing_family_id is not None:
        token_family = existing_family_id
    else:
        family_row = RefreshTokenFamily(school_id=user.school_id, user_id=user.id)
        db.add(family_row)
        await db.flush()
        token_family = family_row.id  # BUG FIX: previously a separate uuid.uuid4() that never matched the row's real id

    access_token = create_access_token(
        user_id=user.id, school_id=user.school_id, role=role.name, permissions=active_permissions
    )
    refresh_token = create_refresh_token(user_id=user.id, school_id=user.school_id, token_family=token_family)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password,
    }
