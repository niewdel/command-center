-- Task 11: first-class AEO (AI-search) health score in seo_checks.
-- Already applied to prod directly; this file exists for the migration
-- record/history. Nullable so existing rows render as "Getting started"
-- in the report until the next recurring check populates it.
alter table public.seo_checks add column if not exists aeo_score int;
