-- Migration 005: Create storage bucket for workspace logos
-- Run this in Supabase SQL Editor

insert into storage.buckets (id, name, public)
values ('workspace-assets', 'workspace-assets', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload
create policy "Authenticated users can upload workspace assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'workspace-assets');

-- Allow authenticated users to update (upsert)
create policy "Authenticated users can update workspace assets"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'workspace-assets');

-- Public read access
create policy "Public can view workspace assets"
  on storage.objects for select
  to public
  using (bucket_id = 'workspace-assets');
