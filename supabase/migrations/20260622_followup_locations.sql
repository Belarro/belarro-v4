-- Add location_id to follow_up table to support locations table as lead source
ALTER TABLE belarro_v4_follow_up
  ADD COLUMN IF NOT EXISTS location_id TEXT;

-- Drop the foreign key constraint on customer_id so location-based follow-ups can be inserted
ALTER TABLE belarro_v4_follow_up
  DROP CONSTRAINT IF EXISTS belarro_v4_follow_up_customer_id_fkey;

-- Make customer_id nullable
ALTER TABLE belarro_v4_follow_up
  ALTER COLUMN customer_id DROP NOT NULL;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_followup_location_id ON belarro_v4_follow_up(location_id);
