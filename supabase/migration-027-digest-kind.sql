-- Migration 027: Add kind column to content_digests + tiktok source
-- Already applied to remote DB via Supabase MCP on 2026-05-06
-- This file is kept in repo for reference / fresh-clone replay

alter table content_digests
  add column if not exists kind text not null default 'digest'
  check (kind in ('digest', 'inspiration'));

create index if not exists idx_content_digests_kind on content_digests(kind);

alter table content_digests drop constraint if exists content_digests_source_check;
alter table content_digests
  add constraint content_digests_source_check
  check (source in ('youtube', 'instagram', 'tiktok', 'unknown'));
