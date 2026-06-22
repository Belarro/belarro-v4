-- 1. Add language column to customer table
ALTER TABLE belarro_v4_customer
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- 2. Normalize status: rename 'prospect' to 'lead' for any existing records
UPDATE belarro_v4_customer SET status = 'lead' WHERE status = 'prospect';

-- 3. Ensure follow_up table has all needed columns
ALTER TABLE belarro_v4_follow_up
  ADD COLUMN IF NOT EXISTS stage INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS message_text TEXT,
  ADD COLUMN IF NOT EXISTS sent_via TEXT,
  ADD COLUMN IF NOT EXISTS sent_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 4. Function to auto-create 5 follow-up records when a lead is inserted
CREATE OR REPLACE FUNCTION create_lead_followups()
RETURNS TRIGGER AS $$
DECLARE
  base_date TIMESTAMPTZ;
BEGIN
  -- Only create follow-ups for leads
  IF NEW.status != 'lead' THEN
    RETURN NEW;
  END IF;

  base_date := COALESCE(NEW.first_contact_date, NEW.created_at, now());

  -- Stage 1: 2 hours after visit
  INSERT INTO belarro_v4_follow_up (id, customer_id, follow_up_number, follow_up_days, stage, due_date, status, created_at)
  VALUES (gen_random_uuid()::text, NEW.id, 1, 0, 1, base_date + INTERVAL '2 hours', 'pending', now())
  ON CONFLICT DO NOTHING;

  -- Stage 2: 2 days after visit
  INSERT INTO belarro_v4_follow_up (id, customer_id, follow_up_number, follow_up_days, stage, due_date, status, created_at)
  VALUES (gen_random_uuid()::text, NEW.id, 2, 2, 2, base_date + INTERVAL '2 days', 'pending', now())
  ON CONFLICT DO NOTHING;

  -- Stage 3: 5 days after visit
  INSERT INTO belarro_v4_follow_up (id, customer_id, follow_up_number, follow_up_days, stage, due_date, status, created_at)
  VALUES (gen_random_uuid()::text, NEW.id, 3, 5, 3, base_date + INTERVAL '5 days', 'pending', now())
  ON CONFLICT DO NOTHING;

  -- Stage 4: 14 days after visit
  INSERT INTO belarro_v4_follow_up (id, customer_id, follow_up_number, follow_up_days, stage, due_date, status, created_at)
  VALUES (gen_random_uuid()::text, NEW.id, 4, 14, 4, base_date + INTERVAL '14 days', 'pending', now())
  ON CONFLICT DO NOTHING;

  -- Stage 5: 30 days after visit
  INSERT INTO belarro_v4_follow_up (id, customer_id, follow_up_number, follow_up_days, stage, due_date, status, created_at)
  VALUES (gen_random_uuid()::text, NEW.id, 5, 30, 5, base_date + INTERVAL '30 days', 'pending', now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger: fires on new customer insert OR when status changes TO 'lead'
DROP TRIGGER IF EXISTS trigger_create_lead_followups ON belarro_v4_customer;
CREATE TRIGGER trigger_create_lead_followups
  AFTER INSERT ON belarro_v4_customer
  FOR EACH ROW
  EXECUTE FUNCTION create_lead_followups();

-- Trigger for status update to 'lead' (e.g. SalesTracker sets prospect, we update to lead)
CREATE OR REPLACE FUNCTION create_lead_followups_on_update()
RETURNS TRIGGER AS $$
DECLARE
  base_date TIMESTAMPTZ;
  existing_count INTEGER;
BEGIN
  IF NEW.status = 'lead' AND OLD.status != 'lead' THEN
    -- Only create if no follow-ups exist yet
    SELECT COUNT(*) INTO existing_count
    FROM belarro_v4_follow_up
    WHERE customer_id = NEW.id AND deleted_at IS NULL;

    IF existing_count = 0 THEN
      base_date := COALESCE(NEW.first_contact_date, NEW.created_at, now());

      INSERT INTO belarro_v4_follow_up (id, customer_id, follow_up_number, follow_up_days, stage, due_date, status, created_at)
      VALUES
        (gen_random_uuid()::text, NEW.id, 1, 0, 1, base_date + INTERVAL '2 hours', 'pending', now()),
        (gen_random_uuid()::text, NEW.id, 2, 2, 2, base_date + INTERVAL '2 days', 'pending', now()),
        (gen_random_uuid()::text, NEW.id, 3, 5, 3, base_date + INTERVAL '5 days', 'pending', now()),
        (gen_random_uuid()::text, NEW.id, 4, 14, 4, base_date + INTERVAL '14 days', 'pending', now()),
        (gen_random_uuid()::text, NEW.id, 5, 30, 5, base_date + INTERVAL '30 days', 'pending', now())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- When lead converts to active, close all pending follow-ups
  IF NEW.status = 'active' AND OLD.status = 'lead' THEN
    UPDATE belarro_v4_follow_up
    SET status = 'completed', completed_at = now()
    WHERE customer_id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_lead_followups_update ON belarro_v4_customer;
CREATE TRIGGER trigger_create_lead_followups_update
  AFTER UPDATE ON belarro_v4_customer
  FOR EACH ROW
  EXECUTE FUNCTION create_lead_followups_on_update();
