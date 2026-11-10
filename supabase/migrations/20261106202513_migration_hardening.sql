-- ---------- Migration hardening (WP-F22 rewrite for WP-51) ----------
-- Corrects the WP-30/32 draft against the credentialed WP-35 dry-run
-- (specs/megaplan/audits/migration-dryrun.md §3 B3/B5/B8). DRAFT — apply
-- before the WP-51 run; it is not applied anywhere yet.
--
--   (a) Natural-key UNIQUEs so insert-only sheet tables upsert idempotently.
--   (b) Conflict-target UNIQUEs the live app already upserts on (verified in
--       src — cited per index); absent from the numbered DDL because the
--       remote project predates this series and grew them ad hoc.
--   (c) Remote-schema reconcile: tables that exist remotely under legacy V1
--       shapes no mapping can write (openapi-verified, dry-run §3 B3 — ALL 0
--       ROWS remotely on 2026-11-06). Each is dropped ONLY when its
--       target-shape signature column is absent, then recreated at the
--       numbered-DDL shape the mappings write — a correctly-shaped table is
--       left untouched and a re-apply is a no-op. If any shows rows by apply
--       time, STOP and rename-aside like 011 did for sc_*/tickets instead.
--   (d) Tables absent from the remote openapi entirely: qe_fd_cache +
--       qa_access_log, created in the exact shapes the mappings write (the
--       previous draft's (ticket_id,detail_json,cached_at) and
--       (at,actor,action,detail) matched no mapping — dry-run verified).
--   (e) RLS enable + app_all policy on every recreated/new table (011
--       convention).

-- ---------- (a) idempotent re-run uniques (kept from WP-30/32 draft) ----------
CREATE UNIQUE INDEX IF NOT EXISTS tlp_queue_daily_date_tl_uidx
  ON public.tlp_queue_daily (date, tl_email);
CREATE UNIQUE INDEX IF NOT EXISTS tlp_team_tl_month_uidx
  ON public.tlp_team (tl_email, month);
CREATE UNIQUE INDEX IF NOT EXISTS queue_submissions_submission_uidx
  ON public.queue_submissions (submission_id);
CREATE UNIQUE INDEX IF NOT EXISTS dq_aging_flags_flag_uidx
  ON public.dq_aging_flags (flag_id);

-- ---------- (b) app-verified conflict targets ----------
-- prod_daily_layers: the engine/env upsert keys are hard-coded to
-- (date,email,layer) — shared/jobs/env.ts:349 — the only key separating the
-- 'raw' and 'effective' layers; (date,email) alone is non-unique by design
-- (dry-run B8). Remote has 2,579 rows: if any existing (date,email,layer)
-- duplicates exist this index fails — dedupe first, then re-apply.
CREATE UNIQUE INDEX IF NOT EXISTS prod_daily_layers_date_email_layer_uidx
  ON public.prod_daily_layers (date, email, layer);
-- prod_tph_*: the ported write paths upsert on exactly these keys —
-- cx-productivity/lib/tph/write.ts:108 ('date,agent_email'), :171/:198
-- ('task_id'), :227 ('date,source'); lib/tph/index.ts:1517/:1579 ('date').
CREATE UNIQUE INDEX IF NOT EXISTS prod_tph_days_date_agent_uidx
  ON public.prod_tph_days (date, agent_email);
CREATE UNIQUE INDEX IF NOT EXISTS prod_tph_tasks_task_id_uidx
  ON public.prod_tph_tasks (task_id);
CREATE UNIQUE INDEX IF NOT EXISTS prod_tph_cases_date_source_uidx
  ON public.prod_tph_cases (date, source);
CREATE UNIQUE INDEX IF NOT EXISTS prod_tph_touches_date_uidx
  ON public.prod_tph_touches (date);
CREATE UNIQUE INDEX IF NOT EXISTS prod_tph_calls_date_uidx
  ON public.prod_tph_calls (date);
-- prod_quarterly_reports.report_id: the app appends by report_id
-- (jobs/quarterly.ts:60-70); UNIQUE lets the corrected mapping upsert on it.
CREATE UNIQUE INDEX IF NOT EXISTS prod_quarterly_reports_report_id_uidx
  ON public.prod_quarterly_reports (report_id);
-- prod_tph_tasks.removed: the app writes the column (write.ts:171,196) but
-- the remote table predates it (dry-run B5 — remote lacks `removed`; the
-- sheet tab is empty today, 0 rows affected).
ALTER TABLE public.prod_tph_tasks ADD COLUMN IF NOT EXISTS removed boolean;

-- ---------- (c) V1-shape empty tables: guarded DROP + recreate ----------
-- Guard = drop only when the table lacks the signature column of the target
-- (mapping-write) shape; CREATE TABLE IF NOT EXISTS then converges. Remote
-- V1 shapes per dry-run §3 B3 (all verified 0 rows):
--   esc_seen             [id,agent_email,esc_id,seen_at]            (different entity)
--   agg_queue_now        [id,agent_email,channel,status,count,updated_at]
--   agg_inflow_daily     [date,channel,count]
--   agg_inflow_weekly    [week,channel,count]
--   agg_inflow_monthly   [month,channel,count]
--   agg_agent_perf       [date,agent_email,productivity_pct,quality_score,fcr_pct,tph]
--   agg_agent_daily      [date,agent_email,available_min,productive_min,cases_handled]
--   agg_snapshots_today  [snapshot_id,at,queue_data]                (jsonb blob)
--   kpi_ol_cases         [case_id,date,agent_email,hours,approved_by,approved_at] (different entity)
--   prod_quarterly_reports [report_id,quarter,year,...]             (already target shape -> no drop)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='esc_seen' AND column_name='ticket_id') THEN
    DROP TABLE IF EXISTS public.esc_seen;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='agg_queue_now' AND column_name='queue') THEN
    DROP TABLE IF EXISTS public.agg_queue_now;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='agg_inflow_daily' AND column_name='country') THEN
    DROP TABLE IF EXISTS public.agg_inflow_daily;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='agg_inflow_weekly' AND column_name='period') THEN
    DROP TABLE IF EXISTS public.agg_inflow_weekly;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='agg_inflow_monthly' AND column_name='period') THEN
    DROP TABLE IF EXISTS public.agg_inflow_monthly;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='agg_agent_perf' AND column_name='period') THEN
    DROP TABLE IF EXISTS public.agg_agent_perf;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='agg_agent_daily' AND column_name='overall_pct') THEN
    DROP TABLE IF EXISTS public.agg_agent_daily;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='agg_snapshots_today' AND column_name='snapshot_key') THEN
    DROP TABLE IF EXISTS public.agg_snapshots_today;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='kpi_ol_cases' AND column_name='key') THEN
    DROP TABLE IF EXISTS public.kpi_ol_cases;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='prod_quarterly_reports' AND column_name='report_id') THEN
    DROP TABLE IF EXISTS public.prod_quarterly_reports;
  END IF;
END $$;

-- Recreated shapes are verbatim 003_domain_tables.sql / 007_queue.sql — the
-- shapes the WP-30/31/32 mappings write.
CREATE TABLE IF NOT EXISTS public.esc_seen (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id text UNIQUE, status text, seen_at timestamptz, source text
);

CREATE TABLE IF NOT EXISTS public.agg_queue_now (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  queue text, kind text, open integer, actionable integer, unassigned integer,
  oldest_h double precision, over_top integer, created_today integer, resolved_today integer,
  as_of timestamptz, source_as_of timestamptz, stale boolean,
  by_status_json jsonb, bands_json jsonb
);

CREATE TABLE IF NOT EXISTS public.agg_inflow_daily (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, channel text, country text, inflow integer, updated_at timestamptz,
  UNIQUE (date, channel, country)
);

CREATE TABLE IF NOT EXISTS public.agg_inflow_weekly (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period text, channel text, country text, inflow integer, days integer,
  partial boolean, updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.agg_inflow_monthly (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period text, channel text, country text, inflow integer, days integer,
  partial boolean, updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.agg_agent_perf (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text, name text, tl_email text, tl_name text, period text,
  from_date text, to_date text, days integer, overall_pct double precision,
  inbound_pct double precision, texting_pct double precision, wa_pct double precision,
  inbound_achieved double precision, inbound_missed double precision,
  texting_achieved double precision, wa_achieved double precision,
  productive_min double precision, idle_min double precision,
  audits integer, avg_score double precision
);

CREATE TABLE IF NOT EXISTS public.agg_agent_daily (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date text, email text, overall_pct double precision,
  inbound_achieved double precision, texting_achieved double precision, wa_achieved double precision
);

CREATE TABLE IF NOT EXISTS public.agg_snapshots_today (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_key text, slot_date text, slot text, captured_at timestamptz, data_as_of timestamptz,
  late boolean, queue text, open integer, actionable integer, unassigned integer,
  oldest_h double precision, over_top integer, created_today integer, resolved_today integer,
  stale boolean, by_status_json jsonb, bands_json jsonb, year integer
);

CREATE TABLE IF NOT EXISTS public.kpi_ol_cases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE, month text, email text, cases integer, updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.prod_quarterly_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id text UNIQUE, quarter integer, year integer, start_date text, end_date text,
  report_json jsonb, created_at timestamptz
);

-- ---------- (d) tables absent remotely (dry-run §3 B3) ----------
-- 'Ticket Detail Cache' tab -> qe_fd_cache: the mapping's 13 verbatim columns;
-- id is the ticket id (cache semantics — PRIMARY KEY, mapping upserts on it).
CREATE TABLE IF NOT EXISTS public.qe_fd_cache (
  id text PRIMARY KEY,
  group_name text, contact_type_1 text, contact_type_2 text, contact_type_3 text,
  subject text, status text, country text, order_id text, channel text,
  source text, created_at timestamptz, cached_at timestamptz
);
-- 'QaAccessLog' tab -> qa_access_log: the mapping's 4 columns verbatim.
-- Insert-only audit log (no natural unique — a re-run duplicates).
CREATE TABLE IF NOT EXISTS public.qa_access_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text, action text, submitted_by text, submitted_at timestamptz
);

-- ---------- (e) RLS: enable + app_all on every recreated/new table ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'esc_seen','agg_queue_now','agg_inflow_daily','agg_inflow_weekly',
    'agg_inflow_monthly','agg_agent_perf','agg_agent_daily',
    'agg_snapshots_today','kpi_ol_cases','prod_quarterly_reports',
    'qe_fd_cache','qa_access_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS app_all ON public.%I', t);
    EXECUTE format('CREATE POLICY app_all ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
