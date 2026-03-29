-- Command Center Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Workspaces
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  type text not null check (type in ('business', 'personal')),
  created_at timestamptz default now()
);

-- Seed the three workspaces
insert into workspaces (name, slug, type) values
  ('Niewdel', 'niewdel', 'business'),
  ('i10 Solutions', 'i10', 'business'),
  ('Personal', 'personal', 'personal');

-- Clients
create table clients (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  type text not null default 'lightweight' check (type in ('full', 'lightweight')),
  notes text,
  links jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Projects
create table projects (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  description text,
  status text default 'active' check (status in ('active', 'completed', 'on_hold')),
  created_at timestamptz default now()
);

-- Tasks (central entity)
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  title text not null,
  description text,
  status text default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text default 'none' check (priority in ('none', 'low', 'medium', 'high')),
  due_date date,
  is_recurring boolean default false,
  recurrence_rule text,
  source text default 'manual' check (source in ('manual', 'telegram', 'fathom', 'hubspot')),
  source_id text,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Tags
create table tags (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  color text
);

-- Polymorphic tag assignments
create table taggables (
  id uuid primary key default uuid_generate_v4(),
  tag_id uuid references tags(id) on delete cascade,
  taggable_type text not null check (taggable_type in ('task', 'project', 'note', 'client')),
  taggable_id uuid not null
);

-- Notes & Meeting Log
create table notes (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  content text,
  type text default 'note' check (type in ('note', 'meeting')),
  source text default 'manual' check (source in ('manual', 'fathom')),
  source_id text,
  meeting_date timestamptz,
  attendees jsonb,
  created_at timestamptz default now()
);

-- Goals
create table goals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  title text not null,
  description text,
  type text not null check (type in ('business', 'personal')),
  status text default 'active' check (status in ('active', 'completed', 'abandoned')),
  target_date date,
  created_at timestamptz default now()
);

-- HubSpot synced tasks (mirror table)
create table hubspot_tasks (
  id uuid primary key default uuid_generate_v4(),
  hubspot_id text unique not null,
  subject text,
  body text,
  status text,
  priority text,
  due_date timestamptz,
  owner_id text,
  last_synced_at timestamptz,
  raw_data jsonb
);

-- Sync log
create table sync_log (
  id uuid primary key default uuid_generate_v4(),
  source text not null check (source in ('hubspot', 'fathom')),
  status text not null check (status in ('success', 'error')),
  message text,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index idx_tasks_workspace on tasks(workspace_id);
create index idx_tasks_status on tasks(status);
create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_source on tasks(source);
create index idx_notes_workspace on notes(workspace_id);
create index idx_clients_workspace on clients(workspace_id);
create index idx_projects_workspace on projects(workspace_id);
create index idx_taggables_target on taggables(taggable_type, taggable_id);

-- Enable realtime for tasks
alter publication supabase_realtime add table tasks;
