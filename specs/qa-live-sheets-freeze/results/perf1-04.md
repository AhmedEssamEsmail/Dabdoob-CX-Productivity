# perf1-04 — stagger cxh-scorecard-nightly off the shared 06:30 UTC slot (perf-5)

Status: PASS (edit-in-place correct — migration not yet applied remotely)
Files: `supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql` (2 lines: header :18, schedule :154)
Remote-applied check: TRACKER.md:104 lists this file under "Remote apply pending"; `supabase migration list --remote` read-only check returned 403 (token scope) — TRACKER + file header (:51-54) assert pending, so no corrective migration needed.
Checks: `cron.schedule('cxh-scorecard-nightly', '45 6 * * *')` at :152-154; `cxh-job-nightly-aggregates` stays `'30 6 * * *'` at :104-106; header table matches (:16/:18). grep -c: `'30 6 * * *'`=2, `'45 6 * * *'`=2 — i.e. exactly ONE JOB per slot (header line + schedule literal each; leaf's "one left" = one job). All other jobs/settings-guards/unschedule list byte-identical.
No remote apply performed; ships with pending `db push` batch (PM/deploy).
Handoff: the two heavy nightly jobs now fire 15 min apart (06:30 vs 06:45 UTC) on next remote apply; still before qa-engine's 07:30 UTC.
