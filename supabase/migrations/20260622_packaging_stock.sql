CREATE TABLE IF NOT EXISTS belarro_v4_packaging_stock (
  id TEXT PRIMARY KEY,
  size_name TEXT NOT NULL UNIQUE,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE belarro_v4_packaging_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select" ON belarro_v4_packaging_stock FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_packaging_stock FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_packaging_stock FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_packaging_stock FOR DELETE TO anon USING (true);

-- Seed with your current sizes
INSERT INTO belarro_v4_packaging_stock (id, size_name, quantity) VALUES
  (gen_random_uuid()::text, '2000ml', 0),
  (gen_random_uuid()::text, '750ml', 0),
  (gen_random_uuid()::text, '500ml', 0),
  (gen_random_uuid()::text, '375ml', 0)
ON CONFLICT (size_name) DO NOTHING;
