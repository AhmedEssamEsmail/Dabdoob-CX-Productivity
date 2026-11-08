# RMS-07: gate `qaCtlReminders` on `reminders_enabled`
Kind: mini
ID: RMS-07
Parent: reminders-master-switch
Owner: dev
Depends: RMS-01
Criteria: PLAN #4
Skills: none
Budget: files=2; actions=2; changed_lines=85; minutes=12

## Goal
While `reminders_enabled` is false, `qaCtlReminders` is a no-op inside its
heartbeat run — no `qa_ctl_due` popup backfill (`qaEnsureCtlPopups_`), no
`qa_ctl_reminder` mail, no `reminded_date` stamping. It resumes normally on
re-enable.

## Files
- Edit: `src/features/cx-quality/lib/server.ts` | `qaCtlReminders` hbRun callback (line 2123) + import line 16
- Create: `tests/golden/reminders-off-qa.test.ts` | vitest file covering off and on states

## Context
- `src/features/cx-quality/lib/server.ts:2121-2156` | put the early return as the FIRST line inside the `hbRun('qa_ctl_reminders', async () => {...})` callback: `if (!(await remindersOn())) return { reminded: 0, popups: 0, skipped: 'off' }`
- `src/features/cx-quality/lib/server.ts:16` | extend `import { getConfig, setConfig }` to include `remindersOn`
- `src/features/shared/platform/health.ts:150-168` | `hbRun` recognises `{skipped:'off'}` and still beats ok — the cron heartbeat keeps recording runs
- `src/features/shared/platform/identity.ts:139-147` | `requireJobCaller` passes with NO signed-in user (cron) — test with `hubSetUser('')`
- `tests/golden/hub-fakes.ts` + `tests/golden/queue-checkin.test.ts:13-16` | mock + seed pattern; `cacheClear()` at `src/features/shared/platform/repo.ts:61` between flips; `hbBeat`/`hbFlush` may write a job-health table — seed whatever `.from()` name it uses (read health.ts hbFlush) as `[]`

## Contract
Only the callback gains the early return; `requireJobCaller()` stays outside
`hbRun` exactly as today. Return type stays `Row`-compatible.
Out of scope: `qaEnsureCtlPopups_` internals, CTL status/`reminded_date`
schema, `jobQualityDaily` ordering, dispute/confirmed notifications
(`notify()` callers are notifications — not gated here).

## Actions
1. Add `remindersOn` to the settings import and the contracted first line inside the hbRun callback.
2. Create the test: mock supabase+auth via hub-fakes; `hubSetUser('')` (cron caller); `hubDbReset()` + `cacheClear()` per test; seed `config` (`reminders_enabled:'false'`, `admin_emails`, `mail_dry_run:true`), `roster` (active `tl@dabdoob.com` + agent), `qa_ctls` (one `{ctl_id:'C1',tl_email:'tl@dabdoob.com',agent_email:'a@dabdoob.com',status:'open',due_date:'<yesterday>',reminded_date:''}`), `popups:[]`, `mail_log:[]`, plus the job-health table hbFlush writes (see Context); call `qaCtlReminders()`; off -> result `{reminded:0,popups:0,skipped:'off'}`, popups/mail_log empty, `reminded_date` still `''`; flip to `'true'` + `cacheClear()` -> `reminded:1`, one `qa_ctl_due` popup, one `mail_log` row.

## Done when
- Off: `{skipped:'off'}`, no popup backfill, no mail, no stamping; on: normal run
- Test passes; `npx tsc --noEmit` clean

## Verify
- Run: `npx vitest run tests/golden/reminders-off-qa.test.ts` -> all tests pass

## Handoff
CTL due/overdue reminders are gated; heartbeat runs still record.
Write results/RMS-07.md.
