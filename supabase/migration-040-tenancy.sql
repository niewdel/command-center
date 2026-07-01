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

-- authenticated needs EXECUTE (the policies run as the querying role); anon
-- does NOT — every membership policy is TO authenticated, and leaving anon
-- EXECUTE would expose an anonymous membership/admin oracle via /rest/v1/rpc.
REVOKE ALL ON FUNCTION is_agency_admin(uuid) FROM public;
REVOKE ALL ON FUNCTION is_workspace_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION is_agency_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid, uuid) TO authenticated;

-- 5) Every new workspace automatically gets the agency admins as owners —
--    and its creator (workspaces.user_id), so a non-admin-created workspace
--    can never be owner-writable yet SELECT-invisible to its own creator.
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
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (NEW.id, NEW.user_id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger-only: never RPC-exposed.
REVOKE ALL ON FUNCTION add_agency_admins_to_workspace() FROM public, anon, authenticated;

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
