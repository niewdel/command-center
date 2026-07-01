# CRM Elevation Plan — make /pipeline best-of-breed

> Build on the EXISTING CRM at `/pipeline` (`crm_companies`/`crm_contacts`/`crm_deals`/`crm_deal_contacts`). Do NOT rebuild. Each task inspects the existing code/schema first, then extends. Keep GREEN (tsc + tests + build). Brand v3 (research/2026-07-01-brand-v3-reference.md). Voice: no em-dashes, outcome-first. Feature basis: research/2026-07-01-crm-best-of-breed-blueprint.md.

**Goal:** Turn the working deal pipeline into a real CRM: activity-based selling (next-action-or-stale), activity timeline, tasks + My Day, weighted forecast, contact/company 360, table view, a reporting dashboard, and a first-login onboarding walkthrough — stealing the best of Pipedrive/HubSpot/Monday/Salesforce/GoHighLevel.

## Task E0: Inspect + migration
- Read `supabase/migration-031..034` + `src/types/pipeline.ts` + `src/app/api/pipeline/*` + `src/app/pipeline/*` to capture exact schemas + patterns.
- Migration `037-crm-elevation.sql` (controller applies): 
  - `crm_activities` (id, tenant/workspace_id, deal_id?, crm_company_id?, contact_id?, type[note/call/email/meeting/stage_change], body, occurred_at, created_by, created_at) + indexes + RLS.
  - `crm_tasks` (id, workspace_id, deal_id?, crm_company_id?, contact_id?, title, due_date, done, created_by, created_at) + indexes + RLS.
  - `crm_deals`: add `next_action_at timestamptz`, `amount_cents bigint` (if `value_cents` absent), `probability int` (nullable; else stage→prob map in code).
  - `crm_saved_views` (id, workspace_id, user_id, entity, name, filter_json) + RLS.
  - Onboarding: add `onboarding_completed_at timestamptz`, `onboarding_step int`, `onboarding_checklist jsonb` to the users/profile row (find the right table).
- Commit migration file; controller applies via Supabase MCP.

## Task E1: Next-action-or-stale nudge (Pipedrive — highest ROI, build first)
- On the deal: set/clear `next_action_at`. In the kanban + deal list, flag deals with no `next_action_at` (or past-due) as "going stale" (a visible badge + a "needs next action" filter). API + UI on existing deals.

## Task E2: Activity timeline (HubSpot)
- API `/api/pipeline/deals/[id]/activities` (+ company/contact scoped) GET/POST. Auto-write a `stage_change` activity when a deal moves stage (hook the existing PATCH). Timeline component on the deal detail (and later the 360). Quick-log note/call/email/meeting.

## Task E3: Tasks + "My Day" (Pipedrive)
- `/api/pipeline/tasks` CRUD; task list on the deal detail; a `/pipeline/my-day` view: today + overdue tasks + deals needing a next action. Complete-in-place.

## Task E4: Weighted forecast + table view (SF/Monday)
- Stage→probability map; show weighted pipeline value (Σ value×prob) on the board header. Add a table view toggle to the kanban (sortable/filterable columns).

## Task E5: Contact/Company 360 (HubSpot)
- Company + contact detail pages: profile + linked deals + activity timeline + tasks + files (proposals). Reuse E2/E3 components.

## Task E6: Reporting dashboard (SF/Monday)
- `/pipeline/dashboard`: pipeline value by stage, win rate, deals created/closed over time, activity volume, weighted forecast. Aggregation RPC/queries.

## Task E7: Onboarding walkthrough (driver.js)
- Add `driver.js` (MIT). `useOnboarding()` hook (reads/writes the onboarding fields via Supabase). Reusable `<Tour>` client component (`next/dynamic ssr:false`). Trigger on first authenticated load when `onboarding_completed_at` is null; persist `onboarding_step` for resume. A 3–5 item activation **checklist** widget + the 6-step CRM tour. **"Replay walkthrough" in Settings** (force:true). Contextual empty-state popovers.

## Task E8: Verify end-to-end
- `npm run build` green; smoke the pipeline + my-day + dashboard + tour; full suite green. PR-ready. Do NOT deploy.

## Deferred (documented, later): automations, sequences, meeting scheduler, deal scoring, @mentions, per-tenant sub-accounts + snapshots + white-label (the agency moat — big, own spec), Stripe billing tiers.
