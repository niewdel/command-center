-- Migration 015: Restore PIN-auth-compatible RLS policies
--
-- Context: migration 20260422233448 ("harden_rls_across_public_schema") replaced
-- the permissive policies from migration-010 with {authenticated} + auth.uid()
-- policies. This app uses PIN auth (cookie `cc-auth`) and does NOT create a
-- Supabase Auth session, so auth.uid() is always NULL on the client and every
-- query returns []. This migration restores working behavior.
--
-- Security boundary: PIN middleware (src/middleware.ts) + service role key
-- for server-side ops. RLS stays enabled on every table (linter-clean).
-- This is a STOPGAP — a follow-up migration will introduce real Supabase Auth
-- via the PIN login route, at which point these permissive policies should be
-- replaced with the auth.uid()-scoped policies from the harden migration.

-- ============================================================
-- Drop all existing policies (both hardened and legacy)
-- ============================================================

-- ai_command_log
DROP POLICY IF EXISTS "Users manage own ai command log" ON public.ai_command_log;

-- calendar_connections
DROP POLICY IF EXISTS "Users manage own calendar connections" ON public.calendar_connections;

-- calendar_events
DROP POLICY IF EXISTS "Users manage own calendar events" ON public.calendar_events;

-- clients
DROP POLICY IF EXISTS "Users manage clients in own workspaces" ON public.clients;

-- content_digests
DROP POLICY IF EXISTS "Users manage own digests" ON public.content_digests;

-- email_connections
DROP POLICY IF EXISTS "Users can view own email connections" ON public.email_connections;
DROP POLICY IF EXISTS "Users can insert own email connections" ON public.email_connections;
DROP POLICY IF EXISTS "Users can update own email connections" ON public.email_connections;
DROP POLICY IF EXISTS "Users can delete own email connections" ON public.email_connections;

-- expenses
DROP POLICY IF EXISTS "Users manage expenses in own workspaces" ON public.expenses;

-- goals
DROP POLICY IF EXISTS "Users manage goals in own workspaces" ON public.goals;

-- hubspot_tasks
DROP POLICY IF EXISTS "Users manage own hubspot tasks" ON public.hubspot_tasks;

-- inbox_items
DROP POLICY IF EXISTS "Users can view own inbox items" ON public.inbox_items;
DROP POLICY IF EXISTS "Users can update own inbox items" ON public.inbox_items;
DROP POLICY IF EXISTS "Users insert own inbox items" ON public.inbox_items;
DROP POLICY IF EXISTS "Users delete own inbox items" ON public.inbox_items;

-- issues
DROP POLICY IF EXISTS "Users manage own issues" ON public.issues;

-- news_stories
DROP POLICY IF EXISTS "Authenticated users access news stories" ON public.news_stories;

-- news_topics
DROP POLICY IF EXISTS "Authenticated users access news topics" ON public.news_topics;

-- notes
DROP POLICY IF EXISTS "Users manage notes in own workspaces" ON public.notes;

-- projects
DROP POLICY IF EXISTS "Users manage projects in own workspaces" ON public.projects;

-- routine_blocks
DROP POLICY IF EXISTS "Users manage own routine blocks" ON public.routine_blocks;

-- routine_templates
DROP POLICY IF EXISTS "Users manage own routine templates" ON public.routine_templates;

-- sync_log
DROP POLICY IF EXISTS "Users view own sync log" ON public.sync_log;

-- taggables
DROP POLICY IF EXISTS "Users manage own taggables" ON public.taggables;

-- tags
DROP POLICY IF EXISTS "Users manage own tags" ON public.tags;

-- tasks
DROP POLICY IF EXISTS "Users manage tasks in own workspaces" ON public.tasks;

-- user_settings
DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;

-- workspaces
DROP POLICY IF EXISTS "Users manage own workspaces" ON public.workspaces;

-- ============================================================
-- Create permissive PIN-auth policies (anon + authenticated)
-- ============================================================

CREATE POLICY "PIN-auth access" ON public.ai_command_log       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.calendar_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.calendar_events      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.clients              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.content_digests      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.email_connections    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.expenses             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.goals                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.hubspot_tasks        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.inbox_items          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.issues               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.news_stories         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.news_topics          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.notes                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.projects             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.routine_blocks       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.routine_templates    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.sync_log             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.taggables            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.tags                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.tasks                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.user_settings        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "PIN-auth access" ON public.workspaces           FOR ALL USING (true) WITH CHECK (true);
