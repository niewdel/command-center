-- Migration 020: add audits + lead_jobs to the supabase_realtime publication
--
-- Without this, the /audits and /leads pages never receive postgres_changes
-- events, so the UI looks frozen even when the background pipeline finishes.
-- Already applied 2026-04-27 via MCP; this file exists for repo parity.

alter publication supabase_realtime add table public.audits;
alter publication supabase_realtime add table public.lead_jobs;
