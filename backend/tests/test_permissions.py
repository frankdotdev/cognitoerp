"""
Permission-boundary tests, per doc 018: every sensitive endpoint needs a
test proving a role WITHOUT the required permission is rejected, not just
a happy-path test proving a role WITH it succeeds. Testing require_permission
directly (unit-level) rather than through full HTTP requests, since the
dependency function itself is what every route delegates the decision to —
if it's correct, every route using it inherits that correctness.
"""
import pytest
from fastapi import HTTPException

from app.modules.auth.dependencies import require_permission, CurrentUser


@pytest.mark.asyncio
async def test_user_without_permission_is_rejected():
    checker = require_permission("fees.edit")
    user = CurrentUser(user_id=__import__("uuid").uuid4(), school_id=__import__("uuid").uuid4(), role="Teacher", permissions=["students.view", "attendance.mark"])

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=user)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_user_with_permission_is_allowed():
    checker = require_permission("attendance.mark")
    user = CurrentUser(user_id=__import__("uuid").uuid4(), school_id=__import__("uuid").uuid4(), role="Teacher", permissions=["students.view", "attendance.mark"])

    result = await checker(current_user=user)
    assert result is user


@pytest.mark.asyncio
async def test_super_admin_wildcard_bypasses_every_check():
    """
    Regression test for the exact bug caught and fixed in session five:
    the "*" wildcard was seeded on the Super Admin role but wasn't actually
    honored by require_permission until this was caught. This test exists
    specifically so that bug class can never silently come back.
    """
    checker = require_permission("literally.anything.not.seeded.anywhere")
    user = CurrentUser(user_id=__import__("uuid").uuid4(), school_id=__import__("uuid").uuid4(), role="Super Admin", permissions=["*"])

    result = await checker(current_user=user)
    assert result is user


@pytest.mark.asyncio
async def test_parent_role_cannot_access_finance_permission():
    checker = require_permission("fees.edit")
    user = CurrentUser(user_id=__import__("uuid").uuid4(), school_id=__import__("uuid").uuid4(), role="Parent", permissions=["own_children.view"])

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=user)
    assert exc_info.value.status_code == 403
