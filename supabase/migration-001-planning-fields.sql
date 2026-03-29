-- Migration 001: Add planning system fields to tasks
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- New task fields for the planning system
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_focus boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS planned_date date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES goals(id) ON DELETE SET NULL;

-- Index for planned_date queries (Today view)
CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON tasks(planned_date);
CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE NOT NULL,
  available_hours_weekday numeric DEFAULT 8,
  available_hours_weekend numeric DEFAULT 4,
  shutdown_time time DEFAULT '17:00',
  planning_completed_date date,
  shutdown_completed_date date,
  daily_intention text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable realtime for goals
ALTER PUBLICATION supabase_realtime ADD TABLE goals;
