-- Fix all growth procedure records to have correct column names and values
-- This assumes the crop data exists and we're just filling in the procedure values

BEGIN;

-- Red Rambo (Radish)
UPDATE belarro_v4_growth_procedure
SET
  soak_enabled = true,
  soak_hours = 24,
  cover_soil_enabled = true,
  stack_enabled = true,
  stack_days = 4,
  light_enabled = true,
  light_days = 6,
  blackout_enabled = false,
  blackout_days = null,
  humidity_dome_enabled = true,
  humidity_dome_days = 3
WHERE crop_id = 'rad-red-rambo';

-- If the record doesn't exist, insert it
INSERT INTO belarro_v4_growth_procedure (crop_id, soak_enabled, soak_hours, cover_soil_enabled, stack_enabled, stack_days, light_enabled, light_days, blackout_enabled, humidity_dome_enabled, humidity_dome_days)
SELECT 'rad-red-rambo', true, 24, true, true, 4, true, 6, false, true, 3
WHERE NOT EXISTS (SELECT 1 FROM belarro_v4_growth_procedure WHERE crop_id = 'rad-red-rambo');

COMMIT;
