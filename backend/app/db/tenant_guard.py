"""
Tenant isolation, enforced at the ORM level rather than left to each developer
to remember in every query.

Why this exists: relying on "every query includes .filter(school_id=...)" is
how multi-tenant SaaS products leak data — one forgotten filter in one endpoint,
written at 2am before a deadline, and School A can see School B's students.

Instead, we register a SQLAlchemy `do_orm_execute` event that automatically
injects a `school_id = :current_tenant` filter onto every SELECT against a
tenant-scoped table, using the tenant id resolved from the request's JWT
(never from a client-supplied header or query param — see auth/dependencies.py).
A developer would have to deliberately opt out (`.execution_options(skip_tenant_filter=True)`)
to bypass it, which is logged and reserved for platform-admin-only tooling.
"""
from contextvars import ContextVar
import uuid

from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

from app.db.base_model import TenantMixin

# Set once per request by the tenant-resolution middleware (see core/middleware.py).
# ContextVar, not a global, so concurrent requests never bleed into each other.
current_tenant_id: ContextVar[uuid.UUID | None] = ContextVar("current_tenant_id", default=None)


def register_tenant_guard(session_factory) -> None:
    @event.listens_for(session_factory, "do_orm_execute")
    def _add_tenant_filter(execute_state):
        if execute_state.is_select and not execute_state.execution_options.get("skip_tenant_filter", False):
            tenant_id = current_tenant_id.get()
            if tenant_id is None:
                # No resolved tenant on a tenant-scoped query is a bug, not a
                # missing filter — fail loudly rather than silently return
                # cross-tenant rows.
                raise RuntimeError(
                    "Attempted a tenant-scoped query with no tenant resolved on the request context."
                )
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    TenantMixin,
                    lambda cls: cls.school_id == tenant_id,
                    include_aliases=True,
                )
            )


def set_current_tenant(tenant_id: uuid.UUID) -> None:
    current_tenant_id.set(tenant_id)


def clear_current_tenant() -> None:
    current_tenant_id.set(None)
