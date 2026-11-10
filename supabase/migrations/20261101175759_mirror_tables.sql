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

-- refresh_log reconciliation. This project's Supabase already had a legacy
-- refresh_log (log_id, type, status, started_at — both NOT NULL) before
-- migration 003 ran, so `CREATE TABLE IF NOT EXISTS` never added the columns
-- this app writes (job/finished_at/rows_in/rows_out/source_cursor/error/note)
-- and every logRun append was silently soft-failing. ALTER into the superset
-- on either base; writers emit log_id+type so both schemas accept the row.
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

-- RLS policies. Tables created via the dashboard/SQL editor on this project get
-- RLS enabled by default; the app writes through the anon client (auth lives in
-- the API routes), so mirror tables need a permissive policy like every other
-- app table or every upsert fails with "row-level security policy" violations.
CREATE POLICY app_all ON fd_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON maqsam_calls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON freshchat FOR ALL USING (true) WITH CHECK (true);
