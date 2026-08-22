# 012 — Communication

## Structured, not an open group chat
Per the product decision: an unmoderated parent group chat reliably
degenerates into spam and buried complaints. Instead, purpose-built
channels with different write-permissions:

| Channel | Who can post | Purpose |
|---|---|---|
| Announcements | Admin/Principal only | School-wide notices; parents react, don't comment |
| Parent Forum | Parents, teachers, admin | Open Q&A ("is tomorrow's excursion compulsory?") |
| Help Desk | Parents (create ticket), staff (respond) | Replaces ad-hoc phone/WhatsApp complaints, tracked to resolution |
| PTA space | PTA members | Private — polls, minutes, contributions |
| Events | Admin posts, parents RSVP | Event logistics, volunteering |

## Help Desk, in detail (the highest-leverage piece for reducing support load)
Ticket model: subject, message, category (fees/academics/general),
status (open/in-progress/resolved), assigned_to. A parent's "I paid but
it shows unpaid" no longer becomes a phone call to the office — it's a
ticket routed to Finance, with the resolution visible to the parent and
logged for the school.

## Notification fan-out
Posting an Announcement triggers the notification pipeline (013) — in-app
by default, email/SMS as the school's notification settings dictate.

## Status
Built: announcements and help-desk tickets (with replies), both fully
wired with routers, plus a genuine fan-out to Notifications on every
announcement post (not a stub) — every active user in the school gets a
queued notification respecting their own channel/opt-out preferences.
Frontend: the Communication screen (Announcements / Help Desk tabs).

Not yet built: targeted announcements (the `target_classes` field exists
on the model but isn't used to filter recipients yet — every
announcement currently fans out to the whole school regardless of that
field), and a ticket-reply UI on the frontend (the backend endpoint
exists; replying is currently API-only).
