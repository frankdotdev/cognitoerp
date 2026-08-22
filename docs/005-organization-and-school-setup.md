# 005 — Organization & School Setup

## The `schools` table (platform-level, not tenant-scoped)
Core fields: `id`, `name`, `school_code` (short, unique, used in Identity
Codes — e.g. `CMS`), `motto`, `address`, `phone`, `email`, `principal_name`,
`plan` (Foundation/Academy/Excellence/Enterprise), `student_limit`,
`billing_cycle` (monthly/termly/annual), `subdomain`, `custom_domain`
(nullable, Enterprise-only), `academic_session_start`, `is_active`.

## Branding, stored on `school_theme` (one-to-one with `schools`)
`primary_color`, `secondary_color`, `accent_color`, `logo_url`, `favicon_url`,
`report_card_template_id`, `certificate_template_id`, `stamp_url`,
`signature_url`, `email_header_url`. Read once per session on the frontend
and applied via CSS custom properties (see 002) — a school administrator
changing their color in Settings updates every screen, every generated PDF,
and every outbound email immediately, with no deploy or cache-bust needed
beyond a theme-version counter.

## Onboarding wizard (first thing a new school does)
1. School identity: name, motto, logo, address, principal.
2. Academic structure: classes/sections, current session, term dates
   (these dates drive termly billing invoices — see 009).
3. Branding: pick colors (defaults to Cognitio green if skipped).
4. Bulk import: upload Excel for students, staff, and (optionally) historical
   fee records — automatic column-mapping, review screen before commit (this
   is the single highest-leverage feature for a school actually switching
   over, per the competitive research in the PRD).
5. First Super Admin account is created automatically as part of signup,
   outside the normal issuance flow (see 003) — every other identity is
   issued from inside the app afterward.

## Organization hierarchy (built for later, not fully used at launch)
```
Platform → School → Campus → Academic Session → Class → Section → Student
```
Campus is a nullable parent on `classes` from day one so multi-campus schools
(Enterprise plan) don't require a schema migration later — but the MVP UI
only exposes single-campus flows.

## Custom roles
Default roles are seeded per school on creation (Principal, VP, Registrar,
Teacher, Accountant, Parent, Student, etc. — see `roles.is_system_role`), but
every school can rename them and adjust the underlying permission set. System
roles cannot be deleted, only their permission list edited, so a school can
never accidentally lock itself out of its own Super Admin capability.

## What's built vs. pending
Built: `Role`/`User` models, `School`, `SchoolTheme`, and `SchoolClass`
(classes/sections), the full onboarding wizard (frontend, 3 steps, calling
the real `POST /schools/onboard`), the bulk-import backend endpoint, and
Settings screens for Profile/Branding/Classes/Fee Structure/Grading
Scheme/Notification Preferences. Onboarding now also sends a real welcome
email with the admin's login credentials — closing what had been the last
gap in the self-serve signup path (see doc 016 for the full trace).

Pending: custom domain resolution, email template customization per
school (schools use Cognitio's default wording for automated emails today).
