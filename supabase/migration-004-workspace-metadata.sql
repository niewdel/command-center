-- Migration 004: Add metadata columns to workspaces for dynamic workspace management
-- Run this in Supabase SQL Editor

alter table workspaces add column if not exists color text default 'bg-slate-500';
alter table workspaces add column if not exists description text;
alter table workspaces add column if not exists logo_url text;
alter table workspaces add column if not exists icon text default 'briefcase';
alter table workspaces add column if not exists position integer default 0;

-- Backfill existing workspaces
update workspaces set color = 'bg-violet-500', description = 'AI & Automation Consulting', icon = 'briefcase', position = 0 where slug = 'niewdel';
update workspaces set color = 'bg-emerald-500', description = 'Sandler Sales Training Franchise', logo_url = '/logos/i10-logo.png', icon = 'building', position = 1 where slug = 'i10';
update workspaces set color = 'bg-amber-500', description = 'Personal tasks, notes & goals', icon = 'user', position = 2 where slug = 'personal';
