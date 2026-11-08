# RMS-06: gate `dqRemindMissedCheckins_` on `reminders_enabled`
Kind: mini
ID: RMS-06
Parent: reminders-master-switch
Owner: dev
Depends: RMS-01
Criteria: PLAN #4
Skills: none
Budget: files=2; actions=2; changed_lines=80; minutes=12

## Goal
While `reminders_enabled` is false, `dqRemindMissedCheckins_` returns
immediately — no `queue_checkin_missed` popup rows, no mail. The popup rows
double as its send dedupe, so gating the whole job (not just the mail) keeps
re-enable clean.

## Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqRemindMissedCheckins_` top (line 246) + import line 11
- Create: `tests/golden/reminders-off-dq.test.ts` | vitest file covering off and on states

## Context
- `src/features/cx-queue/lib/jobs.ts:246-285` | the job; early return goes before `const cfg = await cfg_()`; `cp` shape `{slot,name,date,at,readAfter,opensAt,dueAt,key}` per `src/features/cx-queue/lib/index.ts:182-205`
- `src/features/cx-queue/lib/jobs.ts:11` | extend `import { configAll }` to `import { configAll, remindersOn }` from `'@/features/shared/platform/settings'`
- `tests/golden/queue-checkin.test.ts:13-16,40-46,103-119` | mock lines, roster-row shape, `seedHub` config-row shape to imitate
- `src/features/shared/platform/repo.ts:61` | `cacheClear()` between config flips
- `tests/golden/hub-fakes.ts:39-46` | `hubSetTables`/`hubSetUser`/`hubDbReset`

## Contract
`export async function dqRemindMissedCheckins_(...)` gains a first line
`if (!(await remindersOn())) return` — Promise<void>, no return value change.
The `queue_checkin_missed` popup exclusion in `pendingPopupsFor` is untouched.
Out of scope: `dqCheckinTick_` (snapshot capture must keep running — only the
reminder job is gated), checkin_owner_emails logic, TL roster lookup.

## Actions
1. Add `remindersOn` to the settings import and the early return at the top of `dqRemindMissedCheckins_`.
2. Create the test: mock supabase+auth via hub-fakes; `hubDbReset()` + `cacheClear()` per test; seed `config` (`reminders_enabled:'false'`, `business_tz`, `checkin_owner_emails:'{}'`, `mail_dry_run:true`, `admin_emails`), `roster` (one active tl row `tl@dabdoob.com`), `queue_submissions:[]`, `popups:[]`, `mail_log:[]`; call `dqRemindMissedCheckins_(new Date('2026-10-15T12:00:00Z'), [{slot:'14:00',name:'Afternoon',date:'2026-10-15',at:new Date('2026-10-15T11:00:00Z'),readAfter:new Date('2026-10-15T11:20:00Z'),opensAt:new Date('2026-10-15T10:45:00Z'),dueAt:new Date('2026-10-15T11:30:00Z'),key:'2026-10-15|14:00'}])`; off -> popups + mail_log stay empty; flip to `'true'` + `cacheClear()` -> one `queue_checkin_missed` popup row and one `mail_log` row for `tl@dabdoob.com`.

## Done when
- Off: job writes nothing; on: popup + mail row for the missed slot's TL
- Test passes; `npx tsc --noEmit` clean

## Verify
- Run: `npx vitest run tests/golden/reminders-off-dq.test.ts` -> all tests pass

## Handoff
Queue missed-check-in reminders are gated at job level; `dqCheckinTick_`
snapshots are unaffected. Write results/RMS-06.md.
