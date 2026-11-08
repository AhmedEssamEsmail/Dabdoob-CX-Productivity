# S02-06: Audit the non-prod buildJobEnv callers for hidden table reads
Kind: mini
ID: S02-06
Parent: S02
Owner: dev
Depends: S02-01
Criteria: PLAN #2 (no env user silently loses its preload)
Skills: none
Budget: files=5; actions=6; changed_lines=40; minutes=8

## Goal
Verify — and only where needed, patch — the remaining `buildJobEnv` callers
so no job silently reads `prodRows`/`cachedLive` on an unfetched table after
the eager preload was removed. This is an audit-first leaf: evidence is a
deliverable, edits are conditional.

## Files
- Edit: `src/app/api/cron/scorecard-nightly/route.ts` | `buildJobEnv()` call (~:25) — edit ONLY if the audit finds an unfetched read
- Edit: `src/app/api/cron/oo-reminders/route.ts` | `buildJobEnv()` call (~:17) — same condition
- Edit: `src/app/api/cron/task-reminders/route.ts` | `buildJobEnv()` call (~:17) — same condition
- Edit: `src/app/api/cron/meeting-reminders/route.ts` | `buildJobEnv()` call (~:17) — same condition
- Edit: `src/app/api/cron/missed-1on1-check/route.ts` | `buildJobEnv()` call (~:17) — same condition

## Context
- `src/features/shared/jobs/env.ts:346-350` | post-S02-01 miss marker: unfetched reads return [] + tableErrors 'not prefetched' — grep targets: `prodRows\(`, `cachedLive\(` in each invoked fn's module
- `src/app/api/cron/job-data-tick/route.ts`, `job-nightly-aggregates`, `job-qa-engine`, `job-tl-queue` | confirmed NOT to call buildJobEnv — out of scope
- `tests/golden/reminders-off-*.test.ts`, `tests/golden/scorecard.test.ts` | suites that prove no behavior change

## Contract
- For each route: trace its job fn; grep that fn's module for `prodRows(`/`cachedLive(`/`readTickets`/`readInflow`. If none => no edit, record "clean" in results.
- If a fn DOES read prod tables, fix it at the ROUTE: `buildJobEnv({ tables: [...] })` with exactly the names the grep found (same end state as a prefetch — `opts.tables` preloads at build).
- Do NOT pass `roster:false` anywhere in this leaf — reminder jobs may use env.dir; roster stays default.
Out of scope: prod/tph/backfill/quarterly fns (S02-02..05), env.ts.
Cap: if ANY fix lands outside the 5 listed route files, stop and return RESHARD_NEEDED with findings.

## Actions
1. Audit `scNightly_` (scorecard-server.ts) -> prefetch list or "clean".
2. Audit the oo-reminders job fn -> prefetch list or "clean".
3. Audit the task-reminders job fn -> prefetch list or "clean".
4. Audit the meeting-reminders job fn -> prefetch list or "clean".
5. Audit `runMissedOneOnOneCheck_` (missed-1on1-check) -> prefetch list or "clean".
6. Record per-route verdict + any added list in results/S02-06.md.

## Done when
- Every listed route has a recorded verdict; any added prefetch exactly matches the fn's prodRows usage.
- `npx vitest run tests/golden` green.

## Verify
- Run: `npx vitest run tests/golden` -> all pass.

## Handoff
Evidence: per-route verdict list in results. If any route needed >1 file
changed beyond a prefetch call, flag it for the TL. Write results/S02-06.md
(<=10 lines); TL alone updates TRACKER.md.
