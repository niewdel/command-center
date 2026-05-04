-- Migration 022: SEO monitoring module (Phase 1)
--
-- Adds the SEO agent: weekly automated free checks (technical, performance,
-- on-page, content freshness, GBP basics) per client domain, with diff-based
-- issue tracking. Monthly PDF reports + paid checks (keyword/competitor) are
-- added in later phases.
--
-- Storage model:
--   - clients.seo_config (JSONB) holds per-client knobs (domain, contact_email,
--     target_keywords, competitor_domains, crawl_config, dry_run, etc.)
--   - seo_jobs is the unified job-machinery table (mirrors lead_jobs with
--     heartbeat). Type discriminates between weekly_check, monthly_report,
--     paid_keyword, paid_competitor.
--   - seo_checks is the result of a weekly_check job (one snapshot per run).
--   - seo_issues is normalized; an `issue_fingerprint` makes week-over-week
--     diffing idempotent (same broken-H1 won't insert a new row each week).
--
-- RLS: workspace-scoped via clients.workspace_id → workspaces.user_id. Matches
-- the migration-016 hardened pattern, NOT the migration-019 permissive pattern.

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. clients.seo_config — per-client SEO settings
-- ============================================================
alter table public.clients
  add column if not exists seo_config jsonb;

-- Shape (validated in TypeScript, not SQL):
-- {
--   enabled: boolean,
--   domain: "niewdel.com",
--   contact_email: "client@example.com",
--   contact_name: "Client Name",
--   target_keywords: ["keyword 1", "keyword 2"],     // for paid keyword check
--   competitor_domains: ["competitor.com"],           // for paid competitor check
--   crawl_config: { max_pages: 25, include_paths: [], exclude_paths: [] },
--   dry_run: boolean,                                 // no tasks, no client send
--   report_status: "enabled" | "paused"
-- }

create index if not exists idx_clients_seo_enabled
  on public.clients ((seo_config->>'enabled'))
  where seo_config is not null;

-- ============================================================
-- 2. seo_jobs — unified job-machinery table
-- ============================================================
create table if not exists public.seo_jobs (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  type                text not null
                      check (type in ('weekly_check','monthly_report','paid_keyword','paid_competitor')),
  status              text not null default 'queued'
                      check (status in ('queued','running','complete','failed','cancelled')),
  current_stage       text,
  progress_pct        int not null default 0 check (progress_pct between 0 and 100),
  triggered_by        uuid references auth.users on delete set null,  -- null = cron
  scheduled_for       timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  last_heartbeat_at   timestamptz,
  error_message       text,
  result_id           uuid,           -- FK into the matching result table (seo_checks/etc)
  metadata            jsonb default '{}'::jsonb,  -- per-run telemetry (pages_crawled, psi_calls, tokens)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_seo_jobs_workspace_status
  on public.seo_jobs(workspace_id, status);
create index if not exists idx_seo_jobs_client_created
  on public.seo_jobs(client_id, created_at desc);
create index if not exists idx_seo_jobs_active_heartbeat
  on public.seo_jobs(last_heartbeat_at)
  where status in ('queued','running');
create index if not exists idx_seo_jobs_type_status
  on public.seo_jobs(type, status);

create trigger set_updated_at before update on public.seo_jobs
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 3. seo_checks — weekly snapshot results
-- ============================================================
create table if not exists public.seo_checks (
  id                    uuid primary key default uuid_generate_v4(),
  job_id                uuid not null references public.seo_jobs(id) on delete cascade,
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  client_id             uuid not null references public.clients(id) on delete cascade,

  -- Aggregate scores (0-100). Null until the relevant phase completes.
  technical_score       int,                            -- crawlability + status codes
  lighthouse_mobile     int,                            -- avg performance score across pages
  lighthouse_desktop    int,
  onpage_score          int,                            -- title/meta/h1/alt/schema completeness
  freshness_days        int,                            -- max days since last visible content change

  pages_crawled         int default 0,
  -- pages: array of per-page snapshots
  --   { url, content_hash, status_code, title, meta_desc, h1_count, alt_missing_count,
  --     schema_types: string[], psi_mobile?: number, psi_desktop?: number }
  pages                 jsonb default '[]'::jsonb,

  -- diff_from_previous: { new_issues_count, resolved_issues_count, score_deltas: {...} }
  diff_from_previous    jsonb,

  ai_summary            text,                           -- 2-3 sentence Claude summary

  created_at            timestamptz not null default now()
);

create index if not exists idx_seo_checks_client_created
  on public.seo_checks(client_id, created_at desc);
create index if not exists idx_seo_checks_workspace_created
  on public.seo_checks(workspace_id, created_at desc);

-- ============================================================
-- 4. seo_issues — week-over-week issue tracking
-- ============================================================
create table if not exists public.seo_issues (
  id                      uuid primary key default uuid_generate_v4(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  client_id               uuid not null references public.clients(id) on delete cascade,

  -- Stable identity across weekly runs: sha256(category|page_url|sub_type)
  -- Used by upsert logic to make diffing idempotent.
  fingerprint             text not null,

  severity                text not null
                          check (severity in ('critical','high','medium','low')),
  category                text not null
                          check (category in ('technical','performance','onpage','content','schema','gbp')),
  sub_type                text,                          -- e.g. 'missing_h1', 'broken_canonical', 'lcp_high'
  page_url                text,
  title                   text not null,
  description             text,
  recommendation          text,
  status                  text not null default 'open'
                          check (status in ('open','fixed','ignored')),

  task_id                 uuid references public.tasks(id) on delete set null,

  first_seen_check_id     uuid references public.seo_checks(id) on delete set null,
  last_seen_check_id      uuid references public.seo_checks(id) on delete set null,
  resolved_check_id       uuid references public.seo_checks(id) on delete set null,
  first_seen_at           timestamptz not null default now(),
  last_seen_at            timestamptz not null default now(),
  resolved_at             timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Idempotent upsert key: at most one OPEN issue per (client, fingerprint).
-- Resolved/ignored issues can repeat (they stay around for history).
create unique index if not exists uq_seo_issues_open_fingerprint
  on public.seo_issues(client_id, fingerprint)
  where status = 'open';

create index if not exists idx_seo_issues_client_status
  on public.seo_issues(client_id, status);
create index if not exists idx_seo_issues_workspace_status
  on public.seo_issues(workspace_id, status);
create index if not exists idx_seo_issues_severity
  on public.seo_issues(severity)
  where status = 'open';

create trigger set_updated_at before update on public.seo_issues
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 5. Row Level Security — workspace-scoped via clients
-- ============================================================
alter table public.seo_jobs   enable row level security;
alter table public.seo_checks enable row level security;
alter table public.seo_issues enable row level security;

create policy "Users manage seo_jobs in own workspaces" on public.seo_jobs
  for all to authenticated
  using (workspace_id in (select id from public.workspaces where user_id = auth.uid()))
  with check (workspace_id in (select id from public.workspaces where user_id = auth.uid()));

create policy "Users manage seo_checks in own workspaces" on public.seo_checks
  for all to authenticated
  using (workspace_id in (select id from public.workspaces where user_id = auth.uid()))
  with check (workspace_id in (select id from public.workspaces where user_id = auth.uid()));

create policy "Users manage seo_issues in own workspaces" on public.seo_issues
  for all to authenticated
  using (workspace_id in (select id from public.workspaces where user_id = auth.uid()))
  with check (workspace_id in (select id from public.workspaces where user_id = auth.uid()));

-- ============================================================
-- 6. Realtime — subscribe to seo_jobs progress in the UI
-- ============================================================
alter publication supabase_realtime add table public.seo_jobs;
alter publication supabase_realtime add table public.seo_checks;
