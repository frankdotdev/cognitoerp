# 021 — Pricing & Billing Strategy

Doesn't fit cleanly into the 001–020 architecture series, but is
important enough to have its own home rather than stay scattered across
memory notes and the original PRD document.

## Cognitio ERP plans (unchanged from the original pricing decision)

| Plan | Included students | Monthly | Termly (~4mo, 5% off) | Annual (2 months free) |
|---|---:|---:|---:|---:|
| Foundation | 200 | ₦25,000 | ₦95,000 | ₦250,000 |
| Academy | 450 | ₦50,000 | ₦190,000 | ₦500,000 |
| Excellence | 1,000 | ₦100,000 | ₦380,000 | ₦1,000,000 |
| Enterprise | Custom | Custom | Custom | Custom |

No feature gating between tiers — every plan gets the full ERP (fees,
attendance, communication all included from Foundation up), which is the
deliberate contrast against competitors like SSA/Smart School Africa that
gate attendance and fees behind higher tiers.

## Termly billing dates — kept simple deliberately

Nigerian academic terms run roughly September–December, January–April,
and April/May–July, but term start/end dates vary by school and by state
calendar. Rather than build a shared, platform-wide "term calendar" every
school must conform to (real complexity, real edge cases when a school's
actual dates don't match), **termly billing is generated against each
school's OWN configured session dates** — set once during onboarding
(`School.current_session_start`) — via a one-time Paystack invoice per
term rather than a fixed recurring subscription interval (see doc 016's
billing-approach note: Paystack has no native "termly" interval, only
quarterly/biannually/annually, and none of those cleanly map to 3
uneven terms/year).

**Practically, this means:** a school on termly billing gets an invoice
generated near the start of each of their own terms, not on a fixed
calendar the platform imposes. This is more correct for the real world
(a school starting late due to a public holiday, or running a shorter
first term) than forcing every school onto the same 3 fixed billing
dates would be — at the cost of it being a per-school computed date
rather than one global constant, which is the right tradeoff.

**The genuinely simple option, and the one to lead with in sales
conversations:** annual billing, 2 months free. No per-term invoice
scheduling at all — one payment, one date, done. Given the real
complexity difference above, steering schools toward annual (with the
discount as the incentive) rather than termly is deliberate product
strategy, not just a nice-to-have.

## The multi-product ecosystem — Stella AI, LMS (Cognitio LMS), CBT (Cognitio Assess)

Per the product's explicit direction: each of these is a **standalone
product with its own independent pricing** — someone can subscribe to
Stella AI directly with no Cognitio ERP account at all, same for a future
Cognitio LMS or Cognitio Assess customer. They share the same ecosystem (SSO, the
Cognitio brand family) without being bundled-only.

**How a school gets access through their ERP plan:** `School` carries
three addon flags — `stella_ai_enabled`, `lms_enabled`, `cbt_enabled`
(migration `0005`). A school's Cognitio plan tier can include one or more
of these (e.g. Excellence includes Stella AI; Academy and below don't,
and would pay for it as a separate addon) — nothing about *how* a school
gets the flag flipped is pricing logic baked into the ERP itself; that's
a commercial/billing decision made at the point of sale or upgrade, kept
deliberately outside the application layer so it can change without a
schema change.

**Why this matters architecturally, not just commercially:** the ERP's
sidebar already has "Learning" and "Assessments" launcher nav items
(`DashboardShell.tsx`) with a "Soon" badge, and placeholder pages that
check these exact flags to show either "included in your plan" or
"ask about upgrading." When Cognitio LMS and Cognitio Assess actually launch as
products, wiring them in is a redirect-target change to those two nav
items and a real SSO handoff (same JWT, no second login) — not new
nav, new permission structure, or new billing logic. The groundwork is
real and ready, even though the products behind it aren't built yet.

## Status
The pricing table and the addon-flag gating mechanism are both real
(the flags exist in the schema and are exposed via the API). What's
NOT built: any actual billing integration that flips these flags
automatically on a plan change or addon purchase — today, an addon flag
would be set manually (a direct database update or an admin tool that
doesn't exist yet) rather than through a self-serve upgrade flow. That's
real, deliberate future work, not a gap discovered by accident.
