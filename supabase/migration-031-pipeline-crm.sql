-- migration-031-pipeline-crm.sql
-- Workspace-scoped lightweight CRM for the Niewdel workspace (extensible
-- to other workspaces later). Three tables: crm_companies, crm_contacts,
-- crm_deals. Optional FK back to lead-gen companies/contacts so we can
-- dedupe when promoting a prospect from the lead gen agent.
--
-- Stages reflect Niewdel's consulting flow:
--   discovery -> scope -> proposal -> build -> live | lost

CREATE TABLE IF NOT EXISTS crm_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  website text,
  industry text,
  headcount integer,
  hq text,
  notes text,
  source_prospect_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  owner text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, domain)
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  crm_company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  first_name text,
  last_name text,
  title text,
  email text,
  phone text,
  linkedin_url text,
  notes text,
  source_prospect_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  crm_company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  primary_contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  stage text NOT NULL DEFAULT 'discovery',
  value_cents bigint,
  close_date_est date,
  notes text,
  owner text,
  lost_reason text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT crm_deals_stage_check
    CHECK (stage IN ('discovery','scope','proposal','build','live','lost'))
);

CREATE INDEX IF NOT EXISTS crm_companies_workspace_idx ON crm_companies (workspace_id);
CREATE INDEX IF NOT EXISTS crm_contacts_workspace_idx ON crm_contacts (workspace_id);
CREATE INDEX IF NOT EXISTS crm_contacts_company_idx ON crm_contacts (crm_company_id);
CREATE INDEX IF NOT EXISTS crm_deals_workspace_stage_idx ON crm_deals (workspace_id, stage);
CREATE INDEX IF NOT EXISTS crm_deals_company_idx ON crm_deals (crm_company_id);
CREATE INDEX IF NOT EXISTS crm_deals_contact_idx ON crm_deals (primary_contact_id);

-- updated_at trigger (reuses pattern from existing tables; create if missing)
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crm_companies_touch ON crm_companies;
CREATE TRIGGER crm_companies_touch BEFORE UPDATE ON crm_companies
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS crm_contacts_touch ON crm_contacts;
CREATE TRIGGER crm_contacts_touch BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS crm_deals_touch ON crm_deals;
CREATE TRIGGER crm_deals_touch BEFORE UPDATE ON crm_deals
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Auto-set closed_at when a deal lands in a terminal stage.
CREATE OR REPLACE FUNCTION set_deal_closed_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.stage IN ('live','lost') AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.closed_at = now();
  ELSIF NEW.stage NOT IN ('live','lost') THEN
    NEW.closed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crm_deals_closed_at ON crm_deals;
CREATE TRIGGER crm_deals_closed_at BEFORE UPDATE ON crm_deals
  FOR EACH ROW EXECUTE FUNCTION set_deal_closed_at();

-- Realtime so the kanban board reacts to stage moves immediately.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='crm_companies') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_companies;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='crm_contacts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_contacts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='crm_deals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_deals;
  END IF;
END$$;

-- Permissive RLS for pin-auth era; matches the pattern from migration-015.
ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals     ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_companies' AND policyname='crm_companies_all') THEN
    CREATE POLICY crm_companies_all ON crm_companies FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_contacts' AND policyname='crm_contacts_all') THEN
    CREATE POLICY crm_contacts_all ON crm_contacts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_deals' AND policyname='crm_deals_all') THEN
    CREATE POLICY crm_deals_all ON crm_deals FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;
