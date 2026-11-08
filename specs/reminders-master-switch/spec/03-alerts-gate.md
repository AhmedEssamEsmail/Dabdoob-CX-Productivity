# RMS-03: gate `oneOnOneAlerts` on `reminders_enabled`
Kind: mini
ID: RMS-03
Parent: reminders-master-switch
Owner: dev
Depends: RMS-01
Criteria: PLAN #3, #6
Skills: none
Budget: files=2; actions=2; changed_lines=75; minutes=10

## Goal
While `reminders_enabled` is false, the in-app 1:1 alerts poll returns
`{ now, alerts: [] }` even when an alert is due; when true it behaves exactly
as today.

## Files
- Edit: `src/features/shared/platform/notify.ts` | `oneOnOneAlerts` (lines 229-258), import line 18
- Create: `tests/golden/reminders-off-alerts.test.ts` | vitest file covering off and on states

## Context
- `src/features/shared/platform/notify.ts:229-258` | `oneOnOneAlerts`; gate after `const now = Date.now()`, before the `pwOoOn` reads; return `{ now: new Date(now).toISOString(), alerts: [] }`
- `src/features/shared/platform/notify.ts:12-19` | extend the existing `./settings` import with `remindersOn`
- `tests/golden/hub-fakes.ts` | `hubSetTables`, `hubSetUser`, `hubDbReset`; `vi.mock` lines at `tests/golden/queue-checkin.test.ts:13-16`
- `src/features/shared/platform/repo.ts:61` | `cacheClear()` — required between config flips (config + `pwOoUpcomingCached` caches)
- `tests/golden/people-jobs.test.ts:91-112` | roster/config fixture shape (`one_on_one_inapp_15min`, `admin_emails`)

## Contract
Gate placement keeps `const email = await currentEmail()` first (auth error
behaviour unchanged for signed-out callers is out of scope — order: email, now,
then the gate). No other export touched.
Out of scope: `notify()` mail path, `oneOnOneAlertsSeen`, the cron email half
(that is RMS-04's `pwSendOnce_` gate).

## Actions
1. Add `remindersOn` to the `./settings` import; insert `if (!(await remindersOn())) return { now: new Date(now).toISOString(), alerts: [] }` after `const now = Date.now()`.
2. Create the test: mock supabase+auth via hub-fakes; seed `roster` (manager tl@ + report a@ rows like people-jobs.test.ts:91-96), `one_on_one_schedule` with one `status:'scheduled'` booking ~10 min ahead of now for tl@ + a@, `config` with `one_on_one_inapp_15min:true`, `admin_emails`, `reminders_enabled:'false'`; `hubSetUser('tl@dabdoob.com')`; `hubDbReset()` + `cacheClear()` per test; assert off -> `alerts: []`, then flip value to `'true'` + `cacheClear()` -> `alerts.length > 0`.

## Done when
- Off: `alerts: []`; on: due alert returns for the signed-in TL
- Test passes; `npx tsc --noEmit` clean

## Verify
- Run: `npx vitest run tests/golden/reminders-off-alerts.test.ts` -> all tests pass

## Handoff
Alerts poll is gated; no downstream leaf depends on this file.
Write results/RMS-03.md.
