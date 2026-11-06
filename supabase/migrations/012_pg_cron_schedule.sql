-- ============================================================================
-- 012_pg_cron_schedule.sql — DRAFT-BLOCKED-B5 (WP-24). DO NOT APPLY YET.
-- ============================================================================
-- Sub-hourly + fixed-time internal cron schedule for CX-Hub jobs, replacing
-- GAS installable triggers per D-SCHED (see specs/megaplan/audits/jobs.md).
--
-- Blocked on B5: CRON_SECRET + canonical app URL must exist in the Vercel
-- environment first. Two placeholders must be substituted at apply time:
--   {{APP_URL}}      e.g. https://cx-hub.example.com   (no trailing slash)
--   {{CRON_SECRET}}  the same value Vercel injects for cron Authorization
--
-- Preconditions:
--   * pg_cron + pg_net already enabled by 011_remote_reconcile.sql
--     (CREATE EXTENSION IF NOT EXISTS kept here for idempotence).
--   * WP-F18 LANDED (dd8dff2d): /api/desk/job/mail now checks Bearer
--     CRON_SECRET before requireJobCaller (route.ts:6-10,15). Verify the
--     deployed build includes it before enabling cxh-mail-desk.
--   * All times are UTC. Legacy installers used business_tz Asia/Kuwait
--     (UTC+3, no DST): Kuwait HH:MM = (HH-3):MM UTC.
--
-- Idempotent: every entry is preceded by an unschedule-by-name guard, so the
-- file can be re-applied without duplicating jobs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule guard: no-op when the job does not exist.
DO $$
DECLARE
  names text[] := ARRAY[
    'cxh-job-data-tick', 'cxh-job-nightly-aggregates', 'cxh-job-qa-engine',
    'cxh-job-tl-queue', 'cxh-oo-reminders', 'cxh-missed-1on1-check',
    'cxh-task-reminders', 'cxh-meeting-reminders', 'cxh-scorecard-nightly',
    'cxh-mail-desk',
    'cxh-job-tph-hourly', 'cxh-job-tph-past-days',
    'cxh-roster-sync', 'cxh-assistant-digest', 'cxh-warm-my-day',
    'cxh-fc-messages', 'cxh-int-maqsam', 'cxh-int-freshchat'
  ];
  j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = ANY(names) LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- QUEUE — jobDataTick (Setup.js:185 everyMinutes(15)).
-- Runs freshdesk_sync + queue_aggregates + inflow(55-min gate) + checkin_tick
-- (+ folded queue_snapshot 4x/day, daily_report reads). jobs.md §1 rows 1-7.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-job-data-tick',
  '*/15 * * * *',
  $cmd$SELECT net.http_get(
    '{{APP_URL}}/api/cron/job-data-tick',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'),
    60000)$cmd$
);

-- ----------------------------------------------------------------------------
-- QUEUE/HUB — jobNightlyAggregates (Setup.js:186 ~09:30 Kuwait = 06:30 UTC).
-- Steps: agent_aggregates, inflow hourly/weekly/monthly rebuild, year_rollover.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-job-nightly-aggregates',
  '30 6 * * *',
  $cmd$SELECT net.http_get(
    '{{APP_URL}}/api/cron/job-nightly-aggregates',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'),
    60000)$cmd$
);

-- ----------------------------------------------------------------------------
-- QUALITY — jobQualityDaily (Quality.js:3618 ~10:30 tz) consolidated with
-- jobQualityHistory (:3619 ~11:30). Route runs qa_queue_import +
-- qa_history_import + qa_ctl_reminders in one call (jobs.md §4-F: history runs
-- ~1h earlier than the legacy split — accepted deviation).
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-job-qa-engine',
  '30 7 * * *',
  $cmd$SELECT net.http_get(
    '{{APP_URL}}/api/cron/job-qa-engine',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'),
    60000)$cmd$
);

-- ----------------------------------------------------------------------------
-- QUEUE — jobTlQueueMetrics (TlQueue.js:495 everyHours(1)).
-- BLOCKED_TASKS.md B5 sketched '15 0 * * *' daily; hourly chosen to keep the
-- HB_PLAN every:60/grace:90 window green (jobs.md §4-C). NOTE: ported impl
-- rebuilds [yesterday] only vs legacy [yesterday, today] — WP-F2 gap.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-job-tl-queue',
  '15 * * * *',
  $cmd$SELECT net.http_get(
    '{{APP_URL}}/api/cron/job-tl-queue',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'),
    60000)$cmd$
);

-- ----------------------------------------------------------------------------
-- PEOPLE — jobOneOnOneReminders (OneOnOneReminders.js:113 everyMinutes(1)).
-- D-SCHED floor 1-min -> 15-min; internal OO_REM_NEXT_CONFIG next-due gate
-- preserved (jobs.md §4-H) so no reminder window is missed.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-oo-reminders',
  '*/15 * * * *',
  $cmd$SELECT net.http_get(
    '{{APP_URL}}/api/cron/oo-reminders',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'),
    30000)$cmd$
);

-- jobMissedOneOnOneCheck — 22:30 Kuwait = 19:30 UTC (PeopleTriggers.js:17).
SELECT cron.schedule(
  'cxh-missed-1on1-check',
  '30 19 * * *',
  $cmd$SELECT net.http_get(
    '{{APP_URL}}/api/cron/missed-1on1-check',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'),
    30000)$cmd$
);

-- jobTaskReminders — 10:00 Kuwait = 07:00 UTC (PeopleTriggers.js:19).
SELECT cron.schedule(
  'cxh-task-reminders',
  '0 7 * * *',
  $cmd$SELECT net.http_get(
    '{{APP_URL}}/api/cron/task-reminders',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'),
    30000)$cmd$
);

-- jobMeetingActionReminders — 10:30 Kuwait = 07:30 UTC (PeopleTriggers.js:21).
SELECT cron.schedule(
  'cxh-meeting-reminders',
  '30 7 * * *',
  $cmd$SELECT net.http_get(
    '{{APP_URL}}/api/cron/meeting-reminders',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'),
    30000)$cmd$
);

-- jobScorecardNightly — ~09:30 Kuwait = 06:30 UTC (PeopleTriggers.js:65).
SELECT cron.schedule(
  'cxh-scorecard-nightly',
  '30 6 * * *',
  $cmd$SELECT net.http_get(
    '{{APP_URL}}/api/cron/scorecard-nightly',
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'),
    60000)$cmd$
);

-- ----------------------------------------------------------------------------
-- DESK — jobMailDesk (TlPerformance.js:408 everyMinutes(10)).
-- D-SCHED floor -> */15. HB_PLAN retains legacy every:10/grace:20 label
-- (jobs.md §4-G): after enabling, bump the window below or the row reads
-- 'warn' on the 10-15 min gap.
-- Route is Bearer-gated since WP-F18; safe to schedule once B5 env exists.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'cxh-mail-desk',
  '*/15 * * * *',
  $cmd$SELECT net.http_post(
    '{{APP_URL}}/api/desk/job/mail',
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}',
                       'Content-Type', 'application/json'),
    60000)$cmd$
);

-- Optional one-time window fix once */15 is live (owner decision — jobs.md §4-G):
-- UPDATE health SET expect_every_min = 15 WHERE job = 'mail_desk';

-- ============================================================================
-- COMMENTED — divergences/alternatives. Uncomment deliberately (jobs.md §4).
-- ============================================================================

-- (A) jobTphHourly — legacy everyMinutes(15) (ProductivityApp.js:616); vercel.json
-- currently fires :05 + :55 (~2x/h, uneven). Enable this pg_cron line ONLY after
-- the PM removes the vercel entries (PM-owned file) or the job double-fires.
-- SELECT cron.schedule(
--   'cxh-job-tph-hourly',
--   '*/15 * * * *',
--   $cmd$SELECT net.http_get('{{APP_URL}}/api/cron/job-tph-hourly',
--     '{}'::jsonb,
--     jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'), 60000)$cmd$
-- );

-- (B) jobTphPastDays — legacy everyHours(1) (:617); vercel.json has daily
-- '0 5 * * *'. Preferred fix is vercel '0 * * * *' (>=1h jobs stay in Vercel
-- per D-SCHED). Alternative pg_cron hourly:
-- SELECT cron.schedule(
--   'cxh-job-tph-past-days',
--   '7 * * * *',
--   $cmd$SELECT net.http_get('{{APP_URL}}/api/cron/job-tph-past-days',
--     '{}'::jsonb,
--     jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'), 60000)$cmd$
-- );

-- ----------------------------------------------------------------------------
-- BLOCKED — routes/gates not yet present (do NOT uncomment before WP-F15/B3).
-- ----------------------------------------------------------------------------

-- roster_sync — ported (cx-hub/lib/roster.ts:373) but unrouted + G1. WP-F15.
-- SELECT cron.schedule('cxh-roster-sync', '0 4 * * *',  -- 07:00 Kuwait
--   $cmd$SELECT net.http_get('{{APP_URL}}/api/cron/roster-sync', '{}'::jsonb,
--     jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'), 60000)$cmd$);

-- jobAssistantMorningDigest — ported (myday.ts:817) but unrouted + G3 +
-- assistant_digest_installed flag + requireAssistantJobCaller_ gap (jobs.md
-- §2-15). WP-F15. 07:30 Kuwait = 04:30 UTC.
-- SELECT cron.schedule('cxh-assistant-digest', '30 4 * * *',
--   $cmd$SELECT net.http_get('{{APP_URL}}/api/cron/assistant-digest', '{}'::jsonb,
--     jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'), 30000)$cmd$);

-- jobWarmMyDay — ported (myday.ts:713) but unrouted + G3. WP-F15.
-- Legacy everyMinutes(10) with 06:00-22:00 KW internal skip -> */15 03-19 UTC.
-- SELECT cron.schedule('cxh-warm-my-day', '*/15 3-19 * * *',
--   $cmd$SELECT net.http_get('{{APP_URL}}/api/cron/warm-my-day', '{}'::jsonb,
--     jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'), 30000)$cmd$);

-- fc_messages — NOT ported (B3 creds + WP-53/WP-F16). Legacy daily ~05:00 Cairo.
-- SELECT cron.schedule('cxh-fc-messages', '0 2 * * *',
--   $cmd$SELECT net.http_get('{{APP_URL}}/api/cron/fc-messages', '{}'::jsonb,
--     jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}'), 60000)$cmd$);

-- ----------------------------------------------------------------------------
-- OPTIONAL — mirror refreshers. Mirrors are already refreshed daily inside
-- job-productivity-daily (mirror_sync step, vercel 30 6). Enable only if the
-- board needs fresher daily_report/maqsam data between daily runs.
-- ----------------------------------------------------------------------------
-- SELECT cron.schedule('cxh-int-maqsam', '*/30 * * * *',
--   $cmd$SELECT net.http_post('{{APP_URL}}/api/integrations/maqsam', '{}'::jsonb,
--     '{}'::jsonb, jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}',
--       'Content-Type', 'application/json'), 60000)$cmd$);
-- SELECT cron.schedule('cxh-int-freshchat', '10 * * * *',   -- gated B3
--   $cmd$SELECT net.http_post('{{APP_URL}}/api/integrations/freshchat', '{}'::jsonb,
--     '{}'::jsonb, jsonb_build_object('Authorization', 'Bearer {{CRON_SECRET}}',
--       'Content-Type', 'application/json'), 60000)$cmd$);

-- ============================================================================
-- Verification after apply (substituted env):
--   SELECT jobid, jobname, schedule, active FROM cron.job
--    WHERE jobname LIKE 'cxh-%' ORDER BY jobname;
--   SELECT status, return_message, start_time FROM cron.job_run_details
--    ORDER BY start_time DESC LIMIT 20;
-- Heartbeat rows: SELECT job, status, last_ok_at, expect_every_min FROM health
--    ORDER BY job;
-- ============================================================================
