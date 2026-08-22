# 019 — Security

Mapped against the full security brief, with honest status per item.

## Identity & access
| Requirement | Status |
|---|---|
| JWT access + refresh tokens, short-lived access | Built — including `/auth/refresh` and family-based revocation. Building this surfaced and fixed a real bug: the refresh token's `family` claim was originally a random UUID that never matched the actual `RefreshTokenFamily` row's id, so refresh/revocation could never have worked as designed |
| Subdomain-based tenant resolution | Built (`core/subdomain.py`) — deliberately read-only and pre-auth: resolves which school a hostname belongs to (for routing to the correct login page), but never grants access on its own. The actual tenant used for every authenticated query still comes only from the verified JWT (see doc 004), never from this resolution step — a request can't widen its own access by claiming a different hostname |
| Lifecycle-driven access revocation | Built — teacher offboarding and student exit events (graduation, transfer, withdrawal, suspension, death) both deactivate the account AND revoke every refresh token family, forcing logout on every device immediately, even for a still-valid access token in someone's hands. Historical records they created are never touched or deleted |
| Argon2 password hashing | Built |
| RBAC, permission-string based | Built |
| Multi-tenant isolation (ORM-level) | Built |
| Brute-force lockout (per-account) | Built |
| Delegated access with auto-expiry | Built |
| OAuth (Google account linking) | Pending |
| 2FA (Finance/Super Admin roles) | Pending |
| Email verification | Pending |
| Session/device management, login history | Partial — `login_attempts` logs every attempt; a "your active sessions" UI is pending |
| Suspicious login detection | Pending — needs a login-attempt volume of real users before thresholds can be tuned meaningfully |

## Transport & application
| Requirement | Status |
|---|---|
| HTTPS everywhere | Enforced at the Nginx layer (016), not app-level |
| Rate limiting | Built — per-IP sliding-window limiter on login/reset (`core/rate_limit.py`); a second, independent layer on top of the existing per-account lockout. In-memory, single-process today — flagged in the code to move to Redis if the API ever runs multiple worker processes |
| CSRF protection | N/A for the API itself (stateless JWT, no cookies for auth) — relevant only if a cookie-based session is ever added |
| XSS / output encoding | React/Next.js escapes by default; audit needed wherever raw HTML is ever rendered (report card templates) |
| SQL injection | Structurally prevented — SQLAlchemy parameterized queries throughout, no raw string SQL |
| Input validation | Pydantic schemas on every endpoint (see `students/schemas.py` as the pattern) |
| Content Security Policy | Built at the API layer (`app/main.py`'s security-headers middleware — CSP, X-Frame-Options, X-Content-Type-Options, HSTS in production); the frontend's own CSP at the Vercel/Next.js layer is still pending |
| Secrets management | Environment variables via each deploy target's secret store; never committed |
| File upload validation | Built — content-type allowlist and a 10MB size cap enforced on presigned upload URLs (`core/storage.py`) |

## Data protection
| Requirement | Status |
|---|---|
| Encryption in transit | TLS via Nginx/Vercel |
| Encryption at rest | Managed Postgres provider default (Render Postgres — see doc 016 for the finalized platform decision) |
| Encrypted backups | Inherits from Render Postgres's automated backup/PITR |
| Audit logs | `created_by`/`updated_by`/`deleted_by` on every table (019); a dedicated `audit_log` table for sensitive actions (fee edits, permission changes) is pending |
| Soft delete | Built — see `base_repository.py` |
| Database-level integrity constraints | Built — migration `0002` adds CHECK constraints beyond FK/uniqueness (amounts can't go negative or exceed their total, status columns are constrained to valid values, date ranges are ordered correctly). Every constraint's table/column references were mechanically cross-checked against the schema before being trusted, catching the class of bug a typo here would cause on first migration run |
| Transaction safety on idempotent inserts | Built, after a real bug was found and fixed — the original Payments and Notifications code called `db.rollback()` on a duplicate-key conflict, which rolls back the ENTIRE session transaction, not just the failed insert. Replaced with a SAVEPOINT (`begin_nested()`) scoped to just the risky insert |

## Operational
| Requirement | Status |
|---|---|
| Zero-trust posture (never trust client input) | Enforced structurally: tenant id from JWT only, permissions checked server-side on every route |
| Signed URLs for file access | Built — every file (logos, report card PDFs) is served via a short-lived presigned R2 URL; objects are never public, and a download URL is only issued after verifying the requested object key actually belongs to the caller's school (`object_belongs_to_school`) |

## Honest summary
Every item in this table marked "Built" is real code, most of it now
cross-referenced against the actual schema and, in several cases, caught
and corrected mid-build rather than assumed correct (the refresh-token
family bug, the rollback-scope bug, the wildcard-permission bug — see
docs 003/009/013's status sections for each). What's still genuinely
missing: OAuth-linking's UI (the backend is built; no frontend screen
calls `/auth/link-google` yet), 2FA, a dedicated sensitive-action audit
log beyond the audit columns every table already has, and — the one that
matters most before any of this touches real school data — **none of it
has been verified by actually running it.** The tenant-isolation,
permission-boundary, and idempotency tests exist specifically to close
that gap the moment there's a real Postgres to run them against (see doc
016's go-live runbook).
