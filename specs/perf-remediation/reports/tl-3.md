# tl report - perf-remediation - FIX round 3 (source: reports/sec-1.md, every row treated blocking)

Verdict: all 3 findings fixed, all integration gates green. Reviewer DELTA scope = files below.

## Leaves dispatched (3 parallel, disjoint files)

| Leaf | Finding | Owner | Status | Changed files |
|---|---|---|---|---|
| FIX-05 | sec-1 MED `cronOk` fail-open | dev | done | `src/app/api/cron/job-data-tick/route.ts`, `job-tl-queue/route.ts`, `job-qa-engine/route.ts`, `job-nightly-aggregates/route.ts`, `src/app/api/desk/job/mail/route.ts`, `tests/jobs/routes.test.ts` |
| FIX-06 | sec-2 LOW `updateRows` lost-update | dev | done | `src/features/shared/platform/repo.ts`, `tests/platform/repo.test.ts` |
| FIX-07 | sec-3 LOW fire-and-forget `net.http_get` | supabase-expert | done | `supabase/migrations/20261108231643_job_data_tick_pg_cron.sql`, `docs/ARCHITECTURE.md` |

## What changed
- FIX-05: all 5 `cronOk` copies now `return process.env.NODE_ENV !== 'production'` when `CRON_SECRET` is unset — fail-closed in prod (the report's exact-fix alternative; dev/no-secret convenience preserved outside prod). New regression test asserts 401 for `job-nightly-aggregates` with NODE_ENV=production and no secret.
- FIX-06: batched `updateRows` upserts `{[keyField]: key, ...patch}` per key via a new `patchByKey` map (repeated keys accumulate patches); `out` still returns merged rows; constraint-error fallback verbatim. Regression test asserts the upsert payload excludes unpatched columns.
- FIX-07: same (unapplied) migration now also schedules `cxh-job-data-tick-health` at `7-59/15 * * * *`: newest `net._http_response` within 20 min must be clean-200 else `RAISE EXCEPTION` -> `status='failed'` in `cron.job_run_details` (sole-pg_net-caller assumption commented). Unschedule guard + verification comments cover both jobs; ARCHITECTURE.md runbook line added.

## Integration gates (round 3 — logs in specs/perf-remediation/logs/)
- `npx tsc --noEmit` -> PASS (0 errors)
- `npx vitest run` -> PASS (54 files, 1122/1122; +2 regression tests)
- `npx eslint .` -> PASS (0 errors; 366 pre-existing warnings)
- `npm run test:security` -> PASS (4/4)
- `next build` -> PASS (154/154 pages, exit 0)

## Notes for reviewer
- FIX-06 transiently saw a tsc error in `tests/jobs/routes.test.ts` while FIX-05 was mid-write; final `tsc --noEmit` is clean — not a real finding.
- `job-data-tick` and `job-nightly-aggregates` have no `requireJobCaller`; in non-prod without a secret they remain open by design (pre-existing convention kept per the finding's fix).
- NEEDS_APPROVAL (unchanged, TRACKER): remote apply of all 6 migrations incl. the amended `20261108231643` — provision `app.settings.*` first, apply before the vercel.json deploy.
- No reviewer/architect/devops shards were requested or spawned; none of the fixes needed them.
- `.qa-tmp/` stray dir (noted in sec-1) untouched — housekeeping, not ours.
