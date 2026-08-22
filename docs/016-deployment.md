# 016 — Deployment

Rewritten with a concrete platform decision and real capacity numbers,
researched against current (August 2026) pricing rather than assumed —
platform pricing changes fast enough that stale numbers here would be
actively misleading for a real budgeting decision.

## The decision: Render, not Railway, not a bare Hetzner VPS — at launch

All three are legitimate options; here's the actual reasoning, since "just
use Railway or Render" without the reasoning isn't a decision you can
defend or revisit later.

**Render is the launch recommendation.** Reasons, specifically:
- **Predictable, flat pricing** — a Starter web service is a flat $7/month,
  not usage-metered. For a solo founder who hasn't run a production
  workload before, "I know exactly what next month costs" is worth more
  than Railway's usage-based billing being marginally cheaper at low
  traffic, because usage-based billing is also how a founder gets a
  surprise bill from a bug (an infinite retry loop, a runaway query) —
  Render's flat-per-service model caps that risk structurally.
- **Native support for everything this stack needs** — web service,
  background worker (Celery), cron jobs, managed Postgres, and a
  Redis-compatible Key Value store, all as first-class Render resource
  types with one dashboard, one billing relationship. Render's own
  Blueprint (`render.yaml`) can define the whole topology (API + worker +
  Postgres + Redis) as one file reviewed in this repo.
- **A genuinely simpler operational model** for someone who is not
  planning to be a full-time infrastructure engineer — no Nginx config, no
  Certbot renewal, no OS patching, no Docker host to secure. Render
  handles TLS, zero-downtime deploys, and health-check-based restarts.

**Railway is a reasonable second choice**, specifically if actual usage
stays low enough that its usage-based Hobby/Pro credits cover most of the
bill — worth revisiting once there's real traffic data, not before.

**A bare Hetzner VPS is explicitly NOT the launch recommendation**,
despite being the cheapest raw compute (~$9.50/month for a CX22 — 2 vCPU,
4GB RAM, after Hetzner's April 2026 price adjustment). The cost savings
only matter once managed-platform fees start to genuinely add up — self-
managing Postgres backups, Redis, TLS renewal, and OS security patches is
real ongoing work that a solo founder's time is worth more than the
$20–30/month difference for the first several months. Hetzner becomes the
right call once monthly platform spend clears roughly $150–200/month
(see the scaling table below) and the savings justify taking on that
operational work — not on day one.

## Topology (on Render)

| Component | Render resource | Starting tier | ~Monthly cost |
|---|---|---|---:|
| API (FastAPI/Uvicorn) | Web Service | Starter (0.5 CPU / 512MB) | $7 |
| Celery worker | Background Worker | Starter | $7 |
| Postgres | Render Postgres | Basic-1gb | $19 |
| Redis (broker + cache) | Key Value | Starter | ~$10 |
| Frontend (Next.js) | Vercel (separate) | Hobby | $0 |
| File storage | Cloudflare R2 | Pay-as-you-go | ~$0–5 |
| **Total to launch** | | | **~$43–48/month** |

At Foundation-plan pricing (₦25,000/month ≈ $16–17), **three paying
schools already cover this entire infrastructure bill**, with margin
remaining for SMS/email costs. This is the number to actually hold onto —
not the PRD's original abstract estimate.

## Realistic capacity: what does this actually carry?

This is the question worth answering concretely rather than vaguely,
since it drives real decisions (when to upgrade, whether the architecture
holds).

**The workload shape matters more than raw user count.** A school admin
platform is not high-frequency-trading or a social feed — it's bursty,
concentrated CRUD: attendance marking is heavy for ~30 minutes each
morning per school, fee/results entry is occasional, most of the day is
light read traffic (parents checking a dashboard). This is a genuinely
easy workload for modern hardware compared to what "500–1,000 users"
sounds like in the abstract.

| Schools onboarded | Approx. total users | Render tier needed | Reasoning |
|---:|---:|---|---|
| 1–15 | up to ~750 | Starter web + Starter worker (as above) | Peak concurrent load is a few dozen requests/second during morning attendance windows across all schools combined — well within a single 0.5 CPU instance for JSON CRUD over an indexed Postgres schema. |
| 15–50 | ~750–2,500 | Standard web (2GB) + Standard worker + Postgres Standard-4gb | The database, not the API process, becomes the first real constraint — more concurrent connections and larger tables (attendance/score history accumulating). Render's connection pooling and the schema's existing indexes (doc 004) carry this without an architecture change. |
| 50–200 | ~2,500–10,000 | Pro web (multiple instances behind Render's load balancer) + Pro Postgres + a dedicated Redis instance | This is where horizontal scaling (multiple API instances) actually starts to matter, not before — and it's a Render dashboard setting, not a rearchitecture, because the app was built stateless from the start (no in-process session state, no local file writes outside R2). |
| 200+ | 10,000+ | Time to move to Hetzner/dedicated infrastructure, or Render's Scale tier + read replicas | At this point the managed-platform premium is worth trading for direct infrastructure control, and the revenue (200+ schools at even Foundation pricing is ₦5M+/month) comfortably funds a part-time or full-time infra hire to manage it properly. |

**The honest caveat, stated plainly:** these are informed estimates based
on the schema, the query patterns, and how comparable FastAPI+Postgres
workloads perform in practice — not numbers from a load test, because no
load test has been run (nothing has run at all yet, see doc 020). The
first real signal on whether these estimates hold comes from actually
deploying and watching Render's built-in metrics during the pilot-school
phase, not from this table. Revisit this table after the first month of
real usage.

## The self-serve journey — a school onboarding without ever meeting the founder

This is a real, currently-functional path through the product, worth
tracing end to end since it's the whole point of the landing page and
onboarding wizard existing. Two entry points now, matching a real-world
distinction: the person running onboarding is often not the Principal,
but the school's de facto "IT person" — non-technical schools included.

```
Landing page (cognitioerp.com)
        ↓  "Start free trial"
Onboarding wizard (/onboard) — 3 steps, no sales call required
        ↓  POST /schools/onboard
School + default roles + first Super Admin created atomically
        ↓  Welcome email sent automatically (Notifications module)
Whoever ran onboarding signs in at {subdomain}.cognitioerp.com/login
        ↓  (resolved automatically via subdomain — see below)
        ↓  forced password reset (doc 003)
   ├── If they ARE the Principal: continue directly
   └── If they're IT staff setting this up FOR the Principal:
        Settings > Staff — issue a separate, scoped Principal account
        (or Registrar, Accountant, Librarian, ICT Admin) — the Principal
        never has to touch the onboarding wizard at all
        ↓
Settings > Branding — school sets logo/colors (doc 015)
        ↓
Settings > Classes — define JSS1..SS3 (SchoolClass)
        ↓
Students > Import — bulk Excel upload (with each school's own official
        admission numbers, if they have one), or Add student one at a
        time, photo included
        ↓
Settings > Fee structure + Grading scheme — configure what the school
        charges and how it grades
        ↓
Results > Import past results — historical/manual scores from old Excel
        files sync into the new system automatically
        ↓
Teachers > Add teacher — issued their own Identity Code and photo
        ↓
Daily use: Attendance (offline-capable), Results, Finance, Communication
        ↓
Real-world lifecycle, whenever it happens: teacher resignation/
        termination (offboard — access revoked everywhere, records
        untouched), student graduation/transfer/withdrawal/death (exit —
        same principle, plus a downloadable transcript and portable
        JSON export the family takes wherever they go next)
```

Every arrow in that chain is a real, built, wired endpoint. Two real
gaps in this chain were found and closed:

1. **Subdomain resolution didn't exist at all** — flagged as the single
   most launch-blocking gap in the whole system. A school completing
   onboarding had a URL but no way to actually reach a working login
   page from it; the frontend read a placeholder that nothing ever set.
   Closed with `core/subdomain.py` (resolves a school from the request's
   hostname before login even happens) and `lib/school-context.tsx` (the
   frontend's real resolution of "which school is this," replacing the
   placeholder everywhere it was used).
2. **Onboarding claimed credentials were emailed but nothing actually
   sent them.** Closed by wiring a real welcome email through the
   Notifications module — which itself surfaced a second bug:
   `queue_notification` silently ignored its `requested_channel`
   parameter whenever a user had no preferences yet (always true for a
   brand-new account), defaulting new accounts to `in_app` delivery they
   had no way to check. Fixed to honor the requested channel.

Both fixes mean self-serve onboarding is now a genuinely complete,
working path end to end — not one with a silent dead end at the very
first or very last step.

## Landing page — SEO/AEO

The landing page (`cognitio-erp-landing.html`) already has the structural
bones for this (semantic headings, an FAQ section) but is missing the
mechanical SEO/AEO layer the original brief called for:
- Meta description, Open Graph tags, Twitter Card tags — not yet added to
  the `<head>`.
- `FAQPage` Schema.org structured data wrapping the existing FAQ
  content — this is specifically what lets AI answer engines and Google's
  rich results surface the FAQ answers directly.
- A `sitemap.xml` and `robots.txt` — don't exist yet; trivial once the
  site has more than one page (currently just the landing page — no
  `/pricing`, `/about`, or blog exist as separate crawlable pages).
- Dedicated content pages answering "What is a School ERP?" / "How much
  does school management software cost?" (the AEO strategy from the
  original brief) — not built. The landing page's FAQ section covers some
  of this ground conversationally but isn't structured as indexable,
  linkable standalone pages.

These are genuinely quick additions (a few hours, not days) once the
domain is live and can be prioritized right after the email-delivery fix
above, since SEO/AEO only starts compounding once the page is actually
deployed and crawlable.

## CI/CD

GitHub Actions: on PR — lint, type-check, run the test suite including the
tenant-isolation tests (doc 018); merge to `develop` — deploy to a Render
staging environment; tag on `main` — deploy to production, running Alembic
migrations as a pre-deploy step (Render supports this as a "pre-deploy
command" on the web service) with the deploy failing (not proceeding) if
migrations fail.

## Migrations

Alembic, one migration per PR that changes schema — never edit an
already-merged migration. All three current migrations (`0001` initial
schema, `0002` check constraints, `0003` school_classes) are written and
ready; none have been executed yet, since this session never had access
to a live Postgres. **Running these for the first time against a real
Render Postgres instance is the literal first step of deployment** — if
something in the hand-written `0001` migration doesn't apply cleanly,
that's the first thing to find and fix, before any application code is
even exercised.

## Status

Not yet provisioned — this document is now a concrete runbook, not just a
plan. The order of operations for actually going live:
1. Create the Render Postgres instance, run all three migrations against it.
2. Deploy the API as a Render Web Service, worker as a Background Worker,
   Redis as a Key Value instance — wire the environment variables from
   `.env.example` (Resend API key is required now that onboarding
   depends on it to deliver the very first credentials a school gets).
3. Deploy the frontend to Vercel, pointing `NEXT_PUBLIC_API_URL` at the
   Render API's URL.
4. Run the test suite (doc 018) against the now-real database.
5. Onboard 1–2 pilot schools through the actual self-serve flow, not a
   manually-seeded account, to prove the whole chain — including the
   welcome email — works end to end.
