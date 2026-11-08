# RMS-F04: qaCtlReminders marks reminded_date while off
Kind: mini
ID: RMS-F04
Parent: reminders-master-switch
Owner: dev
Depends: none
Criteria: PLAN #4 + #6 (skip backfill+emails but still mark reminded_date)
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=10

## Goal
While `reminders_enabled` is false, `qaCtlReminders` skips the `qa_ctl_due`
popup backfill and the `qa_ctl_reminder` emails but still marks `reminded_date`
on due open CTLs — so CTLs that came due during the off window never send their
daily reminder retroactively (fixes qa-1 MED, qa half).

## Files
- Edit: `src/features/cx-quality/lib/server.ts` | `qaCtlReminders` hbRun callback only (~lines 2123-2156)
- Edit: `tests/golden/reminders-off-qa.test.ts` | update assertions to new contract

## Context
- `src/features/cx-quality/lib/server.ts:2120-2156` | current early return at :2124; due-marking tx at :2142-2154
- `tests/golden/reminders-off-qa.test.ts:39-56` | encodes old full no-op behaviour

## Contract
- `requireJobCaller`/`hbRun` wrapper unchanged.
- Capture `on = await remindersOn()` once inside the callback.
- While off: skip `qaEnsureCtlPopups_` (raised = 0) and skip `notify`; still run
  the due-marking `qaTx_` block. Return `{ reminded: due.length, popups: 0, skipped: 'off' }`.
- While on: identical to today.
Out of scope: `qaEnsureCtlPopups_` internals, notify.ts, popups.ts, other jobs.

## Actions
1. Replace the early return with an `on` flag; gate backfill + notify on it.
2. Keep the reminded_date tx unconditional for due CTLs.
3. Update the test: off -> `{skipped:'off'}`, no popups, no mail, but
   `reminded_date` IS set; flip on -> unchanged normal run.

## Done when
- Off: due CTL gets `reminded_date = today`; zero popups and zero mail.
- On: backfill + email + marking all run as before.

## Verify
- Run: `npx vitest run tests/golden/reminders-off-qa.test.ts` -> all pass
- Run: `npx tsc --noEmit` -> clean

## Handoff
None. Write results/RMS-F04.md (<=10 lines); TL alone updates TRACKER.md.
