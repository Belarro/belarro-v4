-- Sprint 1 — Phase 3: Notifications infrastructure
-- Run in Supabase SQL editor (or via supabase db push).

-- S1-014: notification_log audit table (Data Protection Mandate: audit logs, no silent failures)
CREATE TABLE IF NOT EXISTS belarro_v4_notification_log (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_date     DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  channel      TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient    TEXT NOT NULL,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_id  TEXT,            -- Twilio SID / Resend id
  error        TEXT,
  payload      JSONB,           -- the message body / summary, for audit
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_run_date
  ON belarro_v4_notification_log (run_date DESC);

-- S1-015 / S1-016: pg_cron daily trigger at 07:00 Berlin (= 05:00 UTC in summer/CEST).
-- In winter (CET, UTC+1) change '0 5 * * *' to '0 6 * * *' after DST ends (late Oct).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- NOTE: replace PASTE_THE_SAME_CRON_SECRET_HERE with the CRON_SECRET set as an
-- Edge Function secret before running this block.
select cron.schedule(
  'belarro-daily-followups',
  '0 5 * * *',
  $$
  select net.http_post(
    url     := 'https://wbqzlxdyjdmbzifhsyil.supabase.co/functions/v1/notify-follow-ups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'PASTE_THE_SAME_CRON_SECRET_HERE'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Verify registration:
-- select jobid, schedule, jobname, active from cron.job where jobname = 'belarro-daily-followups';
