# 014 — Analytics

## Principal Dashboard (MVP scope)
Today's attendance %, revenue collected today, outstanding fees total,
teachers/students absent today, pending admissions, pending approvals —
computed from the same aggregation queries Finance and Attendance already
expose, not a separate analytics pipeline at this stage. Real-time enough
(computed on request, cached 5 minutes) without needing a data warehouse
for a single school's data volume.

## Term-level reporting
Fee collection trend (bar chart, matches reference UI), attendance trend,
class performance comparison — read-only report screens, exportable to
PDF/Excel.

## Future: Stella AI-assisted insight (Year 2+)
"Which students are trending toward failing," "which teachers haven't
submitted results," phrased as natural-language answers rather than another
chart to interpret — see the PRD's AI section. Explicitly deferred past
launch; the MVP's analytics are dashboards, not predictions.

## Status
Built: the Principal Dashboard frontend screen, wired to the shape a
`/dashboard/summary` endpoint will return.

Not yet built: the `/dashboard/summary` endpoint itself — the single
remaining piece connecting this screen to real numbers. Everything it
needs (attendance %, revenue, outstanding fees, teacher/student counts)
already exists as queryable data in Finance and Attendance; this is a
read-aggregation endpoint away from being real, not a new subsystem.
