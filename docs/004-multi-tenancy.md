# 004 — Multi-tenancy

## Model
Single application, single PostgreSQL database, shared schema — every
tenant-scoped table carries a `school_id` foreign key (via `TenantMixin`,
`backend/app/db/base_model.py`). This is the "modular monolith with row-level
isolation" pattern, not schema-per-tenant or database-per-tenant — the right
choice for a solo/small team scaling from 1 to hundreds of schools without
operational complexity exploding (see 016 for why this also simplifies
deployment and migrations).

## Enforcement — not by convention, by construction
`backend/app/db/tenant_guard.py` registers a SQLAlchemy `do_orm_execute` event
that injects a `school_id = :current_tenant` filter onto every SELECT against
a tenant-scoped model automatically. The tenant id is resolved once per
request, from the verified JWT only (`auth/dependencies.py:get_current_user`)
— never from a header, query param, or path segment a client could tamper
with. A developer would have to deliberately pass
`.execution_options(skip_tenant_filter=True)` to bypass this, which is
reserved for explicit, logged platform-support tooling.

This means a forgotten `.filter(school_id=...)` in some future endpoint — the
single most common way multi-tenant SaaS products leak data — simply cannot
happen for standard queries. The isolation lives in one file, not in the
discipline of every future contributor remembering it.

## What's NOT tenant-scoped
Platform-level tables: `schools` itself, subscription plans, system config,
and `identity_sequences` (keyed by `school_code`, a denormalized string, used
before a full tenant context necessarily exists during account issuance).

## Isolation at every layer (tracking against the original brief)
| Layer | Mechanism | Status |
|---|---|---|
| Auth | Tenant resolved from JWT only | Built |
| Database | ORM-level auto-filter | Built |
| API | Every router depends on `get_current_user`, which sets tenant context | Built (pattern established, applied per-module as built) |
| Caching | Redis keys prefixed `school:{id}:...` | Planned |
| Storage | R2 object keys prefixed `schools/{id}/...`, signed URLs scoped per tenant | Planned |
| Queues | Celery task payloads always carry `school_id`, workers set tenant context before touching the DB | Planned |
| Backups | Full-database backups (not per-tenant) — restoration story documented in 016 | Planned |
| Logs | Every structured log line includes `school_id` | Planned |

## Testing requirement (see 018)
Every module ships with at least one test that creates two schools, writes
data as School A, and asserts School B's queries never return it — this is
non-negotiable and blocks merge, not an optional nice-to-have.

## Custom branding & config per tenant
Academic sessions, grading scales, fee structures, timetables, roles, and
report card templates are all tenant-configurable data, not code — see 005 and 015.
