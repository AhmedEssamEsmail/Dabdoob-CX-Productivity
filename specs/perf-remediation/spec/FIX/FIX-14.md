# FIX-14: popupsPoll cache key not normalized — stale popups up to 300s
Kind: mini
ID: FIX-14
Parent: -
Owner: dev
Depends: none
Criteria: data report data-6 (LOW, blocking per task) — popupsPoll caches under
raw `email` while resolvePopups invalidates under normEmail(recipient);
case-mismatched caller email leaves resolved popups cached for POPUPS_POLL_S
Skills: none
Budget: files=2; actions=2; changed_lines=25; minutes=5

## Goal
`popupsPoll` keys its cache with `POPUPS_POLL_KEY + normEmail(email)` so it
matches the invalidation at popups.ts:113 (`normEmail(r.recipient)`).
normEmail is already imported in the file.

## Files
- Edit: `src/features/shared/platform/popups.ts` | `const key = POPUPS_POLL_KEY + email` at line ~130
- Edit: `tests/golden/reminders-off-popups.test.ts` | one regression case (hub-fakes + cacheClear already wired)

## Context
- `src/features/shared/platform/popups.ts:113,130,141` | invalidate vs cache key mismatch
- `reports/data-1.md` finding data-6 | exact fix: normalize at both ends
- `tests/golden/reminders-off-popups.test.ts` | hubDb/hubSetTables/cacheClear/popupsPoll infra already present

## Contract
- Only the cache key expression changes (`normEmail(email)`); the write at
  line 141 reuses `key` so it normalizes automatically. No other behaviour
  (POPUPS_POLL_S, stamp logic, pendingPopupsFor) changes.
- Regression test: with reminders ON, `popupsPoll(<MIXED-CASE email>)` caches
  under `pop:poll:` + normalized email (assert via `cacheGet`), and
  `resolvePopups` for that recipient clears it.
Out of scope: everything else in popups.ts and every other file.

## Actions
1. Change the key expression to `POPUPS_POLL_KEY + normEmail(email)`.
2. Add the mixed-case regression test described in Contract.

## Done when
- Poll cache key is normalized; mixed-case email hits/invalidates the same entry.
- New test fails on the raw-email code; `npx vitest run tests/golden/reminders-off-popups.test.ts` green; `npx tsc --noEmit` -> 0.

## Verify
- Run: `npx vitest run tests/golden/reminders-off-popups.test.ts` -> green.

## Handoff
none. Write results/FIX-14.md (<=10 lines); TL alone updates TRACKER.md.
