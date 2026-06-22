ALTER TABLE belarro_v4_product_variant
  ADD COLUMN IF NOT EXISTS container_size TEXT,
  ADD COLUMN IF NOT EXISTS container_qty INTEGER DEFAULT 1;
