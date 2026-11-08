# RMS-F02: raisePopup off-gate scoped to reminder kinds only
Kind: mini
ID: RMS-F02
Parent: reminders-master-switch
Owner: dev
Depends: none
Criteria: PLAN #3 (event popups still created while off and resurface on re-enable)
Skills: none
Budget: files=2; actions=2; changed_lines=60; minutes=10

## Goal
While `reminders_enabled` is false, `raisePopup` skips only the periodic-nag
reminder kinds (`missed_1on1`, `qa_ctl_due`); every other kind — event
notifications and the mail-only `queue_checkin_missed` dedupe kind — is still
dedupe-checked and appended so it resurfaces on re-enable (fixes qa-2 MED).

## Files
- Edit: `src/features/shared/platform/popups.ts` | `raisePopup` gate at line ~64
- Edit: `tests/golden/reminders-off-popups.test.ts` | update off-test + add event-kind case

## Context
- `src/features/shared/platform/popups.ts:30-51` | pendingPopupsFor/popupsPoll gates stay wholesale
- `tests/golden/reminders-off-popups.test.ts:48-71` | current assertions assume all kinds skip

## Contract
- Define the reminder-kind set (`missed_1on1`, `qa_ctl_due`) once in popups.ts.
- While off: `raisePopup` returns `{ skipped: 'off' }` only for those kinds;
  other kinds run `assertWritable` + dedupe + append normally.
- `pendingPopupsFor`/`popupsPoll`/`resolvePopups` unchanged — ALL pending popups
  stay hidden while off, none are deleted.
Out of scope: read-path gates, notify.ts, jobs.ts, server.ts, admin-page.tsx.

## Actions
1. Make the `raisePopup` remindersOn check kind-conditional (reminder kinds only).
2. Update the test: off + `missed_1on1` still skips/reads empty; off + an event
   kind (e.g. `qa_ctl_confirm`) and `queue_checkin_missed` still append rows.

## Done when
- Off: reminder kinds skipped; non-reminder kinds appended; reads return [].
- On: behaviour unchanged.

## Verify
- Run: `npx vitest run tests/golden/reminders-off-popups.test.ts` -> all pass
- Run: `npx tsc --noEmit` -> clean

## Handoff
`queue_checkin_missed` rows are writable while off — RMS-F03 relies on this.
Write results/RMS-F02.md (<=10 lines); TL alone updates TRACKER.md.
