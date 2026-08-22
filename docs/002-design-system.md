# 002 — Design System

## Identity
Cognitio ERP's visual identity is green-led, matching STELLA AI's palette so the
two products read as one family — while remaining fully overridable per school
(see 015). Green is Cognitio's *default* brand color, not a hardcoded constant:
every school-facing screen pulls its accent color from the active tenant's
theme, defaulting to Cognitio green until a school sets its own.

## Color tokens
| Token | Value | Use |
|---|---|---|
| `--brand-600` (default accent) | `#0E7C4A` | Primary buttons, active nav, links |
| `--brand-500` | `#12A25C` | Hover states, secondary accents |
| `--brand-50` | `#EAF6EF` | Tinted backgrounds, badges |
| `--ink-900` | `#14181F` | Primary text |
| `--ink-500` | `#5B6472` | Secondary text |
| `--ink-300` | `#98A1AD` | Muted text, placeholders |
| `--surface-0` | `#F7F8F7` | Page background |
| `--surface-1` | `#FFFFFF` | Cards |
| `--border` | `#E5E8EA` | Hairlines |
| `--sidebar-bg` | `#12161F` | Dashboard sidebar (fixed, not themeable — keeps chrome legible regardless of school color) |
| `--danger` | `#C4453F` | Errors, overdue |
| `--warning` | `#B8791A` | Due soon, pending |
| `--success` | `#0E7C4A` | Paid, complete (same as brand — deliberate: green already means "good" in this product) |

Every school's `--brand-*` values are overridden at runtime from that school's
theme settings (see 015); everything else stays fixed so the product always
feels like Cognitio underneath the school's skin.

## Typography
- **Headings:** Manrope (500/600 weight only) — professional, geometric, reads as institutional software rather than a startup landing page.
- **Body/UI:** Inter (400/500) — the actual workhorse for dense dashboard UI, excellent at small sizes.
- **Data/mono:** IBM Plex Mono, for identity codes, amounts in tables, timestamps.
- Scale: 12 / 13 / 14 / 16 / 20 / 24 / 32 / 40px. Dashboards live mostly at 13–14px — this is dense operational software, not a marketing page.

## Component library
Built on shadcn/ui (Radix primitives + Tailwind) rather than a heavier component
kit — gives full control over styling to match the reference screenshots
(clean cards, soft borders, no heavy shadows) without fighting a prebuilt theme.

Core shared components (built once in `frontend/components/shared/`, used everywhere):
`DataTable` (sortable, paginated, filterable — every list screen uses this one
component), `StatCard`, `PageHeader`, `EmptyState`, `ConfirmDialog`, `RoleBadge`,
`StudentAvatar`, `CurrencyDisplay`.

## Layout pattern (matches the reference screenshots)
Dashboard shell: fixed dark sidebar (icon + label nav, role-aware — a Teacher
never sees Finance) + top bar (search, notifications, avatar) + content area
on `--surface-0` with white cards. Mobile: sidebar collapses to a bottom tab
bar for the 4–5 most-used items per role.

## Motion
Minimal. 150ms ease-out on hover/focus states, no page-load choreography, no
decorative animation. Enterprise software should feel instant, not performed.
