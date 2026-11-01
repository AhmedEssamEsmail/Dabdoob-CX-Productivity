-- Paste once in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/uugeyulccyytvgcabzzx/sql
-- = migration 004 (mirror tables) + the `health` table from 002 that was never applied.

CREATE TABLE IF NOT EXISTS fd_activities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key text UNIQUE,
  ts_ms bigint,
  cols jsonb,
  synced_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fd_activities_ts ON fd_activities(ts_ms);

CREATE TABLE IF NOT EXISTS maqsam_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key text UNIQUE,
  ts_ms bigint,
  cols jsonb,
  synced_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_maqsam_calls_ts ON maqsam_calls(ts_ms);

CREATE TABLE IF NOT EXISTS freshchat (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key text UNIQUE,
  ts_ms bigint,
  cols jsonb,
  synced_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_freshchat_ts ON freshchat(ts_ms);

CREATE TABLE IF NOT EXISTS health (
  job TEXT PRIMARY KEY,
  system TEXT NOT NULL DEFAULT 'hub',
  link BOOLEAN NOT NULL DEFAULT FALSE,
  label TEXT NOT NULL DEFAULT '',
  expect_every_min INTEGER NOT NULL DEFAULT 1440,
  grace_min INTEGER NOT NULL DEFAULT 180,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  last_status TEXT NOT NULL DEFAULT '',
  last_note TEXT NOT NULL DEFAULT '',
  last_ok_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  seeded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_system ON health(system);

-- refresh_log reconciliation: the live table predates migration 003 and only
-- has (log_id, type, status, started_at). Add the columns this app writes so
-- job/cron logging and the "last automatic build" reads work. log_id/type stay
-- required-by-legacy and are supplied by the app's writers.
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS job text;
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS finished_at timestamptz;
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS rows_in integer;
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS rows_out integer;
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS source_cursor text;
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS error text;
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS log_id text;
ALTER TABLE refresh_log ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE refresh_log ALTER COLUMN type DROP NOT NULL;
