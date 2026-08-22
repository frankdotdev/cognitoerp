# 020 — Production Readiness

Read this first. Rewritten in full again this session, since a lot
changed and an append-only history stops being useful past a certain
point. This reflects the current, accurate state.

## What Cognitio ERP actually is, right now

A multi-tenant School Operating System: backend (FastAPI, 94 Python
files across 15 mounted routers), frontend (Next.js, 29 screens),
database (30 tables, 5 migrations, hand-verified against every
constraint the application code depends on), and a real — never yet
executed — test suite. Every module from the original MVP scope is
built, plus the real-world lifecycle realities a school actually lives
through: staff who aren't the Principal running onboarding, teachers who
resign or are terminated, students who graduate, transfer, withdraw, or
die, official reg numbers schools already have, and full data
portability for a student's entire academic record.

## What's built and real, by category

**Identity & access:** Identity-code login with forced reset, Google
OAuth (additive only — can never create or take over an account), JWT
refresh with family-based revocation, per-IP rate limiting, generic
staff account issuance (Principal/VP/Registrar/Accountant/Librarian/ICT
Admin — not just Teacher/Student), and **subdomain resolution** — the
single most launch-blocking gap identified in review, now closed:
`core/subdomain.py` resolves a school from the request's hostname before
login happens, and the frontend's `school-context.tsx` replaces every
placeholder that nothing used to set.

**Lifecycle management, built to match real school operations, not just
the happy path:** teacher offboarding (`teachers/service.py`) revokes
access everywhere immediately while never touching a single historical
record they created; student exit (`students/lifecycle.py`) covers
graduation, transfer, withdrawal, suspension, and death, each with the
same access-revocation-without-deletion principle, plus a portable PDF
transcript and JSON export a family can take anywhere. Official
admission numbers a school already has can be registered directly
instead of being forced onto Cognitio's own numbering.

**Every core module** (Students, Teachers, Attendance — offline-capable
with roster prefetch and a real device queue, Results — with PDF
generation and bulk historical import, Finance — with bulk invoice
generation, Parents, Communication, Notifications — a real Celery
pipeline, Inventory, HR/Payroll) has mounted, tenant-isolated,
permission-checked routes. Photos for students and teachers, via a
proper entity-specific uploader (a draft that briefly wired the wrong
component to the wrong endpoint was caught before shipping).

**Database:** 30 tables, 5 migrations. Every `ON CONFLICT` constraint
name the application depends on is mechanically cross-checked against
the schema; every foreign key verified to reference a table already
created earlier in the file. CHECK constraints enforce real invariants
(amounts can't go negative or exceed their total, statuses are
constrained, dates are ordered) at the database level, not just in
application code.

**A real test suite** covers tenant isolation (proving, not asserting,
the "School A can never see School B's data" claim), permission
boundaries (with a named regression test for an earlier wildcard-
permission bug), and idempotency — writing the idempotency tests is what
caught two real transaction-safety bugs (see below).

**Pricing and the multi-product ecosystem** are concretely designed: the
final plan table, a termly-billing approach that generates per-school
invoices against each school's own term dates rather than forcing a
platform-wide calendar, and addon flags (`stella_ai_enabled`,
`lms_enabled`, `cbt_enabled`) with real launcher nav items and
placeholder pages already wired to them — see doc 021.

**Deployment is a concrete decision, not an abstract plan:** Render,
chosen with real reasoning against current pricing (not Railway, not a
bare VPS, at launch), a capacity table grounded in the workload's actual
shape, and a traced, working self-serve signup journey from landing page
to daily use.

## Bugs found and fixed — the actual evidence of rigor, listed plainly

This list is long, and that's the point: every one of these was caught
by verification, not avoided by writing carefully the first time.

1. Super Admin wildcard permission wasn't honored by `require_permission` — every Super Admin action would have 403'd.
2. A `BackgroundTask` reused a request-scoped `db` session that would already be closed by the time it ran.
3. The refresh token's JWT `family` claim never matched the actual `RefreshTokenFamily` row's id.
4. `db.rollback()` on a duplicate idempotency key rolled back the entire session transaction, not just the failed insert, in both Payments and Notifications — fixed with a SAVEPOINT.
5. `queue_notification` silently ignored its own `requested_channel` parameter whenever a user had no preferences yet — always true for a brand-new account.
6. A `SchoolClass` model was about to be built with a hand-rolled `school_id` column instead of `TenantMixin`, which would have silently bypassed the automatic tenant-isolation guard.
7. **Subdomain resolution didn't exist at all** — the actual top launch blocker, found only when explicitly tracing the self-serve journey end to end rather than checking modules in isolation.
8. Writing a custom static analysis tool (below) found **three separate missing-import `NameError` bugs** that had been sitting in merged code across multiple sessions: `jwt`/`decode_token` never imported in `auth/service.py` (would have crashed the first real call to `/auth/refresh`), `status` never imported in `students/router.py`, and `HTTPException`/`status` never imported in `teachers/router.py`. `py_compile` — the only verification tool available in this sandbox for eight sessions — checks syntax, not names, and none of these were syntax errors.
9. A student photo-upload UI was wired to call the wrong backend endpoint entirely (school branding assets, not the student-specific photo endpoint) — caught before shipping, not after.

Point 8 is worth sitting with. For eight sessions, `py_compile` passing was treated as "verified" — accurately, for what it checks, but that's a narrower guarantee than it sounds like. Writing a scope-aware undefined-name checker this session (no `pyflakes` available, no network to install one) immediately found three real, latent crash bugs in code that had been "clean" the whole time. This is direct evidence for the same point doc 018 already makes: static verification has a real ceiling, and running the code is a categorically different, stronger check that nothing in this project has been able to do yet.

## What's still genuinely missing

- **Nothing has ever been executed.** No live Postgres, no live Redis, no request has ever hit an endpoint, no migration has ever run. Closing this is the explicit first step in doc 016's go-live runbook, and — per the bugs above — it will very likely surface issues that no amount of additional careful reading would have caught.
- A "record payment" UI with a real amount-entry dialog (deliberately not built with a fake ₦0 placeholder); Paystack payment-link generation (the webhook receiver exists, nothing generates the link yet).
- `/dashboard/summary` for the Principal Dashboard, and real attendance/fee figures in the Parent Child Summary (both are aggregation endpoints away from real data that already exists elsewhere, not new subsystems).
- A true unified cross-school parent view (deliberately not built — see doc 008's honest architecture note on why this needs its own design pass, not a quick bolt-on) — what exists instead is a genuinely useful client-side "My Schools" bookmark switcher.
- Workbox/service-worker background sync (today's offline sync runs on browser events and a polling interval while the tab is open).
- Billing automation that flips the Stella AI/LMS/CBT addon flags on a plan change (currently a manual/future-admin-tool action, not self-serve).
- Custom domain resolution, 2FA, targeted announcements, a "my classes only" gradebook filter, real PWA icon artwork, SEO/AEO meta tags on the landing page.

## Definition of done, per module

Not "the screen renders" — a module is done when: the API endpoints exist
with Pydantic validation, the tenant-isolation test passes, the permission
boundaries are tested, the frontend screen consumes the real API, and it
works on a 375px viewport as well as desktop. By this standard, nearly
every module is "built" but not yet "verified done" — the gap is entirely
about execution, covered above.

## Immediate next action

Follow doc 016's go-live runbook: provision Render Postgres, run all five
migrations for the first time, deploy the API/worker/Redis, deploy the
frontend to Vercel, run the test suite against the now-real database, then
onboard 1–2 pilot schools through the actual self-serve signup flow —
subdomain resolution and all — to prove the whole chain works end to end.
Given points 7 and 8 above, budget real time for what execution surfaces;
treat a clean first run as a pleasant surprise, not the expectation.
