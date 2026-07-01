# Morning brief — overnight build (2026-07-01)

## Shipped live overnight (already on app.niewdel.com)
- Rename: SEO Agent -> Visibility Agent, Website Scoring Agent -> Site Audit Agent, client "SEO Report" -> "Visibility Report" (PR #12).
- Auth: core team (justin/dillon) always allowed regardless of env var (PR #11) — Dillon unblocked permanently.

## Accounts / links
- admin@niewdel.com CREATED (demo account). Set-password link (expires ~1h; regenerate if stale):
  https://mrnuwlxmzxzhqadhktef.supabase.co/auth/v1/verify?token=f7e05336073efce695c45c3f229c923d61bdea29a47e7aa5bba6ee7a&type=recovery&redirect_to=https://app.niewdel.com/login/update
- admin@ access goes live ONLY with the CRM ship, sandboxed to the Demo workspace + /crm only (never real client data).

## Needs you (can't do solo)
- Stripe account keys for live billing (Invoicing subsystem) — code will be complete with a clear paste-in point.
- Final production deploy approval for the CRM (I'll leave it green + PR-ready; deploy after a quick look).

## Demo-user access rule (baked into CRM)
- admin@niewdel.com -> Demo workspace, /crm only. Middleware redirects demo users away from /seo /audits /issues. Data workspace-scoped so demo never sees Niewdel's real clients.
