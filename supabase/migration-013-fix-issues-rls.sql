-- Migration 013: Fix issues table RLS for PIN-auth
-- The issues table (migration-007) was created with auth.uid() policies,
-- but was missed in migration-010 which fixed all other tables for PIN auth.
-- This caused inserts/selects to silently fail (auth.uid() is always NULL).
--
-- Run this in Supabase SQL Editor

DROP POLICY IF EXISTS "Users can view their own issues" ON issues;
DROP POLICY IF EXISTS "Users can create their own issues" ON issues;
DROP POLICY IF EXISTS "Users can update their own issues" ON issues;
DROP POLICY IF EXISTS "Users can delete their own issues" ON issues;

CREATE POLICY "Allow authenticated access" ON issues FOR ALL USING (true) WITH CHECK (true);
