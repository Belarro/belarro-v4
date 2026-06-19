-- ============================================================================
-- SPRINT 3 / PHASE 1 — DATA MIGRATION  belarro_v3_*  ->  belarro_v4_*
-- ============================================================================
-- Copies live data from the v3 schema into the v4 schema, accounting for the
-- column renames/restructures between versions. Honest about what does NOT map
-- (no invented values).
--
-- SAFETY:
--   * Wrapped in BEGIN ... (ROLLBACK by default). Change the final ROLLBACK to
--     COMMIT only after the row-count assertions pass on staging.
--   * Row-count assertions abort the transaction if v3 source count != v4 dest
--     inserted count for each table.
--   * v4 tables must already exist (SUPABASE_SETUP*.sql) and SHOULD be empty.
--     Re-running is guarded with ON CONFLICT (id) DO NOTHING so a partial retry
--     is safe.
--
-- KNOWN SCHEMA DIFFERENCES (v3 -> v4):
--   crop:
--     v3.photo_url            -> v4.image_url
--     v3.flavor               -> v4.flavor_en           (single flavor; flavor_de left NULL)
--     v3.name_en/name_de      -> v4.name_en/name_de     (1:1)
--     v3.seeds_per_tray, yield_per_tray, total_growth_days,
--        seeding_schedule     -> DROPPED in v4 (moved to growth_procedure model)
--     v3.deleted_at           -> v4.deleted_at          (1:1)
--   product_variant:
--     v3.price_eur (NOT NULL) -> v4.price_eur (nullable) (1:1)
--     v3.container_qty        -> DROPPED in v4
--     v4.is_internal          -> NEW, defaulted false (no v3 source)
--   size_template:
--     v3.belarro_v3_size_template has NO v4 equivalent table. Its rows are a
--     global size catalogue, not per-crop variants, so they are NOT migrated
--     automatically. Handle manually if needed.
--   All other tables (customer, order, seeding_batch, harvest_record,
--   order_fulfillment, invoice, standing_order, standing_order_item,
--   follow_up, visit, seed/sample/package_inventory, seed_usage_log) are
--   column-compatible 1:1.
-- ============================================================================

BEGIN;

-- Helper: assert two integers are equal or abort.
CREATE OR REPLACE FUNCTION pg_temp.assert_eq(label TEXT, expected BIGINT, actual BIGINT)
RETURNS VOID AS $$
BEGIN
  IF expected IS DISTINCT FROM actual THEN
    RAISE EXCEPTION 'MIGRATION ASSERT FAILED [%]: expected % rows, got %', label, expected, actual;
  END IF;
  RAISE NOTICE 'OK [%]: % rows', label, actual;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- CROPS
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_crop (id, name_en, name_de, flavor_en, flavor_de, status, image_url, created_at, updated_at, deleted_at)
  SELECT id, name_en, name_de, flavor, NULL, COALESCE(status, 'active'), photo_url, created_at, updated_at, deleted_at
  FROM belarro_v3_crop
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('crop',
  (SELECT count(*) FROM belarro_v3_crop),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- PRODUCT VARIANTS
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_product_variant (id, crop_id, size_name, size_grams, price_eur, is_internal, created_at, updated_at)
  SELECT id, crop_id, size_name, size_grams, price_eur, false, created_at, updated_at
  FROM belarro_v3_product_variant
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('product_variant',
  (SELECT count(*) FROM belarro_v3_product_variant),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- CUSTOMERS
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_customer (id, name, restaurant_name, contact_person, address, city, email, whatsapp, phone, status, net_days, first_contact_date, created_at, updated_at)
  SELECT id, name, restaurant_name, contact_person, address, city, email, whatsapp, phone, status, net_days, first_contact_date, created_at, updated_at
  FROM belarro_v3_customer
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('customer',
  (SELECT count(*) FROM belarro_v3_customer),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- VISITS
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_visit (id, customer_id, visit_date, notes, created_at, updated_at)
  SELECT id, customer_id, visit_date, notes, created_at, updated_at
  FROM belarro_v3_visit
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('visit',
  (SELECT count(*) FROM belarro_v3_visit),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- FOLLOW-UPS
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_follow_up (id, customer_id, follow_up_number, follow_up_days, due_date, status, sent_via, sent_date, notes, created_at, updated_at)
  SELECT id, customer_id, follow_up_number, follow_up_days, due_date, status, sent_via, sent_date, notes, created_at, updated_at
  FROM belarro_v3_follow_up
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('follow_up',
  (SELECT count(*) FROM belarro_v3_follow_up),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_order (id, customer_id, product_variant_id, quantity, order_date, next_delivery_date, expected_harvest_date, status, recurring, created_at, updated_at)
  SELECT id, customer_id, product_variant_id, quantity, order_date, next_delivery_date, expected_harvest_date, status, recurring, created_at, updated_at
  FROM belarro_v3_order
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('order',
  (SELECT count(*) FROM belarro_v3_order),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- SEEDING BATCHES
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_seeding_batch (id, crop_id, seeding_date, quantity_trays, batch_type, expected_harvest_date, created_at, updated_at)
  SELECT id, crop_id, seeding_date, quantity_trays, batch_type, expected_harvest_date, created_at, updated_at
  FROM belarro_v3_seeding_batch
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('seeding_batch',
  (SELECT count(*) FROM belarro_v3_seeding_batch),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- HARVEST RECORDS
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_harvest_record (id, seeding_batch_id, harvest_date, actual_yield_grams, yield_used_for_orders_grams, yield_available_samples_grams, notes, created_at, updated_at)
  SELECT id, seeding_batch_id, harvest_date, actual_yield_grams, yield_used_for_orders_grams, yield_available_samples_grams, notes, created_at, updated_at
  FROM belarro_v3_harvest_record
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('harvest_record',
  (SELECT count(*) FROM belarro_v3_harvest_record),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- ORDER FULFILLMENT
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_order_fulfillment (id, order_id, harvest_record_id, allocated_grams, packed_date, delivery_date, delivered, delivery_notes, created_at, updated_at)
  SELECT id, order_id, harvest_record_id, allocated_grams, packed_date, delivery_date, delivered, delivery_notes, created_at, updated_at
  FROM belarro_v3_order_fulfillment
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('order_fulfillment',
  (SELECT count(*) FROM belarro_v3_order_fulfillment),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- INVOICES
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_invoice (id, customer_id, invoice_month, total_amount_eur, vat_amount_eur, status, sent_at, paid_at, created_at, updated_at)
  SELECT id, customer_id, invoice_month, total_amount_eur, vat_amount_eur, status, sent_at, paid_at, created_at, updated_at
  FROM belarro_v3_invoice
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('invoice',
  (SELECT count(*) FROM belarro_v3_invoice),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- SEED USAGE LOG
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_seed_usage_log (id, crop_id, quantity_used_grams, trays_seeded, seeded_date, created_at)
  SELECT id, crop_id, quantity_used_grams, trays_seeded, seeded_date, created_at
  FROM belarro_v3_seed_usage_log
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('seed_usage_log',
  (SELECT count(*) FROM belarro_v3_seed_usage_log),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- STANDING ORDERS + ITEMS
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_standing_order (id, customer_id, status, notes, created_at, updated_at)
  SELECT id, customer_id, status, notes, created_at, updated_at
  FROM belarro_v3_standing_order
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('standing_order',
  (SELECT count(*) FROM belarro_v3_standing_order),
  (SELECT count(*) FROM ins));

WITH ins AS (
  INSERT INTO belarro_v4_standing_order_item (id, standing_order_id, variant_id, size_name, quantity, price_at_time_eur, delivery_day_of_week, created_at, updated_at)
  SELECT id, standing_order_id, variant_id, size_name, quantity, price_at_time_eur, delivery_day_of_week, created_at, updated_at
  FROM belarro_v3_standing_order_item
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('standing_order_item',
  (SELECT count(*) FROM belarro_v3_standing_order_item),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- INVENTORY (seed / sample / package)
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_seed_inventory (id, crop_id, quantity_grams, reorder_threshold_trays, last_purchase_date, last_purchase_qty_grams, created_at, updated_at)
  SELECT id, crop_id, quantity_grams, reorder_threshold_trays, last_purchase_date, last_purchase_qty_grams, created_at, updated_at
  FROM belarro_v3_seed_inventory
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('seed_inventory',
  (SELECT count(*) FROM belarro_v3_seed_inventory),
  (SELECT count(*) FROM ins));

WITH ins AS (
  INSERT INTO belarro_v4_sample_inventory (id, crop_id, available_grams, created_at, updated_at)
  SELECT id, crop_id, available_grams, created_at, updated_at
  FROM belarro_v3_sample_inventory
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('sample_inventory',
  (SELECT count(*) FROM belarro_v3_sample_inventory),
  (SELECT count(*) FROM ins));

WITH ins AS (
  INSERT INTO belarro_v4_package_inventory (id, variant_id, quantity_available, reorder_threshold, created_at, updated_at)
  SELECT id, variant_id, quantity_available, reorder_threshold, created_at, updated_at
  FROM belarro_v3_package_inventory
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('package_inventory',
  (SELECT count(*) FROM belarro_v3_package_inventory),
  (SELECT count(*) FROM ins));

-- ---------------------------------------------------------------------------
-- SALES VISITS
-- ---------------------------------------------------------------------------
WITH ins AS (
  INSERT INTO belarro_v4_sales_visit (id, customer_id, visit_date, outcome, notes, created_at, updated_at)
  SELECT id, customer_id, visit_date, outcome, notes, created_at, updated_at
  FROM belarro_v3_sales_visit
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
)
SELECT pg_temp.assert_eq('sales_visit',
  (SELECT count(*) FROM belarro_v3_sales_visit),
  (SELECT count(*) FROM ins));

-- ============================================================================
-- FINAL HARNESS
-- ============================================================================
-- Default is ROLLBACK so this script is a safe dry-run. After all assertions
-- print "OK [...]" on staging, change ROLLBACK -> COMMIT for the real run.
ROLLBACK;
-- COMMIT;
