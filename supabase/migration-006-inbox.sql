-- Migration 006: Unified Inbox — email connections + inbox items
-- Run this in Supabase SQL Editor

-- Email/integration connections
create table email_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  provider text not null check (provider in ('google', 'microsoft')),
  account_email text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] default '{}',
  sync_cursor text,
  last_synced_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider, account_email)
);

-- Inbox items (emails from all connected accounts)
create table inbox_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  connection_id uuid references email_connections(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  external_id text not null,
  thread_id text,
  subject text,
  snippet text,
  sender_name text,
  sender_email text,
  recipients jsonb default '[]',
  received_at timestamptz not null,
  is_read boolean default false,
  is_starred boolean default false,
  has_attachments boolean default false,
  labels text[] default '{}',

  -- AI classification
  ai_category text check (ai_category in (
    'action_required', 'needs_response', 'informational', 'promotional', 'trash'
  )),
  ai_confidence numeric,
  ai_summary text,
  ai_classified_at timestamptz,

  -- Task linkage
  task_id uuid references tasks(id) on delete set null,

  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(connection_id, external_id)
);

-- Indexes
create index idx_inbox_user_received on inbox_items(user_id, received_at desc);
create index idx_inbox_category on inbox_items(user_id, ai_category);
create index idx_inbox_connection on inbox_items(connection_id);
create index idx_inbox_thread on inbox_items(thread_id);
create index idx_inbox_unread on inbox_items(user_id, is_read) where is_read = false;
create index idx_email_connections_user on email_connections(user_id);

-- RLS
alter table email_connections enable row level security;
alter table inbox_items enable row level security;

create policy "Users can view own email connections"
  on email_connections for select using (auth.uid() = user_id);
create policy "Users can insert own email connections"
  on email_connections for insert with check (auth.uid() = user_id);
create policy "Users can update own email connections"
  on email_connections for update using (auth.uid() = user_id);
create policy "Users can delete own email connections"
  on email_connections for delete using (auth.uid() = user_id);

create policy "Users can view own inbox items"
  on inbox_items for select using (auth.uid() = user_id);
create policy "Users can update own inbox items"
  on inbox_items for update using (auth.uid() = user_id);
create policy "Service role can insert inbox items"
  on inbox_items for insert with check (true);
create policy "Service role can update inbox items"
  on inbox_items for update using (true);

-- Expand tasks source to include email
alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('manual', 'telegram', 'fathom', 'hubspot', 'calendar', 'ai', 'email'));

-- Add inbox linkage to tasks
alter table tasks add column if not exists inbox_item_id uuid references inbox_items(id) on delete set null;

-- Enable realtime for inbox
alter publication supabase_realtime add table inbox_items;
