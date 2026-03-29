-- Migration 002: Calendar + AI Command Hub
-- Run this in Supabase SQL Editor after schema.sql

-- Calendar provider connections (one per OAuth grant)
create table calendar_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  provider text not null check (provider in ('google', 'microsoft', 'apple')),
  account_email text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_ids jsonb default '[]'::jsonb,
  sync_cursor text,
  last_synced_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider, account_email)
);

-- Calendar events (local + synced)
create table calendar_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  workspace_id uuid references workspaces(id) on delete set null,
  connection_id uuid references calendar_connections(id) on delete cascade,
  external_id text,
  external_calendar_id text,
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean default false,
  timezone text default 'America/New_York',
  status text default 'confirmed' check (status in ('confirmed', 'tentative', 'cancelled')),
  recurrence_rule text,
  meeting_url text,
  meeting_provider text check (meeting_provider in ('zoom', 'teams', 'google_meet', 'other')),
  attendees jsonb default '[]'::jsonb,
  color text,
  source text default 'local' check (source in ('local', 'google', 'microsoft', 'apple')),
  is_read_only boolean default false,
  raw_data jsonb,
  task_id uuid references tasks(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(connection_id, external_id)
);

-- Meeting link provider connections (Zoom, Teams)
create table meeting_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  provider text not null check (provider in ('zoom', 'teams')),
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  account_email text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

-- AI command log (for debugging and improving NLP)
create table ai_command_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  raw_input text not null,
  parsed_intent text,
  parsed_data jsonb,
  action_taken text,
  entity_type text,
  entity_id uuid,
  confidence numeric,
  source text default 'command_bar' check (source in ('command_bar', 'telegram', 'voice', 'quick_add')),
  duration_ms integer,
  created_at timestamptz default now()
);

-- Add calendar-related fields to tasks
alter table tasks add column if not exists scheduled_start timestamptz;
alter table tasks add column if not exists scheduled_end timestamptz;
alter table tasks add column if not exists calendar_event_id uuid references calendar_events(id) on delete set null;

-- Expand tasks source constraint to include calendar and ai
alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('manual', 'telegram', 'fathom', 'hubspot', 'calendar', 'ai'));

-- Expand sync_log source constraint
alter table sync_log drop constraint if exists sync_log_source_check;
alter table sync_log add constraint sync_log_source_check
  check (source in ('hubspot', 'fathom', 'google_calendar', 'microsoft_calendar', 'apple_calendar'));

-- Indexes
create index idx_calendar_events_user_time on calendar_events(user_id, start_time);
create index idx_calendar_events_connection on calendar_events(connection_id);
create index idx_calendar_events_external on calendar_events(connection_id, external_id);
create index idx_calendar_events_task on calendar_events(task_id);
create index idx_ai_command_log_user on ai_command_log(user_id, created_at);
create index idx_tasks_scheduled on tasks(scheduled_start);

-- Enable realtime for calendar events
alter publication supabase_realtime add table calendar_events;
