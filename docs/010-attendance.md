# 010 — Attendance

## The offline-first requirement, concretely
This is the one module where "offline-first" isn't a nice-to-have — Nigerian
school connectivity makes it a launch-blocking requirement. Design:

1. Teacher opens the attendance screen for their class — the class roster is
   cached in IndexedDB the moment the teacher logs in (prefetched, not
   fetched-on-demand), so the screen renders with zero network calls.
2. Marking present/absent/late writes to IndexedDB immediately and shows as
   saved in the UI — no spinner waiting on a server round-trip.
3. A background sync queue (Workbox) retries pushing queued attendance
   records whenever connectivity is detected, with exponential backoff.
4. Each queued record carries an idempotency key (`school_id` +
   `class_id` + `date` + `student_id`) so a record that syncs twice (e.g.
   flaky connection causing a duplicate retry) is upserted, never
   duplicated.
5. Conflict case (rare but real): two devices mark the same student's
   attendance differently before either syncs — last-write-wins by
   server-received timestamp, with the losing write visible in an audit log
   entry rather than silently discarded.

## Data model
`attendance_records`: student_id, class_id, date, status
(present/absent/late/excused), marked_by, synced_at. One row per
student per day per class — a unique constraint on
`(school_id, student_id, date)` prevents double-marking.

## Calendar view (frontend)
Matches the reference screenshot exactly: month grid, color-coded legend
(Present/Absent/Festival/Early-Off/Late), searchable by student, filterable
by class/section.

## Staff attendance
Same underlying mechanism, different `class_id` semantics (staff attendance
is scoped to the school, not a class) — reuses the sync engine rather than
a parallel implementation.

## Status
Built: the data model, the `/attendance/sync` upsert endpoint (idempotent
by `(school_id, student_id, date)`), the `/attendance/calendar` read
endpoint the frontend month view uses, the IndexedDB queue
(`lib/offline-db.ts`), the sync trigger (`lib/offline-sync.ts` — `online`
event plus a 30-second fallback interval), and two frontend screens: the
read-only calendar (`/attendance`) and the actual write path, Mark
Attendance (`/attendance/mark`), which was a genuine gap for several
sessions — the calendar existed with no way to actually mark attendance
at all until it was built.

**Roster caching for a true cold offline start is also now built**: every
successful roster fetch persists to IndexedDB (`cacheRoster`), and Mark
Attendance falls back to that cached roster — with a visible "showing a
saved roster from [time]" notice — when the live fetch fails, rather than
showing nothing. This closes the original design's "cached the moment the
teacher logs in" intent; a school opening the app for the very first time
with zero prior connectivity still won't have anything cached (there's
been no successful fetch yet to cache), which is the correct, unavoidable
edge case, not a bug — the roster has to load online at least once.

Not yet built: Workbox-based service worker registration (the sync logic
runs on browser events today, which works while the tab is open, but a
true background sync that fires even when the app isn't in the foreground
needs a registered service worker with the Background Sync API — a
further step beyond what exists now).
