# FIX-21: Collision-proof patch signature in `updateRows` grouping (qa-2)
Kind: mini
ID: FIX-21
Parent: -
Owner: dev
Depends: none
Criteria: qa-3 finding qa-2 (LOW, blocking per task): `Object.keys(patch).sort().join('')` can collide (`['a','bc']`->`'abc'` = `['ab','c']`) — same bug class just fixed in env.ts; would regroup non-uniform key-sets into one upsert, re-exposing the data-1 failure
Skills: none
Budget: files=2; actions=2; changed_lines=40; minutes=6

## Goal
The upsert-grouping signature in `updateRows` is injective — two different
sorted key-sets can never share a signature — so heterogeneous patches always
land in separate upserts.

## Files
- Edit: `src/features/shared/platform/repo.ts` | the `signature` line (~242) only
- Edit: `tests/platform/repo.test.ts` | one regression test in `describe('updateRows (batched upsert)')`

## Context
- `src/features/shared/platform/repo.ts:240-246` | the grouping loop; signature at :242 is `Object.keys(patch).sort().join('')`
- `src/features/shared/platform/env.ts:292` | the same fix already applied there: `JSON.stringify(keys.map(k => r[k] ?? null))` pattern — here it is `JSON.stringify(Object.keys(patch).sort())`
- `tests/platform/repo.test.ts:227-256` | existing `'groups heterogeneous patch key-sets into separate homogeneous upserts'` test — mirror its fakeDb/signature-inspection approach

## Contract
- Change the signature to `JSON.stringify(Object.keys(patch).sort())`. No
  other logic change (grouping, stamps, fallback verbatim).
- Regression test: two updates whose sorted patch-key arrays differ but whose
  `join('')` collides (e.g. patch keys `{a, bc}` vs `{ab, c}`) must produce TWO
  separate upsert calls — fails on the old signature, passes on the new.
Out of scope: anything else in repo.ts, env.ts, other tests.

## Actions
1. Apply the one-line signature fix.
2. Add the collision regression test; run the focused vitest file.

## Done when
- Signature is `JSON.stringify(...)`; new test fails on the old code, passes now.
- `npx tsc --noEmit` clean; `npx vitest run tests/platform/repo.test.ts` green.

## Verify
- Run: `npx vitest run tests/platform/repo.test.ts` -> all pass; `npx tsc --noEmit` -> 0 errors.

## Handoff
None.
Write results/FIX-21.md (<=10 lines); TL alone updates TRACKER.md.
