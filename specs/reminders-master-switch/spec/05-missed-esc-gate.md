# RMS-05: gate the missed-escalation direct sendMail in `runMissedOneOnOneCheck_`
Kind: mini
ID: RMS-05
Parent: reminders-master-switch
Owner: dev
Depends: RMS-02, RMS-04
Criteria: PLAN #4, #5
Skills: none
Budget: files=2; actions=2; changed_lines=120; minutes=15

## Goal
While `reminders_enabled` is false, the 2-working-day escalation block still
writes its `missed-esc:<schedule_id>` dedupe rows (status `skipped_off`) but
never calls `sendMail`. Missed/excused schedule marking is untouched
(criterion #5 — state marking is not a reminder).

## Files
- Edit: `src/features/cx-people/lib/reminders.ts` | escalation block lines 145-171 + import
- Create: `tests/golden/reminders-off-missed.test.ts` | vitest file: off-state end-to-end assertions

## Context
- `src/features/cx-people/lib/reminders.ts:140-171` | the `late` block: wrap only the `sendMail` call — `const res = (await remindersOn()) ? await sendMail({...}, JOB_ACTOR) : { status: 'skipped_off' }`; the `pwAppend_` dedupe write already uses `res.status`
- `src/features/cx-people/lib/reminders.ts:24-38` | imports — add `import { remindersOn } from '@/features/shared/platform/settings'`
- `tests/golden/people-jobs.test.ts:460-495` | fixture template (sched rows, roster at lines 91-96, BASE_SETTINGS at 97-112) — port to hub-fakes, NO oracle needed (new feature, no parity target)
- `tests/golden/hub-fakes.ts` | `hubSetTables`, `hubDbReset`, `hubDb`; `vi.mock` lines at `tests/golden/queue-checkin.test.ts:13-16`; `cacheClear()` at `src/features/shared/platform/repo.ts:61`
- `src/features/cx-people/lib/reminders.ts:62-119` | full job body: marking (lines 79-89), popups via `raisePopup` (90-102, gated by RMS-02), same-evening mail via `pwSendOnce_` (132, gated by RMS-04)

## Contract
Only the sendMail expression inside `if (late.length)` changes; dedupe rows,
`escalated`/`emailed` counters, return shape, and all marking logic stay
verbatim. While on, byte-identical behaviour.
Out of scope: `runTaskReminders_`, `runMeetingActionReminders_` (already
gated via `pwSendOnce_`), excused marking rules, popup resolution.

## Actions
1. Add the `remindersOn` import and replace `const res = await sendMail(...)` with the contracted ternary (keep the msg object verbatim).
2. Create the test: mock supabase+auth via hub-fakes; `hubDbReset()` + `cacheClear()` per test; seed `roster` (manager tl@, report a@, admin admin@), `config` (`reminders_enabled:'false'`, `admin_emails`, `one_on_one_cutoff:'22:00'`, `mail_dry_run:true`, `days_off_default:'[]'`, `days_off_by_country:'{}'`), `holidays:[]`, `popups:[]`, `mail_log:[]`, `pw_reminder_log:[]`, `one_on_one_schedule` = one `'scheduled'` row 07:00 UTC today + one `'missed'` row dated 3+ working days back; run `runMissedOneOnOneCheck_(tonight)`; assert: scheduled row now `status:'missed'` (marking still happens), `popups`/`mail_log` still empty, and every new `pw_reminder_log` row (`missed:*`, `missed-esc:*`) has `status:'skipped_off'`.

## Done when
- Off run: missed/excused marking applied; no popups, no mail_log rows; all new dedupe rows `skipped_off`
- Test passes; `npx tsc --noEmit` clean

## Verify
- Run: `npx vitest run tests/golden/reminders-off-missed.test.ts` -> all tests pass

## Handoff
The last direct sendMail in the people reminder jobs is gated.
Write results/RMS-05.md.
