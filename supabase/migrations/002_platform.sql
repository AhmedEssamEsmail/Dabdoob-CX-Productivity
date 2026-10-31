-- Platform tables ported from the Apps Script sheets
-- (original_deprecated: Options.js, Popups.js, Mailer.js, Health.js, WorkCalendar.js, OneOnOneAlerts.js)

-- Admin-maintained picklists (Options.js).
CREATE TABLE options (
  id BIGSERIAL PRIMARY KEY,
  list_key TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  sort INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_options_list_key ON options(list_key);
CREATE UNIQUE INDEX idx_options_list_value ON options(list_key, lower(value));

-- In-app pop-ups, recipient-specific until resolved (Popups.js).
CREATE TABLE popups (
  popup_id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  ref TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_popups_pending ON popups(recipient) WHERE resolved_at IS NULL;
CREATE INDEX idx_popups_kind_ref ON popups(kind, ref) WHERE resolved_at IS NULL;

-- Every mail attempt: sent, dry-run, blocked or failed (Mailer.js).
CREATE TABLE mail_log (
  id BIGSERIAL PRIMARY KEY,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  "to" TEXT NOT NULL DEFAULT '',
  cc TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  quota_left TEXT NOT NULL DEFAULT '',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_mail_log_sent_at ON mail_log(sent_at);

-- One row per heartbeat key; windows stay editable (Health.js).
CREATE TABLE health (
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
CREATE INDEX idx_health_system ON health(system);

-- Public holidays by country/date (WorkCalendar.js).
CREATE TABLE holidays (
  id BIGSERIAL PRIMARY KEY,
  country TEXT NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  deleted_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_holidays_date ON holidays(date);

-- Booked 1:1s the alert poll and reminders read (OneOnOneAlerts.js).
CREATE TABLE one_on_one_schedule (
  schedule_id TEXT PRIMARY KEY,
  manager_email TEXT NOT NULL,
  report_email TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled',
  booked_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ooo_status_at ON one_on_one_schedule(status, scheduled_at);
CREATE INDEX idx_ooo_manager ON one_on_one_schedule(manager_email);
CREATE INDEX idx_ooo_report ON one_on_one_schedule(report_email);
