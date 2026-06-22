-- ============================================================
-- AUDIT LOG — captures every INSERT, UPDATE, DELETE
-- across all critical Belarro tables.
-- Nothing is ever truly deleted — the old data is always here.
-- ============================================================

CREATE TABLE IF NOT EXISTS belarro_v4_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  tbl         TEXT NOT NULL,
  operation   TEXT NOT NULL,  -- INSERT | UPDATE | DELETE
  row_id      TEXT,
  old_data    JSONB,
  new_data    JSONB,
  changed_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tbl        ON belarro_v4_audit_log(tbl);
CREATE INDEX IF NOT EXISTS idx_audit_row_id     ON belarro_v4_audit_log(row_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON belarro_v4_audit_log(changed_at);

ALTER TABLE belarro_v4_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select" ON belarro_v4_audit_log FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_audit_log FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- TRIGGER FUNCTION — one function used by all tables
-- ============================================================

CREATE OR REPLACE FUNCTION belarro_audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO belarro_v4_audit_log(tbl, operation, row_id, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'DELETE', OLD.id::TEXT, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO belarro_v4_audit_log(tbl, operation, row_id, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id::TEXT, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO belarro_v4_audit_log(tbl, operation, row_id, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'INSERT', NEW.id::TEXT, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================
-- ATTACH TRIGGER TO EVERY CRITICAL TABLE
-- ============================================================

-- Crops
DROP TRIGGER IF EXISTS audit_belarro_v4_crop ON belarro_v4_crop;
CREATE TRIGGER audit_belarro_v4_crop
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_crop
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Growth Procedure
DROP TRIGGER IF EXISTS audit_belarro_v4_growth_procedure ON belarro_v4_growth_procedure;
CREATE TRIGGER audit_belarro_v4_growth_procedure
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_growth_procedure
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Product Variants
DROP TRIGGER IF EXISTS audit_belarro_v4_product_variant ON belarro_v4_product_variant;
CREATE TRIGGER audit_belarro_v4_product_variant
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_product_variant
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Customers
DROP TRIGGER IF EXISTS audit_belarro_v4_customer ON belarro_v4_customer;
CREATE TRIGGER audit_belarro_v4_customer
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_customer
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Orders
DROP TRIGGER IF EXISTS audit_belarro_v4_order ON belarro_v4_order;
CREATE TRIGGER audit_belarro_v4_order
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_order
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Standing Orders
DROP TRIGGER IF EXISTS audit_belarro_v4_standing_order ON belarro_v4_standing_order;
CREATE TRIGGER audit_belarro_v4_standing_order
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_standing_order
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Standing Order Items
DROP TRIGGER IF EXISTS audit_belarro_v4_standing_order_item ON belarro_v4_standing_order_item;
CREATE TRIGGER audit_belarro_v4_standing_order_item
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_standing_order_item
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Seed Inventory
DROP TRIGGER IF EXISTS audit_belarro_v4_seed_inventory ON belarro_v4_seed_inventory;
CREATE TRIGGER audit_belarro_v4_seed_inventory
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_seed_inventory
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Packaging Stock
DROP TRIGGER IF EXISTS audit_belarro_v4_packaging_stock ON belarro_v4_packaging_stock;
CREATE TRIGGER audit_belarro_v4_packaging_stock
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_packaging_stock
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Follow Ups
DROP TRIGGER IF EXISTS audit_belarro_v4_follow_up ON belarro_v4_follow_up;
CREATE TRIGGER audit_belarro_v4_follow_up
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_follow_up
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Invoices
DROP TRIGGER IF EXISTS audit_belarro_v4_invoice ON belarro_v4_invoice;
CREATE TRIGGER audit_belarro_v4_invoice
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_invoice
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Seeding Batches
DROP TRIGGER IF EXISTS audit_belarro_v4_seeding_batch ON belarro_v4_seeding_batch;
CREATE TRIGGER audit_belarro_v4_seeding_batch
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_seeding_batch
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();

-- Harvest Records
DROP TRIGGER IF EXISTS audit_belarro_v4_harvest_record ON belarro_v4_harvest_record;
CREATE TRIGGER audit_belarro_v4_harvest_record
  AFTER INSERT OR UPDATE OR DELETE ON belarro_v4_harvest_record
  FOR EACH ROW EXECUTE FUNCTION belarro_audit_trigger();
