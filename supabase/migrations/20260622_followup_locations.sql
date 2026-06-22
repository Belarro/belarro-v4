-- Add location_id to follow_up table to support locations table as lead source
ALTER TABLE belarro_v4_follow_up
  ADD COLUMN IF NOT EXISTS location_id TEXT;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_followup_location_id ON belarro_v4_follow_up(location_id);
