# Best-of-breed CRM blueprint (research) — for the existing /pipeline CRM

Design input for elevating the existing CRM (`crm_companies`/`crm_contacts`/`crm_deals`/`crm_deal_contacts`, stages discovery→scope→proposal→build→live/lost/disqualified). Built on that foundation, NOT a rebuild.

## Best-of, stolen per CRM
- **Salesforce:** reports/dashboards, custom objects/fields, no-code Flow automation, weighted forecast, AI wired into workflow (not bolted on).
- **HubSpot:** ease/fast setup (#1 to emulate), usable free tier, email tracking + sequences, **contact activity timeline** (the emotional core), meeting scheduler, one unified contact record.
- **Monday:** visual color-coded boards, no-code when→then automations, instant multi-view (kanban/table/chart/timeline), dashboard widgets, **sales→onboarding board handoff**.
- **Pipedrive:** drag-drop pipeline, **activity-based selling (every deal needs a scheduled next action; overdue flagged)** — the single most-loved idea, two-way email sync, AI next-action, Smart Docs (proposals + eSign in the deal), web forms.
- **GoHighLevel (agency moat):** **client sub-accounts** (isolated tenant per client, one login to switch), **Snapshots** (clone config not data into a new tenant in ~60s), **white-label / SaaS mode** (subdomain + branding + Stripe-gated tiers), unified conversations inbox, missed-call-text-back workflow, client portal.

## Prioritized feature set (Cx = build complexity S/M/L)
### Tier 0 — Core (make it feel like a real CRM)
1. **Activity timeline** (HubSpot) — M — new `crm_activities` (polymorphic: contact/company/deal, type call/email/meeting/note, body, occurred_at, user, tenant).
2. **Tasks/reminders + "My Day"** (Pipedrive) — M — new `crm_tasks`.
3. **Activity-based "next action" nudge** (Pipedrive) — S — add `next_action_at` to `crm_deals`; flag deals with none as going stale. **BUILD FIRST (highest love:effort).**
4. **Weighted pipeline forecast** (SF/Pipedrive) — S — `amount` + `probability` (or stage→prob map) on `crm_deals`; sum in a view.
5. **Contact/Company 360 profile** (HubSpot) — M — one page: details + deals + timeline + tasks + files.
6. **Quick-add everywhere (⌘K)** (Monday/HubSpot) — S — UI over existing CRUD.
7. **Saved views/filters** (SF/Monday) — M — new `crm_saved_views`.
8. **Email/activity capture** (HubSpot/Pipedrive) — M→L — manual log now, Gmail/Graph sync later.
9. **Multi-view pipeline (kanban + table)** (Monday) — S — UI on existing deals.
### Tier 1 — Differentiators
10. Pipeline automations (stage-change triggers) — L — new `crm_automations`; start with a fixed menu.
11. Reporting dashboard (pipeline value/win rate/activity/forecast) — M.
12. Lead/deal scoring — M — `score` on deals from activity recency/count.
13. Sequences/cadences — L (needs email).
14. Meeting scheduler — L (needs calendar).
15. Proposals + eSign status on deals — M (proposals already attach; add status/viewed_at).
16. @mentions/comments — M — new `crm_comments` + existing realtime.
17. Mobile quick actions (PWA) — S.
18. AI "next best action" inline on the timeline — M (existing LLM plumbing).
19. Unified conversations inbox — L (defer; needs Twilio).
### Tier 2 — Agency/white-label (resale moat)
20. **Per-client sub-accounts (tenancy)** — L — the tenant_id + RLS work; `crm_tenants` + `tenant_members` (role agency_admin/account_user) + tenant switcher. Foundational.
21. Per-tenant white-label branding — S→M — CSS custom-property tokens in `crm_tenants.branding_json`, injected at runtime.
22. Custom subdomain per tenant — M — DNS/wildcard + middleware tenant resolution.
23. **Snapshots/templates** — L — `crm_snapshots` (config_json: stages, automations, saved views, branding). Rule: snapshot CONFIG, never runtime data. Highest-leverage agency feature.
24. SaaS/reseller billing tiers — L — Stripe/MRR + `tenant_subscriptions`.
25. Client-facing portal — M — (the customer portal we're building now covers reporting; extend to pipeline later).

**Build order:** #3 → #1 → #2 → #5 → #4/#9/#11 → #20/#21/#23 → automations/sequences/scheduler.

## Onboarding walkthrough — driver.js
- **Library: driver.js** — MIT (intro.js & shepherd are AGPL — disqualified for a closed-source resale SaaS), React-19-proof (vanilla TS), ~5.9KB, CSS-var theming. Runner-up react-joyride v3 (MIT now, ~4× bundle).
- App Router: client-only (`'use client'`, trigger in useEffect after hydration, `next/dynamic ssr:false`).
- **State: server-side in Supabase** (login-gated; never localStorage). On the user/profile row: `onboarding_completed_at timestamptz`, `onboarding_step int`, `onboarding_checklist jsonb`.
- Reusable `<Tour>` client component wrapping driver.js + a `useOnboarding()` hook (reads/writes Supabase). Trigger on first authenticated load when not completed; persist step for resume; "skip/finish" sets completed_at.
- **Re-launch from Settings** ("Replay walkthrough") calls the hook with `force:true` (ignores completed flag).
- **Primary pattern = a 3–5 item activation checklist** (persistent, dismissible) + short driver.js tour + contextual empty-state popovers. Keep tours ≤5 steps (3-step ~72% completion vs 7-step ~16%).
- **Sample 6-step CRM tour:** (1) pipeline board + drag stages, (2) quick-add ⌘K, (3) deal 360/timeline, (4) next-action-or-stale, (5) My Day, (6) weighted forecast/dashboard (agency: tenant switcher).
- **Checklist:** ☐ create first deal ☐ add contact + log activity ☐ set a next action ☐ connect calendar/email ☐ (agency) create first client sub-account.
