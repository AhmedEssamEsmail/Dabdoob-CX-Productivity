-- People & Performance tables ported verbatim from the legacy Apps Script
-- sheets (People_deprecated/Actions.js PW_TABLES, Notes.js, Scorecard.js
-- SC_HEADERS, KpiPayout.js KPI_LOG_HEADERS already live in 003).
--
-- Columns follow the sheet headers 1:1; text everywhere the sheet was loose,
-- timestamptz only where the field is an instant written by code. Stamps
-- (submitted_by/submitted_at, updated_by/updated_at) match Repo.js.

-- The shared actions store under 1:1s, meetings and TL tasks (Actions.js).
CREATE TABLE IF NOT EXISTS actions (
  action_id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL DEFAULT '',
  assigned_by TEXT NOT NULL DEFAULT '',
  due_date DATE,
  source_type TEXT NOT NULL DEFAULT 'adhoc',
  source_id TEXT NOT NULL DEFAULT '',
  series_id TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  outcome_note TEXT NOT NULL DEFAULT '',
  closed_at TIMESTAMPTZ,
  closed_by TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'shared',
  track_as_task BOOLEAN NOT NULL DEFAULT FALSE,
  carry_count INTEGER NOT NULL DEFAULT 0,
  source_deleted_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_actions_owner ON actions(owner_email);
CREATE INDEX IF NOT EXISTS idx_actions_series ON actions(series_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status) WHERE status IN ('open', 'blocked');

-- The carry-forward review a 1:1 or meeting applies (Actions.js pwApplyReviews_).
CREATE TABLE IF NOT EXISTS action_reviews (
  review_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  reviewed_in_type TEXT NOT NULL DEFAULT '',
  reviewed_in_id TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  new_due_date DATE,
  prev_status TEXT NOT NULL DEFAULT '',
  prev_due_date DATE,
  prev_outcome_note TEXT NOT NULL DEFAULT '',
  reverted_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_action_reviews_action ON action_reviews(action_id);
CREATE INDEX IF NOT EXISTS idx_action_reviews_in ON action_reviews(reviewed_in_type, reviewed_in_id);

-- Progress notes on an action (Actions.js actionsPostUpdate, Tasks.js milestones).
CREATE TABLE IF NOT EXISTS action_updates (
  update_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'status',
  note TEXT NOT NULL DEFAULT '',
  percent_complete NUMERIC,
  rag TEXT NOT NULL DEFAULT '',
  next_step TEXT NOT NULL DEFAULT '',
  drive_file_id TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  planned_milestone_id TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_action_updates_action ON action_updates(action_id);

-- TL task fields that hang off an action (Actions.js / Tasks.js).
CREATE TABLE IF NOT EXISTS action_task_details (
  action_id TEXT PRIMARY KEY,
  priority TEXT NOT NULL DEFAULT '',
  start_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  est_hours NUMERIC,
  available_hours NUMERIC,
  fit_status TEXT NOT NULL DEFAULT '',
  progress_state TEXT NOT NULL DEFAULT '',
  blocked_reason TEXT NOT NULL DEFAULT '',
  rag_self TEXT NOT NULL DEFAULT '',
  delivered_at TIMESTAMPTZ,
  delivery_ref TEXT NOT NULL DEFAULT '',
  actual_hours NUMERIC,
  source_label TEXT NOT NULL DEFAULT '',
  assigned_anyway BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ,
  -- TL performance (Mohamed 2026-10-11): expectation at assign, rating in the 1:1.
  expectation TEXT NOT NULL DEFAULT '',
  outcome_rating TEXT NOT NULL DEFAULT '',
  outcome_note TEXT NOT NULL DEFAULT '',
  rated_by TEXT NOT NULL DEFAULT '',
  rated_at TIMESTAMPTZ
);

-- Planned milestones a TL sets on a task (Tasks.js).
CREATE TABLE IF NOT EXISTS action_planned_milestones (
  milestone_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  target_date DATE,
  done_by_update_id TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_planned_ms_action ON action_planned_milestones(action_id);

-- Booked 1:1s: the table exists since 002 (alerts poll); add the lifecycle
-- columns the full engine needs (Actions.js PW_TABLES.one_on_one_schedule).
ALTER TABLE one_on_one_schedule
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS log_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rescheduled_to TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS missed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delete_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prev_status TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Held 1:1 records (OneOnOnes.js).
CREATE TABLE IF NOT EXISTS one_on_one_logs (
  log_id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  manager_email TEXT NOT NULL DEFAULT '',
  report_email TEXT NOT NULL DEFAULT '',
  held_at TIMESTAMPTZ,
  summary TEXT NOT NULL DEFAULT '',
  no_action_reason TEXT NOT NULL DEFAULT '',
  on_time BOOLEAN,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT NOT NULL DEFAULT '',
  delete_reason TEXT NOT NULL DEFAULT '',
  delete_cascade_json TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ooo_logs_manager ON one_on_one_logs(manager_email);
CREATE INDEX IF NOT EXISTS idx_ooo_logs_report ON one_on_one_logs(report_email);
CREATE INDEX IF NOT EXISTS idx_ooo_logs_sched ON one_on_one_logs(schedule_id);

-- Topics raised inside a logged 1:1 (OneOnOnes.js).
CREATE TABLE IF NOT EXISTS one_on_one_topics (
  id BIGSERIAL PRIMARY KEY,
  log_id TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  position INTEGER,
  raised_by TEXT NOT NULL DEFAULT '',
  suggested BOOLEAN NOT NULL DEFAULT FALSE,
  skipped_reason TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  confidential BOOLEAN NOT NULL DEFAULT FALSE,
  answers_json TEXT NOT NULL DEFAULT '',
  fields_json TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ooo_topics_log ON one_on_one_topics(log_id);

-- A manager's private notes on a 1:1 (OneOnOnes.js).
CREATE TABLE IF NOT EXISTS one_on_one_private_notes (
  id BIGSERIAL PRIMARY KEY,
  log_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  author_email TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ooo_priv_notes ON one_on_one_private_notes(log_id, author_email);

-- Meeting series and their members (Meetings.js).
CREATE TABLE IF NOT EXISTS meeting_series (
  series_id TEXT PRIMARY KEY,
  meeting_type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  chair_email TEXT NOT NULL DEFAULT '',
  cadence TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS meeting_series_members (
  id BIGSERIAL PRIMARY KEY,
  series_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_msm_series ON meeting_series_members(series_id);

-- One held meeting / BR (Meetings.js).
CREATE TABLE IF NOT EXISTS meetings (
  meeting_id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL DEFAULT '',
  held_at TIMESTAMPTZ,
  next_meeting_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  decisions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  summary_sent_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings(series_id);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  id BIGSERIAL PRIMARY KEY,
  meeting_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  attended BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ma_meeting ON meeting_attendees(meeting_id);

-- Reminder dedupe (Reminders.js / OneOnOneReminders.js): one row per sent reminder.
CREATE TABLE IF NOT EXISTS pw_reminder_log (
  dedupe_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- A suggested 1:1 topic for one person (Coaching.js; pwSuggestTopics_ reads it).
CREATE TABLE IF NOT EXISTS people_signals (
  signal_id TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  signal_date DATE,
  source TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_people_signals_email ON people_signals(email);

-- The owner's private scratchpad (Notes.js NOTE_COLUMNS; owner = submitted_by).
CREATE TABLE IF NOT EXISTS my_notes (
  note_id TEXT PRIMARY KEY,
  text TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'raw',
  deleted_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_my_notes_owner ON my_notes(submitted_by);

-- Optional prompt overrides for the 1:1 topic library (PeopleCore.js pwTopicLibrary_):
-- a row hides/re-words/reorders prompts of the built-in PW_TOPICS list.
CREATE TABLE IF NOT EXISTS one_on_one_topic_prompts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'agent',
  topic TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  prompt_text TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_oo_topic_prompts ON one_on_one_topic_prompts(kind, topic, active);

-- ---------- Scorecard stores (Scorecard.js SC_*_HEADERS; yearly-data-store
-- equivalents kept flat on Postgres) ----------

-- One row per agent per day: Matrix targets/achieved merged with FCR counts.
CREATE TABLE IF NOT EXISTS sc_daily (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  month TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  matrix_day INTEGER NOT NULL DEFAULT 0,
  inb_target NUMERIC NOT NULL DEFAULT 0,
  inb_achieved NUMERIC NOT NULL DEFAULT 0,
  txt_target NUMERIC NOT NULL DEFAULT 0,
  txt_achieved NUMERIC NOT NULL DEFAULT 0,
  wa_target NUMERIC NOT NULL DEFAULT 0,
  wa_achieved NUMERIC NOT NULL DEFAULT 0,
  audits NUMERIC NOT NULL DEFAULT 0,
  score_x_audits NUMERIC NOT NULL DEFAULT 0,
  fcr_passed INTEGER NOT NULL DEFAULT 0,
  fcr_failed INTEGER NOT NULL DEFAULT 0,
  fcr_excluded INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month, date, email)
);
CREATE INDEX IF NOT EXISTS idx_sc_daily_range ON sc_daily(date, email);

-- One row per business-behaviour case read from the workbook.
CREATE TABLE IF NOT EXISTS sc_behaviour (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  month TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sc_behaviour_email ON sc_behaviour(email, month);

-- One row per month: which workbook was read, when, and how it went.
CREATE TABLE IF NOT EXISTS sc_months (
  month TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  refreshed_at TIMESTAMPTZ,
  refreshed_by TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  matrix_rows INTEGER NOT NULL DEFAULT 0,
  agents INTEGER NOT NULL DEFAULT 0,
  first_date TEXT NOT NULL DEFAULT '',
  last_date TEXT NOT NULL DEFAULT '',
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  fcr_rows INTEGER NOT NULL DEFAULT 0,
  fcr_dated BOOLEAN NOT NULL DEFAULT FALSE,
  fcr_note TEXT NOT NULL DEFAULT '',
  behaviour_found BOOLEAN NOT NULL DEFAULT FALSE,
  behaviour_cases INTEGER NOT NULL DEFAULT 0,
  behaviour_note TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);
