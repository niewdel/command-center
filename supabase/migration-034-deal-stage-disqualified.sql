-- migration-034-deal-stage-disqualified.sql
-- Adds 'disqualified' as a seventh deal stage. Terminal like 'live' / 'lost'
-- — used when we walk away from a deal that doesn't fit the ICP (wrong
-- budget, wrong industry, not the decision maker, etc.) vs 'lost' which
-- means we engaged and didn't win.

ALTER TABLE crm_deals DROP CONSTRAINT IF EXISTS crm_deals_stage_check;
ALTER TABLE crm_deals
  ADD CONSTRAINT crm_deals_stage_check
  CHECK (stage IN ('discovery','scope','proposal','build','live','lost','disqualified'));

CREATE OR REPLACE FUNCTION set_deal_closed_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.stage IN ('live','lost','disqualified') AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.closed_at = now();
  ELSIF NEW.stage NOT IN ('live','lost','disqualified') THEN
    NEW.closed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
