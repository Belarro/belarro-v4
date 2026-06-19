-- ============================================================================
-- SPRINT 3 / PHASE 3 — ERROR LOGGING
-- ============================================================================
-- Persistent error log so production failures are observable instead of only
-- living in console.error(). Written by lib/logger.ts from API catch-blocks,
-- read by /admin/error-log.
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS belarro_v4_error_log (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  endpoint    TEXT NOT NULL,                 -- e.g. "POST /api/customers"
  status      INTEGER,                       -- HTTP status returned to client
  message     TEXT NOT NULL,                 -- error message
  stack       TEXT,                          -- stack trace if available
  user_id     TEXT                           -- authenticated user, if known
);

CREATE INDEX IF NOT EXISTS idx_v4_error_log_created_at ON belarro_v4_error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_v4_error_log_endpoint   ON belarro_v4_error_log(endpoint);

ALTER TABLE belarro_v4_error_log ENABLE ROW LEVEL SECURITY;

-- Dev parity with the rest of the schema (anon access). Tighten before prod.
DROP POLICY IF EXISTS "Allow anon select" ON belarro_v4_error_log;
DROP POLICY IF EXISTS "Allow anon insert" ON belarro_v4_error_log;
CREATE POLICY "Allow anon select" ON belarro_v4_error_log FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON belarro_v4_error_log FOR INSERT TO anon WITH CHECK (true);

COMMIT;
