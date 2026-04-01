-- Migration 009: Replace Slack columns with Telegram on content_digests
-- Run this in Supabase SQL Editor

-- Drop Slack columns
ALTER TABLE content_digests DROP COLUMN IF EXISTS slack_message_ts;
ALTER TABLE content_digests DROP COLUMN IF EXISTS slack_channel_id;

-- Add Telegram columns
ALTER TABLE content_digests ADD COLUMN IF NOT EXISTS telegram_chat_id text;
ALTER TABLE content_digests ADD COLUMN IF NOT EXISTS telegram_message_id integer;
