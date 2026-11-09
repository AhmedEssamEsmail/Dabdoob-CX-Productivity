# sec report - perf-remediation - round 2 (DELTA)

Verdict: FAIL
Open: 0 BLOCKER / 0 HIGH / 1 MED / 0 LOW

Scope: tl-3 FIX round — 5 `cronOk` copies, `repo.ts` `updateRows`, amended
migration `20261108231643_job_data_tick_pg_cron.sql`, `ARCHITECTURE.md`,
2 regression tests, `vercel.json` (data-tick entry removed).

## Prior findings — all verified FIXED
- **sec-1 (MED)**: all 5 `cronOk` copies now
  `if (!secret) return process.env.NODE_ENV !== 'production'` — fail-closed in
  prod; grep confirms zero `return true` fail-open remains in `src/`.
  Regression test asserts 401 for `job-nightly-aggregates` with
  NODE_ENV=production + no secret (tests/jobs/routes.test.ts:86-92). FIXED.
- **sec-2 (LOW)**: `updateRows` upserts `patchByKey` =
  `{[keyField]: u.key, ...data}` (repo.ts:236) — only key + sanitized patch +
  stamps reach PostgREST; `out` still returns merged rows; constraint fallback
  verbatim. Regression test asserts upsert payload excludes unpatched columns.
  Lost-update window closed. FIXED.
- **sec-3 (LOW)**: migration now schedules `cxh-job-data-tick-health` at
  `7-59/15 * * * *` (offset +7m): newest `net._http_response` within 20 min
  must be clean-200 else `RAISE EXCEPTION` → `status='failed'` in
  `cron.job_run_details`. Sole-pg_net-caller assumption commented (file:68-69);
  runbook line added to ARCHITECTURE.md. FIXED.

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| sec-4 | MED | src/app/api/cron/job-tph-hourly/route.ts:16 (+15 siblings: `cron/{analytics-aggregation,daily-layers,flag-detection,job-productivity-daily,job-quarterly-report,job-tph-past-days,meeting-reminders,missed-1on1-check,oo-reminders,scorecard-nightly,task-reminders}`, `integrations/{freshchat,freshdesk,gmail,maqsam}`) | sec-1's fix covered only the `cronOk` shape. These 16 routes gate on `authHeader !== `Bearer ${process.env.CRON_SECRET}``: when `CRON_SECRET` is unset the expected header is the constant string `Bearer undefined` — any internet caller who sends it passes the 401 gate, and `requireJobCaller()` returns early for sessionless callers (identity.ts:142-143), so reminder-send + aggregate + integration jobs run unauthenticated. Same missing-secret precondition as sec-1, wider surface (incl. jobs that notify staff). | Hoist and null-check first: `const s = process.env.CRON_SECRET; if (!s || authHeader !== 'Bearer ' + s) return 401` (mirrors the cronOk fail-closed pattern; optionally keep the `NODE_ENV !== 'production'` dev escape for parity). | dev |

Not verified / assumptions:
- Non-prod (`NODE_ENV != 'production'`) cron routes remain open without a
  secret — intentional per tl-3; Vercel always sets NODE_ENV=production on
  deploys, so preview/prod are covered.
- `updateRows` patch-only upsert: a row deleted between the `select` and the
  `upsert` would INSERT a patch-only partial row — same race window and
  outcome class as the pre-existing one-by-one path; not a new exposure.
- pg_net request rows may persist the Bearer value in
  `net.http_request_queue` (postgres-role readable only) — same trust domain
  as `app.settings.*`; acceptable, no file literals.
- Health check assumes `cxh-job-data-tick` is the sole pg_net caller —
  documented in the migration; any future pg_net job must namespace its check.
- All 6 migrations still NEEDS_APPROVAL for remote apply (TRACKER order:
  provision `app.settings.*` → apply → deploy vercel.json).
- Gates re-run by tl-3 (tsc/eslint/vitest 1122/test:security 4-4/build): PASS.
