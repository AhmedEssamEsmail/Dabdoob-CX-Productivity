# RMS-F01: hub-admin oracle tests — allow port-superset config map
Kind: mini
ID: RMS-F01
Parent: reminders-master-switch
Owner: test-engineer
Depends: RMS-01
Criteria: PLAN #7 (vitest green)
Skills: none
Budget: files=1; actions=2; changed_lines=40; minutes=10

## Goal
`tests/golden/hub-admin.test.ts` compares the port's whole config map to the
legacy oracle with `expectSame`. The new `reminders_enabled` key exists only
in the port (new feature, no parity target — PLAN Non-goals), so the 3 exact
map comparisons fail. Make them superset-tolerant like the `getConfigRows`
test already is.

## Files
- Edit: `tests/golden/hub-admin.test.ts` | the 3 failing its at lines 52-84

## Context
- `tests/golden/hub-admin.test.ts:86-97` | `getConfigRows` superset pattern: build a `Map` of port rows by key, iterate oracle rows, `diffPath(row, portRow)` per oracle key — port may have extras.
- `tests/golden/helpers-oracle.ts:100-115` | `expectSame`/`diffPath` helpers (read signatures before use).
- Failing output: `oracle mismatch at $.ok: keys [...] != [...,reminders_enabled]` in `getConfig matches`, `setConfig writes...`, `setConfig validation errors...` (3 its).

## Contract
For the `$.ok` maps only: strip port-only keys (or iterate oracle keys
comparing values) so the port may return extra config keys while every
oracle key still matches exactly. Apply to all 3 its (`getConfig matches`,
`setConfig writes + returns the whole map`, `setConfig validation errors
match` — the loop's `expectSame` calls). Error/refusal assertions stay
exact. No source-file changes; no other test files.
Out of scope: helpers-oracle.ts internals, other golden files, source code.

## Actions
1. In the 3 its, compare the config maps with oracle-keys-only semantics (reuse the Map-by-key + diffPath pattern from the getConfigRows test, or delete `reminders_enabled` from `port.ok` before `expectSame`).
2. Re-run the file's tests; all pass.

## Done when
- `npx vitest run tests/golden/hub-admin.test.ts` -> all tests pass
- Port-only keys tolerated; oracle keys still strictly compared

## Verify
- Run: `npx vitest run tests/golden/hub-admin.test.ts` -> all tests pass

## Handoff
Write results/RMS-F01.md (<=10 lines).
