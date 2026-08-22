# 007 — Teacher Management

## Model
`Teacher` extends the same `User` base as every role (identity code, forced
first-login flow — see 003) with a teacher-specific profile table: subjects
taught, classes assigned (many-to-many via `teacher_class_assignments`),
qualification, employment_date, staff_id (distinct from admission_number,
same sequencing mechanism via `identity_code.py` with `RolePrefix.TEACHER`).

## Class Teacher vs. Subject Teacher
A teacher can be a Class Teacher for one section (broader visibility: full
class attendance, all subjects' results for their class, parent
communication) and a Subject Teacher for others (scoped to just that
subject's gradebook and attendance). This is modeled as an assignment
attribute (`is_class_teacher: bool`), not a separate role, so a single
teacher's permission set stays coherent across both.

## Teacher dashboard (frontend)
Today's classes, attendance entry (per-class, offline-capable — see 010),
gradebook, assignments, inbox. Built to be usable within 5 minutes of first
login with zero training, per the product's core UX principle.

## Gradebook
Continuous assessment entries (CA1, CA2, exam) per subject per student,
validated against the school's configured grading scale (see 011) before
save — prevents a teacher entering 85/70 for a CA capped at 20.

## Status
Built: `Teacher` model, class assignment (with the class-teacher vs.
subject-teacher distinction), CRUD endpoints, `/teachers/me/assignments`
(built specifically because the Teacher Dashboard frontend screen needed
it), photo upload, and the Teacher create form + list screen (with an
Offboard action) on the frontend.

## Offboarding — resignation, termination, and continuity
The real-world case explicitly required: a teacher leaves, and the school
needs (a) their access revoked immediately, everywhere, (b) their classes
not left orphaned, and (c) every record they ever touched to stay exactly
as-is. `teachers/service.py`'s `offboard_teacher`:
- Sets `Teacher.status = "left"`, deactivates their `User` account, and
  revokes every `RefreshTokenFamily` — signs them out on every device
  immediately, even if an access token they're holding hasn't expired.
- Optionally reassigns their `TeacherClassAssignment` rows to a named
  replacement teacher in the same call; `GET /teachers/unassigned-classes`
  surfaces any classes left without an active teacher if no replacement
  was specified at offboarding time.
- Deliberately does NOT touch `ScoreEntry.entered_by` or
  `AttendanceRecord.marked_by` — those correctly keep pointing at the
  departed teacher's `User` row forever. "Who actually entered this score
  in April" is a fact that shouldn't change just because that person
  later left.

Not yet built: the gradebook view scoped to "my classes only" (Results
today shows the whole school's classes to anyone with `results.enter`,
not filtered to a teacher's actual assignments), and teacher-side
assignment/homework tracking beyond attendance and score entry.
