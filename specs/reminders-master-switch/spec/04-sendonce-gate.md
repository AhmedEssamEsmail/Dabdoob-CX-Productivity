# RMS-04: gate `pwSendOnce_` on `reminders_enabled`
Kind: mini
ID: RMS-04
Parent: reminders-master-switch
Owner: dev
Depends: RMS-01
Criteria: PLAN #4, #6
Skills: none
Budget: files=2; actions=2; changed_lines=70; minutes=10

## Goal
While `reminders_enabled` is false, `pwSendOnce_` sends no mail but still
writes its `pw_reminder_log` dedupe row with status `skipped_off` and returns
`'skipped'` — so nothing skipped while off re-fires on re-enable.

## Files
- Edit: `src/features/cx-people/lib/one-on-one-reminders.ts` | `pwSendOnce_` (lines 49-65), import line 19
- Create: `tests/golden/reminders-off-sendonce.test.ts` | vitest file covering off and on states

## Context
- `src/features/cx-people/lib/one-on-one-reminders.ts:49-65` | `pwSendOnce_`; insert the gate after `if (sent[key]) return 'skipped'`, before `sendMail`
- `src/features/cx-people/lib/one-on-one-reminders.ts:106-107` | existing `skipped_off` dedupe-row shape to copy exactly (dedupe_key/kind/recipient/ref/status)
- `src/features/cx-people/lib/one-on-one-reminders.ts:19` | extend the settings import: `getConfig, setConfig, remindersOn`
- `tests/golden/hub-fakes.ts` + `tests/golden/queue-checkin.test.ts:13-16` | mock + seed pattern; `cacheClear()` from `src/features/shared/platform/repo.ts:61` between flips
- `src/features/shared/platform/mail.ts:175-199` | `sendMail` returns `{status}` and logs to `mail_log` even on dry-run

## Contract
Off-branch: `pwAppend_('pw_reminder_log', [{ dedupe_key: key, kind: msg.kind,
ref: msg.ref || '', recipient: ([] as unknown[]).concat(msg.to).join(','),
status: 'skipped_off' }], actor)`, then `sent[key] = true`, `return 'skipped'`.
Identical to the normal path minus the `sendMail` call. Signature unchanged.
Out of scope: `runOneOnOneReminders_` flow, callers' counters, the missed-esc
block (RMS-05), per-kind keys.

## Actions
1. Add `remindersOn` to the settings import and the contracted off-branch inside `pwSendOnce_`.
2. Create the test: mock supabase+auth via hub-fakes; `hubDbReset()` + `cacheClear()` per test; seed `config` (`reminders_enabled:'false'`, `admin_emails`, `mail_dry_run:true`), empty `pw_reminder_log` + `mail_log`; call `pwSendOnce_({}, 'dg|1', {to:'tl@dabdoob.com',kind:'daily_digest',ref:'r1',subject:'s',htmlBody:'<p>x</p>'}, 'system:trigger')` -> `'skipped'`, `mail_log` still empty, `pw_reminder_log` row has `status:'skipped_off'`; flip config to `'true'` + `cacheClear()` -> second call with new key returns `'dry_run'` and a `mail_log` row exists.

## Done when
- Off: no mail_log row, dedupe row `skipped_off`, returns `'skipped'`; on: sends + logs normally
- Test passes; `npx tsc --noEmit` clean

## Verify
- Run: `npx vitest run tests/golden/reminders-off-sendonce.test.ts` -> all tests pass

## Handoff
All digest/missed/meeting/oo15 sends via `pwSendOnce_` are now gated —
RMS-05's test relies on this leaf. Write results/RMS-04.md.
