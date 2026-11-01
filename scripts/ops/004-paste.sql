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
