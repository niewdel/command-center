-- Migration 016: Re-harden RLS after Supabase Auth session is established on PIN login
--
-- Prerequisite: PIN login route now calls supabase.auth.signInWithPassword().
-- Every authenticated browser request has a valid auth.uid(). This migration
-- replaces the permissive "PIN-auth access" policies from migration 015 with
-- user-scoped policies identical to the 2026-04-22 harden migration.
--
-- ORDER OF DEPLOYMENT (do not skip):
--   1. Deploy code changes (PIN route + middleware sign-in).
--   2. Set SUPABASE_USER_EMAIL + SUPABASE_USER_PASSWORD env vars on Railway.
--   3. Log in via PIN on at least one device; confirm data still loads.
--   4. Run this migration.
-- If run before step 3, authenticated sessions that haven't yet signed in will
-- silently see empty data until they hit the middleware and get auto-signed in.

-- ============================================================
-- 1. Drop permissive PIN-auth policies from migration 015
-- ============================================================
DROP POLICY IF EXISTS "PIN-auth access" ON public.ai_command_log;
DROP POLICY IF EXISTS "PIN-auth access" ON public.calendar_connections;
DROP POLICY IF EXISTS "PIN-auth access" ON public.calendar_events;
DROP POLICY IF EXISTS "PIN-auth access" ON public.clients;
DROP POLICY IF EXISTS "PIN-auth access" ON public.content_digests;
DROP POLICY IF EXISTS "PIN-auth access" ON public.email_connections;
DROP POLICY IF EXISTS "PIN-auth access" ON public.expenses;
DROP POLICY IF EXISTS "PIN-auth access" ON public.goals;
DROP POLICY IF EXISTS "PIN-auth access" ON public.hubspot_tasks;
DROP POLICY IF EXISTS "PIN-auth access" ON public.inbox_items;
DROP POLICY IF EXISTS "PIN-auth access" ON public.issues;
DROP POLICY IF EXISTS "PIN-auth access" ON public.news_stories;
DROP POLICY IF EXISTS "PIN-auth access" ON public.news_topics;
DROP POLICY IF EXISTS "PIN-auth access" ON public.notes;
DROP POLICY IF EXISTS "PIN-auth access" ON public.projects;
DROP POLICY IF EXISTS "PIN-auth access" ON public.routine_blocks;
DROP POLICY IF EXISTS "PIN-auth access" ON public.routine_templates;
DROP POLICY IF EXISTS "PIN-auth access" ON public.sync_log;
DROP POLICY IF EXISTS "PIN-auth access" ON public.taggables;
DROP POLICY IF EXISTS "PIN-auth access" ON public.tags;
DROP POLICY IF EXISTS "PIN-auth access" ON public.tasks;
DROP POLICY IF EXISTS "PIN-auth access" ON public.user_settings;
DROP POLICY IF EXISTS "PIN-auth access" ON public.workspaces;
-- Lead-gen tables (added in migration 017)
DROP POLICY IF EXISTS "PIN-auth access" ON public.organizations;
DROP POLICY IF EXISTS "PIN-auth access" ON public.verticals;
DROP POLICY IF EXISTS "PIN-auth access" ON public.companies;
DROP POLICY IF EXISTS "PIN-auth access" ON public.contacts;
DROP POLICY IF EXISTS "PIN-auth access" ON public.sequences;
DROP POLICY IF EXISTS "PIN-auth access" ON public.outreach_emails;
DROP POLICY IF EXISTS "PIN-auth access" ON public.pipeline_log;
DROP POLICY IF EXISTS "PIN-auth access" ON public.lead_jobs;

-- ============================================================
-- 2. Direct user_id policies
-- ============================================================

CREATE POLICY "Users manage own workspaces" ON public.workspaces
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own settings" ON public.user_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own digests" ON public.content_digests
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own issues" ON public.issues
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own sync log" ON public.sync_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own tags" ON public.tags
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own hubspot tasks" ON public.hubspot_tasks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own inbox items" ON public.inbox_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own email connections" ON public.email_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own calendar connections" ON public.calendar_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own calendar events" ON public.calendar_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own ai command log" ON public.ai_command_log
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own routine templates" ON public.routine_templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. Workspace-scoped policies (join through workspaces.user_id)
-- ============================================================

CREATE POLICY "Users manage clients in own workspaces" ON public.clients
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users manage projects in own workspaces" ON public.projects
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users manage tasks in own workspaces" ON public.tasks
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users manage notes in own workspaces" ON public.notes
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users manage goals in own workspaces" ON public.goals
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users manage expenses in own workspaces" ON public.expenses
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid()));

-- ============================================================
-- 4. Indirectly-scoped policies
-- ============================================================

CREATE POLICY "Users manage own taggables" ON public.taggables
  FOR ALL TO authenticated
  USING (tag_id IN (SELECT id FROM public.tags WHERE user_id = auth.uid()))
  WITH CHECK (tag_id IN (SELECT id FROM public.tags WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own routine blocks" ON public.routine_blocks
  FOR ALL TO authenticated
  USING (template_id IN (SELECT id FROM public.routine_templates WHERE user_id = auth.uid()))
  WITH CHECK (template_id IN (SELECT id FROM public.routine_templates WHERE user_id = auth.uid()));

-- ============================================================
-- 5. News tables (shared across tenants for now)
-- ============================================================

CREATE POLICY "Authenticated users access news topics" ON public.news_topics
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users access news stories" ON public.news_stories
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. Lead-gen tables (added in migration 017) — scoped via organizations.user_id
-- ============================================================

CREATE POLICY "Users manage own organizations" ON public.organizations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- All lead-gen child tables join through organizations.user_id
CREATE POLICY "Users manage verticals in own org" ON public.verticals
  FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users manage companies in own org" ON public.companies
  FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users manage contacts in own org" ON public.contacts
  FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users manage sequences in own org" ON public.sequences
  FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users manage outreach emails in own org" ON public.outreach_emails
  FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users view pipeline log in own org" ON public.pipeline_log
  FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own lead jobs" ON public.lead_jobs
  FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.organizations WHERE user_id = auth.uid()));
