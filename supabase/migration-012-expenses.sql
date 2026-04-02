-- Migration 012: Recurring expenses tracker
-- Run this in Supabase SQL Editor

CREATE TABLE expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  cost numeric(10,2) NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_expenses_workspace ON expenses(workspace_id);
