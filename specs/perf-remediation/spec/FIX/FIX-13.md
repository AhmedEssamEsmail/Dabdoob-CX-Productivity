# FIX-13: env.ts keyOf joins composite keys with '' — collisions
Kind: mini
ID: FIX-13
Parent: -
Owner: data-engineer
Depends: none
Criteria: data report data-5 (LOW, blocking per task) — ('ab','c') vs
('a','bc') collide in memoUpsert -> wrong row replaced -> mismatched write set
Skills: none
Budget: files=3; actions=3; changed_lines=30; minutes=6

## Goal
`keyOf` composite-key joins become collision-safe: `('ab','c')` and
`('a','bc')` produce different keys in production `env.ts` memoUpsert and in
the mirrored test stub. Use `JSON.stringify(keys.map(k => r[k]))` (same style
as `tuplesOf` already in the codebase) or a non-printable separator — pick
JSON.stringify for consistency.

## Files
- Edit: `src/features/shared/jobs/env.ts` | `keyOf` at line ~292
- Edit: `tests/jobs/helpers.ts` | mirrored `keyOf` at line ~58 (same expression)
- Edit: `tests/jobs/tph-jobs.test.ts` | one regression case via the stub env `upsert`

## Context
- `src/features/shared/jobs/env.ts:292-303` | `keyOf`/`memoUpsert` defect site
- `tests/jobs/helpers.ts:58-66` | stub env re-implements the same keyOf/upsert — keep parity
- `reports/data-1.md` finding data-5 | exact fix options; JSON.stringify preferred

## Contract
- Both `keyOf` copies produce distinct keys for ('ab','c') vs ('a','bc');
  key type stays string. No other env.ts/helper behaviour changes.
- Regression test drives the stub env `upsert`/`upsertIn` with a composite
  (>=2 col) key where two rows collide under join(''): both rows survive
  instead of one overwriting the other.
Out of scope: every other file/function; do not export keyOf.

## Actions
1. Change `keyOf` in env.ts to `JSON.stringify(keys.map((k) => r[k] ?? null))`
   (or '\u0001' join — JSON.stringify preferred).
2. Mirror the identical expression in tests/jobs/helpers.ts keyOf.
3. Add the collision regression case in tests/jobs/tph-jobs.test.ts.

## Done when
- Production + stub keyOf distinguish ('ab','c')/('a','bc').
- New regression test fails on join(''); `npx vitest run tests/jobs/tph-jobs.test.ts` green; `npx tsc --noEmit` -> 0.

## Verify
- Run: `npx vitest run tests/jobs/tph-jobs.test.ts` -> green.

## Handoff
none. Write results/FIX-13.md (<=10 lines); TL alone updates TRACKER.md.
