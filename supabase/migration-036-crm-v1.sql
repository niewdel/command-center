-- CRM v1: Companies (extend clients) + Contacts + Activities + Tasks, multi-tenant (workspace-scoped) + RLS + Demo tenant seed.
-- Tenant = workspace. New tables carry a denormalized workspace_id for simple/fast RLS.

-- ── 1. Extend clients (= Companies) ─────────────────────────────────────────
alter table public.clients add column if not exists pipeline_stage text not null default 'lead';
alter table public.clients add column if not exists owner_id uuid;
alter table public.clients add column if not exists website text;
alter table public.clients add column if not exists est_mrr numeric;
alter table public.clients add column if not exists lost_reason text;
alter table public.clients add column if not exists last_activity_at timestamptz;

-- Existing clients are active accounts → mark them Won (runs before the demo seed).
update public.clients set pipeline_stage = 'won' where pipeline_stage = 'lead';

alter table public.clients drop constraint if exists clients_pipeline_stage_chk;
alter table public.clients add constraint clients_pipeline_stage_chk
  check (pipeline_stage in ('lead','qualified','proposal_sent','won','lost'));

create index if not exists idx_clients_workspace_stage on public.clients(workspace_id, pipeline_stage);

-- ── 2. Demo workspace (tenant #2, team-owned so the switcher can reach it) ──
insert into public.workspaces (id, user_id, name, slug, type, position)
values ('d0000000-0000-4000-8000-000000000001', '82340bcc-47b7-4217-b5ce-887270928b98', 'Demo', 'demo', 'demo', 99)
on conflict (id) do nothing;

-- ── 3. New CRM tables (workspace_id denormalized) ──────────────────────────
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  title text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_contacts_company on public.contacts(company_id);
create index if not exists idx_contacts_workspace on public.contacts(workspace_id);
create unique index if not exists uniq_primary_contact_per_company
  on public.contacts(company_id) where is_primary;

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  type text not null check (type in ('note','call','email','meeting','stage_change')),
  body text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_activities_company on public.crm_activities(company_id, created_at desc);
create index if not exists idx_crm_activities_workspace on public.crm_activities(workspace_id);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_tasks_company on public.crm_tasks(company_id);
create index if not exists idx_crm_tasks_due on public.crm_tasks(due_date) where not done;

-- ── 4. RLS (workspace-scoped; server-side service-role is the primary path,
--        this is defense-in-depth against direct anon access) ───────────────
alter table public.contacts enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_tasks enable row level security;

drop policy if exists "workspace members access contacts" on public.contacts;
create policy "workspace members access contacts" on public.contacts for all
  using (workspace_id in (select id from public.workspaces where user_id = auth.uid()))
  with check (workspace_id in (select id from public.workspaces where user_id = auth.uid()));

drop policy if exists "workspace members access crm_activities" on public.crm_activities;
create policy "workspace members access crm_activities" on public.crm_activities for all
  using (workspace_id in (select id from public.workspaces where user_id = auth.uid()))
  with check (workspace_id in (select id from public.workspaces where user_id = auth.uid()));

drop policy if exists "workspace members access crm_tasks" on public.crm_tasks;
create policy "workspace members access crm_tasks" on public.crm_tasks for all
  using (workspace_id in (select id from public.workspaces where user_id = auth.uid()))
  with check (workspace_id in (select id from public.workspaces where user_id = auth.uid()));

-- ── 5. Demo tenant seed (generic sample prospects/clients, no real data) ────
insert into public.clients (id, workspace_id, name, type, pipeline_stage, website, est_mrr, last_activity_at)
values
  ('c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Summit Roofing Co','company','lead','summitroofingco.com',500,now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','Bluewater Pools','company','lead','bluewaterpools.com',350,now() - interval '20 days'),
  ('c0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','Apex HVAC','company','qualified','apexhvac.com',750,now() - interval '3 days'),
  ('c0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','Riverstone Dental','company','qualified','riverstonedental.com',500,now() - interval '18 days'),
  ('c0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001','Ironclad Fitness','company','proposal_sent','ironcladfitness.com',999,now() - interval '1 day'),
  ('c0000000-0000-4000-8000-000000000006','d0000000-0000-4000-8000-000000000001','Maple & Co Bakery','company','won','mapleandco.com',299,now() - interval '5 days'),
  ('c0000000-0000-4000-8000-000000000007','d0000000-0000-4000-8000-000000000001','Northgate Auto Spa','company','lost','northgateautospa.com',null,now() - interval '30 days')
on conflict (id) do nothing;

update public.clients set lost_reason = 'Went with a cheaper freelancer'
  where id = 'c0000000-0000-4000-8000-000000000007' and lost_reason is null;

insert into public.contacts (id, workspace_id, company_id, name, email, phone, title, is_primary)
values
  ('c1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Marcus Hale','marcus@summitroofingco.com','704-555-0142','Owner',true),
  ('c1000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','Dana Ruiz','dana@apexhvac.com','704-555-0187','General Manager',true),
  ('c1000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','Priya Nair','priya@ironcladfitness.com','980-555-0119','Founder',true),
  ('c1000000-0000-4000-8000-000000000006','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000006','Tom Whitfield','tom@mapleandco.com','803-555-0164','Owner',true)
on conflict (id) do nothing;

insert into public.crm_activities (id, workspace_id, company_id, type, body, created_at)
values
  ('a0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','note','Inbound from the website form. Wants more roofing leads and a faster site.',now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','call','Discovery call done. Pain is the phone not ringing in the off-season. Budget looks solid.',now() - interval '3 days'),
  ('a0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','email','Sent the website + managed proposal. Priya is comparing paths.',now() - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000006','stage_change','Moved from Proposal Sent to Won',now() - interval '5 days')
on conflict (id) do nothing;

insert into public.crm_tasks (id, workspace_id, company_id, title, due_date, done)
values
  ('a2000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Send Summit the discovery questions', current_date + 1, false),
  ('a2000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003','Draft Apex HVAC proposal', current_date + 2, false),
  ('a2000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','Follow up with Priya on the proposal', current_date, false)
on conflict (id) do nothing;
