-- Belarro V4 Database Setup
-- Execute this in Supabase SQL Editor

-- Drop existing tables if they exist
DROP TABLE IF EXISTS belarro_v4_product_variant CASCADE;
DROP TABLE IF EXISTS belarro_v4_growth_procedure CASCADE;
DROP TABLE IF EXISTS belarro_v4_crop CASCADE;

-- Create Crops table
CREATE TABLE belarro_v4_crop (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_de TEXT NOT NULL,
  flavor_en TEXT,
  flavor_de TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create Growth Procedure table
CREATE TABLE belarro_v4_growth_procedure (
  id TEXT PRIMARY KEY,
  crop_id TEXT UNIQUE NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
  soak_enabled BOOLEAN DEFAULT false,
  soak_hours INTEGER,
  cover_soil_enabled BOOLEAN DEFAULT false,
  stack_enabled BOOLEAN DEFAULT false,
  stack_days INTEGER,
  growth_env_type TEXT CHECK (growth_env_type IN ('light', 'blackout', 'humidity_dome')),
  growth_env_days INTEGER,
  humidity_dome_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Product Variants table
CREATE TABLE belarro_v4_product_variant (
  id TEXT PRIMARY KEY,
  crop_id TEXT NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
  size_name TEXT NOT NULL,
  size_grams FLOAT NOT NULL,
  price_eur FLOAT,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(crop_id, size_name)
);

-- Create Indexes
CREATE INDEX idx_crop_status ON belarro_v4_crop(status);
CREATE INDEX idx_crop_deleted_at ON belarro_v4_crop(deleted_at);
CREATE INDEX idx_growth_procedure_crop_id ON belarro_v4_growth_procedure(crop_id);
CREATE INDEX idx_product_variant_crop_id ON belarro_v4_product_variant(crop_id);

-- Enable Row Level Security
ALTER TABLE belarro_v4_crop ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_growth_procedure ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_product_variant ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for anonymous access (development)
CREATE POLICY "Allow anon select" ON belarro_v4_crop FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_crop FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_crop FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_crop FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_growth_procedure FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_growth_procedure FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_growth_procedure FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_growth_procedure FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_product_variant FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_product_variant FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_product_variant FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_product_variant FOR DELETE TO anon USING (true);

-- Done! Tables are ready.
