-- Migration 019: Site audit module
--
-- Creates the audits table (one row per run) and the audit-reports Storage
-- bucket where the rendered HTML reports live. The audits table holds the
-- structured AuditResult JSON so future React-native rendering is possible
-- without rerunning the audit. The HTML report is the canonical
-- shareable artifact for now.
--
-- RLS pattern: matches the existing PIN-auth permissive policy. Migration 016
-- (re-harden RLS) replaces this with auth.uid()-scoped policies.

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. AUDITS TABLE
-- ============================================================
create table public.audits (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users on delete cascade,
  url             text not null,
  site_name       text,
  status          text not null default 'pending'
                  check (status in ('pending','crawling','scoring','rendering','complete','failed')),
  current_stage   text,
  progress_pct    int not null default 0 check (progress_pct between 0 and 100),
  overall_score   int,
  overall_severity text
                  check (overall_severity in ('critical','serious','moderate','acceptable','strong')),
  pages_crawled   int default 0,
  result          jsonb,                 -- full AuditResult shape (categories, psi, etc.)
  report_path     text,                  -- Supabase Storage path: <user_id>/<audit_id>-report.html
  fix_plan_path   text,                  -- Supabase Storage path: <user_id>/<audit_id>-fix-plan.html
  error           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_audits_user_created on public.audits(user_id, created_at desc);
create index idx_audits_status on public.audits(status);
create index idx_audits_url on public.audits(url);

create trigger set_updated_at before update on public.audits
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 2. ROW LEVEL SECURITY (permissive, matches existing PIN-auth pattern)
-- ============================================================
alter table public.audits enable row level security;
create policy "PIN-auth access" on public.audits for all using (true) with check (true);

-- ============================================================
-- 3. STORAGE BUCKET FOR RENDERED REPORTS
-- ============================================================
insert into storage.buckets (id, name, public)
values ('audit-reports', 'audit-reports', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload audit reports"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'audit-reports');

create policy "Authenticated users can update audit reports"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'audit-reports');

create policy "Authenticated users can delete audit reports"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'audit-reports');

create policy "Public can view audit reports"
  on storage.objects for select
  to public
  using (bucket_id = 'audit-reports');
