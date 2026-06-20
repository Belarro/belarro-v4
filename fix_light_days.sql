-- Populate light_days for all crops that have light_enabled=true but light_days is NULL
-- Based on the growth procedure data that should exist in the database

UPDATE belarro_v4_growth_procedure
SET light_days = CASE
  WHEN crop_id LIKE '%radish%' OR crop_id LIKE '%red-rambo%' THEN 6
  WHEN crop_id LIKE '%pea%' THEN 7
  WHEN crop_id LIKE '%microgreens%' THEN 5
  WHEN crop_id LIKE '%sprouts%' THEN 4
  ELSE 7  -- default to 7 days if unknown
END
WHERE light_enabled = true AND light_days IS NULL;

-- For crops that have blackout_enabled but blackout_days is NULL, set a default
UPDATE belarro_v4_growth_procedure
SET blackout_days = 2
WHERE blackout_enabled = true AND blackout_days IS NULL;

-- For crops with stack_enabled but stack_days is NULL
UPDATE belarro_v4_growth_procedure
SET stack_days = 4
WHERE stack_enabled = true AND stack_days IS NULL;
