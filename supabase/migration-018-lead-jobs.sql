-- Migration 018: lead_jobs table for cloud-hosted lead-generation pipeline
--
-- Replaces the local CLI engine with cloud execution. Each "Generate Leads"
-- form submission creates a lead_jobs row; the API route kicks off an async
-- pipeline (scrape via Apollo -> enrich via Hunter -> research via Claude ->
-- draft outreach via Claude). Stage transitions and counts persist back to
-- this table so the UI can subscribe via Supabase realtime and show progress.

create table public.lead_jobs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  vertical_id     uuid references public.verticals(id) on delete set null,
  criteria        jsonb not null default '{}',
  status          text not null default 'queued'
                  check (status in ('queued','scraping','enriching','researching','writing','complete','failed','cancelled')),
  current_stage   text,
  progress_pct    int not null default 0 check (progress_pct between 0 and 100),
  target_count    int not null default 25,
  companies_found int not null default 0,
  contacts_found  int not null default 0,
  emails_drafted  int not null default 0,
  error           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_lead_jobs_org_status on public.lead_jobs(org_id, status);
create index idx_lead_jobs_created on public.lead_jobs(created_at desc);

create trigger set_updated_at before update on public.lead_jobs
  for each row execute function public.handle_updated_at();

alter table public.lead_jobs enable row level security;
create policy "PIN-auth access" on public.lead_jobs for all using (true) with check (true);
