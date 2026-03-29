-- Migration 003: Content Digests (Slack → YouTube/Instagram → Claude analysis)
-- Run this in Supabase SQL Editor

create table content_digests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  url text not null,
  source text not null check (source in ('youtube', 'instagram', 'unknown')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  title text,
  thumbnail_url text,
  duration_seconds integer,
  transcript text,
  guide text,
  tags text[] default '{}',
  error_message text,
  slack_message_ts text,
  slack_channel_id text,
  processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for listing digests by status and date
create index idx_content_digests_user_status on content_digests(user_id, status);
create index idx_content_digests_created on content_digests(user_id, created_at desc);

-- RLS
alter table content_digests enable row level security;

create policy "Users can view own digests"
  on content_digests for select
  using (auth.uid() = user_id);

create policy "Service role can insert digests"
  on content_digests for insert
  with check (true);

create policy "Service role can update digests"
  on content_digests for update
  using (true);
