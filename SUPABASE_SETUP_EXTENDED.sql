-- Belarro V4 Database Setup - Extended Tables
-- Execute this to add Customers, Orders, Inventory, Invoices, Seeding & Harvest tracking

-- Drop existing tables if they exist (cascade handles relationships)
DROP TABLE IF EXISTS belarro_v4_message CASCADE;
DROP TABLE IF EXISTS belarro_v4_sales_visit CASCADE;
DROP TABLE IF EXISTS belarro_v4_standing_order_item CASCADE;
DROP TABLE IF EXISTS belarro_v4_standing_order CASCADE;
DROP TABLE IF EXISTS belarro_v4_seed_usage_log CASCADE;
DROP TABLE IF EXISTS belarro_v4_invoice CASCADE;
DROP TABLE IF EXISTS belarro_v4_order_fulfillment CASCADE;
DROP TABLE IF EXISTS belarro_v4_harvest_record CASCADE;
DROP TABLE IF EXISTS belarro_v4_seeding_batch CASCADE;
DROP TABLE IF EXISTS belarro_v4_order CASCADE;
DROP TABLE IF EXISTS belarro_v4_follow_up CASCADE;
DROP TABLE IF EXISTS belarro_v4_visit CASCADE;
DROP TABLE IF EXISTS belarro_v4_customer CASCADE;
DROP TABLE IF EXISTS belarro_v4_sample_inventory CASCADE;
DROP TABLE IF EXISTS belarro_v4_package_inventory CASCADE;
DROP TABLE IF EXISTS belarro_v4_seed_inventory CASCADE;
DROP TABLE IF EXISTS belarro_v4_audit_log CASCADE;

-- ============================================
-- INVENTORY
-- ============================================

CREATE TABLE belarro_v4_seed_inventory (
  id TEXT PRIMARY KEY,
  crop_id TEXT UNIQUE NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
  quantity_grams FLOAT DEFAULT 0,
  reorder_threshold_trays INTEGER DEFAULT 20,
  last_purchase_date TIMESTAMP WITH TIME ZONE,
  last_purchase_qty_grams FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE belarro_v4_package_inventory (
  id TEXT PRIMARY KEY,
  variant_id TEXT UNIQUE NOT NULL REFERENCES belarro_v4_product_variant(id) ON DELETE CASCADE,
  quantity_available INTEGER DEFAULT 0,
  reorder_threshold INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE belarro_v4_sample_inventory (
  id TEXT PRIMARY KEY,
  crop_id TEXT UNIQUE NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
  available_grams FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- CUSTOMERS & RELATIONSHIPS
-- ============================================

CREATE TABLE belarro_v4_customer (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  restaurant_name TEXT,
  contact_person TEXT,
  address TEXT,
  city TEXT,
  email TEXT,
  whatsapp TEXT,
  phone TEXT,
  status TEXT DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'paused', 'inactive')),
  net_days INTEGER DEFAULT 30,
  first_contact_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE belarro_v4_visit (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES belarro_v4_customer(id) ON DELETE CASCADE,
  visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE belarro_v4_follow_up (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES belarro_v4_customer(id) ON DELETE CASCADE,
  follow_up_number INTEGER NOT NULL,
  follow_up_days INTEGER NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed')),
  sent_via TEXT CHECK (sent_via IN ('whatsapp', 'email', 'call', 'visit')),
  sent_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- ORDERS & FULFILLMENT
-- ============================================

CREATE TABLE belarro_v4_order (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES belarro_v4_customer(id) ON DELETE CASCADE,
  product_variant_id TEXT NOT NULL REFERENCES belarro_v4_product_variant(id) ON DELETE CASCADE,
  quantity FLOAT NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE NOT NULL,
  next_delivery_date TIMESTAMP WITH TIME ZONE,
  expected_harvest_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending_seed' CHECK (status IN ('pending_seed', 'growing', 'ready_harvest', 'packed', 'delivered', 'partial_delivery', 'cancelled')),
  recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- SEEDING & HARVESTING
-- ============================================

CREATE TABLE belarro_v4_seeding_batch (
  id TEXT PRIMARY KEY,
  crop_id TEXT NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
  seeding_date TIMESTAMP WITH TIME ZONE NOT NULL,
  quantity_trays INTEGER NOT NULL,
  batch_type TEXT CHECK (batch_type IN ('order', 'sample')),
  expected_harvest_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE belarro_v4_harvest_record (
  id TEXT PRIMARY KEY,
  seeding_batch_id TEXT NOT NULL REFERENCES belarro_v4_seeding_batch(id) ON DELETE CASCADE,
  harvest_date TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_yield_grams FLOAT NOT NULL,
  yield_used_for_orders_grams FLOAT DEFAULT 0,
  yield_available_samples_grams FLOAT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE belarro_v4_order_fulfillment (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES belarro_v4_order(id) ON DELETE CASCADE,
  harvest_record_id TEXT NOT NULL REFERENCES belarro_v4_harvest_record(id) ON DELETE CASCADE,
  allocated_grams FLOAT NOT NULL,
  packed_date TIMESTAMP WITH TIME ZONE,
  delivery_date TIMESTAMP WITH TIME ZONE,
  delivered BOOLEAN DEFAULT false,
  delivery_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- INVOICING
-- ============================================

CREATE TABLE belarro_v4_invoice (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES belarro_v4_customer(id) ON DELETE CASCADE,
  invoice_month TEXT NOT NULL,
  total_amount_eur FLOAT NOT NULL,
  vat_amount_eur FLOAT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(customer_id, invoice_month)
);

-- ============================================
-- SEED TRACKING
-- ============================================

CREATE TABLE belarro_v4_seed_usage_log (
  id TEXT PRIMARY KEY,
  crop_id TEXT NOT NULL REFERENCES belarro_v4_crop(id) ON DELETE CASCADE,
  quantity_used_grams FLOAT NOT NULL,
  trays_seeded INTEGER NOT NULL,
  seeded_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- STANDING ORDERS
-- ============================================

CREATE TABLE belarro_v4_standing_order (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES belarro_v4_customer(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE belarro_v4_standing_order_item (
  id TEXT PRIMARY KEY,
  standing_order_id TEXT NOT NULL REFERENCES belarro_v4_standing_order(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES belarro_v4_product_variant(id) ON DELETE CASCADE,
  size_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_at_time_eur FLOAT NOT NULL,
  delivery_day_of_week INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- SALES VISITS
-- ============================================

CREATE TABLE belarro_v4_sales_visit (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES belarro_v4_customer(id) ON DELETE CASCADE,
  visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
  outcome TEXT CHECK (outcome IN ('interested', 'not_interested', 'sample_sent', 'need_followup')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- MESSAGES
-- ============================================

CREATE TABLE belarro_v4_message (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  order_id TEXT REFERENCES belarro_v4_order(id) ON DELETE SET NULL,
  message_text TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE belarro_v4_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id TEXT,
  old_values TEXT,
  new_values TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_seed_inv_crop_id ON belarro_v4_seed_inventory(crop_id);
CREATE INDEX idx_package_inv_var_id ON belarro_v4_package_inventory(variant_id);
CREATE INDEX idx_sample_inv_crop_id ON belarro_v4_sample_inventory(crop_id);
CREATE INDEX idx_customer_status ON belarro_v4_customer(status);
CREATE INDEX idx_customer_email ON belarro_v4_customer(email);
CREATE INDEX idx_visit_customer_id ON belarro_v4_visit(customer_id);
CREATE INDEX idx_follow_up_cust_id ON belarro_v4_follow_up(customer_id);
CREATE INDEX idx_follow_up_status ON belarro_v4_follow_up(status);
CREATE INDEX idx_follow_up_due ON belarro_v4_follow_up(due_date);
CREATE INDEX idx_order_customer_id ON belarro_v4_order(customer_id);
CREATE INDEX idx_order_status ON belarro_v4_order(status);
CREATE INDEX idx_order_variant ON belarro_v4_order(product_variant_id);
CREATE INDEX idx_seeding_batch_crop ON belarro_v4_seeding_batch(crop_id);
CREATE INDEX idx_seeding_batch_date ON belarro_v4_seeding_batch(seeding_date);
CREATE INDEX idx_harvest_batch ON belarro_v4_harvest_record(seeding_batch_id);
CREATE INDEX idx_harvest_date ON belarro_v4_harvest_record(harvest_date);
CREATE INDEX idx_fulfillment_order ON belarro_v4_order_fulfillment(order_id);
CREATE INDEX idx_invoice_customer ON belarro_v4_invoice(customer_id);
CREATE INDEX idx_invoice_month ON belarro_v4_invoice(invoice_month);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE belarro_v4_seed_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_package_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_sample_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_visit ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_follow_up ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_seeding_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_harvest_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_order_fulfillment ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_seed_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_standing_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_standing_order_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_sales_visit ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE belarro_v4_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES (anon access for development)
-- ============================================

CREATE POLICY "Allow anon select" ON belarro_v4_seed_inventory FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_seed_inventory FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_seed_inventory FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_seed_inventory FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_package_inventory FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_package_inventory FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_package_inventory FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_package_inventory FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_sample_inventory FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_sample_inventory FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_sample_inventory FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_sample_inventory FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_customer FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_customer FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_customer FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_customer FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_visit FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_visit FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_visit FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_visit FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_follow_up FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_follow_up FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_follow_up FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_follow_up FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_order FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_order FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_order FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_order FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_seeding_batch FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_seeding_batch FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_seeding_batch FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_seeding_batch FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_harvest_record FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_harvest_record FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_harvest_record FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_harvest_record FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_order_fulfillment FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_order_fulfillment FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_order_fulfillment FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_order_fulfillment FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_invoice FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_invoice FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_invoice FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_invoice FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_seed_usage_log FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_seed_usage_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_seed_usage_log FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_seed_usage_log FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_standing_order FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_standing_order FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_standing_order FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_standing_order FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_standing_order_item FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_standing_order_item FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_standing_order_item FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_standing_order_item FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_sales_visit FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_sales_visit FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_sales_visit FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_sales_visit FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_message FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_message FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_message FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_message FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select" ON belarro_v4_audit_log FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_audit_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON belarro_v4_audit_log FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON belarro_v4_audit_log FOR DELETE TO anon USING (true);
