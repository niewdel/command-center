-- migration-033-deal-contacts-join.sql
-- Many-to-many: deals can have multiple contacts (from any company).
-- Keep crm_deals.primary_contact_id as a convenience pointer to the
-- headline contact shown on the kanban card.

CREATE TABLE IF NOT EXISTS crm_deal_contacts (
  deal_id uuid NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, contact_id)
);

CREATE INDEX IF NOT EXISTS crm_deal_contacts_contact_idx
  ON crm_deal_contacts (contact_id);

-- Backfill: every existing deal with a primary_contact_id gets a row.
INSERT INTO crm_deal_contacts (deal_id, contact_id, role)
SELECT id, primary_contact_id, 'Primary'
FROM crm_deals
WHERE primary_contact_id IS NOT NULL
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_deal_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_deal_contacts;
  END IF;
END$$;

ALTER TABLE crm_deal_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_deal_contacts' AND policyname = 'crm_deal_contacts_all'
  ) THEN
    CREATE POLICY crm_deal_contacts_all ON crm_deal_contacts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;
