-- Migration 025: Google Analytics 4 integration
--
-- Two new tables:
--   1. google_oauth_connections — one row per user. Stores their refresh
--      token so we can call the Analytics API on their behalf indefinitely
--      without prompting for re-auth. Access token is also cached but is
--      short-lived (1h) and refreshed on demand.
--   2. seo_traffic_snapshots — week-over-week GA4 traffic data per client.
--      One row per (client, captured_at). Pulled by the weekly_check
--      pipeline when seo_config.ga4_property_id is set.
--
-- RLS pattern matches migration-016: workspace owner via auth.uid().
-- Tokens are stored in plaintext but RLS + service-role-only access
-- keeps them sealed. Future hardening: pgsodium encryption at rest.

-- ============================================================
-- 1. google_oauth_connections
-- ============================================================
create table if not exists public.google_oauth_connections (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  google_email    text not null,            -- the authenticated Google account
  scopes          text[] not null default '{}', -- e.g. ['analytics.readonly']

  access_token    text not null,
  refresh_token   text not null,
  token_type      text not null default 'Bearer',
  expires_at      timestamptz not null,     -- when access_token expires (1h)

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id)                          -- one connection per user (single-tenant for now)
);

create index if not exists idx_google_oauth_connections_user
  on public.google_oauth_connections(user_id);

alter table public.google_oauth_connections enable row level security;

drop policy if exists "google_oauth_connections_owner" on public.google_oauth_connections;
create policy "google_oauth_connections_owner"
  on public.google_oauth_connections
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- 2. seo_traffic_snapshots — GA4 data per weekly_check run
-- ============================================================
create table if not exists public.seo_traffic_snapshots (
  id                      uuid primary key default uuid_generate_v4(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  client_id               uuid not null references public.clients(id) on delete cascade,
  job_id                  uuid references public.seo_jobs(id) on delete set null,

  -- Period this snapshot covers (e.g. last 7 days at time of capture).
  period_start            date not null,
  period_end              date not null,

  -- Top-line metrics for the period.
  sessions                integer not null default 0,
  users                   integer not null default 0,
  page_views              integer not null default 0,
  organic_sessions        integer not null default 0,
  avg_session_duration_s  numeric(10, 2),
  bounce_rate             numeric(5, 4),    -- 0.0000 to 1.0000

  -- Top pages + sources stored as JSONB so the shape can evolve without
  -- another migration. Each is an array of small objects:
  --   top_pages: [{ path: '/', sessions: 1234, users: 980 }, ...]
  --   top_sources: [{ source: 'google', medium: 'organic', sessions: 800 }, ...]
  top_pages               jsonb,
  top_sources             jsonb,

  -- GA4 property id used to fetch this data, denormalized for easy lookup.
  ga4_property_id         text not null,

  captured_at             timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

create index if not exists idx_seo_traffic_client_captured
  on public.seo_traffic_snapshots(client_id, captured_at desc);
create index if not exists idx_seo_traffic_workspace
  on public.seo_traffic_snapshots(workspace_id);

alter table public.seo_traffic_snapshots enable row level security;

drop policy if exists "seo_traffic_snapshots_workspace_owner" on public.seo_traffic_snapshots;
create policy "seo_traffic_snapshots_workspace_owner"
  on public.seo_traffic_snapshots
  for all
  to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = seo_traffic_snapshots.workspace_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = seo_traffic_snapshots.workspace_id
        and w.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Realtime publication — let the client detail page see live updates
-- ============================================================
alter publication supabase_realtime add table public.seo_traffic_snapshots;
