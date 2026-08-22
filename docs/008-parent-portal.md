# 008 — Parent Portal

## Account model
A parent is a `User` with role `Parent`, invited (not issued a temp password
directly the same way students/teachers are, since parents aren't added by
name in bulk the same way) via SMS/email/QR code/activation code after their
child's enrollment. The parent creates their own password on first login,
then links to one or more children via a `parent_student_links` join table.

## Linking flow
Parent enters a child's admission number + a short verification (date of
birth) → creates a pending link request → auto-approved if the details
match an enrolled student, otherwise flagged for registrar approval (guards
against someone fishing for a match). One parent, many children, one
dashboard with a child switcher.

## Parent dashboard
Per-child: attendance, results, fees, homework, messages, calendar. Default
view is the most recently active child; switching is a single tap, not a
re-login.

## Notifications
Parents are the primary audience for the notification system (013) —
fee-due reminders, attendance alerts (configurable: immediate vs. daily
digest, since immediate absence pings can be noisy for a school with high
CA1/exam-week absenteeism), result-release announcements.

## Status
Built: the DOB-verification linking flow (`parents/service.py`) exactly
as designed — auto-approves on a match, falls into a registrar-approval
queue on a mismatch without revealing which detail was wrong (the
anti-fishing behavior). Frontend: the Parent Dashboard (multi-child
switcher, empty state for a parent with no linked child yet) and the
Link Child form. Linked into the unified Approvals queue
(`/schools/me/approvals`) for the registrar side.

## Parents with children at more than one school
A real requirement, addressed honestly rather than faked. Each school is
a fully separate tenant with its own subdomain and its own login (doc
004's architecture) — a parent with children at two different Cognitio
schools has two genuinely separate accounts today, one per school. A true
single-login unified view would require a deliberate, carefully-scoped
exception to tenant isolation (e.g. a verified-phone-number guardian
directory living outside any one school's data, with its own consent and
verification flow) — a real architectural decision worth its own design
pass, not something to bolt on quickly.

What's built instead, and is genuinely useful without compromising
anything: a client-side "My Schools" bookmark list (`lib/my-schools.ts`)
— visiting any school's parent dashboard saves it locally, and once a
parent has more than one saved, a switcher appears offering one-click
links to each school's own login. This does not merge data across
schools and doesn't pretend to; it's a directory, not a database merge.

Not yet built: real attendance/fee data in the child summary endpoint
(`ChildSummaryOut` currently returns placeholder `None`/`0.0` values for
attendance and outstanding fees — the shape is real, the joined queries
behind it aren't wired yet).
