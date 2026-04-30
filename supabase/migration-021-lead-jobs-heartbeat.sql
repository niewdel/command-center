-- Migration 021: lead_jobs heartbeat for orphan detection
--
-- The pipeline runs fire-and-forget via setImmediate inside the API route
-- process. If that process dies mid-run (Railway redeploy, dev restart),
-- the row is stranded in a non-terminal status forever. The pipeline now
-- bumps last_heartbeat_at on every progress write; the sweeper marks any
-- non-terminal job whose heartbeat is older than the threshold as failed.

alter table public.lead_jobs
  add column if not exists last_heartbeat_at timestamptz;

-- Backfill so existing in-flight rows are immediately stale and get swept.
update public.lead_jobs
   set last_heartbeat_at = coalesce(started_at, created_at)
 where last_heartbeat_at is null;

create index if not exists idx_lead_jobs_active_heartbeat
  on public.lead_jobs (last_heartbeat_at)
  where status in ('queued','scraping','enriching','researching','writing');
