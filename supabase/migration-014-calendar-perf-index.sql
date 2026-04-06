-- Partial index for fast duplicate detection during ICS sync
-- Used when checking if a local event matches an incoming synced event
CREATE INDEX IF NOT EXISTS idx_calendar_events_title_start_local
  ON calendar_events(title, start_time)
  WHERE connection_id IS NULL;
