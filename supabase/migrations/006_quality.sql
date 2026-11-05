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
