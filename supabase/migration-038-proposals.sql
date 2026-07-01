-- migration-038-proposals.sql
-- Proposal builder + internal e-sign (Task P0). Extends the existing
-- pipeline CRM (crm_deals/crm_companies/crm_contacts, migration-031..034,
-- elevated in migration-037). Same workspace-scoping + permissive-RLS +
-- service-role convention as crm_activities/crm_tasks.
--
-- touch_updated_at() already exists (defined in migration-037) — reused
-- here, not redefined.

-- ============================================================
-- 1. crm_proposals — the proposal document + e-sign state
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  crm_company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  primary_contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('website_build', 'retainer', 'lead_gen', 'ai_phased', 'custom')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'declined', 'void')),
  title text NOT NULL,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposal_date date,
  validity_days int NOT NULL DEFAULT 30,
  prepared_by text,
  subtotal_cents bigint,
  recurring_monthly_cents bigint,
  deposit_cents bigint,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  signer_name text,
  signer_email text,
  signer_ip inet,
  signature_typed text,
  signer_consent boolean,
  countersigner_name text,
  countersigned_at timestamptz,
  requires_dual_sign boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_proposals_workspace_idx ON crm_proposals (workspace_id);
CREATE INDEX IF NOT EXISTS crm_proposals_deal_idx ON crm_proposals (deal_id);
CREATE INDEX IF NOT EXISTS crm_proposals_status_idx ON crm_proposals (status);

DROP TRIGGER IF EXISTS crm_proposals_touch ON crm_proposals;
CREATE TRIGGER crm_proposals_touch BEFORE UPDATE ON crm_proposals
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_proposals;
  END IF;
END$$;

ALTER TABLE crm_proposals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_proposals' AND policyname = 'crm_proposals_all'
  ) THEN
    CREATE POLICY crm_proposals_all ON crm_proposals FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================================
-- 2. crm_proposal_line_items — relational pricing, drives totals
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_proposal_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('one_time', 'recurring', 'handoff')),
  label text NOT NULL,
  description text,
  badge text,
  amount_cents bigint NOT NULL DEFAULT 0,
  cadence text NOT NULL DEFAULT 'one_time' CHECK (cadence IN ('one_time', 'per_month', 'at_handoff', 'at_launch', 'upfront')),
  recurring_months int,
  option_group text,
  is_optional boolean NOT NULL DEFAULT false,
  is_selected boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_proposal_line_items_proposal_idx
  ON crm_proposal_line_items (proposal_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_proposal_line_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_proposal_line_items;
  END IF;
END$$;

ALTER TABLE crm_proposal_line_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_proposal_line_items' AND policyname = 'crm_proposal_line_items_all'
  ) THEN
    CREATE POLICY crm_proposal_line_items_all ON crm_proposal_line_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================================
-- 3. crm_proposal_events — append-only e-sign audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('created', 'sent', 'viewed', 'signed', 'countersigned', 'declined', 'downloaded')),
  actor text,
  ip inet,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_proposal_events_proposal_occurred_idx
  ON crm_proposal_events (proposal_id, occurred_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_proposal_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_proposal_events;
  END IF;
END$$;

ALTER TABLE crm_proposal_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_proposal_events' AND policyname = 'crm_proposal_events_all'
  ) THEN
    CREATE POLICY crm_proposal_events_all ON crm_proposal_events FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;
