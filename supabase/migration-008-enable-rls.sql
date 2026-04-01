-- Migration 008: Enable RLS on all public tables
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- IMPORTANT: After running this migration, run the backfill at the bottom
-- to set user_id on existing rows. Replace YOUR_USER_UUID with your auth.users id.

-- ============================================================
-- Step 1: Add user_id columns where missing
-- ============================================================

-- Workspaces needs an owner
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Tags are currently global — scope them to a user
ALTER TABLE tags ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- HubSpot tasks have no user scoping
ALTER TABLE hubspot_tasks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Sync log has no user scoping
ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- Step 2: Enable RLS on all flagged tables
-- ============================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE taggables ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 3: Create RLS policies
-- ============================================================

-- Helper: reusable check for "workspace belongs to me"
-- Used by workspace-scoped tables (clients, projects, tasks, notes, goals)

-- ----- workspaces -----
CREATE POLICY "Users can view own workspaces"
  ON workspaces FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workspaces"
  ON workspaces FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own workspaces"
  ON workspaces FOR DELETE
  USING (user_id = auth.uid());

-- ----- clients -----
CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

-- ----- projects -----
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

-- ----- tasks -----
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

-- ----- notes -----
CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

-- ----- goals -----
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

-- ----- tags -----
CREATE POLICY "Users can view own tags"
  ON tags FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tags"
  ON tags FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tags"
  ON tags FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tags"
  ON tags FOR DELETE
  USING (user_id = auth.uid());

-- ----- taggables -----
-- Taggables are scoped through their parent tag
CREATE POLICY "Users can view own taggables"
  ON taggables FOR SELECT
  USING (tag_id IN (SELECT id FROM tags WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own taggables"
  ON taggables FOR INSERT
  WITH CHECK (tag_id IN (SELECT id FROM tags WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own taggables"
  ON taggables FOR UPDATE
  USING (tag_id IN (SELECT id FROM tags WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own taggables"
  ON taggables FOR DELETE
  USING (tag_id IN (SELECT id FROM tags WHERE user_id = auth.uid()));

-- ----- hubspot_tasks -----
CREATE POLICY "Users can view own hubspot_tasks"
  ON hubspot_tasks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own hubspot_tasks"
  ON hubspot_tasks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own hubspot_tasks"
  ON hubspot_tasks FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own hubspot_tasks"
  ON hubspot_tasks FOR DELETE
  USING (user_id = auth.uid());

-- ----- sync_log -----
CREATE POLICY "Users can view own sync_log"
  ON sync_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sync_log"
  ON sync_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ----- user_settings -----
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- Step 4: Service role bypass policies for server-side operations
-- (API routes use the service role key, which bypasses RLS by default,
--  but these are here in case you switch to per-user tokens server-side)
-- ============================================================

-- Sync operations need service role access
CREATE POLICY "Service role full access to hubspot_tasks"
  ON hubspot_tasks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to sync_log"
  ON sync_log FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Step 5: BACKFILL existing data
-- Replace 'YOUR_USER_UUID' with your actual auth.users UUID
-- Find it: SELECT id FROM auth.users LIMIT 1;
-- ============================================================

-- UNCOMMENT and run after replacing YOUR_USER_UUID:

-- UPDATE workspaces SET user_id = 'YOUR_USER_UUID' WHERE user_id IS NULL;
-- UPDATE tags SET user_id = 'YOUR_USER_UUID' WHERE user_id IS NULL;
-- UPDATE hubspot_tasks SET user_id = 'YOUR_USER_UUID' WHERE user_id IS NULL;
-- UPDATE sync_log SET user_id = 'YOUR_USER_UUID' WHERE user_id IS NULL;

-- After backfill, enforce NOT NULL on user_id:
-- ALTER TABLE workspaces ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE tags ALTER COLUMN user_id SET NOT NULL;
