# 001 — Foundation & Repository

## Repository shape
Two codebases, one product:

```
cognitio-erp/
  backend/        FastAPI, Python — clean architecture (see 004, 019)
    app/
      core/       config, security primitives
      db/         session, base model, tenant guard
      modules/    one folder per domain: auth, students, teachers,
                  attendance, finance, inventory, hr, results, comms
      shared/     base repository, pagination, error handling
      tasks/      Celery jobs (emails, SMS, PDF generation, imports)
    alembic/      migrations
  frontend/       Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui
    app/
      (public)/           landing page, login
      (dashboard)/
        principal/
        teacher/
        parent/
        student/
        finance/
    components/
      ui/                 shadcn primitives
      shared/              cross-role components (data table, stat card, etc.)
    lib/                  API client, auth helpers, theme provider
  docs/            this folder — the source of truth for product + architecture decisions
```

## Why this split
Backend and frontend deploy independently (Hetzner VPS for the API, Vercel for
the frontend) and version independently. A single monorepo (npm/uv workspaces)
keeps them in one place for a solo/small team without forcing them into the
same deploy pipeline.

## Tech stack, locked
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, PostgreSQL 16, Redis, Celery.
- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form + Zod.
- **Infra:** Docker, GitHub Actions, Hetzner VPS (API + Postgres), Vercel (frontend), Cloudflare R2 (files).

## Branching & environments
- `main` — production. `develop` — staging. Feature branches off `develop`, PR back in.
- Three environments: local (docker-compose), staging (staging.cognitioerp.com), production (cognitioerp.com).
- Every merge to `develop` auto-deploys to staging via GitHub Actions; `main` deploys to production on tag.

## Environment variables
All configuration is environment-driven (see `backend/app/core/config.py`) — nothing
environment-specific is ever hardcoded. `.env.example` in each codebase lists every
required variable; real values live in the deploy target's secret store, never in git.

## Status
Backend scaffold started: config, db session, tenant guard, auth core, Students
reference module. Frontend: not yet scaffolded — next concrete step, see 020.
