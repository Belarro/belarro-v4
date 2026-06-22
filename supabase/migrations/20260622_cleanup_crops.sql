-- Step 1: Delete all soft-deleted crops (deleted_at is not null)
DELETE FROM belarro_v4_crop WHERE deleted_at IS NOT NULL;

-- Step 2: Delete test/junk crops
DELETE FROM belarro_v4_crop WHERE name_en IN (
  'hhh', 'jj', 'jjj', 'rr',
  'Test Crop', 'Final Test Crop', 'Test Notes Crop',
  'Test Persistence Crop', 'Test Procedure Crop',
  'Mushroom Test', 'Pea Salat'
);

-- Step 3: Verify what's left
SELECT id, name_en, status FROM belarro_v4_crop ORDER BY name_en;
