-- Hub shard: the tables/columns still missing after migrations 001-010.
--
-- follow_up_done        Assistant.js AS_FOLLOWUP_TABLE ('FollowUpDone'):
--                       append-only Done clicks on TL follow-up threads.
-- roster                Auth.js ROSTER_HEADERS already exist; this adds the
--                       RosterSync.js DQ_ROSTER_EXTRA + DQ_ROSTER_V2_COLS +
--                       the HCT provenance pair (hct_role, hct_tl_email) and
--                       synced_at the sync stamps.
-- cache_stamps          Stores.js cache_stamps tab (job cache versioning):
--                       nothing reads it yet — created so later queue/store
--                       ports have the table instead of inventing it.
-- options/popups/mail_log/health/holidays/config/queue_* tables already
-- exist (001/002/003/007); dq_hct is deliberately NOT created — the roster
-- sync refuses until a headcount source is connected (see cx-hub/lib/roster).

CREATE TABLE IF NOT EXISTS follow_up_done (
  id BIGSERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL,
  last_at_ms NUMERIC,
  done_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_follow_up_done_thread ON follow_up_done (thread_id);

ALTER TABLE roster ADD COLUMN IF NOT EXISTS freshdesk_id TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS freshdesk_name TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS maqsam_name TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS hiring_date TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE roster ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS hct_role TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS hct_tl_email TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS based_in_country TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS days_off TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS role_override TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS tl_override TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE roster ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS cache_stamps (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
