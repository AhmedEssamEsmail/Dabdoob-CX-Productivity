# TL report 2 — perf-remediation FIX round (qa-1)

## Status: ALL 4 findings FIXED — 5 mini-leaves done, all gates green
Every qa-1 row treated as blocking per task. No RESHARD_NEEDED, no blocked
leaves. One local fix routed back (attempt 2, resolved).

## Leaves dispatched (max 4 workers, disjoint files; FIX-04 queued second)
- FIX-01 dev — `export const instant = false` in `src/app/layout.tsx` (root
  layout opt-out per `instant.md` static-shell rule + build `[block]` hint).
- FIX-02a supabase-expert — NEW migration
  `supabase/migrations/20261108231643_job_data_tick_pg_cron.sql`: pg_cron+pg_net,
  `cxh-job-data-tick` `*/15 * * * *`, one `net.http_get` Bearer + 60s timeout.
  URL+secret via `current_setting('app.settings.*')` at run time — zero
  literals/placeholders, unprovisioned config raises loudly. Idempotent
  unschedule guard; 012 draft untouched.
- FIX-02b dev — vercel.json `job-data-tick` `0 5 * * *` entry REMOVED (no
  double-run at 05:00); route.ts docstring + ARCHITECTURE.md row/pg_cron
  paragraph now say */15 via pg_cron.
- FIX-03 dev — deleted test-only `getUser`/`requireAuth` from lib/auth.ts +
  their describes in auth.test.ts + stale entries in hub-fakes authModule()
  (client-level `auth.getUser` mocks kept).
- FIX-04 dev — `pollTick` returns payload `now` (`data.now ??` client fallback);
  type widened.

## Fix routed back (max 2 attempts)
- FIX-02b attempt 1 broke route.ts: docstring contained literal `*/15` whose
  `*/` closed the block comment -> 4 tsc errors, blocked FIX-01's build verify.
  Resumed same scope; docstring reworded, transpile clean.

## Integration gates (TL checkpoint; logs in logs/fix2-*.log)
- `npx tsc --noEmit` — PASS (0)
- `npx vitest run` — PASS (54 files, 1120/1120; -4 vs qa-1 = deleted stub tests)
- `npx eslint .` — PASS (0 errors; 366 pre-existing warnings)
- `npm run test:security` — PASS (4/4)
- `next build` — **PASS** (154/154 pages generated, exit 0 — qa-1 BLOCKER cleared)
- e2e — PM gate, not run here.

## Changed files (this round only)
- `src/app/layout.tsx`; `src/app/api/cron/job-data-tick/route.ts`;
  `src/features/shared/lib/{auth.ts,auth.test.ts}`;
  `src/features/shared/shell/context.ts`; `tests/golden/hub-fakes.ts`;
  `vercel.json`; `docs/ARCHITECTURE.md`;
  `supabase/migrations/20261108231643_job_data_tick_pg_cron.sql` (new).
  ~97 handwritten changed lines; baseline dirty tree untouched.

## NEEDS_APPROVAL (deploy-order matters)
1. Provision `app.settings.app_url` + `app.settings.cron_secret`
   (ALTER DATABASE ... SET; see migration header).
2. Apply `20261108231643_job_data_tick_pg_cron.sql` remotely.
3. ONLY THEN deploy the vercel.json change — reversing 2/3 leaves
   job-data-tick with no scheduler.
(Previous 5 migrations remain NEEDS_APPROVAL in TRACKER.)

## Notes for PM
- 012_pg_cron_schedule.sql already had a `cxh-job-data-tick */15` draft using
  `{{PLACEHOLDER}}` substitution; left untouched (blocked draft). The new
  migration supersedes only the job-data-tick line — if 012 is ever applied
  later its unschedule guard handles the shared jobname cleanly.
- Reviewer DELTA scope for qa-2: the 9 files above + results/FIX-0*.md.
- No shard asked for reviewers/devops; none spawned.
- TRACKER: specs/perf-remediation/TRACKER.md
