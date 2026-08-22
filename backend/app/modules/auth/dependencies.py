"""
FastAPI dependencies for authentication and authorization.

get_current_user is the single entry point that:
  1. Verifies the JWT (signature + expiry).
  2. Resolves the tenant (school_id) FROM THE TOKEN — never from a request
     header, query param, or path segment. This is deliberate: if tenant
     resolution ever trusted client input, a school could simply pass a
     different school_id and read another tenant's data.
  3. Sets the ContextVar the tenant_guard.py ORM filter reads.

require_permission() is how every protected route declares what it needs,
e.g. `Depends(require_permission("fees.edit"))`. Superadmin/platform-support
routes bypass this entirely via a separate, more tightly scoped dependency
(not shown here) that still requires its own elevated auth.
"""
import uuid
from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.db.tenant_guard import set_current_tenant

bearer_scheme = HTTPBearer()


class CurrentUser:
    def __init__(self, user_id: uuid.UUID, school_id: uuid.UUID, role: str, permissions: list[str]):
        self.user_id = user_id
        self.school_id = school_id
        self.role = role
        self.permissions = set(permissions)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session expired. Sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token.")

    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type.")

    school_id = uuid.UUID(payload["school_id"])
    set_current_tenant(school_id)  # every query for the rest of this request is now scoped to this school

    return CurrentUser(
        user_id=uuid.UUID(payload["sub"]),
        school_id=school_id,
        role=payload["role"],
        permissions=payload.get("permissions", []),
    )


def require_permission(permission_code: str):
    """
    Usage: @router.delete(..., dependencies=[Depends(require_permission("students.delete"))])
    Every permission is an explicit, checkable string — nothing is implied by role name alone,
    per the product requirement that permissions are individually assignable checkboxes.

    The literal permission "*" (seeded only on the Super Admin role — see
    schools/service.py DEFAULT_ROLE_PERMISSIONS) bypasses every check. This is
    deliberately the ONLY wildcard in the system — no other role, including
    Principal, gets one, so accidentally over-granting a custom role can
    never silently become "can do everything."
    """
    async def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if "*" in current_user.permissions:
            return current_user
        if permission_code not in current_user.permissions:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Your role doesn't have permission to do this ({permission_code}).",
            )
        return current_user

    return checker
