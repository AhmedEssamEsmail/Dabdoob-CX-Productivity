-- 011_remote_reconcile.sql — records the remote-only reconciliation that was
-- applied through the Supabase MCP on 2026-11-06 (project uugeyulccyytvgcabzzx).
-- The remote project predates this migration series: its schema was built
-- out-of-band (timestamped migrations 2026103*), so several 002/003 tables had
-- never been created and three legacy-era table names collided with ours.
--
-- On the real project these already ran; IF NOT EXISTS / renames keep this
-- replayable in fresh environments.

-- ---------- Missing 002_platform tables ----------
CREATE TABLE IF NOT EXISTS options (
  id BIGSERIAL PRIMARY KEY,
  list_key TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  sort INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_options_list_key ON options(list_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_options_list_value ON options(list_key, lower(value));

CREATE TABLE IF NOT EXISTS popups (
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
CREATE INDEX IF NOT EXISTS idx_popups_pending ON popups(recipient) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_popups_kind_ref ON popups(kind, ref) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS mail_log (
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
CREATE INDEX IF NOT EXISTS idx_mail_log_sent_at ON mail_log(sent_at);

CREATE TABLE IF NOT EXISTS holidays (
  id BIGSERIAL PRIMARY KEY,
  country TEXT NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  deleted_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

CREATE TABLE IF NOT EXISTS one_on_one_schedule (
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
CREATE INDEX IF NOT EXISTS idx_ooo_status_at ON one_on_one_schedule(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ooo_manager ON one_on_one_schedule(manager_email);
CREATE INDEX IF NOT EXISTS idx_ooo_report ON one_on_one_schedule(report_email);

-- ---------- Missing 003_domain tables ----------
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
CREATE TABLE IF NOT EXISTS dq_aging_flags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flag_id text, ticket_id text, note text, tl_email text,
  resolved_at timestamptz, resolved_by text, resolved_note text,
  submitted_by text, submitted_at timestamptz
);
CREATE TABLE IF NOT EXISTS queue_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id text, slot_date text, slot text, snapshot_key text, status text,
  queues_json jsonb, corrections_json jsonb, correction_reason text,
  general_note text, help_needed boolean, help_note text,
  submitted_by text, submitted_at timestamptz, updated_by text, updated_at timestamptz
);

-- ---------- Name collisions (empty legacy-era tables, renamed aside remotely) ----------
-- sc_daily / sc_behaviour / sc_months existed with an unrelated shape
-- (agent_email/behaviour_score). Remote: renamed to *_legacy_pre008, then 008
-- created the scorecard stores. Fresh environments reach the same end state
-- because the 008 CREATEs run first and these guards no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='sc_daily'
               AND column_name='agent_email') THEN
    ALTER TABLE sc_daily RENAME TO sc_daily_legacy_pre008;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='sc_behaviour'
               AND column_name='agent_email') THEN
    ALTER TABLE sc_behaviour RENAME TO sc_behaviour_legacy_pre008;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='sc_months'
               AND column_name='agent_email') THEN
    ALTER TABLE sc_months RENAME TO sc_months_legacy_pre008;
  END IF;
  -- `tickets` existed as a generic JSON store (data_json); every consumer
  -- selects the 003 FD_TICKET_HEADERS columns. Remote: renamed to
  -- tickets_legacy_pre003 and recreated.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='tickets'
               AND column_name='data_json') THEN
    ALTER TABLE tickets RENAME TO tickets_legacy_pre003;
  END IF;
END $$;

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

-- ---------- RLS posture: enable + app_all on every module table ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'follow_up_done','cache_stamps',
    'options','popups','mail_log','holidays','one_on_one_schedule',
    'kpi_behaviour_log','kpi_leave_log','tlp_team','tlp_area_metrics','dq_aging_flags','queue_submissions',
    'qa_forms','qa_ctls','qa_disputes','qa_calibrations','qa_kb_gaps',
    'qe_queue_log','qe_candidates','qe_outcomes','qe_builds','qe_catalogue',
    'queue_snapshots','agg_snapshots_today','aging_open_tickets','agg_queue_now',
    'agg_inflow_daily','agg_inflow_weekly','agg_inflow_monthly','agg_inflow_hourly',
    'agg_agent_perf','agg_agent_daily','esc_seen',
    'sched_config','sched_team','sched_offdays','sched_overrides','sched_hour_overrides','sched_requests','sched_plan',
    'tlp_shifts','tlp_queue_daily','heatmap_inputs','heatmap_assumption_sets',
    'actions','action_reviews','action_updates','action_task_details','action_planned_milestones',
    'one_on_one_logs','one_on_one_topics','one_on_one_private_notes',
    'meeting_series','meeting_series_members','meetings','meeting_attendees',
    'pw_reminder_log','people_signals','my_notes','one_on_one_topic_prompts',
    'sc_daily','sc_behaviour','sc_months',
    'trackers','tracker_fields','tracker_records',
    'tlp_resp_ratings','tlp_kb','tlp_otd','tlp_ticket_exclusions',
    'mail_sla','mail_approvals','mail_approval_log','tickets'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS app_all ON public.%I', t);
    EXECUTE format('CREATE POLICY app_all ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ---------- Extensions needed by the scheduled-job layer ----------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
