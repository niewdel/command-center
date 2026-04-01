-- Migration 007: Add digest_context to user_settings
-- Stores the user's personal context for AI-powered content digestion.
-- This context is injected into the Claude analysis prompt so guides
-- are personalized to what the user is actually working on.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS digest_context text;
