-- migration-032-deal-attachments.sql
-- Per-deal attachments: a proposal (uploaded PDF or pasted link, e.g. Google
-- Drive) and a Fathom recording link.

ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS proposal_url text,
  ADD COLUMN IF NOT EXISTS proposal_filename text,
  ADD COLUMN IF NOT EXISTS fathom_url text;
