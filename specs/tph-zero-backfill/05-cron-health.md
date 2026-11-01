# 05 — Cron health verification

Confirm the scheduled chain actually runs after 01/02 land. The zero-state was partly caused by crons never reaching step bodies — "No automatic build found in the run log" means `refresh_log` is empty and `dqStep_` never ran.

## Diagnosis checklist

- `CRON_SECRET` present on Vercel (`00`'s env-presence check). If absent → set it; the 401 path can't be verified from code.
- `vercel.json` cron entries exist and match route paths (`job-productivity-daily`, `job-tph-hourly`, `job-tph-past-days`, quarterly job).
- Hobby plan reality: Vercel free plans allow **daily** crons only — the 15-min/hourly `job-tph-*` entries are silently unscheduled. Fold mirror-sync + past-days work into the daily job's chain or an external scheduler (same decision as 01's cron wiring).

## Verification steps

1. Deploy with fixes; trigger `GET /api/cron/job-productivity-daily` manually with the `Authorization: Bearer ${CRON_SECRET}` header.
2. Confirm `refresh_log` gets rows for `prod_intervals`, `prod_flags`, `prod_tph_touches`, `prod_tph_calls`, `prod_tph_cases`, `prod_daily_layers` — each step logs even on failure via `dqStep_`.
3. Confirm `health` rows update per job (`hbRowState_` ok/warn/down).
4. TPH page "Last automatic build" chip shows a timestamp.
5. `job-tph-hourly` folds auto-captures only if `agg_queue_now` is populated (sibling Hub app or missing → health check reports; auto cases stay TL/rebuilt-sourced meanwhile — surfaced via `rebuiltReasons`).

## Acceptance

- At least one real (non-manual) cron run lands `refresh_log` rows after deploy.
- Any step that fails produces a described error in the log (02's mapper), not a raw PostgREST string.
- If Hobby limits prevent the 15-min cadence, the limitation is documented in the tracker + the daily chain covers the same work once/day.
