# 006 — Student Information System

## Status: reference implementation, built
This is the module every other module's structure copies. See:
`backend/app/modules/students/models.py`, `schemas.py`, and the pattern
established in `shared/base_repository.py` (soft delete, pagination,
optimistic locking — all inherited, not reimplemented per module).

## Model
`Student`: identity_code, optional linked `user_id` (a student may exist in
the SIS before their login account is issued — e.g. during bulk import,
records land first, credentials are issued in a second batch step),
full_name, date_of_birth, gender, class_name, section, admission_number,
admission_date, guardian contact fields (denormalized here for quick access
even before a parent account is linked), status (active/graduated/
withdrawn/suspended).

## API surface (pattern for every module)
- `POST /students` — create (admin-only), triggers identity code issuance.
- `GET /students` — paginated, filterable by class/status, searchable by
  name/admission number, sortable — see `StudentListParams`.
- `GET /students/{id}` — single record, includes attendance/results/fees
  summary via joined reads (kept in the service layer, not the router).
- `PATCH /students/{id}` — partial update, requires `version` for optimistic
  locking (see 004's testing note — concurrent-edit tests are mandatory here
  since registrars and class teachers can edit the same record).
- `DELETE /students/{id}` — soft delete only; a genuine hard-delete (e.g. a
  wrongly-created duplicate) is a separate, audit-logged admin operation.

## Bulk import
Excel upload → background Celery task → column auto-detection (matches
header names against known aliases: "Student Name"/"Full Name"/"Name" all
map to `full_name`) → a review screen showing mapped columns and flagged
rows (missing required fields, likely duplicates by name+DOB) before
anything commits → idempotency key on the import job itself, so a resubmitted
file (e.g. after a network blip) never double-creates students.

## Student profile screen (frontend, per the reference screenshots)
Tabbed layout: Information / Attendance / Results / Fees — matches the
reference UI exactly in structure (this was explicitly approved), themed to
the school's branding rather than the reference's neutral palette.

## What's pending
Admission-workflow states beyond "already enrolled" (application → review
→ offer → enrolled) — deliberately simplified; the core "capture every
detail including a photo" requirement is met without the multi-stage
pipeline.

## The real-world student lifecycle
Built in full, per the product's explicit requirement that "graduation,
transfer, expulsion, and death all realistically happen" — see
`students/lifecycle.py`:

- **Status set:** `active | graduated | withdrawn | suspended |
  transferred | deceased`. Every exit event records a date and an
  optional reason.
- **Access revocation, never deletion:** any exit status deactivates the
  student's login and revokes every refresh token (forces logout
  everywhere), but the `Student` row — and every result, attendance
  record, and invoice tied to it — stays exactly as-is, permanently.
  Suspension works the same way as a permanent exit for login purposes;
  reactivation (`POST /students/{id}/reactivate`) is a separate, explicit
  action, never automatic.
- **Portability — the actual point of never deleting anything:** every
  student's full record can be exported as a printable PDF transcript
  (`GET /students/{id}/transcript.pdf` — branded with the issuing
  school's own logo and color) or a structured JSON export
  (`GET /students/{id}/export`, deliberately using generic field names
  rather than Cognitio's internal schema, so a receiving system — Cognitio or
  otherwise — has something reasonable to parse). Neither transmits
  anything automatically between institutions; they produce the portable
  ARTIFACT a family controls and can hand to wherever the student goes
  next.

## Official admission numbers
Many schools already have their own registration-number scheme and
shouldn't be forced onto Cognitio's. `StudentCreate.official_admission_number`
lets an admin supply their school's existing number at creation instead
of getting an auto-generated one — checked for uniqueness, and once
"officially registered" this way, it's what the student logs in with,
same as an Cognitio-generated number would be.

## Photos
`Student.photo_url` plus a dedicated two-step presigned-upload flow
(`/students/{id}/photo/upload-url` + `/photo/confirm`) — a separate
component (`EntityPhotoUploader`) from the school-branding `AssetUploader`,
after an early draft was caught wiring the wrong one to the wrong endpoint
before it shipped.

## Bulk historical results import
"Past results scattered across Excel files should sync automatically" —
`results/bulk_import.py` (lives in Results, since it writes `ScoreEntry`
rows) auto-detects two spreadsheet shapes: **wide** (one row per student,
a column pair per subject like "Mathematics CA1") matched against the
school's active grading scheme, and **long** (explicit Subject/Component/
Score columns). Matches students by admission number; every unmatched or
invalid row is skipped with a reason, never fatal to the whole import.
