# Tenancy Foundation + Switcher — Design Spec

**Date:** 2026-07-01
**Status:** Approved (design), pending spec review → plan.
**Scope:** The FIRST slice of the agency/multi-tenant tier: a real tenant model, membership + roles, RLS-enforced isolation, session-resolved active tenant, an agency tenant switcher, and the admin@ Demo sandbox. White-label branding, snapshots, and custom domains are SEPARATE follow-on specs that build on this.

## Goal
Turn Command Center's single-operator CRM into a multi-tenant product where each client gets their own fully isolated CRM (the HubSpot resale model), a client can never see another client's data (enforced by the database, not app code), and `admin@niewdel.com` is confined to a Demo tenant with zero access to real client data.

## Core decisions (locked)
- **A workspace IS a tenant.** Every `crm_*` row already keys off `workspace_id`; reuse it rather than introducing a parallel `tenants` table.
- **Isolation model C:** Postgres RLS is the wall for all authenticated CRM access; the service-role key is kept ONLY for public token-gated client views (portal + proposal) and webhooks, which have no user session.
- **Client sees the full CRM** (own pipeline, deals, contacts, companies, proposals, tasks), fully isolated.
- **Switcher:** app-header dropdown for agency admins.
- **Demo:** rich, realistic seeded fake data.

## 1. Data model

Migration `040-tenancy.sql`:

- `ALTER TABLE workspaces ADD COLUMN kind text NOT NULL DEFAULT 'internal' CHECK (kind IN ('internal','client','demo'))` and `ADD COLUMN branding jsonb NOT NULL DEFAULT '{}'::jsonb` (branding is a stub for the white-label follow-on; unused here).
  - Backfill: existing `niewdel`, `i10-solutions`, `personal` → `kind='internal'`.
- `workspace_members` (`workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE`, `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE`, `role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member'))`, `created_at`), PRIMARY KEY (`workspace_id`, `user_id`). Indexed on `user_id`.
- `agency_admins` (`email text PRIMARY KEY`) — DB-authoritative list of agency super-admins. Seed `justin@niewdel.com`, `dillon@niewdel.com`. (Mirrors middleware `CORE_EMAILS`; single source of truth for RLS.)
- Function `is_agency_admin(uid uuid) RETURNS boolean` — `SELECT EXISTS (SELECT 1 FROM agency_admins a JOIN auth.users u ON u.email = a.email WHERE u.id = uid)`. `SECURITY DEFINER`, stable.
- Function `is_workspace_member(ws uuid, uid uuid) RETURNS boolean` — true if a `workspace_members` row exists OR `is_agency_admin(uid)`. `SECURITY DEFINER`, stable. (Agency admins implicitly see every workspace; no per-row membership needed for them.)
- Trigger on `workspaces` INSERT: add every `agency_admins` user as an `owner` member of the new workspace. (Keeps explicit membership rows for agency admins too, so listing "my workspaces" returns everything; the `is_agency_admin` short-circuit in RLS is the security guarantee.)

Backfill memberships for existing data: add Justin as `owner` of niewdel/i10-solutions/personal.

## 2. RLS rewrite (the wall)

Rewrite the permissive `USING (true)` policies on the CRM + proposals tables to membership-based:

```sql
USING (is_workspace_member(workspace_id, auth.uid()))
WITH CHECK (is_workspace_member(workspace_id, auth.uid()))
```

Tables: `crm_companies`, `crm_contacts`, `crm_deals`, `crm_deal_contacts`, `crm_activities`, `crm_tasks`, `crm_proposals`, `crm_proposal_line_items`, `crm_proposal_events`, `crm_deal_attachments` (any workspace-scoped CRM table). `crm_saved_views` + `user_onboarding` already use real `auth.uid()` per-user policies — leave them.

`workspaces` gets a members-based SELECT policy so a user can list their tenants: `USING (is_workspace_member(id, auth.uid()))`. `workspace_members` SELECT: a user sees rows for workspaces they belong to.

Legacy single-operator tables from the original app (tasks/notes/etc. under `/workspace/[slug]`, migration-008 owner-based RLS) are Justin's internal data and keep their existing owner-based policies — OUT OF SCOPE for this slice.

## 3. Authenticated access moves to the user-scoped client

- New `src/lib/supabase/server-user.ts` → `getUserScopedClient()`: a per-request Supabase server client built from the request auth cookie (via `@supabase/ssr`; add the dep if absent). Its queries run as the logged-in user, so RLS applies.
- Every AUTHENTICATED `crm_*` + proposals API route swaps `getPipelineClient()` (service-role) → `getUserScopedClient()`, and `getDefaultPipelineWorkspaceId()` (hardcoded "niewdel") → the active workspace id resolved from the session (Section 4). Writes set `workspace_id` to the active workspace; reads filter by it. RLS is the backstop.
- **Unchanged (still service-role):** `/api/portal/*`, `/api/proposals/[id]/{view,sign}`, and any webhook route. These are token/HMAC-gated and id-scoped, with no user session. `getPipelineClient()` stays for exactly these.
- The `/api/proposals/[id]/countersign` route (authenticated) moves to the user-scoped client.

## 4. Active tenant resolution + switcher

- Active workspace stored in an `active_workspace` cookie (workspace id).
- Server helper `resolveActiveWorkspace(req)`: read cookie → validate the user is a member (via a membership query) → if invalid/absent, default to the user's first membership (agency admins default to `niewdel`). Returns the workspace id + slug + name + kind.
- A single-membership client user has no switcher shown; their one tenant is always active.
- **Switcher UI:** a header dropdown (in the app shell) listing the user's workspaces (name + kind badge); selecting one sets the cookie and refreshes. Only rendered when the user has ≥2 memberships (i.e., agency admins).

## 5. Login gate change

Middleware currently allows login only for `CORE_EMAILS` + env emails. Under multi-tenancy, ANY provisioned user (authenticated + a member of ≥1 workspace) may log in. Change the gate: an authenticated user with at least one `workspace_members` row is allowed; an authenticated user with zero memberships is signed out / shown "no access." Agency admins (per `agency_admins`) always allowed. `admin@` gains access purely by being a Demo member.

## 6. admin@ Demo sandbox

- Create workspace `demo` (`kind='demo'`, slug `demo`).
- Seed rich fake data scoped to it: ~8 companies, ~15 contacts, deals across every stage (`discovery`→`live`/`lost`), 2 sample proposals with line items. A seed script/SQL run by the controller.
- Add `admin@niewdel.com` as a `member` of `demo` ONLY. Do NOT add admin@ to niewdel/i10/personal, and admin@ is NOT in `agency_admins`.
- Result: RLS makes it impossible for admin@ to read any non-Demo row, even calling the API directly.

## 7. Testing

- **RLS probe (the critical test):** using a real user JWT for `admin@` (or a SQL `SET request.jwt.claims`), assert `SELECT` on `crm_companies`/`crm_deals`/`crm_proposals` returns ONLY Demo rows and ZERO niewdel rows. Repeat as anon → zero rows. This is the "probe tables as anon to verify RLS" rule applied.
- **Unit:** `is_agency_admin` / `is_workspace_member` truth tables; `resolveActiveWorkspace` (valid cookie, foreign cookie rejected → default, absent → default); the auto-member trigger adds agency admins on workspace insert.
- **Route smoke:** an authenticated CRM list route returns only the active workspace's rows; switching the cookie switches the data.
- Keep the full suite green (tsc + vitest + build).

## Out of scope (follow-on specs)
White-label branding (the `branding` jsonb → runtime CSS vars), snapshots (clone config into a new tenant), custom domains per tenant, finer role granularity (viewer/billing roles), self-serve client provisioning UI. This slice provisions tenants via a controller-run script/SQL.

## Rollout risk
Section 3 (service-role → user-scoped client) touches every authenticated CRM + proposals route — mechanical but broad, and the place a mistake breaks the app or leaks data. The RLS probe test in Section 7 is the backstop: even a route-layer mistake cannot leak across tenants because the database refuses. Land the migration + RLS + probe test FIRST, verify isolation, then refactor routes behind that guarantee.
