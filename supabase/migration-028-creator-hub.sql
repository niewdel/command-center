-- Migration 028: LettyAI CreatorHub — video idea pipeline + hook library
-- Already applied to remote DB via Supabase MCP on 2026-05-06
-- This file is kept in repo for reference / fresh-clone replay

create extension if not exists "uuid-ossp";

create table if not exists creator_ideas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  title text not null,
  hook text,
  pillar text check (pillar in ('build_breakdown', 'slop_callout', 'tactical_tip', 'trend_reaction')),
  status text not null default 'idea' check (status in ('idea', 'scripted', 'recorded', 'edited', 'posted', 'archived')),
  script text,
  notes text,
  inspiration_ids uuid[] default '{}',
  posted_at timestamptz,
  posted_url_tiktok text,
  posted_url_instagram text,
  posted_url_youtube text,
  views_tiktok integer,
  views_instagram integer,
  views_youtube integer,
  position integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_creator_ideas_user_status on creator_ideas(user_id, status);
create index if not exists idx_creator_ideas_pillar on creator_ideas(pillar);

create table if not exists creator_hooks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  pattern text not null,
  example text,
  category text check (category in ('cognitive_dissonance', 'pattern_interrupt', 'curiosity_gap', 'authority_flex', 'controversy', 'list_promise', 'other')),
  tested boolean default false,
  performance_notes text,
  position integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_creator_hooks_user on creator_hooks(user_id);

alter table creator_ideas enable row level security;
alter table creator_hooks enable row level security;

create policy "Users can view own ideas" on creator_ideas for select using (auth.uid() = user_id);
create policy "Users can insert own ideas" on creator_ideas for insert with check (auth.uid() = user_id);
create policy "Users can update own ideas" on creator_ideas for update using (auth.uid() = user_id);
create policy "Users can delete own ideas" on creator_ideas for delete using (auth.uid() = user_id);
create policy "Service role can write ideas" on creator_ideas for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "Users can view own hooks" on creator_hooks for select using (auth.uid() = user_id);
create policy "Users can insert own hooks" on creator_hooks for insert with check (auth.uid() = user_id);
create policy "Users can update own hooks" on creator_hooks for update using (auth.uid() = user_id);
create policy "Users can delete own hooks" on creator_hooks for delete using (auth.uid() = user_id);
create policy "Service role can write hooks" on creator_hooks for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
