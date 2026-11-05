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
