# FIX-23: Restore CRON_SECRET env in cron fail-closed tests (qa-4)
Kind: mini
ID: FIX-23
Parent: -
Owner: test-engineer
Depends: none
Criteria: qa-3 finding qa-4 (LOW, blocking per task): `delete process.env.CRON_SECRET` is not restored (only NODE_ENV via `vi.unstubAllEnvs()`); if CRON_SECRET is ever set in the test env it bleeds into later tests
Skills: none
Budget: files=1; actions=2; changed_lines=10; minutes=4

## Goal
The two cron fail-closed tests no longer leak a deleted CRON_SECRET into the
rest of the suite — env mutation goes through vitest's stub/restore path.

## Files
- Edit: `tests/jobs/routes.test.ts` | the two tests at ~87-93 and ~95-109 only

## Context
- `tests/jobs/routes.test.ts:87-109` | both tests do `vi.stubEnv('NODE_ENV', 'production')` + `delete process.env.CRON_SECRET`, then `vi.unstubAllEnvs()` — the `delete` is NOT undone by unstubAllEnvs
- `specs/perf-remediation/reports/qa-3.md` (qa-4 row) | reviewer's suggested fix

## Contract
- In BOTH tests, replace `delete process.env.CRON_SECRET` with
  `vi.stubEnv('CRON_SECRET', '')`. Empty string is falsy, so the routes'
  `!secret` fail-closed path is preserved (401s still asserted identically).
  `vi.unstubAllEnvs()` then restores the real env.
- Do not change any assertion, request shape, or other test.
Out of scope: route source files, other tests in the file, vitest config.

## Actions
1. Apply the `vi.stubEnv('CRON_SECRET', '')` replacement in both tests.
2. Run the focused vitest file.

## Done when
- No `delete process.env.CRON_SECRET` remains in the file; both tests still assert 401s and pass.
- `npx vitest run tests/jobs/routes.test.ts` green.

## Verify
- Run: `npx vitest run tests/jobs/routes.test.ts` -> all pass.

## Handoff
None.
Write results/FIX-23.md (<=10 lines); TL alone updates TRACKER.md.
