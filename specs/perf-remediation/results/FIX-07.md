# FIX-07 — done

- Files: `supabase/migrations/20261108231643_job_data_tick_pg_cron.sql`, `docs/ARCHITECTURE.md` (+~50/-30 lines; budget 60).
- Added `cron.schedule('cxh-job-data-tick-health', '7-59/15 * * * *', ...)`: selects newest `net._http_response` (created within 20 min, sole-pg_net-caller assumption commented) and `RAISE EXCEPTION` on `status_code IS DISTINCT FROM 200`, `timed_out`, `error_msg`, or no recent row — failures land as `status='failed'` in `cron.job_run_details`.
- Unschedule-by-name guard now covers both job names; tick `*/15` job, settings guard, zero-literal-secrets unchanged; header + verification comments updated (both job names, health-failure query).
- ARCHITECTURE.md: one sentence — health job name, cadence (+7m), failures in `cron.job_run_details`.
- Verify: `supabase migration list` registers `20261108231643`; pg_net columns verified vs docs (`status_code` nullable -> `IS DISTINCT FROM 200`). No local stack running, no remote apply.
- Handoff: NEEDS_APPROVAL unchanged — remote apply after `app.settings.*` provisioning, before the FIX-02b vercel.json deploy.
