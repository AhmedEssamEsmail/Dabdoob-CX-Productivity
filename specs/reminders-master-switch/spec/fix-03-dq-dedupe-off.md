# RMS-F03: dqRemindMissedCheckins_ writes dedupe rows while off
Kind: mini
ID: RMS-F03
Parent: reminders-master-switch
Owner: dev
Depends: RMS-F02 (raisePopup must let queue_checkin_missed through while off)
Criteria: PLAN #4 + #6 (dedupe mark while off so nothing fires retroactively)
Skills: none
Budget: files=2; actions=2; changed_lines=60; minutes=10

## Goal
While `reminders_enabled` is false, `dqRemindMissedCheckins_` still computes
missed check-ins and writes the `queue_checkin_missed` dedupe popup row per
checkpoint+recipient, but sends no mail — so a check-in missed during the off
window can never fire popup+mail late on re-enable (fixes qa-1 MED, dq half).

## Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqRemindMissedCheckins_` only (~lines 245-286)
- Edit: `tests/golden/reminders-off-dq.test.ts` | update assertions to new contract

## Context
- `src/features/cx-queue/lib/jobs.ts:245-286` | current early `return` at :247; `sent` map at :261-266 dedupes on existing popup rows
- `tests/golden/reminders-off-dq.test.ts:49-70` | encodes old write-nothing behaviour

## Contract
- Remove the whole-job early return; capture `on = await remindersOn()` once.
- `raisePopup` dedupe-row write stays unconditional (it is the suppression mark).
- `sendMail` runs only when `on`. Return type stays `Promise<void>`.
Out of scope: `dqCheckinTick_`, other jobs, popups.ts, server.ts, admin page.

## Actions
1. Gate only the `sendMail` call on `on`; keep popup dedupe writes unconditional.
2. Update the test: off run writes the dedupe popup row + empty mail_log; flip
   on, re-run same cps -> no new popup and still no mail (dedupe holds); assert
   a normal on-run still sends (adjust seed/second checkpoint as needed).

## Done when
- Off: `queue_checkin_missed` popup row exists, `mail_log` empty.
- Re-enable + re-run: suppressed checkpoint never mails; popup not duplicated.

## Verify
- Run: `npx vitest run tests/golden/reminders-off-dq.test.ts` -> all pass
- Run: `npx tsc --noEmit` -> clean

## Handoff
None. Write results/RMS-F03.md (<=10 lines); TL alone updates TRACKER.md.
