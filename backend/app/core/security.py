"""
Security primitives shared across the whole app.
Never call jwt.encode / passlib directly from a router or service — always
go through these functions so token structure and hashing stay consistent
if we ever need to rotate algorithms.
"""
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

_hasher = PasswordHasher()  # Argon2id, tuned defaults — deliberately not bcrypt.


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, plain)
    except VerifyMismatchError:
        return False


def create_access_token(*, user_id: uuid.UUID, school_id: uuid.UUID, role: str, permissions: list[str]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "school_id": str(school_id),
        "role": role,
        "permissions": permissions,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(*, user_id: uuid.UUID, school_id: uuid.UUID, token_family: uuid.UUID) -> str:
    """
    token_family lets us revoke an entire chain of refresh tokens at once
    (e.g. on password change or suspected compromise) rather than only the
    single token being used right now — see auth/service.py rotate_refresh_token.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "school_id": str(school_id),
        "family": str(token_family),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    # Raises jwt.ExpiredSignatureError / jwt.InvalidTokenError — callers handle these
    # explicitly rather than letting a bad token silently pass through.
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
