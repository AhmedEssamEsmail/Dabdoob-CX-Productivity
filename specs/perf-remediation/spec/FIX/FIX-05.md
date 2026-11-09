# FIX-05: cronOk fails closed when CRON_SECRET is unset (production)
Kind: mini
ID: FIX-05
Parent: -
Owner: dev
Depends: none
Criteria: sec-1 finding sec-1 (MED) — unauthenticated state-changing cron surface
Skills: none
Budget: files=6; actions=6; changed_lines=60; minutes=8

## Goal
Every `cronOk` copy stops returning `true` when `process.env.CRON_SECRET` is
unset in production: in prod a missing secret means 401 for every caller
(fail-closed). The dev/no-secret convenience is kept only outside production.

## Files
- Edit: `src/app/api/cron/job-data-tick/route.ts` | `cronOk` `!secret` branch (lines 11-15)
- Edit: `src/app/api/cron/job-tl-queue/route.ts` | `cronOk` `!secret` branch (lines 11-15)
- Edit: `src/app/api/cron/job-qa-engine/route.ts` | `cronOk` `!secret` branch (lines 14-18)
- Edit: `src/app/api/cron/job-nightly-aggregates/route.ts` | `cronOk` `!secret` branch (lines 9-13)
- Edit: `src/app/api/desk/job/mail/route.ts` | `cronOk` `!secret` branch (lines 6-10)
- Edit: `tests/jobs/routes.test.ts` | add the fail-closed regression test

## Context
- `src/app/api/cron/job-data-tick/route.ts:11-15` | current: `if (!secret) return true`
- `reports/sec-1.md` finding sec-1 | exact fix alternative: `return process.env.NODE_ENV !== 'production' && !secret`
- `tests/jobs/routes.test.ts` | existing cron-route test harness (Request -> res.status)

## Contract
- In each of the 5 `cronOk` copies replace `if (!secret) return true` with
  `if (!secret) return process.env.NODE_ENV !== 'production'` (update the
  inline comment to say fail-closed in production). Signature stays boolean;
  no other line changes; `requireJobCaller` calls untouched.
- Do NOT touch the `authHeader !== Bearer ${CRON_SECRET}` routes — out of scope
  for this finding (the `cronOk` copies only).
Out of scope: any other route, identity.ts, job internals, env.ts.

## Actions
1. Flip the `!secret` branch in `job-data-tick/route.ts`.
2. Flip it in `job-tl-queue/route.ts`.
3. Flip it in `job-qa-engine/route.ts`.
4. Flip it in `job-nightly-aggregates/route.ts`.
5. Flip it in `desk/job/mail/route.ts`.
6. In `tests/jobs/routes.test.ts` add a regression test: stub
   `vi.stubEnv('NODE_ENV', 'production')` + delete `CRON_SECRET`, call
   `job-nightly-aggregates` GET (no job-env mock needed — it must 401 before
   the job body) and expect 401; `vi.unstubAllEnvs()` in the test. Keep the
   existing beforeEach/secret setup intact.

## Done when
- `grep "if (!secret) return true" src/` -> 0 matches.
- New test asserts 401 with NODE_ENV=production and no CRON_SECRET; suite green.

## Verify
- Run: `npx vitest run tests/jobs/routes.test.ts` -> green; `npx tsc --noEmit` -> 0.

## Handoff
none. Write results/FIX-05.md (<=10 lines); TL alone updates TRACKER.md.
