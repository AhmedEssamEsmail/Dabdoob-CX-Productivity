# RMS-02: gate the popups delivery path on `reminders_enabled`
Kind: mini
ID: RMS-02
Parent: reminders-master-switch
Owner: dev
Depends: RMS-01
Criteria: PLAN #3, #6
Skills: none
Budget: files=2; actions=3; changed_lines=90; minutes=12

## Goal
While `reminders_enabled` is false: `raisePopup` writes no row,
`pendingPopupsFor` returns `[]`, `popupsPoll` returns `{ popups: [] }`
(existing pending rows hidden, not deleted). True/absent key = unchanged
behaviour.

## Files
- Edit: `src/features/shared/platform/popups.ts` | `raisePopup` (line 61), `pendingPopupsFor` (line 30), `popupsPoll` (line 115)
- Create: `tests/golden/reminders-off-popups.test.ts` | vitest file covering the three gates, both states

## Context
- `src/features/shared/platform/popups.ts:30-49,61-86,115-134` | the three functions; gate each at its top
- `src/features/shared/platform/settings.ts` | `remindersOn`, `bustConfigCache` exports (RMS-01)
- `src/features/shared/platform/repo.ts:61` | `cacheClear()` — clears config + `pop:poll:` caches in tests
- `tests/golden/hub-fakes.ts:39-46` | `hubSetTables`/`hubSetUser`; mock pattern at file top of `tests/golden/queue-checkin.test.ts:13-16`
- `tests/golden/queue-checkin.test.ts:103-119` | config-row shape `{ key, value }` (string `'false'` parses to boolean)

## Contract
- `raisePopup`: when off, return `{ skipped: 'off' }` BEFORE `assertWritable`/dedupe read; signature unchanged.
- `pendingPopupsFor`: when off, return `[]` first line.
- `popupsPoll`: when off, return `{ popups: [] }` BEFORE the count query; write nothing to `pop:poll:` cache.
- `resolvePopups` and all callers untouched. While on, byte-for-byte behaviour.
Out of scope: notify()/raisePopup callers, deleting pending rows, per-kind switches.

## Actions
1. In popups.ts add `import { remindersOn } from './settings'` and the three early returns exactly as contracted.
2. Create the test file: `vi.mock` supabase+auth via hub-fakes (copy the two `vi.mock` lines from queue-checkin.test.ts); `hubDbReset()` + `cacheClear()` in beforeEach.
3. Test: seed `config: [{key:'reminders_enabled',value:'false'},{key:'admin_emails',value:'admin@dabdoob.com'}]`, one open `popups` row for `tl@dabdoob.com` (kind `missed_1on1`); while off assert raisePopup returns `{skipped:'off'}` + `hubDb.tables.popups` length unchanged + `pendingPopupsFor('tl@dabdoob.com')` `[]` + `popupsPoll` `{popups:[]}`; then set the row value `'true'` + `cacheClear()` and assert the pending popup returns and raisePopup appends.

## Done when
- Off: no insert, empty read results; on: normal raise/read behaviour restored
- New test file passes; `npx tsc --noEmit` clean

## Verify
- Run: `npx vitest run tests/golden/reminders-off-popups.test.ts` -> all tests pass

## Handoff
The `popups` table write path is now centrally gated — RMS-05 relies on this
(missed-1:1 job raises popups via raisePopup). Write results/RMS-02.md.
