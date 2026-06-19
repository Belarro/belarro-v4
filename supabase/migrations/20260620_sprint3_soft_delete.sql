-- ============================================================================
-- SPRINT 3 / PHASE 2 — SOFT DELETE ENFORCEMENT
-- ============================================================================
-- Data Protection Mandate: never hard-delete user data. EVER.
--
-- This migration:
--   1. Adds deleted_at to every user-data table that the app deletes from.
--   2. Indexes deleted_at for fast "WHERE deleted_at IS NULL" filtering.
--   3. Installs a BEFORE DELETE trigger that aborts ANY hard DELETE, so even a
--      stray SQL statement or a future code regression cannot destroy data.
--
-- Run order: AFTER SUPABASE_SETUP_EXTENDED.sql has created the base tables.
-- Idempotent: safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ADD deleted_at COLUMNS
-- ---------------------------------------------------------------------------
-- belarro_v4_crop already has deleted_at (added in an earlier sprint). The rest
-- get it here. We also cover the child tables that the app "replaces" by delete
-- + re-insert (product_variant, standing_order_item) so the no-hard-delete
-- trigger below cannot break those flows.

ALTER TABLE belarro_v4_product_variant     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE belarro_v4_customer            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE belarro_v4_order               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE belarro_v4_invoice             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE belarro_v4_seeding_batch       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE belarro_v4_harvest_record      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE belarro_v4_standing_order      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE belarro_v4_standing_order_item ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- NOTE on the brief's table list: belarro_v4_size_template does NOT exist in v4.
-- "Size templates" are stored as rows in belarro_v4_product_variant (see
-- app/api/size-templates/route.ts), which is covered above. Nothing to add.

-- ---------------------------------------------------------------------------
-- 2. INDEXES for fast soft-delete filtering
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_v4_product_variant_deleted_at     ON belarro_v4_product_variant(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v4_customer_deleted_at            ON belarro_v4_customer(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v4_order_deleted_at               ON belarro_v4_order(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v4_invoice_deleted_at             ON belarro_v4_invoice(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v4_seeding_batch_deleted_at       ON belarro_v4_seeding_batch(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v4_harvest_record_deleted_at      ON belarro_v4_harvest_record(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v4_standing_order_deleted_at      ON belarro_v4_standing_order(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v4_standing_order_item_deleted_at ON belarro_v4_standing_order_item(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v4_crop_deleted_at                ON belarro_v4_crop(deleted_at);

-- ---------------------------------------------------------------------------
-- 3. NO-HARD-DELETE TRIGGER
-- ---------------------------------------------------------------------------
-- Any attempt to physically DELETE a row raises an exception. The application
-- "deletes" by setting deleted_at via UPDATE, which is unaffected.
--
-- Emergency override (admin only, e.g. GDPR erasure during a maintenance
-- window): SET session belarro.allow_hard_delete = 'on'; before the DELETE.

CREATE OR REPLACE FUNCTION prevent_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('belarro.allow_hard_delete', true) = 'on' THEN
    RETURN OLD;  -- explicit, audited override
  END IF;
  RAISE EXCEPTION
    'Hard deletes are forbidden on %. Use soft delete: UPDATE % SET deleted_at = now().',
    TG_TABLE_NAME, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

-- Attach to all 8 protected tables (drop-then-create for idempotency).
DROP TRIGGER IF EXISTS no_hard_delete_product_variant     ON belarro_v4_product_variant;
DROP TRIGGER IF EXISTS no_hard_delete_customer            ON belarro_v4_customer;
DROP TRIGGER IF EXISTS no_hard_delete_order               ON belarro_v4_order;
DROP TRIGGER IF EXISTS no_hard_delete_invoice             ON belarro_v4_invoice;
DROP TRIGGER IF EXISTS no_hard_delete_seeding_batch       ON belarro_v4_seeding_batch;
DROP TRIGGER IF EXISTS no_hard_delete_harvest_record      ON belarro_v4_harvest_record;
DROP TRIGGER IF EXISTS no_hard_delete_standing_order      ON belarro_v4_standing_order;
DROP TRIGGER IF EXISTS no_hard_delete_standing_order_item ON belarro_v4_standing_order_item;
DROP TRIGGER IF EXISTS no_hard_delete_crop                ON belarro_v4_crop;

CREATE TRIGGER no_hard_delete_product_variant     BEFORE DELETE ON belarro_v4_product_variant     FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER no_hard_delete_customer            BEFORE DELETE ON belarro_v4_customer            FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER no_hard_delete_order               BEFORE DELETE ON belarro_v4_order               FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER no_hard_delete_invoice             BEFORE DELETE ON belarro_v4_invoice             FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER no_hard_delete_seeding_batch       BEFORE DELETE ON belarro_v4_seeding_batch       FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER no_hard_delete_harvest_record      BEFORE DELETE ON belarro_v4_harvest_record      FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER no_hard_delete_standing_order      BEFORE DELETE ON belarro_v4_standing_order      FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER no_hard_delete_standing_order_item BEFORE DELETE ON belarro_v4_standing_order_item FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER no_hard_delete_crop                BEFORE DELETE ON belarro_v4_crop                FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

COMMIT;
