-- =============================================================
-- CX-Hub pending migrations — paste into Supabase SQL editor (Dashboard → SQL)
-- Project: uugeyulccyytvgcabzzx — generated 2026-11-05
-- Contents: 005_hub, 006_quality, 007_queue, 008_people, 009_operations, 010_desk
-- All statements are idempotent (IF NOT EXISTS) — safe to re-run.
-- =============================================================

-- #################### 005_hub ####################
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

-- #################### 006_quality ####################
-- 006_quality.sql — Quality module tables (QA_HEADERS in cx-quality/lib/core.ts
-- and the Queue-Engine tabs in cx-quality/lib/engine.ts QE_*_HEADERS).
-- Text columns throughout: the legacy sheets were all-text and the port keeps
-- the same loose typing (dates as yyyy-MM-dd, JSON payloads as *_json/text).

create table if not exists qa_forms (
  id bigserial primary key,
  form_id text not null,
  version integer not null default 1,
  channel text default '',
  title text default '',
  placeholder boolean default false,
  active boolean default true,
  definition_json text default '{}',
  created_by text default '',
  created_at timestamptz default now(),
  unique (form_id, version)
);

create table if not exists qa_queue (
  id bigserial primary key,
  queue_id text not null unique,
  queue_date text default '',
  ticket_id text default '',
  agent_email text default '',
  agent_name text default '',
  tl_email text default '',
  channel text default '',
  contact_type text default '',
  tier text default '',
  auditor_email text default '',
  status text default 'open',
  started_at timestamptz,
  audit_id text default '',
  imported_at timestamptz,
  log_key text default '',
  interaction_at text default '',
  agent_status text default '',
  passed_to text default '',
  passed_by text default '',
  passed_at timestamptz,
  pass_note text default '',
  action_at text default '',
  agent_status_log text default '',
  ticket_status text default '',
  pass_reason text default '',
  expire_reason text default '',
  source text default '',
  requested_by text default '',
  requested_at timestamptz,
  request_reason text default '',
  waived_by text default '',
  waived_at timestamptz,
  waive_reason text default '',
  audit_type text default '',
  reference text default ''
);
create index if not exists qa_queue_ticket_idx on qa_queue (ticket_id);
create index if not exists qa_queue_auditor_idx on qa_queue (auditor_email, status);
create index if not exists qa_queue_date_idx on qa_queue (queue_date);

create table if not exists qa_audits (
  id bigserial primary key,
  audit_id text not null unique,
  kind text default '',
  queue_id text default '',
  calibration_id text default '',
  ticket_id text default '',
  agent_email text default '',
  tl_email text default '',
  auditor_email text default '',
  channel text default '',
  contact_type text default '',
  form_id text default '',
  form_version text default '',
  answers_json text default '{}',
  comment text default '',
  score numeric,
  fatal text default '',
  score_final numeric,
  started_at timestamptz,
  submitted_at timestamptz,
  audit_date text default '',
  status text default 'draft',
  ack_due_date text default '',
  acknowledged_at timestamptz,
  ack_by text default '',
  updated_at timestamptz,
  updated_by text default '',
  source text default '',
  source_agent text default '',
  fail_reasons_json text default '',
  audit_type text default '',
  reference text default '',
  sample_basis text default '',
  interaction_at text default ''
);
create index if not exists qa_audits_agent_idx on qa_audits (agent_email, audit_date);
create index if not exists qa_audits_auditor_idx on qa_audits (auditor_email, audit_date);
create index if not exists qa_audits_ticket_idx on qa_audits (ticket_id);
create index if not exists qa_audits_queue_idx on qa_audits (queue_id);
create index if not exists qa_audits_cal_idx on qa_audits (calibration_id);

create table if not exists qa_ctls (
  id bigserial primary key,
  ctl_id text not null unique,
  audit_id text default '',
  agent_email text default '',
  tl_email text default '',
  opened_date text default '',
  due_date text default '',
  status text default 'open',
  coaching_notes text default '',
  action text default '',
  submitted_at timestamptz,
  submitted_date text default '',
  sla_met text default '',
  agent_confirmed_at timestamptz,
  agent_note text default '',
  reminded_date text default '',
  updated_at timestamptz,
  updated_by text default '',
  outcome text default '',
  dispute_id text default '',
  reopened_at timestamptz,
  reopen_count integer default 0,
  closed_by text default '',
  shift_tls text default ''
);
create index if not exists qa_ctls_tl_idx on qa_ctls (tl_email, status);
create index if not exists qa_ctls_agent_idx on qa_ctls (agent_email);
create index if not exists qa_ctls_audit_idx on qa_ctls (audit_id);

create table if not exists qa_disputes (
  id bigserial primary key,
  dispute_id text not null unique,
  audit_id text default '',
  agent_email text default '',
  auditor_email text default '',
  tl_email text default '',
  reason text default '',
  raised_at timestamptz,
  status text default 'open',
  decision text default '',
  decision_note text default '',
  old_score numeric,
  new_score numeric,
  decided_by text default '',
  decided_at timestamptz,
  audit_month text default '',
  raised_by text default '',
  raised_date text default '',
  escalated_by text default '',
  escalated_at timestamptz,
  escalation_note text default ''
);
create index if not exists qa_disputes_audit_idx on qa_disputes (audit_id);
create index if not exists qa_disputes_month_idx on qa_disputes (audit_month);

create table if not exists qa_calibrations (
  id bigserial primary key,
  calibration_id text not null unique,
  ticket_id text default '',
  channel text default '',
  agent_email text default '',
  form_id text default '',
  form_version text default '',
  auditor_email text default '',
  tl_email text default '',
  created_by text default '',
  created_at timestamptz,
  status text default 'open',
  auditor_audit_id text default '',
  tl_audit_id text default '',
  alignment_pct numeric,
  month text default '',
  completed_at timestamptz
);

create table if not exists qa_kb_gaps (
  id bigserial primary key,
  gap_id text not null unique,
  audit_id text default '',
  ticket_id text default '',
  auditor_email text default '',
  topic text default '',
  description text default '',
  suggestion text default '',
  created_at timestamptz,
  created_date text default '',
  audit_date text default '',
  same_day text default '',
  status text default 'open',
  added_by text default '',
  added_at timestamptz
);

create table if not exists qa_volume (
  id bigserial primary key,
  date text not null,
  channel text default '',
  contact_type text default '',
  tickets integer default 0,
  updated_at timestamptz,
  unique (date, channel, contact_type)
);

-- ---------------------------------------------------------------- queue engine
-- qe_queue_log mirrors the 'Queue Log' tab (QE_LOG_HEADERS); column names are
-- the headers lowercased/underscored via qeLogField_ ("Group" -> "group", quoted).
create table if not exists qe_queue_log (
  id bigserial primary key,
  key text not null,
  queued_date text not null,
  iso_week text default '',
  slot text default '',
  agent text default '',
  channel text default '',
  "group" text default '',
  contact_type text default '',
  tier text default '',
  ticket_id text default '',
  subject text default '',
  country text default '',
  status text default '',
  last_touch text default '',
  touches integer default 0,
  state text default 'pending',
  audited_at text default '',
  audited_by text default '',
  interaction text default '',
  agent_status text default '',
  passed_to text default '',
  agent_email text default '',
  agent_fd_id text default '',
  action_time text default '',
  agent_status_log text default '',
  pass_reason text default '',
  unique (key, queued_date)
);
create index if not exists qe_queue_log_date_idx on qe_queue_log (queued_date);
create index if not exists qe_queue_log_ticket_idx on qe_queue_log (ticket_id);

create table if not exists qe_candidates (
  id bigserial primary key,
  queued_date text not null,
  agent text default '',
  candidates text default '[]', -- JSON array of Queue Log rows
  unique (queued_date, agent)
);

create table if not exists qe_outcomes (
  id bigserial primary key,
  queued_date text not null,
  ran_at text default '',
  mode text default '',
  outcomes text default '{}', -- JSON per-agent outcome map
  unique (queued_date, ran_at)
);

create table if not exists qe_builds (
  id bigserial primary key,
  ran_at text not null,
  by text default '',
  mode text default '',
  agents integer default 0,
  queued integer default 0,
  pool integer default 0,
  eligible integer default 0,
  notes text default ''
);
create index if not exists qe_builds_ran_idx on qe_builds (ran_at);

create table if not exists qe_catalogue (
  id bigserial primary key,
  kind text not null,
  value text not null,
  times_seen integer default 0,
  last_seen text default '',
  unique (kind, value)
);

-- #################### 007_queue ####################
-- 007_queue.sql — Queue & Workforce stores ported from the legacy Hub
-- (Command_Center_V2_deprecated Queue.js / Aggregates.js / FreshdeskSync.js)
-- and the Queue app (Heatmap.js / Scheduler.js / TlQueue.js).
--
-- Table-name decision (live consumers win): the check-in and aging-flag stores
-- keep the migration-003 names `queue_submissions` and `dq_aging_flags`. The
-- legacy sheet tabs were called `queue_status_submissions` and `aging_flags`;
-- src/features/cx-queue/lib/index.ts documents the mapping in DQ_*_TABLE.
--
-- Shared aggregate tabs already live from earlier migrations / the sheet-era
-- project (agg_queue_now, agg_inflow_daily/weekly/monthly, tickets, esc_seen,
-- refresh_log): re-declared IF NOT EXISTS only where the spec lists them as
-- present-but-undocumented (single ownership stays in 005_hub when it lands).

-- ---------- Live stores written by jobDataTick / jobNightlyAggregates ----------

-- Per-slot queue snapshots (Queue.js DQ_SNAPSHOT_HEADERS + legacy year shard).
CREATE TABLE IF NOT EXISTS queue_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  year integer,
  snapshot_key text, slot_date text, slot text, captured_at timestamptz, data_as_of timestamptz,
  late boolean, queue text, open integer, actionable integer, unassigned integer,
  oldest_h double precision, over_top integer, created_today integer, resolved_today integer,
  stale boolean, by_status_json jsonb, bands_json jsonb,
  UNIQUE (snapshot_key, queue)
);
CREATE INDEX IF NOT EXISTS idx_queue_snapshots_date ON queue_snapshots(slot_date);

-- Live copy of today's snapshots (dqRewrite_'d every check-in tick).
CREATE TABLE IF NOT EXISTS agg_snapshots_today (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_key text, slot_date text, slot text, captured_at timestamptz, data_as_of timestamptz,
  late boolean, queue text, open integer, actionable integer, unassigned integer,
  oldest_h double precision, over_top integer, created_today integer, resolved_today integer,
  stale boolean, by_status_json jsonb, bands_json jsonb, year integer
);

-- The aging board (Aggregates.js DQ_AGING_HEADERS; rewritten per build).
CREATE TABLE IF NOT EXISTS aging_open_tickets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id text, queue text, group_name text, status text, actionable boolean,
  country text, channel text, contact_type_1 text, created_at timestamptz,
  age_h double precision, band integer, agent_email text, agent_name text,
  tl_email text, tl_name text, refreshed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_aging_open_tickets_ticket ON aging_open_tickets(ticket_id);

-- The queue health board (Aggregates.js DQ_QUEUE_NOW_HEADERS).
CREATE TABLE IF NOT EXISTS agg_queue_now (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  queue text, kind text, open integer, actionable integer, unassigned integer,
  oldest_h double precision, over_top integer, created_today integer, resolved_today integer,
  as_of timestamptz, source_as_of timestamptz, stale boolean,
  by_status_json jsonb, bands_json jsonb
);

-- Inflow stores (Aggregates.js DQ_INFLOW_HEADERS / DQ_INFLOW_ROLLUP_HEADERS /
-- DQ_INFLOW_HOURLY_HEADERS). agg_inflow_hourly keeps the legacy per-year shard
-- as a `year` column (consumers filter/upsert on it, e.g. tph run.ts).
CREATE TABLE IF NOT EXISTS agg_inflow_daily (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, channel text, country text, inflow integer, updated_at timestamptz,
  UNIQUE (date, channel, country)
);
CREATE TABLE IF NOT EXISTS agg_inflow_weekly (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period text, channel text, country text, inflow integer, days integer,
  partial boolean, updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS agg_inflow_monthly (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period text, channel text, country text, inflow integer, days integer,
  partial boolean, updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS agg_inflow_hourly (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  year integer, date text, hour integer, channel text, country text, inflow integer,
  UNIQUE (date, hour, channel, country, year)
);
CREATE INDEX IF NOT EXISTS idx_agg_inflow_hourly_year ON agg_inflow_hourly(year);

-- Agent performance rollup (DQ_AGENT_PERF_HEADERS / DQ_AGENT_DAILY_HEADERS).
CREATE TABLE IF NOT EXISTS agg_agent_perf (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text, name text, tl_email text, tl_name text, period text,
  from_date text, to_date text, days integer, overall_pct double precision,
  inbound_pct double precision, texting_pct double precision, wa_pct double precision,
  inbound_achieved double precision, inbound_missed double precision,
  texting_achieved double precision, wa_achieved double precision,
  productive_min double precision, idle_min double precision,
  audits integer, avg_score double precision
);
CREATE TABLE IF NOT EXISTS agg_agent_daily (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, email text, overall_pct double precision,
  inbound_achieved double precision, texting_achieved double precision, wa_achieved double precision
);

-- Escalation sightings (FreshdeskSync.js FD_ESC_SEEN_HEADERS).
CREATE TABLE IF NOT EXISTS esc_seen (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id text UNIQUE, status text, seen_at timestamptz, source text
);

-- ---------- Scheduler (Scheduler.js sched_* stores) ----------
CREATE TABLE IF NOT EXISTS sched_config (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE, value jsonb
);
CREATE TABLE IF NOT EXISTS sched_team (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tl_email text UNIQUE, name text, shift text, wfh boolean, active boolean, extra_json jsonb
);
CREATE TABLE IF NOT EXISTS sched_offdays (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tl_email text, date text, UNIQUE (tl_email, date)
);
CREATE TABLE IF NOT EXISTS sched_overrides (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tl_email text, date text, shift text, note text,
  UNIQUE (tl_email, date)
);
CREATE TABLE IF NOT EXISTS sched_hour_overrides (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tl_email text, date text, hour integer, kind text, label text,
  UNIQUE (tl_email, date, hour)
);
CREATE TABLE IF NOT EXISTS sched_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id text UNIQUE, type text, from_email text, to_email text,
  date text, their_date text, note text, status text,
  decided_by text, decided_at timestamptz, decided_note text,
  submitted_by text, submitted_at timestamptz
);
CREATE TABLE IF NOT EXISTS sched_plan (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  month text, tl_email text, date text, shift text, "from" text, "to" text,
  wfh boolean, segments_json jsonb, variant integer,
  submitted_by text, submitted_at timestamptz, imported_by text
);
CREATE INDEX IF NOT EXISTS idx_sched_plan_month ON sched_plan(month);

-- ---------- TL queue metrics (TlQueue.js rebuildTlQueueMetrics stores) ----------
CREATE TABLE IF NOT EXISTS tlp_shifts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE, date text, tl_email text,
  shift_start timestamptz, shift_end timestamptz, queue_json jsonb, updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tlp_shifts_date ON tlp_shifts(date);
CREATE TABLE IF NOT EXISTS tlp_queue_daily (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, tl_email text, windows integer,
  queue_min double precision,
  calls_in integer, calls_serviced integer, calls_abandoned integer, calls_other integer,
  answer_rate double precision, text_touches integer, text_tickets integer,
  resp_count integer, resp_avg_min double precision, resp_missing integer,
  text_source text, computed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tlp_queue_daily_date ON tlp_queue_daily(date);

-- ---------- Heatmap (Heatmap.js HeatmapInputs / HeatmapAssumptionSets) ----------
-- window_json + data_1 hold the legacy gzip-chunked payload semantics as plain
-- JSON (the legacy data_2..4 chunk columns are kept for header parity).
CREATE TABLE IF NOT EXISTS heatmap_inputs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  input_id text UNIQUE, name text, source text, interval_minutes integer,
  cells_count integer, window_json jsonb, notes text,
  data_1 text, data_2 text, data_3 text, data_4 text,
  archived_at timestamptz, submitted_by text, submitted_at timestamptz
);
CREATE TABLE IF NOT EXISTS heatmap_assumption_sets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  set_id text UNIQUE, name text, assumptions_json jsonb,
  archived_at timestamptz, submitted_by text, submitted_at timestamptz
);

-- ---------- RLS (app writes through the anon client, like 004) ----------
CREATE POLICY app_all ON queue_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON agg_snapshots_today FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON aging_open_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON agg_queue_now FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON agg_inflow_daily FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON agg_inflow_weekly FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON agg_inflow_monthly FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON agg_inflow_hourly FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON agg_agent_perf FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON agg_agent_daily FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON esc_seen FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON sched_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON sched_team FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON sched_offdays FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON sched_overrides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON sched_hour_overrides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON sched_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON sched_plan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON tlp_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON tlp_queue_daily FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON heatmap_inputs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON heatmap_assumption_sets FOR ALL USING (true) WITH CHECK (true);

-- ---------- Schedules (BLOCKED_TASKS B1) ----------
-- pg_cron is not enabled on this project, so the legacy trigger times are
-- recorded here for the PM rather than installed. Sub-hourly cadence
-- (jobDataTick every 15 min) also exceeds what pg_cron expresses natively and
-- needs a PM decision (external scheduler / vercel.json crons).
--   jobDataTick             */15 * * * *     -> GET /api/cron/job-data-tick
--   jobNightlyAggregates    30 6 * * *       -> GET /api/cron/job-nightly-aggregates (06:30 UTC = 09:30 Kuwait)
--   jobTlQueueMetrics       15 0 * * *       -> TL metrics rebuild (00:15 UTC)
-- When pg_cron lands, install equivalents of:
--   select cron.schedule('job-data-tick', '*/15 * * * *', $$select net.http_get('<app>/api/cron/job-data-tick')$$);

-- #################### 008_people ####################
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

-- #################### 009_operations ####################
-- Operations shard: trackers (Operations_deprecated/Trackers.js).
-- Registry tabs "Trackers" / "TrackerFields" -> snake_case tables; native
-- tracker records land in tracker_records (one row per record, values jsonb
-- keyed by field id — the Postgres answer to "one tab per native tracker").
-- External sheet-backed trackers keep their registry rows; their rows are read
-- through the sheets adapter seam (D-GOOGLE) and migrated rows may be backfilled
-- into tracker_records by the shard-80 migration (storage stays 'external').
CREATE TABLE IF NOT EXISTS trackers (
  tracker_id text PRIMARY KEY,
  name text NOT NULL,
  storage_mode text NOT NULL DEFAULT 'external',
  spreadsheet_id text NOT NULL DEFAULT '',
  tab_name text NOT NULL DEFAULT '',
  header_row integer NOT NULL DEFAULT 1,
  access_mode text NOT NULL DEFAULT 'edit',
  form_backed boolean NOT NULL DEFAULT false,
  record_id_header text NOT NULL DEFAULT 'record_id',
  record_id_format text NOT NULL DEFAULT '',
  submitted_by_header text NOT NULL DEFAULT 'submitted_by',
  submitted_at_header text NOT NULL DEFAULT 'submitted_at',
  viewer_roles text NOT NULL DEFAULT 'admin,tl',
  editor_roles text NOT NULL DEFAULT 'admin,tl',
  builder_roles text NOT NULL DEFAULT 'admin',
  owner_email text NOT NULL DEFAULT '',
  archived_at text NOT NULL DEFAULT '',
  submitted_by text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  updated_by text,
  updated_at timestamptz
);

-- Field ids repeat across trackers: the key is (tracker_id, field_id).
CREATE TABLE IF NOT EXISTS tracker_fields (
  field_id text NOT NULL,
  tracker_id text NOT NULL REFERENCES trackers(tracker_id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  column_header text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT false,
  list_key text NOT NULL DEFAULT '',
  parent_field_id text NOT NULL DEFAULT '',
  auto text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  submitted_by text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  PRIMARY KEY (tracker_id, field_id)
);
CREATE INDEX IF NOT EXISTS tracker_fields_tracker_idx ON tracker_fields (tracker_id);

-- One row per record of a Supabase-backed (native) tracker. `row_n` preserves
-- sheet row ordering; `values` holds { fieldId: value } exactly as validated.
CREATE TABLE IF NOT EXISTS tracker_records (
  tracker_id text NOT NULL REFERENCES trackers(tracker_id) ON DELETE CASCADE,
  record_id text NOT NULL,
  row_n integer NOT NULL,
  submitted_by text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tracker_id, record_id)
);
CREATE INDEX IF NOT EXISTS tracker_records_tracker_idx ON tracker_records (tracker_id, row_n);

-- Seed the four built-in trackers + the read-only refund ledger
-- (BUILTIN_TRACKERS verbatim; spreadsheet ids are reference-only).
INSERT INTO trackers (tracker_id, name, storage_mode, spreadsheet_id, tab_name, header_row, access_mode, form_backed,
  record_id_header, record_id_format, submitted_by_header, submitted_at_header, viewer_roles, editor_roles, builder_roles)
VALUES
  ('blocked_customers', 'Blocked customers', 'external', '1KFC6ENFbQWPmRSziH9gLsBQED1hnh_e9ZknsjwruPEA', 'Sheet1', 1, 'edit', false,
    'record_id', '', 'submitted_by', 'submitted_at', 'admin,tl', 'admin,tl,agent', 'admin'),
  ('promocodes', 'Promocodes', 'external', '1GsBilEGkmXqBSgmiv4jM5UHWPeW0_DpdmBVA3L1zgTw', 'Form Responses 1', 1, 'edit', true,
    'record_id', '', 'Email Address', 'Timestamp', 'admin,tl,agent', 'admin,tl,agent', 'admin'),
  ('operational_loss', 'Operational loss', 'external', '12jVdX8CziY9sS_AVd1kZJEnRp82I3YFLXSCUuu_e5Uc', 'Sheet1', 1, 'edit', false,
    'Record ID', 'OL{n}', 'submitted_by', 'submitted_at', 'admin,tl', 'admin,tl,agent', 'admin'),
  ('customer_strikes', 'Customer strikes', 'external', '1Odij24BsYeukoqdGXOmqnVq36SL7s-8pFR9Jpz3OMmQ', 'Form Responses 1', 1, 'edit', true,
    'record_id', '', 'Email Address', 'Timestamp', 'admin,tl', 'admin,tl,agent', 'admin'),
  ('refund_ledger', 'Refund calculator backend', 'external', '1ZaJnCVOmZF42KAYpd3YwDrsr1gY7fIEwTxUeAESgGU8', 'Refund Log', 1, 'view_only', false,
    'record_id', '', 'Agent', 'Logged at', 'admin,tl', '', 'admin')
ON CONFLICT (tracker_id) DO NOTHING;

-- #################### 010_desk ####################
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
  to text NOT NULL DEFAULT '',
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
