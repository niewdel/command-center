-- migration-037-crm-elevation.sql
-- CRM elevation (Task E0): activity timeline, tasks/"My Day", weighted
-- forecast, saved views, and per-user onboarding state. Builds on the
-- existing pipeline CRM (migration-031..034) — same workspace-scoping and
-- RLS pattern as crm_companies/crm_contacts/crm_deals/crm_deal_contacts.
--
-- crm_deals already has `value_cents bigint` (migration-031) — reused here
-- as the forecast amount. Do NOT add a duplicate amount_cents column.

-- ============================================================
-- 1. crm_activities — timeline (note/call/email/meeting/stage_change)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE,
  crm_company_id uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('note', 'call', 'email', 'meeting', 'stage_change')),
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_activities_deal_occurred_idx
  ON crm_activities (deal_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_activities_company_idx
  ON crm_activities (crm_company_id);
CREATE INDEX IF NOT EXISTS crm_activities_workspace_idx
  ON crm_activities (workspace_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_activities;
  END IF;
END$$;

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_activities' AND policyname = 'crm_activities_all'
  ) THEN
    CREATE POLICY crm_activities_all ON crm_activities FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================================
-- 2. crm_tasks — tasks / "My Day"
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE,
  crm_company_id uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_tasks_workspace_idx ON crm_tasks (workspace_id);
CREATE INDEX IF NOT EXISTS crm_tasks_due_date_open_idx
  ON crm_tasks (due_date) WHERE NOT done;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_tasks;
  END IF;
END$$;

ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_tasks' AND policyname = 'crm_tasks_all'
  ) THEN
    CREATE POLICY crm_tasks_all ON crm_tasks FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================================
-- 3. crm_deals — next action + weighted forecast
-- ============================================================
-- value_cents already exists (migration-031) — do not duplicate as
-- amount_cents. probability is nullable; app falls back to a
-- stage -> default-probability map (STAGE_PROBABILITY in elevation-types.ts)
-- when null.

ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS probability int;

CREATE INDEX IF NOT EXISTS crm_deals_next_action_idx ON crm_deals (next_action_at);

-- ============================================================
-- 4. crm_saved_views — per-user saved filters
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity text NOT NULL CHECK (entity IN ('deals', 'contacts', 'companies')),
  name text NOT NULL,
  filter_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_saved_views_workspace_idx ON crm_saved_views (workspace_id);
CREATE INDEX IF NOT EXISTS crm_saved_views_user_idx ON crm_saved_views (user_id);

ALTER TABLE crm_saved_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_saved_views' AND policyname = 'Users manage own saved views'
  ) THEN
    CREATE POLICY "Users manage own saved views" ON crm_saved_views
      FOR ALL TO authenticated
      USING (
        auth.uid() = user_id
        AND workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid())
      )
      WITH CHECK (
        auth.uid() = user_id
        AND workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid())
      );
  END IF;
END$$;

-- ============================================================
-- 5. Onboarding state — no existing profiles/users table in this schema
-- (workspaces.user_id is the closest per-user column but represents a
-- business workspace, not a user profile). Dedicated table keyed by
-- auth.users.id so onboarding state is 1:1 with the authenticated user.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_onboarding (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_completed_at timestamptz,
  onboarding_step int NOT NULL DEFAULT 0,
  onboarding_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS user_onboarding_touch ON user_onboarding;
CREATE TRIGGER user_onboarding_touch BEFORE UPDATE ON user_onboarding
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_onboarding' AND policyname = 'Users manage own onboarding state'
  ) THEN
    CREATE POLICY "Users manage own onboarding state" ON user_onboarding
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;
