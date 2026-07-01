# CRM v1 — Native Prospect & Client Management

**Date:** 2026-07-01
**Status:** Approved design, pre-implementation
**Owner:** Justin Ledwein / Niewdel

## Purpose

Turn Command Center into the system Niewdel uses to run its own book of business — "practice what we preach." CRM v1 is the **foundation**: a native, HubSpot-style CRM (Companies with multiple Contacts) that tracks prospects through a sales pipeline and keeps clients organized, with everything (the existing SEO/Visibility reports, and later proposals + invoices) hanging off one unified company record.

This is the first of three subsystems. **Proposals + e-sign** and **Invoicing + Stripe + MRR** get their own specs and build on the records defined here.

## Locked decisions

1. **Build order:** CRM first (this spec), then Proposals, then Billing.
2. **Model:** HubSpot-style — a **Company** (account) is the primary record; **Contacts** attach to a company (many per company).
3. **Pipeline stages:** `lead → qualified → proposal_sent → won → lost` (simple agency pipeline; renamable in code, not user-editable in v1).
4. **Companies reuse the existing `clients` table** — no separate silo. Franky's Detailing, HD Grading, and Niewdel already live there and are stage = `won`.
5. **Pipeline stage lives on the Company** (not a separate Deals object). A separate Deals object is deliberately deferred (see "Deferred: Deals").
6. **Payments engine (later subsystem):** Stripe, not Wave.
7. **E-sign (later subsystem):** built internally (ESIGN/UETA-valid), not DocuSign.
8. **Tenancy:** ONE system, **RLS-isolated tenants** (not a database per client). `workspace = tenant`. Build the CRM **generic** (no Niewdel-specific hardcoding) so it's a resellable, white-label product; Niewdel's workspace is tenant #1, a seeded **Demo** workspace is tenant #2 (for showing prospects). Self-serve tenant provisioning + subdomains are **deferred** (later phase).

## Multi-tenancy (how isolation works)

- **Tenant = workspace.** Every CRM table carries `workspace_id`. The existing `workspaces` table is the tenant registry; the existing `clients` table (= Companies) already has `workspace_id`.
- **Isolation = `workspace_id` + Row-Level Security.** Each new table gets an RLS policy tying `workspace_id` to a workspace the authenticated user may access. Server-side data access uses the app's existing service-role + explicit workspace-scoping pattern (as the SEO agent does), with RLS as defense-in-depth. A client tenant sees only their own companies/contacts/activities/tasks — never another tenant's.
- **Generic, not Niewdel-specific.** No hardcoded client names, copy, or pipeline assumptions beyond the `PIPELINE_STAGES` constant. Sample/demo content lives only in the seeded Demo workspace, not in code.
- **Workspace resolution (v1).** A `currentWorkspace(session)` helper resolves the authenticated user's active workspace. For v1 the operator team (justin/dillon) maps to the Niewdel workspace; the Demo workspace is reachable via a workspace switcher in the UI (so the team can show the demo). The full per-tenant user-membership model + onboarding UI is the deferred provisioning layer.
- **Deferred (explicitly NOT in v1):** self-serve signup, per-tenant admin invite flow, subdomain routing (`client.niewdel.com`), per-tenant theming. The v1 schema + RLS are designed so these bolt on without a rewrite.

## Goals / success criteria

- Every prospect and client is one Company record with a pipeline stage, its Contacts, an activity timeline, and open tasks.
- A **pipeline board** (kanban by stage) where cards drag between stages, showing company, primary contact, est. MRR, last-touch, and a **stale flag** when a company in an open stage (not won/lost) has had no activity in **14 days** (constant, tunable in code).
- A **company detail** page: contacts (add/edit, mark primary), activity timeline (one-click log note/call/email/meeting), tasks with due dates, est. MRR, and a deep-link to that company's Visibility (SEO) report.
- Nothing about the existing SEO agent breaks — the `clients` records and `seo_config` it depends on are untouched except for additive columns.

## Data model

All new tables include `id uuid pk`, `created_at timestamptz default now()`, and `workspace_id uuid` with workspace-scoped RLS (mirroring the existing app pattern). One migration file (`supabase/migration-036-crm-v1.sql`), applied via the Supabase MCP.

### Companies — extend existing `clients` (additive columns only)
Current columns: `id, workspace_id, name, type, notes, links (jsonb), created_at, seo_config (jsonb)`. Add:
- `pipeline_stage text not null default 'lead'` — one of lead/qualified/proposal_sent/won/lost.
- `owner_id uuid` — the user who owns the relationship (nullable; single-operator today).
- `website text` — company domain/site (distinct from `seo_config.domain`, which stays authoritative for the SEO agent; `website` is the CRM display field and defaults from `seo_config.domain` when present).
- `est_mrr numeric` — estimated monthly recurring value; nullable. Feeds the Billing subsystem's MRR later.
- `lost_reason text` — nullable; set when stage = lost.
- `last_activity_at timestamptz` — denormalized; updated whenever a `crm_activity` is inserted for the company. Powers the "stale" flag and board sorting.

Existing `clients` rows (Franky/HD/Niewdel) get `pipeline_stage = 'won'` in the migration.

### `contacts` (new)
- `company_id uuid not null references clients(id) on delete cascade`
- `name text not null`
- `email text`, `phone text`, `title text`
- `is_primary boolean not null default false` — at most one primary per company (enforced in app logic; a partial unique index guards it)

### `crm_activities` (new) — the timeline
- `company_id uuid not null references clients(id) on delete cascade`
- `contact_id uuid references contacts(id) on delete set null`
- `type text not null` — one of `note | call | email | meeting | stage_change`
- `body text` — free text; for `stage_change`, an auto-generated "Moved from X to Y"
- `created_by uuid`
- Inserting an activity updates the parent company's `last_activity_at`.

### `crm_tasks` (new) — follow-ups / next steps
- `company_id uuid not null references clients(id) on delete cascade`
- `contact_id uuid references contacts(id) on delete set null`
- `title text not null`
- `due_date date`
- `done boolean not null default false`
- `created_by uuid`

### RLS
Every new table is workspace-scoped. `contacts`/`crm_activities`/`crm_tasks` carry a denormalized `workspace_id` (copied from the parent company on insert) so RLS policies are simple and fast: `workspace_id` must be a workspace the authenticated user may access. Policies follow the app's existing pattern; server-side access additionally scopes by the resolved current workspace (defense-in-depth). This guarantees one tenant can never read another tenant's records.

### Demo tenant seed
The migration seeds a **Demo** workspace with a handful of realistic sample companies (across every pipeline stage), contacts, activities, and tasks — generic, on-brand, no real client data — so the CRM can be shown to prospects immediately. This is the "demo model." Niewdel's own workspace is tenant #1 with its real clients (Franky/HD/Niewdel already there).

## Architecture / units

- `src/lib/crm/types.ts` — `Company`, `Contact`, `CrmActivity`, `CrmTask`, `PIPELINE_STAGES` constant + labels.
- `src/lib/crm/db.ts` — data-access helpers (list companies by stage, get company detail bundle, CRUD contacts/activities/tasks, move stage — which also writes a `stage_change` activity and updates `last_activity_at`). Service-role/server-side, workspace-scoped.
- `src/app/crm/page.tsx` — the pipeline board + list toggle.
- `src/app/crm/[id]/page.tsx` — company detail (contacts, timeline, tasks, est. MRR, report link).
- `src/app/api/crm/**` — route handlers for the mutations (create/update company, contact, activity, task, move-stage), each verifying the session + scoping by workspace.
- `src/components/crm/*` — `PipelineBoard`, `CompanyCard`, `StageColumn`, `ContactList`, `ActivityTimeline`, `TaskList`, `LogActivity`, `AddContact` (each small, one responsibility).
- Sidebar/bottom-nav: add a **CRM** item (route `/crm`).

Follows the app's baseline UI + design tokens (dark/blue brand). Uses existing shadcn/ui components and the drag interaction pattern already used elsewhere if present; otherwise a minimal accessible dnd.

## Data flow

- Board load → `listCompaniesByStage(workspace)` → grouped by `pipeline_stage`, sorted by `last_activity_at`.
- Drag a card to a new column → `POST /api/crm/companies/:id/stage` → updates `pipeline_stage`, inserts a `stage_change` activity, bumps `last_activity_at`, optimistic UI update.
- Company detail → one bundled fetch (company + contacts + activities + tasks).
- Log activity / add task / add contact → POST → optimistic append; activity insert bumps `last_activity_at`.

## Error handling

- All API routes: verify Supabase session, scope by workspace, validate input (Zod), return structured errors (no stack leaks) — per the app's API-route security rules.
- Mutations are optimistic with rollback on failure + a toast.
- Deleting a company cascades contacts/activities/tasks (FK `on delete cascade`); the UI requires an explicit confirm (destructive).

## Testing

- Unit (vitest): `crm/db.ts` stage-move writes a stage_change activity + bumps last_activity_at; primary-contact uniqueness; stale-flag threshold logic.
- API: each route — happy path, unauthorized, invalid input, cross-workspace access denied (RLS).
- Component: PipelineBoard renders stages, empty state, stale flag; CompanyDetail renders each panel + empty states.

## Deferred: Deals (not in v1)

Pipeline stage lives on the Company. This is sufficient while a company has one opportunity at a time (the norm for a solo agency selling retainers). If Niewdel later runs multiple concurrent opportunities per account (e.g., an upsell while already a client), introduce a `deals` table (stage + amount, many per company) and move `pipeline_stage`/`est_mrr` onto it. The v1 schema is designed so this is additive, not a rewrite: activities/tasks/proposals can gain an optional `deal_id` later.

## Out of scope (v1 — future specs)

- Proposals + internal e-sign (next spec).
- Invoicing + Stripe + recurring plans + MRR dashboard (spec after that).
- HubSpot two-way sync.
- Sending email from within the CRM (activities log email manually in v1).
- User-editable pipeline stages; multi-user ownership/permissions beyond workspace scope.

## File map

| File | Responsibility |
|---|---|
| `supabase/migration-036-crm-v1.sql` | additive `clients` columns + `contacts`/`crm_activities`/`crm_tasks` + RLS + backfill stage=won |
| `src/lib/crm/types.ts` | shared types + `PIPELINE_STAGES` |
| `src/lib/crm/db.ts` | workspace-scoped data access + stage-move logic |
| `src/app/crm/page.tsx` | pipeline board + list toggle |
| `src/app/crm/[id]/page.tsx` | company detail |
| `src/app/api/crm/**` | mutation route handlers (session-verified, workspace-scoped, Zod) |
| `src/components/crm/*` | board, card, contacts, timeline, tasks, log/add forms |
| `src/components/layout/{sidebar,bottom-nav}.tsx` | add CRM nav item |
