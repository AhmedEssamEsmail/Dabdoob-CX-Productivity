-- TL Desk shard (Desk_deprecated). Tables the Desk app owns; the snapshot
-- tables it reads (tlp_shifts, tlp_queue_daily, tlp_team, tlp_area_metrics,
-- kpi_behaviour_log, kpi_leave_log, kpi_ol_cases) live in 003_domain_tables.sql.
-- The actions / action_task_details / action_updates task tables are shared
-- with the People shard (PW_TABLES in cx-people/lib/actions.ts); declared here
-- IF NOT EXISTS so the Desk can run before the People migration lands.

-- TLP_HEADERS verbatim (TlPerformance.js).
CREATE TABLE IF NOT EXISTS tlp_resp_ratings (
  rating_id text PRIMARY KEY,          -- week|tl_email|area
  tl_email text NOT NULL,
  week text NOT NULL,                  -- yyyy-MM-dd Sunday
  area text NOT NULL,
  rating numeric,
  note text NOT NULL DEFAULT '',
  rated_by text NOT NULL DEFAULT '',
  rated_at timestamptz
);
CREATE INDEX IF NOT EXISTS tlp_resp_ratings_tl_idx ON tlp_resp_ratings (tl_email, week);

CREATE TABLE IF NOT EXISTS tlp_kb (
  kb_id text PRIMARY KEY,
  topic text NOT NULL,
  requested_at timestamptz,
  done_at timestamptz,
  accurate text NOT NULL DEFAULT '',   -- 'yes' | 'no' | ''
  owner_email text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS tlp_otd (
  key text PRIMARY KEY,                -- month|warehouseIndex
  month text NOT NULL,
  warehouse integer NOT NULL,
  value numeric,
  entered_by text NOT NULL DEFAULT '',
  entered_at timestamptz
);

CREATE TABLE IF NOT EXISTS tlp_ticket_exclusions (
  key text PRIMARY KEY,                -- area|ticketId
  area text NOT NULL,
  ticket_id text NOT NULL,
  reason text NOT NULL DEFAULT '',
  logged_by text NOT NULL DEFAULT '',
  logged_at timestamptz,
  removed_by text NOT NULL DEFAULT '',
  removed_at timestamptz
);

-- MD_HEADERS verbatim (MailDesk.js).
CREATE TABLE IF NOT EXISTS mail_sla (
  message_id text PRIMARY KEY,         -- Gmail message id
  thread_id text NOT NULL,
  kind text NOT NULL DEFAULT '',       -- refund_status | chargeback
  subject text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  received_at timestamptz,
  expected_tls text NOT NULL DEFAULT '',   -- comma list, set on first sight
  status text NOT NULL DEFAULT 'open',     -- open | replied
  replied_at timestamptz,
  replied_by text NOT NULL DEFAULT '',
  minutes_to_reply numeric,
  breached boolean NOT NULL DEFAULT false,
  by_expected boolean NOT NULL DEFAULT false,
  covering_missed boolean NOT NULL DEFAULT false,
  snippet text NOT NULL DEFAULT '',
  updated_at timestamptz,
  due_at timestamptz,
  next_shift boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS mail_sla_received_idx ON mail_sla (received_at);

CREATE TABLE IF NOT EXISTS mail_approvals (
  thread_id text PRIMARY KEY,          -- Gmail thread id
  message_id text NOT NULL DEFAULT '',
  rfc_message_id text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT '',       -- refund | operational_loss
  mobile text NOT NULL DEFAULT '',
  order_id text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  requester text NOT NULL DEFAULT '',
  reply_to text NOT NULL DEFAULT '',
  cc text NOT NULL DEFAULT '',
  received_at timestamptz,
  excerpt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- pending | sending | approved | rejected | replied | answered_in_gmail
  decision_text text NOT NULL DEFAULT '',
  decided_by text NOT NULL DEFAULT '',
  decided_at timestamptz,
  sent_status text NOT NULL DEFAULT '',     -- '' | dry_run | sent | failed
  sent_message_id text NOT NULL DEFAULT '',
  client_token text NOT NULL DEFAULT '',
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS mail_approval_log (
  log_id text PRIMARY KEY,
  thread_id text NOT NULL,
  action text NOT NULL DEFAULT '',     -- decide | send_failed | reset
  decision text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  by text NOT NULL DEFAULT '',
  at timestamptz,
  sent_status text NOT NULL DEFAULT '',
  "to" text NOT NULL DEFAULT '',
  cc text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT ''
);

-- Shared task tables (People shard owns the canonical DDL in 008_people.sql;
-- columns below follow PW_TABLES exactly so either order of migrations works).
CREATE TABLE IF NOT EXISTS actions (
  action_id text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  owner_email text NOT NULL DEFAULT '',
  assigned_by text NOT NULL DEFAULT '',
  due_date text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT '',
  source_id text NOT NULL DEFAULT '',
  series_id text NOT NULL DEFAULT '',
  topic text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  outcome_note text NOT NULL DEFAULT '',
  closed_at timestamptz,
  closed_by text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT '',
  track_as_task boolean NOT NULL DEFAULT false,
  carry_count integer NOT NULL DEFAULT 0,
  source_deleted_at timestamptz,
  submitted_by text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  updated_by text,
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS actions_owner_idx ON actions (owner_email);

CREATE TABLE IF NOT EXISTS action_task_details (
  action_id text PRIMARY KEY,
  priority text NOT NULL DEFAULT 'P2',
  start_at timestamptz,
  deadline_at timestamptz,
  est_hours numeric,
  available_hours numeric,
  fit_status text NOT NULL DEFAULT '',
  progress_state text NOT NULL DEFAULT '',
  blocked_reason text NOT NULL DEFAULT '',
  rag_self text NOT NULL DEFAULT '',
  delivered_at timestamptz,
  delivery_ref text NOT NULL DEFAULT '',
  actual_hours numeric,
  source_label text NOT NULL DEFAULT '',
  assigned_anyway boolean NOT NULL DEFAULT false,
  submitted_by text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  updated_by text,
  updated_at timestamptz,
  -- TL performance (TlPerformance.js TLP_TASK_COLS).
  expectation text NOT NULL DEFAULT '',
  outcome_rating numeric,
  outcome_note text NOT NULL DEFAULT '',
  rated_by text NOT NULL DEFAULT '',
  rated_at timestamptz
);

CREATE TABLE IF NOT EXISTS action_updates (
  update_id text PRIMARY KEY,
  action_id text NOT NULL,
  kind text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  percent_complete numeric,
  rag text NOT NULL DEFAULT '',
  next_step text NOT NULL DEFAULT '',
  drive_file_id text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  planned_milestone_id text NOT NULL DEFAULT '',
  submitted_by text NOT NULL DEFAULT '',
  submitted_at timestamptz
);
CREATE INDEX IF NOT EXISTS action_updates_action_idx ON action_updates (action_id);
