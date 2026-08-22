"""
Application entry point. Kept thin deliberately — route registration and
middleware wiring only. Business logic never lives here.
"""
import uuid

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.db.tenant_guard import register_tenant_guard, clear_current_tenant

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/api/docs" if settings.ENV != "production" else None,  # OpenAPI docs off in prod
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_tenant_guard(AsyncSessionLocal)


@app.middleware("http")
async def clear_tenant_context_after_request(request: Request, call_next):
    """
    Belt-and-suspenders: the tenant ContextVar is set per-request by
    get_current_user, but if a request never goes through auth (public
    routes) or errors before reaching it, this guarantees no tenant id ever
    leaks into the NEXT request handled by the same worker.
    """
    try:
        response = await call_next(request)
    finally:
        clear_current_tenant()
    return response


from app.core.subdomain import resolve_school_from_request


@app.middleware("http")
async def resolve_school(request: Request, call_next):
    """
    Runs first, before auth — resolves which school a request's hostname
    belongs to. See core/subdomain.py's docstring for why this is safe as
    a read-only, pre-auth lookup.
    """
    await resolve_school_from_request(request)
    return await call_next(request)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Baseline security headers on every response. CSP is deliberately
    conservative (default-src 'self') since this is a JSON API, not a page
    renderer — the frontend (Next.js/Vercel) sets its own, separate CSP
    appropriate for serving HTML/JS.
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    if settings.ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# --- Structured error responses (doc 019 / the original brief's error-handling requirement) ---

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak internals to the client; the request_id lets support/Sentry
    # correlate this response with the actual stack trace.
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "internal_error",
                "message": "Something went wrong on our end. If this keeps happening, contact support.",
                "request_id": getattr(request.state, "request_id", None),
            }
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


from sqlalchemy import select

@app.get(f"{settings.API_V1_PREFIX}/health/ready")
async def readiness():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(select(1))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "database": "disconnected", "detail": str(e)},
        )



# --- Routers ---
# Each module's router is registered here as it's built — kept as explicit,
# readable includes rather than auto-discovery magic, so it's always obvious
# from this file which modules are actually live.

from app.modules.auth.router import router as auth_router
from app.modules.students.router import router as students_router
from app.modules.schools.router import router as schools_router
from app.modules.finance.router import router as finance_router
from app.modules.attendance.router import router as attendance_router
from app.modules.teachers.router import router as teachers_router
from app.modules.results.router import router as results_router
from app.modules.parents.router import router as parents_router
from app.modules.communication.router import router as communication_router
from app.modules.notifications.router import router as notifications_router
from app.modules.inventory.router import router as inventory_router
from app.modules.hr.router import router as hr_router
from app.modules.schools.storage_router import router as storage_router
from app.modules.schools.approvals_router import router as approvals_router
from app.modules.schools.staff_accounts_router import router as staff_accounts_router
from app.modules.dashboard.router import router as dashboard_router

app.include_router(auth_router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["auth"])
app.include_router(students_router, prefix=f"{settings.API_V1_PREFIX}/students", tags=["students"])
app.include_router(schools_router, prefix=f"{settings.API_V1_PREFIX}/schools", tags=["schools"])
app.include_router(finance_router, prefix=f"{settings.API_V1_PREFIX}/finance", tags=["finance"])
app.include_router(attendance_router, prefix=f"{settings.API_V1_PREFIX}/attendance", tags=["attendance"])
app.include_router(teachers_router, prefix=f"{settings.API_V1_PREFIX}/teachers", tags=["teachers"])
app.include_router(results_router, prefix=f"{settings.API_V1_PREFIX}/results", tags=["results"])
app.include_router(parents_router, prefix=f"{settings.API_V1_PREFIX}/parents", tags=["parents"])
app.include_router(communication_router, prefix=f"{settings.API_V1_PREFIX}/communication", tags=["communication"])
app.include_router(notifications_router, prefix=f"{settings.API_V1_PREFIX}/notifications", tags=["notifications"])
app.include_router(inventory_router, prefix=f"{settings.API_V1_PREFIX}/inventory", tags=["inventory"])
app.include_router(hr_router, prefix=f"{settings.API_V1_PREFIX}/hr", tags=["hr"])
app.include_router(storage_router, prefix=f"{settings.API_V1_PREFIX}/schools", tags=["storage"])
app.include_router(approvals_router, prefix=f"{settings.API_V1_PREFIX}/schools", tags=["approvals"])
app.include_router(staff_accounts_router, prefix=f"{settings.API_V1_PREFIX}/schools", tags=["staff-accounts"])
app.include_router(dashboard_router, prefix=f"{settings.API_V1_PREFIX}/dashboard", tags=["dashboard"])

# Every module from the locked MVP scope (docs/020) now has a mounted router,
# including the Principal Dashboard summary endpoint (doc 014).

