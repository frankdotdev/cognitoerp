"""
Generates the school-issued Identity Code that is the PRIMARY identity for
every student, teacher, parent, and staff member on the platform.

Format:  {SCHOOL_CODE}-{ROLE_PREFIX}-{YEAR}-{SEQUENCE}
Example: CMS-STU-2026-00341

Design intent (see product decision log):
  - This code is the account's real, permanent identifier. It is issued by
    a school administrator when the person's record is created — nobody
    self-registers into a school.
  - A linked Google/Apple account (see auth/oauth.py) is only ever an
    alternate login path layered on top of this identity. If the OAuth
    link breaks or the person loses access to that email, the Identity
    Code + password still works — the school owns the identity, not a
    third-party provider.
  - Codes are never reused, even after a student leaves — sequence numbers
    only ever increment per (school, role, year).
"""
import uuid
from enum import Enum

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import IdentitySequence


class RolePrefix(str, Enum):
    STUDENT = "STU"
    TEACHER = "TCH"
    PARENT = "PAR"
    STAFF = "STF"
    ADMIN = "ADM"
    ADMISSION = "ADMN"  # distinct sequence for admission numbers vs. login identity codes — see students/router.py


async def generate_identity_code(
    db: AsyncSession, *, school_code: str, role: RolePrefix, year: int
) -> str:
    """
    Atomically reserves the next sequence number for (school, role, year) using
    a row-level lock (SELECT ... FOR UPDATE) so two concurrent admissions never
    receive the same code — this is the idempotency-critical path described in
    the product's "no duplicate identities" requirement.
    """
    stmt = (
        select(IdentitySequence)
        .where(
            IdentitySequence.school_code == school_code,
            IdentitySequence.role == role.value,
            IdentitySequence.year == year,
        )
        .with_for_update()
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()

    if row is None:
        row = IdentitySequence(
            id=uuid.uuid4(), school_code=school_code, role=role.value, year=year, last_value=0
        )
        db.add(row)
        await db.flush()

    row.last_value += 1
    sequence = str(row.last_value).zfill(5)
    await db.flush()

    return f"{school_code}-{role.value}-{year}-{sequence}"
