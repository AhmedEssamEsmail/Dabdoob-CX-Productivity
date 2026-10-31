-- 003_domain_tables.sql — domain tables whose headers are recoverable from the
-- legacy GAS source in original_deprecated/. IF NOT EXISTS so it also documents
-- the tables already created ad hoc in the project. Columns stored as text/jsonb
-- to match the sheet-cell model (legacy wrote strings; *_json columns are JSON
-- strings, parsed by the app layer).
--
-- Sources: ProductivityApp.js PROD_HEADERS, ProdCore.js PRODUCTIVITY_COMPUTED_HEADERS,
-- KpiPayout.js KPI_LOG_HEADERS, TlSnapshots.js TLS_HEADERS,
-- QueueCore.js FD_TICKET_HEADERS/DQ_FLAGS_HEADERS/DQ_SUBMISSIONS_HEADERS,
-- Stores.js refresh_log headers.

-- ---------- Productivity (ProductivityApp.js / ProdCore.js) ----------
CREATE TABLE IF NOT EXISTS prod_intervals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  interval_key text, date text, agent_email text, agent_name text, status text,
  source_status text, start_at timestamptz, end_at timestamptz, minutes double precision,
  source text, snapshot_at timestamptz
);
CREATE TABLE IF NOT EXISTS prod_flags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flag_id text, date text, agent_email text, agent_name text, tl_email text,
  raw_status text, interval_start timestamptz, interval_end timestamptz,
  interval_min double precision, spans_json jsonb, flagged_min double precision,
  case_count integer, distinct_cases integer, case_ids_json jsonb,
  channel_mix_json jsonb, suggested_status text, decision text,
  validated_status text, decided_by text, decided_at timestamptz, reason text,
  review_open_ms double precision, due_date text, created_at timestamptz,
  rule_json jsonb, updated_at timestamptz, confidence_score double precision,
  confidence_level text, confidence_factors_json jsonb
);
CREATE TABLE IF NOT EXISTS prod_flag_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  log_id text, flag_id text, action text, from_status text, to_status text,
  "by" text, at timestamptz, reason text
);
CREATE TABLE IF NOT EXISTS prod_daily_layers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layer text,
  "agentName" text, date text, email text,
  "inboundAvailMin" double precision, "inboundTarget" double precision,
  "inboundAchieved" double precision, "inboundMissed" double precision,
  "inboundProdPct" double precision, "inboundGap" double precision,
  "textingAvailMin" double precision, "textingTarget" double precision,
  "textingAchieved" double precision, "textingProdPct" double precision, "textingGap" double precision,
  "waAvailMin" double precision, "waTarget" double precision, "waAchieved" double precision,
  "waProdPct" double precision, "waGap" double precision,
  "overallProdPct" double precision, "totalAudits" double precision, "avgScore" double precision,
  "productiveMinAux" double precision, "productiveMinResolution" double precision,
  "idleMin" double precision, "computedAt" timestamptz
);
CREATE TABLE IF NOT EXISTS prod_window_hist (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, class text, windows integer, counts_json jsonb, computed_at timestamptz
);
CREATE TABLE IF NOT EXISTS prod_flag_analytics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, agent_email text, total_flags integer, auto_accepted integer,
  total_flagged_min double precision, avg_cases_per_flag double precision,
  most_common_raw_status text, most_common_suggested_status text
);
CREATE TABLE IF NOT EXISTS prod_quarterly_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id text, quarter integer, year integer, start_date text, end_date text,
  report_json jsonb, created_at timestamptz
);
CREATE TABLE IF NOT EXISTS prod_tph_days (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, agent_email text, slots_json jsonb, sources_json jsonb,
  "by" text, at timestamptz
);
CREATE TABLE IF NOT EXISTS prod_tph_tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id text, date text, agent_email text, channel text, "start" text,
  "end" text, "by" text, at timestamptz, removed boolean
);
CREATE TABLE IF NOT EXISTS prod_tph_cases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, source text, cases_json jsonb, "by" text, at timestamptz
);
CREATE TABLE IF NOT EXISTS prod_tph_touches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, touches_json jsonb, computed_at timestamptz
);
CREATE TABLE IF NOT EXISTS prod_tph_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, calls_json jsonb, computed_at timestamptz
);

-- ---------- KPI logs (KpiPayout.js KPI_LOG_HEADERS) ----------
CREATE TABLE IF NOT EXISTS kpi_behaviour_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  log_id text, email text, date text, note text, logged_by text,
  logged_at timestamptz, removed_by text, removed_at timestamptz
);
CREATE TABLE IF NOT EXISTS kpi_leave_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  log_id text, email text, from_date text, to_date text, type text, note text,
  logged_by text, logged_at timestamptz, removed_by text, removed_at timestamptz
);
CREATE TABLE IF NOT EXISTS kpi_ol_cases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE, month text, email text, cases integer, updated_at timestamptz
);

-- ---------- TL snapshots (TlSnapshots.js TLS_HEADERS) ----------
CREATE TABLE IF NOT EXISTS tlp_shifts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE, date text, tl_email text, shift_start timestamptz,
  shift_end timestamptz, queue_json jsonb, updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS tlp_queue_daily (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, tl_email text, windows integer, queue_min double precision,
  calls_in integer, calls_serviced integer, calls_abandoned integer, calls_other integer,
  answer_rate double precision, text_touches integer, text_tickets integer,
  resp_count integer, resp_avg_min double precision, resp_missing integer,
  text_source text, computed_at timestamptz
);
CREATE TABLE IF NOT EXISTS tlp_team (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tl_email text, month text, quality double precision, fcr double precision,
  productivity double precision, agents integer, updated_at timestamptz,
  kpi_score double precision, kpi_prod double precision, kpi_qual double precision,
  kpi_fcr double precision, kpi_behavior double precision, kpi_agents integer,
  ol_agents integer, ineligible_agents integer, red_zone integer,
  action_plan integer, probation_agents integer, partial_agents integer
);
CREATE TABLE IF NOT EXISTS tlp_area_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE, tl_email text, area text, "from" text, "to" text,
  pct double precision, met integer, total integer, rule text, updated_at timestamptz
);

-- ---------- Queue & Workforce (QueueCore.js) ----------
-- Freshdesk ticket cache (FD_TICKET_HEADERS).
CREATE TABLE IF NOT EXISTS tickets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id text UNIQUE, status text, group_name text, responder_id text,
  requester_id text, channel text, country text, contact_type_1 text,
  created_at timestamptz, updated_at timestamptz, resolved_at timestamptz,
  closed_at timestamptz, status_code integer, group_id text, source text,
  contact_type_2 text, contact_type_3 text, priority integer, is_escalated boolean,
  first_responded_at timestamptz, status_updated_at timestamptz, due_by timestamptz,
  fr_due_by timestamptz, synced_at timestamptz
);
-- TL aging flags on tickets (DQ_FLAGS_HEADERS).
CREATE TABLE IF NOT EXISTS dq_aging_flags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flag_id text, ticket_id text, note text, tl_email text,
  resolved_at timestamptz, resolved_by text, resolved_note text,
  submitted_by text, submitted_at timestamptz
);
-- TL check-in submissions per slot (DQ_SUBMISSIONS_HEADERS).
CREATE TABLE IF NOT EXISTS queue_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id text, slot_date text, slot text, snapshot_key text, status text,
  queues_json jsonb, corrections_json jsonb, correction_reason text,
  general_note text, help_needed boolean, help_note text,
  submitted_by text, submitted_at timestamptz, updated_by text, updated_at timestamptz
);
-- Refresh/job log for queue aggregates (Stores.js).
CREATE TABLE IF NOT EXISTS refresh_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job text, started_at timestamptz, finished_at timestamptz,
  rows_in integer, rows_out integer, source_cursor text, status text,
  error text, note text
);

-- ---------- Placeholders pending legacy headers (see specs/legacy-parity/06) ----------
-- agg_queue_now, aging_open_tickets, agg_inflow_*, agg_agent_*, agg_snapshots_today,
-- queue_snapshots, sc_daily, sc_behaviour, sc_months, qa_* (Quality), tlp_* mail desk
-- (MD_HEADERS), esc_seen, holidays(002), one_on_one_*, actions* and tracker* tables
-- are defined in legacy files that are not in this repository; their schemas land
-- when the source arrives.
