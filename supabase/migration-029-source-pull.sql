-- Migration 029: source_pull on content_digests
-- Already applied to remote DB via Supabase MCP on 2026-05-06
-- This file is kept in repo for reference / fresh-clone replay

alter table content_digests
  add column if not exists source_pull text not null default 'manual_url'
  check (source_pull in ('telegram', 'manual_url', 'trend_scrape'));

create index if not exists idx_content_digests_source_pull on content_digests(source_pull);

-- Backfill existing rows: anything with telegram_chat_id came from Telegram
update content_digests
  set source_pull = 'telegram'
  where telegram_chat_id is not null
    and source_pull = 'manual_url';
