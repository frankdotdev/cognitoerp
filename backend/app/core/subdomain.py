"""
Resolves a school from the request's subdomain BEFORE login even happens —
this is the piece flagged as the actual launch blocker: without it, a
school completing onboarding has no way to reach their own login page.

Design: `caritas-model.cognitioerp.com` -> subdomain "caritas-model" ->
look up School.subdomain -> attach school_id to request.state. The
LOGIN endpoint itself still resolves school_id from the JWT once
authenticated (auth/dependencies.py) — this middleware only answers "which
school's login page is this," a public, pre-auth question, and is
deliberately a read-only lookup with no write access and no trust
implications: it can only ever route someone to the CORRECT login form,
never grant access to anything.

Custom domains (Enterprise plan, `School.custom_domain`) resolve through
the same lookup — the middleware checks custom_domain first, then falls
back to subdomain parsing, so `portal.stmarycollege.edu.ng` and
`stmary.cognitioerp.com` both resolve correctly without different code
paths.
"""
from fastapi import Request
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.tenant_guard import set_current_tenant, clear_current_tenant
from app.modules.schools.models import School

_BASE_DOMAIN = "cognitioerp.com"  # the platform's own domain — everything below this level is a subdomain, not a custom domain


def _extract_subdomain(host: str) -> str | None:
    host = host.split(":")[0]  # strip port for local/dev testing
    if host.endswith(f".{_BASE_DOMAIN}"):
        subdomain = host[: -(len(_BASE_DOMAIN) + 1)]
        if subdomain and subdomain != "www":
            return subdomain
    return None


async def resolve_school_from_request(request: Request) -> None:
    """
    Called from middleware on every request. Sets request.state.school_id
    when the host resolves to a known school; leaves it None otherwise
    (public routes like /schools/onboard and the landing page don't need
    a resolved school, and correctly have none).
    """
    host = request.headers.get("host", "")
    subdomain = _extract_subdomain(host)

    async with AsyncSessionLocal() as db:
        if subdomain:
            stmt = select(School).where(School.subdomain == subdomain, School.is_active.is_(True))
        else:
            # Not a recognized Cognitio subdomain — check whether it's a
            # school's CUSTOM domain instead (Enterprise plan).
            stmt = select(School).where(School.custom_domain == host, School.is_active.is_(True))

        school = (await db.execute(stmt)).scalar_one_or_none()
        request.state.school_id = school.id if school else None
        request.state.school_subdomain = subdomain
