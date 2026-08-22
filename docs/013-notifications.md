# 013 — Notifications

## Channels and cost discipline
SMS is the single largest recurring infrastructure cost (Termii/Africa's
Talking are paid per message) — the notification system defaults every
non-critical alert to in-app + email, and reserves SMS for a school-configured
allowlist of critical events (fee due, attendance absence, exam results
published). Schools can opt into broader SMS usage as their own cost
tradeoff, not ours by default.

## Delivery pipeline
All notifications are queued as Celery tasks, never sent synchronously
inside a request — an announcement to 800 parents must not block the
admin's UI while it sends. Each notification job carries: recipient list,
channel(s), template, and an idempotency key (so a retried job after a
worker crash never double-sends).

## Templates
Stored per school (branding — see 015): subject line, body, with variable
interpolation (`{{student_name}}`, `{{amount_due}}`, `{{school_name}}`).
Default templates ship with the platform; schools can customize wording
without touching code.

## Preferences
Per-user notification preferences (immediate vs. daily digest for
attendance alerts, opt-out of non-critical categories) — respected at
send-time, checked before a job is queued, not after.

## Status
Built: the full pipeline — preference checks and the school-level SMS
allowlist resolved *before* anything is queued (not after), Celery
delivery (`app/tasks/notifications.py`) with real recipient email/phone
resolution (including Nigerian phone number normalization for Termii —
a real gap caught and closed, since the original draft had a TODO where
recipient contact info should have been), idempotent sends via a unique
constraint, and a frontend Notification Preferences screen. The
onboarding welcome email (school creation → admin's first credentials)
now runs through this exact pipeline rather than being a separate,
one-off email path.

Not yet built: the daily-digest option (`NotificationPreference.digest`
exists as a field but nothing currently batches "immediate" vs "daily"
— every queued notification sends as soon as its Celery task runs,
regardless of the digest setting).
