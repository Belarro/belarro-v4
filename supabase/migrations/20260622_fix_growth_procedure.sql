-- Drop and recreate belarro_v4_growth_procedure with correct columns only.
-- All crop procedures will need to be re-entered via the Grow Procedure page.

DROP TABLE IF EXISTS belarro_v4_growth_procedure CASCADE;

CREATE TABLE belarro_v4_growth_procedure (
  id TEXT PRIMARY KEY,
  crop_id TEXT UNIQUE NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
  soak_enabled BOOLEAN DEFAULT false,
  soak_hours INTEGER,
  soak_notes TEXT,
  cover_soil_enabled BOOLEAN DEFAULT false,
  cover_soil_notes TEXT,
  stack_enabled BOOLEAN DEFAULT false,
  stack_days INTEGER,
  stack_notes TEXT,
  blackout_enabled BOOLEAN DEFAULT false,
  blackout_days INTEGER,
  blackout_notes TEXT,
  light_enabled BOOLEAN DEFAULT true,
  light_days INTEGER,
  light_notes TEXT,
  humidity_dome_enabled BOOLEAN DEFAULT false,
  humidity_dome_days INTEGER,
  humidity_dome_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_growth_procedure_crop_id ON belarro_v4_growth_procedure(crop_id);

ALTER TABLE belarro_v4_growth_procedure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select" ON belarro_v4_growth_procedure FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_growth_procedure FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_growth_procedure FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_growth_procedure FOR DELETE TO anon USING (true);
