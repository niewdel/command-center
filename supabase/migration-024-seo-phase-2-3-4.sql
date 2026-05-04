-- Migration 024: SEO Phases 2 + 3 + 4
--
-- Phase 2: Trends & Reports (no schema changes — uses existing seo_checks columns)
-- Phase 3: Paid checks (DataForSEO) — adds seo_keyword_ranks + seo_competitor_gaps
-- Phase 4: Close-the-loop — extends seo_issues.category to allow 'ai_search';
--          tasks.source extended to allow 'seo' for auto-created tasks
--
-- RLS pattern: workspace-scoped via clients.workspace_id → workspaces.user_id.
-- Matches the migration-016 hardened pattern used by all SEO tables in 022.

-- ============================================================
-- 1. Extend seo_issues.category to include 'ai_search'
--    (commit b68581c referenced "migration 023" but no file shipped — fold here)
-- ============================================================
alter table public.seo_issues
  drop constraint if exists seo_issues_category_check;
alter table public.seo_issues
  add constraint seo_issues_category_check
  check (category in ('technical','performance','onpage','content','schema','gbp','ai_search'));

-- ============================================================
-- 2. Extend tasks.source to include 'seo'
--    Lets the SEO pipeline auto-create tasks distinguishable from manual ones.
-- ============================================================
alter table public.tasks
  drop constraint if exists tasks_source_check;
alter table public.tasks
  add constraint tasks_source_check
  check (source in ('manual','telegram','fathom','hubspot','ai','seo'));
-- Note: 'ai' was added in a prior session (used by /api/tasks/dump and
-- /api/ai/parse) but never reflected in schema.sql. Including it here.

-- ============================================================
-- 3. seo_keyword_ranks — week-over-week rank tracking via DataForSEO
--    One row per (client, keyword, captured_at). Latest two captures
--    feed the delta column on the client detail page.
-- ============================================================
create table if not exists public.seo_keyword_ranks (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  job_id          uuid references public.seo_jobs(id) on delete set null,

  keyword         text not null,
  rank            integer,            -- null = not in top N (50 default)
  url             text,               -- top-ranking URL on the client domain
  search_volume   integer,
  cpc             numeric(10,2),

  captured_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_seo_keyword_ranks_client_kw
  on public.seo_keyword_ranks(client_id, keyword, captured_at desc);
create index if not exists idx_seo_keyword_ranks_workspace
  on public.seo_keyword_ranks(workspace_id);

alter table public.seo_keyword_ranks enable row level security;

drop policy if exists "seo_keyword_ranks_workspace_owner" on public.seo_keyword_ranks;
create policy "seo_keyword_ranks_workspace_owner"
  on public.seo_keyword_ranks
  for all
  to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = seo_keyword_ranks.workspace_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = seo_keyword_ranks.workspace_id
        and w.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. seo_competitor_gaps — keywords competitors rank for that we don't.
--    Replaced (delete + insert) on each paid_competitor run; no need for
--    history here (snapshots covered by job metadata + captured_at).
-- ============================================================
create table if not exists public.seo_competitor_gaps (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  job_id              uuid references public.seo_jobs(id) on delete set null,

  competitor_domain   text not null,
  keyword             text not null,
  competitor_rank     integer not null,
  competitor_url      text,
  search_volume       integer,
  cpc                 numeric(10,2),

  captured_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists idx_seo_competitor_gaps_client_vol
  on public.seo_competitor_gaps(client_id, search_volume desc nulls last);
create index if not exists idx_seo_competitor_gaps_workspace
  on public.seo_competitor_gaps(workspace_id);

alter table public.seo_competitor_gaps enable row level security;

drop policy if exists "seo_competitor_gaps_workspace_owner" on public.seo_competitor_gaps;
create policy "seo_competitor_gaps_workspace_owner"
  on public.seo_competitor_gaps
  for all
  to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = seo_competitor_gaps.workspace_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = seo_competitor_gaps.workspace_id
        and w.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. Realtime publication — let the client detail page see live updates
--    on the new tables (matches the seo_jobs/seo_checks/seo_issues setup).
-- ============================================================
alter publication supabase_realtime add table public.seo_keyword_ranks;
alter publication supabase_realtime add table public.seo_competitor_gaps;
