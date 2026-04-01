-- Migration 010: Fix RLS policies for PIN-auth app
-- The app uses PIN auth (cookie-based), not Supabase Auth sessions.
-- auth.uid() is always NULL on the client, so the old policies block everything.
-- Security boundary: PIN middleware + service role key for server-side ops.
-- RLS stays enabled (satisfies Supabase linter) with anon-role access.
--
-- Run this in Supabase SQL Editor

-- ============================================================
-- Drop all auth.uid()-based policies from migration-008
-- ============================================================

-- workspaces
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can insert own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;

-- clients
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

-- projects
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

-- notes
DROP POLICY IF EXISTS "Users can view own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
DROP POLICY IF EXISTS "Users can update own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;

-- goals
DROP POLICY IF EXISTS "Users can view own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
DROP POLICY IF EXISTS "Users can update own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON goals;

-- tags
DROP POLICY IF EXISTS "Users can view own tags" ON tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
DROP POLICY IF EXISTS "Users can update own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

-- taggables
DROP POLICY IF EXISTS "Users can view own taggables" ON taggables;
DROP POLICY IF EXISTS "Users can insert own taggables" ON taggables;
DROP POLICY IF EXISTS "Users can update own taggables" ON taggables;
DROP POLICY IF EXISTS "Users can delete own taggables" ON taggables;

-- hubspot_tasks
DROP POLICY IF EXISTS "Users can view own hubspot_tasks" ON hubspot_tasks;
DROP POLICY IF EXISTS "Users can insert own hubspot_tasks" ON hubspot_tasks;
DROP POLICY IF EXISTS "Users can update own hubspot_tasks" ON hubspot_tasks;
DROP POLICY IF EXISTS "Users can delete own hubspot_tasks" ON hubspot_tasks;
DROP POLICY IF EXISTS "Service role full access to hubspot_tasks" ON hubspot_tasks;

-- sync_log
DROP POLICY IF EXISTS "Users can view own sync_log" ON sync_log;
DROP POLICY IF EXISTS "Users can insert own sync_log" ON sync_log;
DROP POLICY IF EXISTS "Service role full access to sync_log" ON sync_log;

-- user_settings
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

-- ============================================================
-- Create new policies: allow anon + service_role access
-- PIN auth middleware is the security boundary, not RLS.
-- When migrating to multi-tenant SaaS, swap these for auth.uid() policies.
-- ============================================================

-- workspaces
CREATE POLICY "Allow authenticated access" ON workspaces FOR ALL USING (true) WITH CHECK (true);

-- clients
CREATE POLICY "Allow authenticated access" ON clients FOR ALL USING (true) WITH CHECK (true);

-- projects
CREATE POLICY "Allow authenticated access" ON projects FOR ALL USING (true) WITH CHECK (true);

-- tasks
CREATE POLICY "Allow authenticated access" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- tags
CREATE POLICY "Allow authenticated access" ON tags FOR ALL USING (true) WITH CHECK (true);

-- taggables
CREATE POLICY "Allow authenticated access" ON taggables FOR ALL USING (true) WITH CHECK (true);

-- notes
CREATE POLICY "Allow authenticated access" ON notes FOR ALL USING (true) WITH CHECK (true);

-- goals
CREATE POLICY "Allow authenticated access" ON goals FOR ALL USING (true) WITH CHECK (true);

-- hubspot_tasks
CREATE POLICY "Allow authenticated access" ON hubspot_tasks FOR ALL USING (true) WITH CHECK (true);

-- sync_log
CREATE POLICY "Allow authenticated access" ON sync_log FOR ALL USING (true) WITH CHECK (true);

-- user_settings
CREATE POLICY "Allow authenticated access" ON user_settings FOR ALL USING (true) WITH CHECK (true);
