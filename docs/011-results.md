# 011 — Results

## Grading configuration (per school)
Schools define their own grading scale during onboarding (e.g. CA1: 20,
CA2: 20, Exam: 60 — or any split that sums to 100) and grade boundaries
(A: 70-100, B: 60-69, etc.), stored on `grading_scheme`, not hardcoded —
Nigerian schools vary here and this must be configurable from day one, not
retrofitted.

## Entry flow
Subject teachers enter CA and exam scores per student per subject; scores
are validated against the configured max at entry time (see 007). A
Class Teacher sees a compiled view across all subjects for their class
before results are published — nothing is visible to parents/students
until explicitly published by an authorized role, so a school can review
before release.

## Report card generation
WeasyPrint renders each student's report card from their school's
custom template (see 015) — subject scores, grade, position in class,
attendance summary for the term, a comment field. Comment drafting can
optionally be assisted by Stella AI (teacher reviews/edits before saving —
see the PRD's AI section on this being an editing aid, not an autopilot).

## Position/ranking
Computed per class, per term, from the compiled score table — a
materialized view refreshed on result publication (not on every read) since
ranking a class of 60 students doesn't need to recompute on every page
load.

## Status
Built: grading scheme CRUD (`/results/grading-scheme`, with a school
required to configure one before any score can be entered — enforced
server-side, not just a UI nicety), score entry validated against the
active scheme's component caps, class-wide report card compilation with
real ranking, the explicit publish step, and — the piece originally
flagged as pending — **PDF generation** (`results/pdf.py`, WeasyPrint,
rendered with the school's actual logo and brand color pulled from
`SchoolTheme`, uploaded to R2, returned as a short-lived signed URL,
never a public path). Frontend: the gradebook (`/results`, wired to the
real roster and the real grading scheme, not demo data), the tabbed
student profile's Results tab, and a dedicated print/PDF-ready Report
Card preview screen with a real "Download PDF" action.

Not yet built: the AI-assisted comment drafting mentioned in the PRD's
Stella AI section (deferred — explicitly a Year 2+ item, not part of MVP
scope), and automatic PDF (re)generation on publish — right now PDF
generation is a manual action a staff member triggers per report card,
not a batch operation that runs automatically when a class's cards are
published.
