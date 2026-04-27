-- Migration 017: Lead-generator schema
--
-- Imports the lead-generator pipeline tables (organizations, verticals,
-- companies, contacts, sequences, outreach_emails, pipeline_log) into
-- command-center's Supabase project so the dashboard can live as a tab.
--
-- RLS pattern: matches the current PIN-auth permissive policies on every
-- other table in command-center. When migration-016 (re-harden RLS) eventually
-- runs, it will replace these with auth.uid() / org_id-scoped policies — see
-- migration-016 for the planned hardened versions.
--
-- The original lead-gen schema scoped by org_id. We keep that structure so
-- the existing CLI engine in ~/lead-generator/ continues to work unchanged
-- after we point its SUPABASE_URL at this project.

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. ORGANIZATIONS  (root entity for lead-gen multi-tenant prep)
-- ============================================================
create table public.organizations (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create index idx_organizations_user on public.organizations(user_id);

-- Seed the single org for Justin so the CLI engine has somewhere to write.
insert into public.organizations (id, user_id, name)
values (
  'a1b2c3d4-0000-0000-0000-000000000001',
  '82340bcc-47b7-4217-b5ce-887270928b98',
  'Niewdel'
);

-- ============================================================
-- 2. VERTICALS
-- ============================================================
create table public.verticals (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  icp             jsonb not null default '{}',
  scrape_params   jsonb not null default '{}',
  outreach_config jsonb not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_verticals_org on public.verticals(org_id);

-- ============================================================
-- 3. COMPANIES
-- ============================================================
create table public.companies (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  vertical_id       uuid references public.verticals(id) on delete set null,
  name              text not null,
  domain            text,
  website           text,
  industry          text,
  revenue_range     text,
  headcount         int,
  city              text,
  state             text,
  country           text default 'US',
  source            text not null default 'apollo',
  source_id         text,
  research_profile  jsonb,
  research_summary  text,
  researched_at     timestamptz,
  status            text not null default 'new'
                    check (status in ('new','researched','outreach_ready','in_sequence','replied','qualified','disqualified')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, domain)
);
create index idx_companies_org_vertical on public.companies(org_id, vertical_id);
create index idx_companies_status on public.companies(status);
create index idx_companies_domain on public.companies(domain);
create index idx_companies_research on public.companies using gin (research_profile jsonb_path_ops);

-- ============================================================
-- 4. CONTACTS
-- ============================================================
create table public.contacts (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  full_name       text not null,
  first_name      text,
  last_name       text,
  title           text,
  email           text,
  email_verified  boolean not null default false,
  linkedin_url    text,
  role_type       text not null default 'unknown'
                  check (role_type in ('decision_maker','influencer','champion','end_user','unknown')),
  source          text not null default 'apollo',
  source_id       text,
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, email)
);
create index idx_contacts_company on public.contacts(company_id);
create index idx_contacts_email on public.contacts(email);

-- ============================================================
-- 5. SEQUENCES
-- ============================================================
create table public.sequences (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  vertical_id  uuid not null references public.verticals(id) on delete cascade,
  name         text not null,
  steps        int not null default 3,
  delay_days   int[] not null default '{0,3,5}',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index idx_sequences_org on public.sequences(org_id);

-- ============================================================
-- 6. OUTREACH EMAILS
-- ============================================================
create table public.outreach_emails (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  sequence_id     uuid references public.sequences(id) on delete set null,
  step_number     int not null default 1,
  subject         text,
  body_html       text,
  body_plain      text,
  status          text not null default 'draft'
                  check (status in ('draft','approved','scheduled','sent','bounced','failed')),
  smartlead_id    text,
  sent_at         timestamptz,
  opened_at       timestamptz,
  replied_at      timestamptz,
  open_count      int not null default 0,
  click_count     int not null default 0,
  generated_by    text default 'claude',
  prompt_version  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_outreach_contact on public.outreach_emails(contact_id);
create index idx_outreach_status on public.outreach_emails(status);
create index idx_outreach_sequence_step on public.outreach_emails(sequence_id, step_number);

-- ============================================================
-- 7. PIPELINE LOG
-- ============================================================
create table public.pipeline_log (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  company_id  uuid references public.companies(id) on delete cascade,
  contact_id  uuid references public.contacts(id) on delete cascade,
  event_type  text not null,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);
create index idx_pipeline_log_company on public.pipeline_log(company_id);
create index idx_pipeline_log_type on public.pipeline_log(event_type);
create index idx_pipeline_log_created on public.pipeline_log(created_at desc);

-- ============================================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================================
-- The handle_updated_at function already exists in command-center
-- (created during the initial schema). Reuse it.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'handle_updated_at') then
    create function public.handle_updated_at()
    returns trigger as $func$
    begin
      new.updated_at = now();
      return new;
    end;
    $func$ language plpgsql;
  end if;
end$$;

create trigger set_updated_at before update on public.companies
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.contacts
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.outreach_emails
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.verticals
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 9. ROW LEVEL SECURITY (permissive, matches existing PIN-auth pattern)
-- ============================================================
alter table public.organizations    enable row level security;
alter table public.verticals        enable row level security;
alter table public.companies        enable row level security;
alter table public.contacts         enable row level security;
alter table public.sequences        enable row level security;
alter table public.outreach_emails  enable row level security;
alter table public.pipeline_log     enable row level security;

create policy "PIN-auth access" on public.organizations    for all using (true) with check (true);
create policy "PIN-auth access" on public.verticals        for all using (true) with check (true);
create policy "PIN-auth access" on public.companies        for all using (true) with check (true);
create policy "PIN-auth access" on public.contacts         for all using (true) with check (true);
create policy "PIN-auth access" on public.sequences        for all using (true) with check (true);
create policy "PIN-auth access" on public.outreach_emails  for all using (true) with check (true);
create policy "PIN-auth access" on public.pipeline_log     for all using (true) with check (true);
