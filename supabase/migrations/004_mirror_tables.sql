-- 004_mirror_tables.sql — Supabase mirrors of the source Google Sheet tabs the
-- interactive TPH path reads (src/lib/tph/run.ts). Each row is one sheet row:
--   dedupe_key  sha1 of the row's cells — deterministic, so re-syncing is idempotent
--   ts_ms       the row's timestamp as epoch ms (per-tab column/tz, set by mirrors.ts)
--   cols        the row's cells as a JSON array, exactly the shape the ported
--               readers expect (Activities A..J, Maqsam Calls D..J, Freshchat A..G)
--   synced_at   when the mirror last wrote this row
--
-- Populated by src/lib/jobs/mirrors.ts (POST /api/admin/mirrors, or the
-- mirror_sync step inside jobProductivityDaily).

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
