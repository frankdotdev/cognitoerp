# 015 — Settings & Branding

## Full customization surface (per school)
Name, motto, logo, address, principal name, website, primary/secondary/
accent color, dark mode toggle, report card template, certificate template,
school stamp/signature images, academic calendar, banner image, font choice
(constrained to a curated set — full font freedom risks a school picking
something illegible at small sizes in dense dashboard UI).

## Where it lives
`school_theme` table (see 005) plus a `school_documents` table for
letterhead/certificate/report-card template assets. Read once per session,
cached client-side, applied via CSS custom property overrides (see 002) —
changing a color in Settings is instant everywhere, no rebuild or redeploy.

## Custom domain (Enterprise plan)
`portal.stmarycollege.edu.ng` instead of `stmary.cognitioerp.com` — a CNAME
pointed at the platform, resolved to the correct tenant via a domain lookup
at request time rather than the subdomain parsing used for every other
school. Deferred past MVP; the domain-resolution middleware is
straightforward to add once the first Enterprise customer needs it.

## Settings screen structure (frontend)
Tabbed: School Profile / Branding / Academic Session / Grading Scheme /
Roles & Permissions / Billing / Integrations. Only Super Admin (and any role
explicitly granted `settings.edit`) can reach this section at all.

## Status
Built: `School`, `SchoolTheme`, and `SchoolClass` models (the last one a
genuine gap found and closed this session — every module's `class_name`
was free text with nothing anywhere defining which classes a school
actually has), the onboarding wizard, the Settings screen (Profile,
Branding, Classes, Fee Structure, Grading Scheme, Notification
Preferences tabs across several screens), and real file uploads for
logo/stamp/signature via Cloudflare R2's presigned two-step flow.

Not yet built: custom domain resolution (Enterprise-plan feature — the
`custom_domain` field exists on `School` but nothing routes traffic
based on it yet) and email template customization (schools can't yet
edit the wording of automated emails — Cognitio's default templates are
the only option).
