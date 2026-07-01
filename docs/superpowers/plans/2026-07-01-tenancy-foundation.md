# Tenancy Foundation + Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-operator CRM into a multi-tenant product where a workspace IS a tenant, Postgres RLS is the isolation wall, authenticated routes run as the logged-in user, and `admin@niewdel.com` is confined to a seeded Demo workspace.

**Architecture:** Migration 040 adds `workspace_members` + `agency_admins` + membership-based RLS on all 9 CRM tables and lands FIRST, verified by direct DB probes, before any code changes. Then all 19 authenticated CRM/proposal API routes swap the service-role client (`getPipelineClient()`) for the existing cookie-based user-scoped client, with the active tenant resolved from an `active_workspace` cookie validated against membership. Service role survives only in token-gated public surfaces (`/api/portal/*`, `/api/proposals/[id]/{view,sign}`) and webhooks.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres RLS, `@supabase/ssr` ^0.9.0 — already a dep), vitest 4, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-07-01-tenancy-foundation-design.md` (approved)

## Global Constraints

- Branch: `feat/tenancy` (already rebased onto main at `2980fa8`).
- Migrations are applied by the controller via Supabase MCP (`apply_migration`) — never handed to Justin as SQL to paste. SQL files are ALSO committed to `supabase/` for the record.
- **The live DB's RLS policies do NOT match the migration files on disk.** A July 1 MCP-applied migration (`harden_crm_and_news_rls`) already replaced policies on `crm_proposals`, `crm_proposal_line_items`, `crm_proposal_events`, `crm_activities`, `crm_tasks`. Migration 040 therefore drops policies DYNAMICALLY (by querying `pg_policies`), never by hardcoded name.
- Migration file name: `supabase/migration-040-tenancy.sql` (039 intentionally skipped, like 036 — spec locked "040").
- Valid `crm_deals.stage` values: `discovery`, `scope`, `proposal`, `build`, `live`, `lost`, `disqualified` (terminal: `live`/`lost`/`disqualified`).
- RLS policies call `is_workspace_member(workspace_id, (SELECT auth.uid()))` — the `(SELECT ...)` wrapper is required so Postgres caches `auth.uid()` per statement instead of per row.
- UI rules: `rounded-lg`, `transition-colors`, `aria-label` on icon-only buttons, no gradients, no colored shadows, `size-N` for squares.
- Test commands: `npx tsc --noEmit`, `npm test` (vitest run), `npm run build`. All three must be green at every commit.
- Existing route tests mock `@/lib/pipeline/db` — when a route moves to `@/lib/tenancy`, its test's mock moves with it in the same commit.
- Service-role client (`getPipelineClient()`) is ONLY allowed in: `/api/proposals/[id]/view`, `/api/proposals/[id]/sign`, `/api/portal/*`, `/api/webhooks/*`, cron. Nothing else.

---

### Task 1: Migration 040 — tenancy data model + RLS wall

**Files:**
- Create: `supabase/migration-040-tenancy.sql`

**Interfaces:**
- Produces: tables `workspace_members(workspace_id, user_id, role, created_at)`, `agency_admins(email)`; columns `workspaces.kind`, `workspaces.branding`; SQL functions `is_agency_admin(uid uuid) RETURNS boolean`, `is_workspace_member(ws uuid, uid uuid) RETURNS boolean`. Later tasks (RLS probes, tenancy lib, middleware) all depend on these exact names.

- [ ] **Step 1: Snapshot the live policy state (pre-check)**

Run via Supabase MCP `execute_sql`:

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces','crm_companies','crm_contacts','crm_deals',
    'crm_deal_contacts','crm_activities','crm_tasks','crm_proposals',
    'crm_proposal_line_items','crm_proposal_events')
ORDER BY tablename, policyname;
```

Save the output into the task notes (it documents what the dynamic drop removes). Also confirm both auth users exist:

```sql
SELECT id, email FROM auth.users
WHERE lower(email) IN ('justin@niewdel.com','admin@niewdel.com','dillon@niewdel.com');
```

Expected: `justin@niewdel.com` and `admin@niewdel.com` exist. If `dillon@niewdel.com` has no auth user, that's fine — the seed/backfill joins through `auth.users` and simply produces no row for him until he gets one.

- [ ] **Step 2: Write `supabase/migration-040-tenancy.sql`**

```sql
-- migration-040-tenancy.sql
-- Tenancy foundation: a workspace IS a tenant. Membership + agency admins +
-- membership-based RLS on every CRM table. Spec:
-- docs/superpowers/specs/2026-07-01-tenancy-foundation-design.md
--
-- NOTE: existing policies are dropped DYNAMICALLY because the live DB carries
-- MCP-applied policies (harden_crm_and_news_rls, 2026-07-01) whose names do
-- not appear in any migration file in this repo.

-- 1) Workspace = tenant: kind + branding stub (branding used by the
--    white-label follow-on spec, not read anywhere yet).
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'internal'
    CHECK (kind IN ('internal','client','demo')),
  ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Membership
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members (user_id);
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- 3) Agency super-admins. DB-authoritative twin of middleware CORE_EMAILS.
--    RLS on + NO policies = readable only by service role and the
--    SECURITY DEFINER helpers below.
CREATE TABLE IF NOT EXISTS agency_admins (email text PRIMARY KEY);
ALTER TABLE agency_admins ENABLE ROW LEVEL SECURITY;
INSERT INTO agency_admins (email)
VALUES ('justin@niewdel.com'), ('dillon@niewdel.com')
ON CONFLICT DO NOTHING;

-- 4) Helpers. SECURITY DEFINER so they can read agency_admins/auth.users
--    from inside RLS policies; search_path pinned per the security advisors.
CREATE OR REPLACE FUNCTION is_agency_admin(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM agency_admins a
    JOIN auth.users u ON lower(u.email) = lower(a.email)
    WHERE u.id = uid
  );
$$;

CREATE OR REPLACE FUNCTION is_workspace_member(ws uuid, uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = ws AND m.user_id = uid
  ) OR is_agency_admin(uid);
$$;

REVOKE ALL ON FUNCTION is_agency_admin(uuid) FROM public;
REVOKE ALL ON FUNCTION is_workspace_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION is_agency_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid, uuid) TO authenticated, anon;

-- 5) Every new workspace automatically gets the agency admins as owners.
CREATE OR REPLACE FUNCTION add_agency_admins_to_workspace()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO workspace_members (workspace_id, user_id, role)
  SELECT NEW.id, u.id, 'owner'
  FROM auth.users u
  WHERE EXISTS (
    SELECT 1 FROM agency_admins a WHERE lower(a.email) = lower(u.email)
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspaces_add_agency_admins ON workspaces;
CREATE TRIGGER trg_workspaces_add_agency_admins
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION add_agency_admins_to_workspace();

-- 6) Backfill: agency admins own every existing workspace.
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, u.id, 'owner'
FROM workspaces w
CROSS JOIN auth.users u
WHERE EXISTS (
  SELECT 1 FROM agency_admins a WHERE lower(a.email) = lower(u.email)
)
ON CONFLICT DO NOTHING;

-- 7) THE WALL. Drop every existing policy on the CRM tables + workspaces,
--    then recreate membership-based ones.
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workspaces',
    'crm_companies','crm_contacts','crm_deals','crm_deal_contacts',
    'crm_activities','crm_tasks',
    'crm_proposals','crm_proposal_line_items','crm_proposal_events'
  ] LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- workspaces: members can SEE their tenants; only the owner mutates
-- (preserves the existing sidebar workspace-CRUD feature).
CREATE POLICY workspaces_member_select ON workspaces
  FOR SELECT TO authenticated
  USING (is_workspace_member(id, (SELECT auth.uid())));
CREATE POLICY workspaces_owner_insert ON workspaces
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY workspaces_owner_update ON workspaces
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY workspaces_owner_delete ON workspaces
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- workspace_members: you can see the membership rows of workspaces you
-- belong to. Writes are service-role-only (controller provisioning).
CREATE POLICY workspace_members_select ON workspace_members
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())));

-- 8 workspace-keyed CRM tables, one identical policy each.
CREATE POLICY crm_companies_member ON crm_companies
  FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())))
  WITH CHECK (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY crm_contacts_member ON crm_contacts
  FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())))
  WITH CHECK (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY crm_deals_member ON crm_deals
  FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())))
  WITH CHECK (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY crm_activities_member ON crm_activities
  FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())))
  WITH CHECK (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY crm_tasks_member ON crm_tasks
  FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())))
  WITH CHECK (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY crm_proposals_member ON crm_proposals
  FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())))
  WITH CHECK (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY crm_proposal_line_items_member ON crm_proposal_line_items
  FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())))
  WITH CHECK (is_workspace_member(workspace_id, (SELECT auth.uid())));
CREATE POLICY crm_proposal_events_member ON crm_proposal_events
  FOR ALL TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())))
  WITH CHECK (is_workspace_member(workspace_id, (SELECT auth.uid())));

-- crm_deal_contacts has no workspace_id; membership routes through the deal.
CREATE POLICY crm_deal_contacts_member ON crm_deal_contacts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crm_deals d
    WHERE d.id = deal_id
      AND is_workspace_member(d.workspace_id, (SELECT auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM crm_deals d
    WHERE d.id = deal_id
      AND is_workspace_member(d.workspace_id, (SELECT auth.uid()))
  ));

-- 8) Backfill kind on the three internal workspaces (default already
--    'internal'; explicit for the record).
UPDATE workspaces SET kind = 'internal'
WHERE slug IN ('niewdel','i10-solutions','personal');
```

- [ ] **Step 3: Apply via Supabase MCP**

Call `mcp__plugin_supabase_supabase__apply_migration` with name `tenancy_foundation` and the file content. Expected: success, no errors.

- [ ] **Step 4: Verify schema + policies landed**

Run via MCP `execute_sql`:

```sql
SELECT tablename, policyname, roles FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('workspaces','workspace_members','crm_companies','crm_deals','crm_proposals')
ORDER BY tablename;
SELECT count(*) AS justin_memberships FROM workspace_members m
JOIN auth.users u ON u.id = m.user_id
WHERE lower(u.email) = 'justin@niewdel.com';
```

Expected: only the new `*_member` / `workspaces_owner_*` policies, all `TO authenticated` (nothing `TO public`); `justin_memberships` = number of existing workspaces (Justin owner-backfilled on all). Then run `mcp__plugin_supabase_supabase__get_advisors` (security) — no NEW findings beyond the known intentional deny-all ones (`website_chat_conversations`, now also `agency_admins`, `workspace_members` write-lockdown).

- [ ] **Step 5: Verify the deployed app still works (live code + new RLS)**

The deployed CRM API routes use the service role (bypasses RLS) and the browser client is authenticated via `@supabase/ssr` cookies, so nothing should break. Confirm: log into app.niewdel.com (or ask nothing of the user — curl `/api/health`, then check the Railway HTTP logs show no 5xx spike), and via MCP:

```sql
BEGIN;
SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT id FROM auth.users WHERE lower(email)='justin@niewdel.com'), 'role', 'authenticated')::text, true);
SELECT count(*) FROM workspaces;
ROLLBACK;
```

Expected: count ≥ 3 (Justin sees all his workspaces through the membership policy).

- [ ] **Step 6: Commit**

```bash
git add supabase/migration-040-tenancy.sql
git commit -m "feat(tenancy): migration 040 — workspace_members, agency_admins, membership RLS wall"
```

---

### Task 2: Demo workspace + seed data + admin@ membership

**Files:**
- Create: `supabase/seed-demo-workspace.sql`

**Interfaces:**
- Consumes: `workspace_members`, `agency_admins`, `workspaces.kind` from Task 1.
- Produces: workspace `slug='demo', kind='demo'` with seeded `crm_companies` (8), `crm_contacts` (15), `crm_deals` (10 across all 7 stages), `crm_activities`, `crm_tasks`, 2 `crm_proposals` + line items; `admin@niewdel.com` as `member` of demo ONLY. The RLS probe (Task 3) depends on this data existing.

- [ ] **Step 1: Write `supabase/seed-demo-workspace.sql`**

Idempotent (safe to re-run). Use fictional-but-realistic companies. Skeleton — the implementer fills all 8/15/10 rows in the same style:

```sql
-- seed-demo-workspace.sql
-- Demo tenant for admin@niewdel.com. Idempotent: deletes + reseeds the demo
-- workspace's CRM rows on each run. Run by the controller via Supabase MCP.

-- 1) The workspace. Owned by Justin (owner-based write policies), kind=demo.
INSERT INTO workspaces (name, slug, type, kind, user_id, icon, color)
SELECT 'Demo', 'demo', 'business', 'demo', u.id, 'sparkles', 'bg-violet-500'
FROM auth.users u WHERE lower(u.email) = 'justin@niewdel.com'
ON CONFLICT (slug) DO UPDATE SET kind = 'demo';
-- (the Task-1 trigger just added agency admins as owners)

-- 2) admin@ is a member of demo ONLY.
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, u.id, 'member'
FROM workspaces w, auth.users u
WHERE w.slug = 'demo' AND lower(u.email) = 'admin@niewdel.com'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'member';

-- 3) Wipe + reseed demo CRM data (cascades take out line items/events/etc.).
DELETE FROM crm_proposals WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo');
DELETE FROM crm_deals     WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo');
DELETE FROM crm_contacts  WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo');
DELETE FROM crm_companies WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo');
DELETE FROM crm_activities WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo');
DELETE FROM crm_tasks      WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo');

WITH ws AS (SELECT id FROM workspaces WHERE slug = 'demo'),
companies AS (
  INSERT INTO crm_companies (workspace_id, name, domain, website, industry, headcount, hq, notes)
  SELECT ws.id, c.* FROM ws, (VALUES
    ('Harbor & Pine Coffee', 'harborpine.example', 'https://harborpine.example', 'Food & Beverage', '11-50', 'Charlotte, NC', 'Three locations, no online ordering yet.'),
    ('Bluefin Logistics', 'bluefinlog.example', 'https://bluefinlog.example', 'Transportation', '51-200', 'Atlanta, GA', 'Referred by chamber event.')
    -- ...6 more in the same shape (8 total)
  ) AS c(name, domain, website, industry, headcount, hq, notes)
  RETURNING id, name, workspace_id
)
-- contacts: 15 total, each referencing a company by name from `companies`;
-- deals: 10 total spread across stages
--   'discovery','scope','proposal','build','live','lost','disqualified'
--   with value_cents between 250000 and 4500000, probability set on open stages;
-- 2 proposals (one 'sent' website build w/ 4 line items incl. an option group,
--   one 'draft' retainer w/ recurring line items), each linked to a deal;
-- a handful of crm_activities (notes/calls) + crm_tasks (2 due next week, 1 overdue)
SELECT 1;
```

(The implementer writes the full INSERT chains — every column above matches the real schema from migrations 031/037/038; do not invent columns. Proposal `content` is jsonb-shaped like production rows: copy the block structure of one real proposal via `SELECT content FROM crm_proposals LIMIT 1` on the live DB and rewrite the text.)

- [ ] **Step 2: Apply via MCP `execute_sql`** (it's a seed, not a schema migration)

Expected: success. Then verify counts:

```sql
SELECT
  (SELECT count(*) FROM crm_companies WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo')) AS companies,
  (SELECT count(*) FROM crm_contacts  WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo')) AS contacts,
  (SELECT count(*) FROM crm_deals     WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo')) AS deals,
  (SELECT count(*) FROM crm_proposals WHERE workspace_id = (SELECT id FROM workspaces WHERE slug='demo')) AS proposals,
  (SELECT count(*) FROM workspace_members m JOIN auth.users u ON u.id=m.user_id
   WHERE lower(u.email)='admin@niewdel.com') AS admin_memberships;
```

Expected: companies=8, contacts=15, deals=10, proposals=2, **admin_memberships=1** (demo only).

- [ ] **Step 3: Commit**

```bash
git add supabase/seed-demo-workspace.sql
git commit -m "feat(tenancy): demo workspace seed + admin@ demo-only membership"
```

---

### Task 3: RLS isolation probes (the critical gate — nothing proceeds if this fails)

**Files:** none created (probes run against the live DB; record results in `docs/progress.md` at the end).

**Interfaces:**
- Consumes: Task 1 policies + Task 2 seed data.

- [ ] **Step 1: Probe as admin@ (JWT-claims simulation)**

Via MCP `execute_sql`:

```sql
BEGIN;
SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT id FROM auth.users WHERE lower(email)='admin@niewdel.com'), 'role','authenticated')::text, true);

SELECT count(*) AS visible_companies FROM crm_companies;                    -- expect 8 (demo only)
SELECT count(*) AS niewdel_leak FROM crm_companies c
  JOIN workspaces w ON w.id = c.workspace_id AND w.slug = 'niewdel';        -- expect 0
SELECT count(*) AS visible_deals FROM crm_deals;                            -- expect 10
SELECT count(*) AS visible_proposals FROM crm_proposals;                    -- expect 2
SELECT count(*) AS visible_workspaces FROM workspaces;                      -- expect 1 (demo)
ROLLBACK;
```

Any `niewdel_leak > 0` or `visible_workspaces > 1` = STOP, fix policies before continuing.

- [ ] **Step 2: Probe as anon over the real REST API** (the browser-shipped key — the memory rule: "probe tables as anon to verify RLS")

```bash
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2)
ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)
for t in crm_companies crm_deals crm_proposals workspace_members agency_admins workspaces; do
  echo "$t: $(curl -s "$SUPABASE_URL/rest/v1/$t?select=id&limit=5" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY")"
done
```

Expected: `[]` (empty array) or a permission error for EVERY table. Any row = STOP.

- [ ] **Step 3: Probe as justin@ (agency admin sees everything)**

Same JWT-claims pattern as Step 1 with justin's uid. Expected: `visible_workspaces >= 4` (3 internal + demo), `crm_companies` count = niewdel rows + 8 demo rows.

- [ ] **Step 4: Anon INSERT probe**

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/crm_companies" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"probe","workspace_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: `42501` row-level security error.

- [ ] **Step 5: Record probe results** in the task notes (they go into progress.md in Task 9). No commit (no repo changes).

---

### Task 4: Tenancy lib — `getUserScopedClient()` + `resolveActiveWorkspace()`

**Files:**
- Create: `src/lib/tenancy/index.ts`
- Test: `src/lib/tenancy/__tests__/tenancy.test.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase-server` (existing cookie-based `@supabase/ssr` server client — the spec's proposed `src/lib/supabase/server-user.ts` is NOT created; this codebase already has the client, we wrap it. Deviation noted in decisions.md).
- Produces (every route task + middleware consumes these):
  - `getUserScopedClient(): Promise<SupabaseClient>` — RLS-scoped, cookie-auth
  - `resolveActiveWorkspace(): Promise<ActiveWorkspace | null>` where `ActiveWorkspace = { id: string; slug: string; name: string; kind: "internal" | "client" | "demo" }` — null means "no session or no memberships" → routes return 401
  - `ACTIVE_WORKSPACE_COOKIE = "active_workspace"` (exported const)

- [ ] **Step 1: Write the failing tests**

`src/lib/tenancy/__tests__/tenancy.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockOrder = vi.fn();
const mockCookieGet = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: mockOrder })),
    })),
  })),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mockCookieGet })),
}));

import { resolveActiveWorkspace } from "@/lib/tenancy";

const WORKSPACES = [
  { id: "ws-niewdel", slug: "niewdel", name: "Niewdel", kind: "internal" },
  { id: "ws-demo", slug: "demo", name: "Demo", kind: "demo" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockOrder.mockResolvedValue({ data: WORKSPACES });
});

describe("resolveActiveWorkspace", () => {
  it("returns null when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await resolveActiveWorkspace()).toBeNull();
  });

  it("returns null when the user has no visible workspaces", async () => {
    mockOrder.mockResolvedValue({ data: [] });
    expect(await resolveActiveWorkspace()).toBeNull();
  });

  it("honors a valid active_workspace cookie", async () => {
    mockCookieGet.mockReturnValue({ value: "ws-demo" });
    expect((await resolveActiveWorkspace())?.id).toBe("ws-demo");
  });

  it("rejects a cookie for a workspace the user cannot see (falls back)", async () => {
    mockCookieGet.mockReturnValue({ value: "ws-foreign" });
    expect((await resolveActiveWorkspace())?.id).toBe("ws-niewdel");
  });

  it("defaults to niewdel when no cookie and niewdel is visible", async () => {
    mockCookieGet.mockReturnValue(undefined);
    expect((await resolveActiveWorkspace())?.slug).toBe("niewdel");
  });

  it("defaults to the first membership when niewdel is not visible", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockOrder.mockResolvedValue({ data: [WORKSPACES[1]] });
    expect((await resolveActiveWorkspace())?.slug).toBe("demo");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/tenancy` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/tenancy/index.ts`**

```typescript
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase-server";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace";

export type ActiveWorkspace = {
  id: string;
  slug: string;
  name: string;
  kind: "internal" | "client" | "demo";
};

// The user-scoped Supabase client: cookie-authenticated, so every query runs
// as the logged-in user and RLS applies. This is the ONLY client authenticated
// CRM routes may use; the service-role client is reserved for token-gated
// public surfaces and webhooks (see middleware notes).
export async function getUserScopedClient() {
  return createClient();
}

// Resolve the active tenant. The workspaces SELECT is already RLS-filtered to
// the user's memberships, so an invalid/foreign cookie simply misses the list
// and falls through to the default — no separate membership check needed.
export async function resolveActiveWorkspace(): Promise<ActiveWorkspace | null> {
  const supabase = await getUserScopedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, slug, name, kind")
    .order("position", { ascending: true });
  if (!workspaces || workspaces.length === 0) return null;

  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const fromCookie = requested
    ? workspaces.find((w) => w.id === requested)
    : undefined;

  return (
    (fromCookie as ActiveWorkspace | undefined) ??
    (workspaces.find((w) => w.slug === "niewdel") as ActiveWorkspace | undefined) ??
    (workspaces[0] as ActiveWorkspace)
  );
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/tenancy` — Expected: 6 PASS. Then `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tenancy
git commit -m "feat(tenancy): user-scoped client + active-workspace resolution"
```

---

### Task 5: Route refactor A — companies + contacts (4 routes)

**Files:**
- Modify: `src/app/api/pipeline/companies/route.ts`, `src/app/api/pipeline/companies/[id]/route.ts`, `src/app/api/pipeline/contacts/route.ts`, `src/app/api/pipeline/contacts/[id]/route.ts`

**Interfaces:**
- Consumes: `getUserScopedClient`, `resolveActiveWorkspace` from `@/lib/tenancy` (Task 4 signatures).

- [ ] **Step 1: Apply the standard swap to each route**

In every handler, replace:

```typescript
const supabase = getPipelineClient();
const workspaceId = await getDefaultPipelineWorkspaceId();
```

with:

```typescript
const ws = await resolveActiveWorkspace();
if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const supabase = await getUserScopedClient();
const workspaceId = ws.id;
```

and the import `from "@/lib/pipeline/db"` with `from "@/lib/tenancy"`. Where a handler used `getPipelineClient()` without a workspace lookup (`[id]` routes), still add the `resolveActiveWorkspace()` 401-guard and ALSO add `.eq("workspace_id", ws.id)` to the query if it filters by id only — RLS is the backstop, explicit scoping is the convention.

- [ ] **Step 2: Update any tests that mock these routes' imports** (none exist for companies/contacts today — verify with `grep -rl "companies\|contacts" src/app/api/pipeline/__tests__ src/app/api/pipeline/*/__tests__`).

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm test` — Expected: clean, all suites pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/pipeline/companies src/app/api/pipeline/contacts
git commit -m "feat(tenancy): companies + contacts routes on user-scoped client"
```

---

### Task 6: Route refactor B — deals, deal sub-routes, promote (6 routes)

**Files:**
- Modify: `src/app/api/pipeline/deals/route.ts`, `src/app/api/pipeline/deals/[id]/route.ts`, `src/app/api/pipeline/deals/[id]/activities/route.ts`, `src/app/api/pipeline/deals/[id]/contacts/route.ts`, `src/app/api/pipeline/deals/[id]/contacts/[contactId]/route.ts`, `src/app/api/pipeline/promote/route.ts`
- Test: `src/app/api/pipeline/deals/__tests__/stage-change.test.ts`, `src/app/api/pipeline/deals/__tests__/activities.test.ts`

**Interfaces:**
- Consumes: same `@/lib/tenancy` swap as Task 5.

- [ ] **Step 1: Apply the standard swap** (same recipe as Task 5 Step 1) to all six routes. `promote/route.ts` note: only its **CRM writes** move to the user-scoped client + `ws.id`; its reads from the leads tables keep whatever client they use today (leads module tenancy is explicitly out of scope per the spec).

- [ ] **Step 2: Update the two deals test files** — change `vi.mock("@/lib/pipeline/db", ...)` to `vi.mock("@/lib/tenancy", ...)` returning:

```typescript
vi.mock("@/lib/tenancy", () => ({
  getUserScopedClient: vi.fn(async () => mockSupabase),
  resolveActiveWorkspace: vi.fn(async () => ({
    id: "ws-1", slug: "niewdel", name: "Niewdel", kind: "internal",
  })),
}));
```

keeping each file's existing `mockSupabase` chain object exactly as it is.

- [ ] **Step 3: Run the touched suites** — `npx vitest run src/app/api/pipeline/deals` — Expected: PASS.

- [ ] **Step 4: Full check** — `npx tsc --noEmit && npm test` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/pipeline/deals src/app/api/pipeline/promote
git commit -m "feat(tenancy): deals + promote routes on user-scoped client"
```

---

### Task 7: Route refactor C — activities, tasks, revenue (4 routes)

**Files:**
- Modify: `src/app/api/pipeline/activities/route.ts`, `src/app/api/pipeline/tasks/route.ts`, `src/app/api/pipeline/tasks/[id]/route.ts`, `src/app/api/pipeline/revenue/route.ts`
- Test: `src/app/api/pipeline/__tests__/activities-general.test.ts`, `src/app/api/pipeline/tasks/__tests__/tasks.test.ts`, `src/app/api/pipeline/tasks/__tests__/task-detail.test.ts`

- [ ] **Step 1: Apply the standard swap** (Task 5 Step 1 recipe) to all four routes.
- [ ] **Step 2: Update the three test files' mocks** (Task 6 Step 2 recipe).
- [ ] **Step 3: Run** — `npx vitest run src/app/api/pipeline` — PASS.
- [ ] **Step 4: Full check** — `npx tsc --noEmit && npm test` — clean.
- [ ] **Step 5: Commit**

```bash
git add src/app/api/pipeline/activities src/app/api/pipeline/tasks src/app/api/pipeline/revenue src/app/api/pipeline/__tests__
git commit -m "feat(tenancy): activities + tasks + revenue routes on user-scoped client"
```

---

### Task 8: Route refactor D — proposal builder routes + countersign

**Files:**
- Modify: `src/app/api/pipeline/proposals/route.ts`, `src/app/api/pipeline/proposals/[id]/route.ts`, `src/app/api/pipeline/proposals/[id]/line-items/route.ts`, `src/app/api/pipeline/proposals/[id]/link/route.ts`, `src/app/api/proposals/[id]/countersign/route.ts`
- Test: `src/app/api/pipeline/proposals/__tests__/proposals.test.ts`
- **DO NOT TOUCH:** `src/app/api/proposals/[id]/view/route.ts`, `src/app/api/proposals/[id]/sign/route.ts` (public token-gated — service role stays), `src/app/proposals/[id]/view/page.tsx`.

- [ ] **Step 1: Apply the standard swap** to the four `/api/pipeline/proposals/*` routes.
- [ ] **Step 2: countersign** — it already re-gates via `supabase.auth.getUser()` (middleware lets `/api/proposals/*` through unauthenticated). Replace its `getPipelineClient()` data access with `getUserScopedClient()`; keep the explicit auth check AND the comment explaining why it self-gates. RLS now additionally guarantees the operator can only countersign proposals in workspaces they belong to.
- [ ] **Step 3: Update `proposals.test.ts` mock** (Task 6 Step 2 recipe). `sign.test.ts` mocks the untouched sign route — leave it alone.
- [ ] **Step 4: Full check** — `npx tsc --noEmit && npm test && npm run build` — clean (build catches route-level type issues).
- [ ] **Step 5: Guardrail grep** — verify no authenticated route still imports the service client:

```bash
grep -rln "lib/pipeline/db" src/app/api | sort
```

Expected output — ONLY the public token-gated pair:
```
src/app/api/proposals/[id]/sign/route.ts
src/app/api/proposals/[id]/view/route.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/pipeline/proposals src/app/api/proposals/[id]/countersign
git commit -m "feat(tenancy): proposal routes on user-scoped client; service role only for token-gated view/sign"
```

---

### Task 9: Workspace switcher — API + sidebar dropdown

**Files:**
- Create: `src/app/api/tenancy/switch/route.ts`
- Create: `src/components/layout/workspace-switcher.tsx`
- Modify: `src/components/layout/sidebar.tsx` (render switcher under the wordmark)
- Test: `src/app/api/tenancy/__tests__/switch.test.ts`

**Interfaces:**
- Consumes: `getUserScopedClient`, `ACTIVE_WORKSPACE_COOKIE` from `@/lib/tenancy`; `useWorkspaces()` from the existing `WorkspacesProvider`.
- Produces: `POST /api/tenancy/switch` body `{ workspaceId: string }` → 200 + sets `active_workspace` cookie, 400 bad body, 401 no session, 403 not a member.

- [ ] **Step 1: Write the failing route test** — `src/app/api/tenancy/__tests__/switch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
vi.mock("@/lib/tenancy", () => ({
  ACTIVE_WORKSPACE_COOKIE: "active_workspace",
  getUserScopedClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
      })),
    })),
  })),
}));

import { POST } from "../switch/route";

function req(body: unknown) {
  return new Request("http://test/api/tenancy/switch", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockMaybeSingle.mockResolvedValue({ data: { id: "ws-demo" } });
});

describe("POST /api/tenancy/switch", () => {
  it("401s with no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req({ workspaceId: "ws-demo" }))).status).toBe(401);
  });
  it("400s on a missing workspaceId", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });
  it("403s when the workspace is not visible to the user", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    expect((await POST(req({ workspaceId: "ws-foreign" }))).status).toBe(403);
  });
  it("sets the cookie on success", async () => {
    const res = await POST(req({ workspaceId: "ws-demo" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("active_workspace=ws-demo");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/app/api/tenancy` — FAIL (module not found).

- [ ] **Step 3: Implement `src/app/api/tenancy/switch/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE, getUserScopedClient } from "@/lib/tenancy";

export async function POST(request: Request) {
  const supabase = await getUserScopedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let workspaceId: unknown;
  try {
    ({ workspaceId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof workspaceId !== "string" || !workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  // RLS-filtered read doubles as the membership check.
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const res = NextResponse.json({ ok: true });
  // Not httpOnly: the value is a UI hint the switcher reads; the server
  // re-validates membership on every request (resolveActiveWorkspace).
  res.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/app/api/tenancy` — 4 PASS.

- [ ] **Step 5: Implement `src/components/layout/workspace-switcher.tsx`**

Client component. Reads the workspace list from `useWorkspaces()` (RLS already limits it to memberships), reads the active id from `document.cookie`, renders nothing when fewer than 2 workspaces. Uses the existing shadcn `DropdownMenu`. Kind badge only for non-internal kinds. Follow the file's existing sidebar styling idioms:

```tsx
"use client";

import { useMemo } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaces } from "@/lib/providers/workspaces-provider";

function readActiveCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)active_workspace=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function WorkspaceSwitcher() {
  const { workspaces } = useWorkspaces();
  const activeId = readActiveCookie();
  const active = useMemo(
    () =>
      workspaces.find((w) => w.id === activeId) ??
      workspaces.find((w) => w.slug === "niewdel") ??
      workspaces[0],
    [workspaces, activeId]
  );

  if (workspaces.length < 2 || !active) return null;

  async function switchTo(id: string) {
    if (id === active?.id) return;
    await fetch("/api/tenancy/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id }),
    });
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch workspace"
        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <span className="truncate">{active.name}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => switchTo(w.id)}>
            <span className="flex-1 truncate">{w.name}</span>
            {w.kind && w.kind !== "internal" && (
              <span className="rounded-lg bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                {w.kind}
              </span>
            )}
            {w.id === active.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Adjust the `useWorkspaces` import path and `Workspace` type to the real provider (check `src/lib/providers/` — the provider must `select` the new `kind` column; add it to the provider's select/type if missing). If the shadcn `dropdown-menu` component is absent from `src/components/ui/`, add it via the project's existing shadcn setup rather than hand-rolling.

- [ ] **Step 6: Render it in `src/components/layout/sidebar.tsx`** — directly under the wordmark block (line ~40), `<WorkspaceSwitcher />`.

- [ ] **Step 7: Verify** — `npx tsc --noEmit && npm test && npm run build` — clean. Manual: `npm run dev`, log in, confirm the dropdown lists Niewdel/i10/Personal/Demo, switching to Demo reloads `/pipeline` showing the 10 seeded deals, switching back restores real data.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/tenancy src/components/layout/workspace-switcher.tsx src/components/layout/sidebar.tsx
git commit -m "feat(tenancy): active-workspace switcher (API + sidebar dropdown)"
```

---

### Task 10: Middleware login gate — membership-based

**Files:**
- Modify: `src/middleware.ts:9-21` (allow-list), `src/middleware.ts:125-130` (gate check)

**Interfaces:**
- Consumes: `workspace_members` SELECT policy from Task 1 (a user can read their own membership rows through the anon-key server client).

- [ ] **Step 1: Change the gate**

Keep `CORE_EMAILS` verbatim (lockout-proof fallback — the file's own comment explains why) and keep honoring `ALLOWED_LOGIN_EMAILS`. After the existing `getUser()` call, replace the rejection block at `src/middleware.ts:125-130` with:

```typescript
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Core operators + env-listed emails always pass. Everyone else must be
  // provisioned: a member of at least one workspace (workspace_members is
  // RLS-readable by its own user). admin@ passes purely via its Demo
  // membership — no env var needed.
  if (!ALLOWED_EMAILS.has((user.email ?? "").toLowerCase())) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .limit(1);
    if (!membership || membership.length === 0) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=no-access";
      return NextResponse.redirect(url);
    }
  }

  return response;
```

- [ ] **Step 2: Login page notice** — in `src/app/login/page.tsx`, when `searchParams` has `error=no-access`, show the existing error-style message: "This account has no workspace access yet." (match the page's current generic-error styling; no user enumeration).

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm test && npm run build` — clean. Manual with `npm run dev`: log in as admin@ (Justin holds the password; if unavailable, verify by temporarily removing your own email from `CORE_EMAILS` + env locally and confirming membership still admits you — then restore).

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts src/app/login/page.tsx
git commit -m "feat(tenancy): login gate admits any provisioned workspace member"
```

---

### Task 11: End-to-end verification, docs, PR

**Files:**
- Modify: `docs/progress.md` (new section), `docs/decisions.md` (decision entries)

- [ ] **Step 1: Full local gate** — `npx tsc --noEmit && npm test && npm run build` — all clean, test count ≥ 318 (308 existing + ~10 new).

- [ ] **Step 2: Re-run all Task 3 probes** (admin@ / anon / justin@ / anon-INSERT) — same expected results. RLS unchanged by the code work, but this is the cheap re-verification before shipping.

- [ ] **Step 3: Live smoke with the dev server** — `npm run dev`, then as the logged-in operator: `/pipeline` board loads (user-scoped client + RLS now serving the data), create + edit a deal, open a proposal, switch to Demo and back. Confirm the Railway deploy will be code-only (migration + seed already applied).

- [ ] **Step 4: Update docs**
  - `docs/progress.md`: add a "Tenancy Foundation (2026-07-01)" section — tasks done, probe results, and close out the standing "pre-SaaS blocker" line item from the Security-hardening section (the ~15 legacy `/api/leads/*`, `/api/seo/*`, `/api/audits/*` service-role routes remain out of scope — note they're still operator-gated and now ALSO invisible to client logins only if those pages are hidden; flag as the next hardening slice).
  - `docs/decisions.md`: log (1) workspace-IS-tenant + RLS-as-wall (isolation model C), (2) reuse of `src/lib/supabase-server.ts` instead of the spec's new `server-user.ts` file, (3) `active_workspace` cookie non-httpOnly rationale, (4) CORE_EMAILS kept as lockout-proof fallback alongside membership gate.

- [ ] **Step 5: Commit + PR**

```bash
git add docs/progress.md docs/decisions.md
git commit -m "docs(tenancy): progress + decisions for tenancy foundation"
git push -u origin feat/tenancy
gh pr create --title "feat: tenancy foundation — membership RLS wall, user-scoped routes, workspace switcher, admin@ Demo sandbox" --body "..."
```

PR body: summarize the wall (migration 040 + probes with results), the route swap (19 routes off service-role), the switcher, the gate change, and the explicit non-goals (leads/SEO/audits scoping, branding, snapshots). End with the standard Claude Code attribution footer.

---

## Execution ordering constraint (from the spec's Rollout Risk)

Tasks 1→2→3 MUST complete and pass before Tasks 4–10 begin. The migration is safe to apply to the live DB ahead of the code deploy because (a) the deployed CRM routes use the service role, which bypasses RLS, and (b) the deployed browser client is cookie-authenticated `@supabase/ssr` and Justin is membership-backfilled, so the sidebar's direct `workspaces` reads keep working. Tasks 5–8 are independent of each other after Task 4 and may run in parallel worktrees if using subagent-driven development.
