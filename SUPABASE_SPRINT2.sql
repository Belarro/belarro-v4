-- Belarro V4 Sprint 2 — Website Leads + RLS hardening
-- Idempotent: safe to run multiple times.

-- ============================================
-- WEBSITE LEADS (public contact form)
-- ============================================

CREATE TABLE IF NOT EXISTS belarro_v4_website_lead (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  restaurant_name TEXT,
  message TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'archived')),
  converted_customer_id TEXT REFERENCES belarro_v4_customer(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_lead_status ON belarro_v4_website_lead(status);
CREATE INDEX IF NOT EXISTS idx_website_lead_created ON belarro_v4_website_lead(created_at);

-- Reuse the follow_up table for website-lead nurture sequences. Allow the
-- customer FK to be optional and add an optional website_lead_id link.
ALTER TABLE belarro_v4_follow_up
  ADD COLUMN IF NOT EXISTS website_lead_id TEXT REFERENCES belarro_v4_website_lead(id) ON DELETE CASCADE;

ALTER TABLE belarro_v4_follow_up ALTER COLUMN customer_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_follow_up_website_lead ON belarro_v4_follow_up(website_lead_id);

ALTER TABLE belarro_v4_website_lead ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS: admin (authenticated) full access on all belarro_v4_* tables
-- The anon dev policies from the extended setup are dropped so the anon key
-- can no longer read/write directly; all access goes through authenticated
-- sessions (service role bypasses RLS for server routes).
-- ============================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'belarro_v4_crop',
    'belarro_v4_growth_procedure',
    'belarro_v4_product_variant',
    'belarro_v4_seed_inventory',
    'belarro_v4_package_inventory',
    'belarro_v4_sample_inventory',
    'belarro_v4_customer',
    'belarro_v4_visit',
    'belarro_v4_follow_up',
    'belarro_v4_order',
    'belarro_v4_seeding_batch',
    'belarro_v4_harvest_record',
    'belarro_v4_order_fulfillment',
    'belarro_v4_invoice',
    'belarro_v4_seed_usage_log',
    'belarro_v4_standing_order',
    'belarro_v4_standing_order_item',
    'belarro_v4_sales_visit',
    'belarro_v4_message',
    'belarro_v4_audit_log',
    'belarro_v4_website_lead'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

      -- Drop permissive anon dev policies.
      EXECUTE format('DROP POLICY IF EXISTS "Allow anon select" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow anon insert" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow anon update" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow anon delete" ON %I', t);

      -- Admin = any authenticated user with role='admin' in JWT app_metadata.
      EXECUTE format('DROP POLICY IF EXISTS "admin_all" ON %I', t);
      EXECUTE format($p$
        CREATE POLICY "admin_all" ON %I
        FOR ALL TO authenticated
        USING ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' )
        WITH CHECK ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' )
      $p$, t);
    END IF;
  END LOOP;
END $$;
