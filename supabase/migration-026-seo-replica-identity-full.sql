-- Migration 026: REPLICA IDENTITY FULL on seo realtime-published tables
--
-- Supabase realtime needs to evaluate the RLS policy against BOTH the old
-- and new versions of a row on UPDATE events. With REPLICA IDENTITY DEFAULT,
-- the WAL only records the primary key for the old row, so the policy can't
-- be evaluated reliably and UPDATEs may be silently dropped or throttled.
--
-- Symptom (pre-fix): the progress bar on /seo/clients/[id] would freeze at
-- 5%, jump to 92%, then sit there until the page was re-mounted, even though
-- seo_jobs UPDATEs were happening every second on the server. /seo overview
-- was unaffected because its subscription happened to receive enough events
-- to feel responsive on a coarse list, but the same events were missing on
-- the detail page where every tick matters.
--
-- Fix: REPLICA IDENTITY FULL writes the full old row to WAL on UPDATE/DELETE
-- so realtime can fully evaluate RLS and forward every event. Modest WAL size
-- increase, but these tables are low-churn (per-week pipeline) so the cost is
-- negligible.

alter table public.seo_jobs                 replica identity full;
alter table public.seo_checks               replica identity full;
alter table public.seo_keyword_ranks        replica identity full;
alter table public.seo_competitor_gaps      replica identity full;
alter table public.seo_traffic_snapshots    replica identity full;
