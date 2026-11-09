-- ============================================================================
-- 20261108231643_job_data_tick_pg_cron.sql — pg_cron + pg_net schedule for
-- /api/cron/job-data-tick every 15 min (job 'cxh-job-data-tick'), plus health
-- check 'cxh-job-data-tick-health' (every 15 min offset +7m) that raises in
-- cron.job_run_details when the newest pg_net response is not a clean 200 —
-- a failed tick can no longer pass silently (sec-1 finding sec-3).
-- Replaces the Vercel daily cron (Hobby plan cannot do sub-daily).
-- PM decision 2026-11-09 / PLAN #9; criteria qa-1/qa-2.
--
-- Required DB-side config — provision BEFORE apply (read at each job run,
-- never stored in this file). Run once on the target database:
--   ALTER DATABASE postgres SET "app.settings.app_url" =
--     '<canonical app base URL, https scheme, no trailing slash>';
--   ALTER DATABASE postgres SET "app.settings.cron_secret" =
--     '<same CRON_SECRET value Vercel injects for cron Authorization>';
-- If either is unset, the job fails loudly in cron.job_run_details (guard in
-- the command below) — silent NULL would mark the run 'succeeded'.
--
-- APPLY ORDER: remote apply is user-approved only and MUST land BEFORE the
-- FIX-02b vercel.json deploy removes the Vercel entry, or job-data-tick has a
-- coverage gap.
--
-- Preconditions: pg_cron + pg_net enabled by 011_remote_reconcile.sql
-- (CREATE EXTENSION IF NOT EXISTS kept for idempotence). All times UTC.
-- Idempotent: unschedule-by-name guard re-creates the job on re-apply.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule guard: no-op when the jobs do not exist (012 pattern); covers
-- both the tick and its health check so re-apply recreates both.
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job
           WHERE jobname IN ('cxh-job-data-tick', 'cxh-job-data-tick-health') LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'cxh-job-data-tick',
  '*/15 * * * *',
  $cmd$
DO $job$
BEGIN
  IF current_setting('app.settings.app_url', true) IS NULL
     OR current_setting('app.settings.cron_secret', true) IS NULL THEN
    RAISE EXCEPTION 'cxh-job-data-tick: set app.settings.app_url and app.settings.cron_secret (ALTER DATABASE ... SET)';
  END IF;
  PERFORM net.http_get(
    current_setting('app.settings.app_url', true) || '/api/cron/job-data-tick',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)),
    60000);
END;
$job$;
  $cmd$
);

-- Health check: every 15 min offset +7m (a few minutes after each tick fires;
-- the 20-min lookback covers the latest tick plus response latency). Any
-- failure raises -> the run lands as status='failed' with the detail in
-- cron.job_run_details.return_message, so a dead/misfiring tick is loud.
-- Assumption: cxh-job-data-tick is the sole pg_net caller on this database,
-- so the newest net._http_response row is the latest tick's response.
SELECT cron.schedule(
  'cxh-job-data-tick-health',
  '7-59/15 * * * *',
  $cmd$
DO $job$
DECLARE
  r record;
BEGIN
  SELECT id, status_code, timed_out, error_msg INTO r
    FROM net._http_response
   WHERE created > now() - interval '20 minutes'
   ORDER BY created DESC, id DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cxh-job-data-tick-health: no pg_net response in last 20 min (tick unscheduled, settings guard tripping, or pg_net broken)';
  END IF;
  IF r.timed_out IS TRUE OR r.error_msg IS NOT NULL OR r.status_code IS DISTINCT FROM 200 THEN
    RAISE EXCEPTION 'cxh-job-data-tick-health: latest tick response bad (id %, status %, timed_out %, error_msg %)',
      r.id, COALESCE(r.status_code::text, 'NULL'), r.timed_out, r.error_msg;
  END IF;
END;
$job$;
  $cmd$
);

-- ============================================================================
-- Verification after apply:
--   SELECT jobid, jobname, schedule, active FROM cron.job
--    WHERE jobname IN ('cxh-job-data-tick', 'cxh-job-data-tick-health');
--   SELECT status, return_message, start_time FROM cron.job_run_details
--    ORDER BY start_time DESC LIMIT 20;
--   -- Health-check failures appear above as status='failed' rows whose
--   -- return_message starts 'cxh-job-data-tick-health:'; inspect the newest
--   -- tick response directly with:
--   SELECT id, status_code, timed_out, error_msg, created
--     FROM net._http_response ORDER BY created DESC LIMIT 5;
-- ============================================================================
