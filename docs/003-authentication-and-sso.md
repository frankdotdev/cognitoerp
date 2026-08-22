# 003 — Authentication & SSO

## Identity model
Every person's primary identity is a school-issued **Identity Code**, never an
email — `{SCHOOL_CODE}-{ROLE}-{YEAR}-{SEQUENCE}` (e.g. `CMS-STU-2026-00341`).
Full rationale and implementation: `backend/app/modules/auth/identity_code.py`.

## First-login flow
1. Admin creates the person's record → `issue_new_account()` generates the
   Identity Code + a random 10-character temp password.
2. Delivered out-of-band: SMS, email, or a printed welcome slip (registrars can
   batch-print slips for an entire incoming class).
3. First login with (code, temp password) succeeds; response includes
   `must_change_password: true` — frontend routes straight to a forced reset
   screen, nothing else in the app is reachable until this completes.
4. After reset, the person may optionally link a Google account. This is
   always additive — the Identity Code + password login never stops working,
   even if the linked Google account is later removed or inaccessible.

## Tokens
- Access token: JWT, 15-minute expiry, carries `school_id`, `role`, and the
  resolved `permissions` array (post-delegation, see below).
- Refresh token: 30-day expiry, tracked in `refresh_token_families` so an
  entire chain can be revoked at once (password change, admin-forced logout,
  suspected compromise) rather than only the token currently in use.

## Brute-force protection
Per-account lockout (not per-IP, since Identity Codes are semi-sequential and
therefore guessable): 5 failed attempts locks the account for 15 minutes.
Every attempt — success or failure — is written to `login_attempts` for audit
and future suspicious-login detection.

## Delegation
A user can have a `delegated_role_id` + `delegation_expires_at` — e.g. the
Principal delegates their permission set to the VP for 30 days while on leave.
`issue_tokens_for_user()` resolves the active permission set at token-issue
time, checking delegation first. Expiry is enforced by the expiry timestamp
alone — no cron job needed, since an expired delegation simply stops being
picked up on the next login/refresh.

## SSO to LMS / CBT / STELLA (future)
When Cognitio LMS (LMS) and Cognitio Assess (CBT) exist as separate products, they verify
the same JWT issued here rather than running their own auth. A sidebar link
in the ERP (e.g. "Learning") is a plain redirect carrying the current access
token; the receiving product validates it against the same `JWT_SECRET_KEY`
and resolves the same `school_id`/`role`/`permissions` claims. No second
login, no separate user table to keep in sync — this is why identity and auth
live in a shared core module from day one instead of being duplicated later.

## What's built vs. pending
Built: identity code generation, password hashing (Argon2), JWT issue/verify
(including `/auth/refresh` — building it surfaced and fixed a real bug where
the token's family claim never matched the actual `RefreshTokenFamily` row),
lockout, delegation resolution, tenant-scoped `User`/`Role` models, Google
OAuth linking (`/auth/link-google`, `/auth/login/google` — enforced in code
that Google can only authenticate an already-linked account, never create
or take one over), and frontend login + forced-reset screens.

**Subdomain resolution** (`core/subdomain.py`) — the piece that makes the
whole self-serve signup story real: middleware resolves which school a
request's hostname belongs to (subdomain or custom domain) before login
even happens, and a public `GET /schools/resolve` endpoint lets the
frontend answer "which school is this" without a hardcoded ID. This was
flagged as the single most launch-blocking gap in the whole system before
being closed — without it, a school completing onboarding had no way to
reach a working login page at all.

**Generic staff account issuance** (`schools/staff_accounts_router.py`) —
the real-world pattern where the person running onboarding is often not
the Principal, but the school's de facto "IT person." That person becomes
the Super Admin from `/schools/onboard`, then issues separate,
appropriately-scoped accounts (Principal, VP, Registrar, Accountant,
Librarian, ICT Admin) through this endpoint — the Principal never has to
touch the onboarding wizard if they don't want to.

**Offboarding and lifecycle-driven access revocation** — both Teacher
(`teachers/service.py`'s `offboard_teacher`) and Student
(`students/lifecycle.py`'s `process_student_exit`) follow the identical
principle: deactivate the account, revoke every refresh token family
(forces logout on every device, immediately, even if an access token
hasn't expired), and never touch or delete a single historical record —
every score a departed teacher entered, every attendance record they
marked, stays exactly as it was, correctly attributed, forever.

Pending: email verification for admin-entered addresses, 2FA for
Finance/Super Admin roles.
