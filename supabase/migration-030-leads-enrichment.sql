-- migration-030-leads-enrichment.sql
-- Extra enrichment + scoring fields on companies and contacts so the lead
-- gen pipeline can match the Niewdel Lab demo (tech stack chips, founded
-- year, funding stage, HQ, phone numbers, lead score, contact-level status).
--
-- All columns nullable / have defaults; backward compatible with existing
-- pipeline writes.

-- Companies: extra Apollo fields the pipeline already had access to but
-- was previously dropping in mapApolloOrg.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS founded_year integer,
  ADD COLUMN IF NOT EXISTS latest_funding_stage text,
  ADD COLUMN IF NOT EXISTS technologies text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS linkedin_url text;

-- Contacts: phone (Hunter already returns it), lead_score (heuristic 0-100),
-- and status (mirrors highest outreach event so the prospect card can show
-- queued/sent/opened/replied/bounced like the demo).
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS lead_score integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'queued';

-- Constrain status values to match the demo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_status_check'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_status_check
      CHECK (status IN ('queued','sent','opened','replied','bounced'));
  END IF;
END$$;

-- Indexes that the new prospects view will rely on.
CREATE INDEX IF NOT EXISTS contacts_lead_score_idx
  ON contacts (lead_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS contacts_status_idx
  ON contacts (status);
CREATE INDEX IF NOT EXISTS companies_technologies_gin
  ON companies USING gin (technologies);

-- Mirror outreach_emails state onto contacts.status so the prospect card
-- filter (queued/sent/opened/replied/bounced) reflects real activity.
-- Priority highest wins: replied > opened > bounced > sent > queued.
CREATE OR REPLACE FUNCTION sync_contact_status_from_emails()
RETURNS trigger AS $$
DECLARE
  target_contact uuid;
  new_status text;
BEGIN
  target_contact := COALESCE(NEW.contact_id, OLD.contact_id);
  IF target_contact IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    CASE
      WHEN bool_or(replied_at IS NOT NULL) THEN 'replied'
      WHEN bool_or(opened_at IS NOT NULL) THEN 'opened'
      WHEN bool_or(status = 'bounced') THEN 'bounced'
      WHEN bool_or(sent_at IS NOT NULL OR status = 'sent') THEN 'sent'
      ELSE 'queued'
    END
  INTO new_status
  FROM outreach_emails
  WHERE contact_id = target_contact;

  UPDATE contacts
  SET status = COALESCE(new_status, 'queued')
  WHERE id = target_contact
    AND status IS DISTINCT FROM COALESCE(new_status, 'queued');

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outreach_emails_sync_contact_status ON outreach_emails;
CREATE TRIGGER outreach_emails_sync_contact_status
  AFTER INSERT OR UPDATE OR DELETE ON outreach_emails
  FOR EACH ROW EXECUTE FUNCTION sync_contact_status_from_emails();

-- Realtime for contacts so the prospects page refreshes when status/phone
-- changes (post-enrichment, post-send/open/reply).
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
