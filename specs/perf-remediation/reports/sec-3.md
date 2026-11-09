# sec report - perf-remediation - round 3 (DELTA)

Verdict: PASS
Open: 0 BLOCKER / 0 HIGH / 0 MED / 0 LOW

Scope: tl-4 FIX round — 16 routes (10 cron via FIX-08a; `job-tph-hourly`,
`scorecard-nightly` + `integrations/{freshchat,freshdesk,gmail,maqsam}` via
FIX-08b) + `tests/jobs/routes.test.ts`.

## Prior finding — verified FIXED
- **sec-4 (MED)**: all 16 routes now hoist `const secret =
  process.env.CRON_SECRET`; when unset they 401 iff `NODE_ENV ===
  'production'`, and the `Bearer ${secret}` comparison runs only when a
  secret is set — so `Bearer undefined` can no longer pass the gate. Diffs
  sampled verbatim on 7 files (analytics-aggregation:19-27, job-tph-hourly:16-24,
  scorecard-nightly:20-28, gmail:6-14, freshdesk:6-14, freshchat:16-24,
  maqsam:16-24); remaining 9 confirmed by uniform `fail-closed` block count.
  `grep 'Bearer ${process.env.CRON_SECRET}' src/` → 0 matches. Empty-string
  secret also caught by `!secret`. Regression test
  (tests/jobs/routes.test.ts:94-109) asserts `Bearer undefined` → 401 on cron
  GET (job-tph-hourly) + integration POST (gmail) and missing header → 401
  under NODE_ENV=production. FIXED.

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| — | — | — | none | — | — |

Not verified / assumptions:
- 5 `cronOk` routes (job-data-tick:11-15, job-nightly-aggregates,
  job-qa-engine, job-tl-queue, desk/job/mail) re-spotted — still fail-closed
  per sec-2 verification; unchanged this round.
- Non-prod no-secret mode remains open (dev escape) — carried-forward
  accepted assumption; Vercel deploys always set NODE_ENV=production.
- Bearer comparison uses `!==` (not timing-safe) — pre-existing across all
  routes; not practically exploitable over HTTP; no change this round.
- `requireJobCaller()` remains the sessionless-caller gate after the Bearer
  check — unchanged semantics.
- Gates re-run by tl-4: tsc / eslint / vitest 1123 / test:security 4-4 /
  build — all PASS (logs under specs/perf-remediation/logs/fix4-*.log).
- Migrations + `app.settings.*` provisioning still NEEDS_APPROVAL (TRACKER);
  unchanged from sec-2.
