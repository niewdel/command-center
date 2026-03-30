-- Migration 007: Issues — bug reports & feature requests
-- Run this in Supabase SQL Editor

create table issues (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  title text not null,
  description text,
  type text not null check (type in ('bug', 'feature')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  linked_entity_type text check (linked_entity_type in ('workspace', 'task', 'project', 'client', 'goal', 'note', 'calendar_event', 'inbox_item', 'page')),
  linked_entity_id text,
  linked_entity_label text,
  resolved_by text check (resolved_by in ('user', 'system')),
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookups
create index idx_issues_user_id on issues(user_id);
create index idx_issues_status on issues(status);
create index idx_issues_type on issues(type);

-- RLS
alter table issues enable row level security;

create policy "Users can view their own issues"
  on issues for select using (user_id = auth.uid());

create policy "Users can create their own issues"
  on issues for insert with check (user_id = auth.uid());

create policy "Users can update their own issues"
  on issues for update using (user_id = auth.uid());

create policy "Users can delete their own issues"
  on issues for delete using (user_id = auth.uid());

-- Auto-update updated_at
create or replace function update_issues_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger issues_updated_at
  before update on issues
  for each row execute function update_issues_updated_at();
