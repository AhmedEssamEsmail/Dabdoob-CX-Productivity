-- ============================================================================
-- 20261116202809_pg_cron_scoped_wave1.sql — scoped pg_cron wave-1 schedule for
-- the five internal job routes that are missing BOTH a vercel.json crons
-- entry AND a cron.job row on remote (S09-01 / PLAN #5 as amended by
-- DECISION: pg_cron scoped apply supersedes vercel.json).
--
-- Scope rule applied: schedule a candidate ONLY if it has no vercel.json
-- crons entry (verified 2026-11-16: none of the five paths present) AND no
-- cron.job row on remote (verified 2026-11-16 read-only SELECT, evidence:
-- specs/qa-live-sheets-freeze/results/S09-01-remote-cron.md). Remote cron.job
-- held only 'cxh-job-data-tick' + 'cxh-job-data-tick-health' -> nothing was
-- skipped; all five candidates below are scheduled.
--
-- Jobs (all times UTC):
--   cxh-job-qa-engine          '30 7 * * *'  GET  /api/cron/job-qa-engine
--   cxh-job-nightly-aggregates '30 6 * * *'  GET  /api/cron/job-nightly-aggregates
--   cxh-job-tl-queue           '15 * * * *'  GET  /api/cron/job-tl-queue
--   cxh-scorecard-nightly      '45 6 * * *'  GET  /api/cron/scorecard-nightly
--   cxh-mail-desk              '*/15 * * * *' POST /api/desk/job/mail
--
-- Command pattern: derived from the APPLIED 20261108231643_job_data_tick_pg_cron
-- file — same settings-guard DO block, but the two job secrets are now read
-- from Supabase Vault at each run:
--   (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url')
--   (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret')
-- Vault replaces the earlier ALTER DATABASE custom-GUC design — the host
-- disallows ALTER DATABASE/ROLE custom GUCs (42501 on any app.* parameter).
-- NOT the {{APP_URL}}/{{CRON_SECRET}} placeholder shape of draft-blocked
-- 20261106201210 (DO-NOT-APPLY). Zero secret literals here.
--
-- Required DB-side config — provision BEFORE/WITH apply (read at each job
-- run, never stored in this file). Run once on the target database:
--   SELECT vault.create_secret(
--     '<canonical app base URL, https scheme, no trailing slash>',
--     'cxh_app_url');
--   SELECT vault.create_secret(
--     '<same CRON_SECRET value Vercel injects for cron Authorization>',
--     'cxh_cron_secret');
-- !! REMOTE STATE 2026-11-16: vault secrets cxh_app_url / cxh_cron_secret
-- NOT yet created — absent names read as NULL, so every job in THIS file
-- raises '<jobname>: create vault secrets cxh_app_url and cxh_cron_secret'
-- in cron.job_run_details until the create_secret calls above land. The
-- live cxh-job-data-tick row predates the guard pattern and embeds
-- literals, so it runs today. Provisioning is part of the apply step; do
-- not apply without it.
--
-- Pre-reqs:
--   * pg_cron + pg_net already enabled remotely (CREATE EXTENSION IF NOT
--     EXISTS kept for idempotence).
--   * supabase_vault already installed remotely (v0.3.1) — job secrets read
--     via vault.decrypted_secrets; provisioned with vault.create_secret.
--   * WP-F18 LANDED: /api/desk/job/mail checks Bearer CRON_SECRET before
--     requireJobCaller (route.ts:6-15) — verify the deployed build includes
--     it before enabling cxh-mail-desk.
--   * Existing jobs stay untouched: cxh-job-data-tick (+health) are NOT in
--     this file's unschedule list — non-goal per S09.
--
-- APPLY PATH: remote apply is user-approval-gated and happens outside this
-- leaf — `env -u SUPABASE_ACCESS_TOKEN npx supabase db push --remote`
-- (verify the `Target:` line = production before confirming).
-- Idempotent: unschedule-by-name guard re-creates these five on re-apply.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule guard: no-op when the jobs do not exist; lists ONLY the five
-- jobs this file schedules (data-tick pair deliberately excluded).
DO $$
DECLARE
  names text[] := ARRAY[
    'cxh-job-qa-engine', 'cxh-job-nightly-aggregates', 'cxh-job-tl-queue',
    'cxh-scorecard-nightly', 'cxh-mail-desk'
  ];
  j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = ANY(names) LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- QUALITY — jobQualityDaily (qa_queue_import + qa_history_import +
-- qa_ctl_reminders). Uncovered: no vercel.json path, no cron.job row.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-job-qa-engine',
  '30 7 * * *',
  $cmd$
DO $job$
BEGIN
  IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') IS NULL
     OR (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret') IS NULL THEN
    RAISE EXCEPTION 'cxh-job-qa-engine: create vault secrets cxh_app_url and cxh_cron_secret (vault.create_secret)';
  END IF;
  PERFORM net.http_get(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') || '/api/cron/job-qa-engine',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret')),
    60000);
END;
$job$;
  $cmd$
);

-- ----------------------------------------------------------------------------
-- QUEUE/HUB — jobNightlyAggregates (agent_aggregates + inflow rebuilds +
-- year_rollover). Uncovered: no vercel.json path, no cron.job row.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-job-nightly-aggregates',
  '30 6 * * *',
  $cmd$
DO $job$
BEGIN
  IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') IS NULL
     OR (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret') IS NULL THEN
    RAISE EXCEPTION 'cxh-job-nightly-aggregates: create vault secrets cxh_app_url and cxh_cron_secret (vault.create_secret)';
  END IF;
  PERFORM net.http_get(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') || '/api/cron/job-nightly-aggregates',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret')),
    60000);
END;
$job$;
  $cmd$
);

-- ----------------------------------------------------------------------------
-- QUEUE — jobTlQueueMetrics hourly. Uncovered: no vercel.json path, no
-- cron.job row.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-job-tl-queue',
  '15 * * * *',
  $cmd$
DO $job$
BEGIN
  IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') IS NULL
     OR (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret') IS NULL THEN
    RAISE EXCEPTION 'cxh-job-tl-queue: create vault secrets cxh_app_url and cxh_cron_secret (vault.create_secret)';
  END IF;
  PERFORM net.http_get(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') || '/api/cron/job-tl-queue',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret')),
    60000);
END;
$job$;
  $cmd$
);

-- ----------------------------------------------------------------------------
-- PEOPLE — jobScorecardNightly. Uncovered: no vercel.json path, no cron.job
-- row.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-scorecard-nightly',
  '45 6 * * *',
  $cmd$
DO $job$
BEGIN
  IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') IS NULL
     OR (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret') IS NULL THEN
    RAISE EXCEPTION 'cxh-scorecard-nightly: create vault secrets cxh_app_url and cxh_cron_secret (vault.create_secret)';
  END IF;
  PERFORM net.http_get(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') || '/api/cron/scorecard-nightly',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret')),
    60000);
END;
$job$;
  $cmd$
);

-- ----------------------------------------------------------------------------
-- DESK — jobMailDesk every 15 min (POST; Bearer-gated since WP-F18,
-- route.ts:6-15). Uncovered: no vercel.json path, no cron.job row.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-mail-desk',
  '*/15 * * * *',
  $cmd$
DO $job$
BEGIN
  IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') IS NULL
     OR (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret') IS NULL THEN
    RAISE EXCEPTION 'cxh-mail-desk: create vault secrets cxh_app_url and cxh_cron_secret (vault.create_secret)';
  END IF;
  PERFORM net.http_post(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_app_url') || '/api/desk/job/mail',
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cxh_cron_secret'),
                       'Content-Type', 'application/json'),
    60000);
END;
$job$;
  $cmd$
);

-- ============================================================================
-- Verification after apply:
--   SELECT jobid, jobname, schedule, active FROM cron.job
--    WHERE jobname LIKE 'cxh-%' ORDER BY jobname;
--   SELECT status, return_message, start_time FROM cron.job_run_details
--    ORDER BY start_time DESC LIMIT 20;
--   -- First-run rows appear above after each job's first fire; a missing
--   -- vault-secret provision lands as status='failed' with return_message
--   -- '<jobname>: create vault secrets cxh_app_url and cxh_cron_secret'.
--   SELECT id, status_code, timed_out, error_msg, created
--     FROM net._http_response ORDER BY created DESC LIMIT 5;
--   -- Health heartbeats land via each route's own health writes; expect
--   -- qe_builds/qa_queue rows after the 07:30 UTC qa-engine fire.
-- ============================================================================
