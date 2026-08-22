# 017 — Monitoring & Observability

## Error tracking
Sentry, wired into both FastAPI (backend exceptions, with `school_id`
attached to every event for fast triage) and Next.js (frontend runtime
errors). Free tier is sufficient at launch volume.

## Structured logging
Every log line is JSON, includes `request_id`, `school_id`, `user_id` where
applicable — makes "show me everything that happened for School X in the
last hour" a log query, not a database archaeology exercise.

## Metrics
Prometheus scraping the FastAPI app (via `prometheus-fastapi-instrumentator`)
for request latency/error-rate/throughput; Grafana dashboards for the same.
Free/self-hosted, run alongside the API on the same Hetzner VPS.

## Health checks
`/health` (liveness — is the process up) and `/health/ready` (readiness —
can it reach Postgres and Redis) endpoints, checked by Nginx/uptime
monitoring before routing traffic, and by the CI/CD pipeline before
considering a deploy successful.

## Uptime monitoring
A third-party pinger (e.g. UptimeRobot free tier) hitting `/health` from
outside the infrastructure — catches full outages that internal monitoring
can't see itself experiencing.

## Alerting
Sentry issue alerts + Grafana threshold alerts (error rate spike, DB
connection pool exhaustion, disk usage) routed to a dedicated
support/on-call channel — not email, which gets missed.

## Status
Not yet built. Comes online alongside first production deployment (016) —
observability with nothing deployed yet has nothing to observe.
