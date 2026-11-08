# RMS-04: gate pwSendOnce_ on reminders_enabled
Status: done
Files: src/features/cx-people/lib/one-on-one-reminders.ts (import + off-branch in pwSendOnce_); tests/golden/reminders-off-sendonce.test.ts (new)
Checks: `npx vitest run tests/golden/reminders-off-sendonce.test.ts` -> 2/2 pass; `npx tsc --noEmit` -> exit 0
Behaviour: off -> pw_reminder_log row status 'skipped_off', mail_log untouched, returns 'skipped'; on -> 'dry_run' + mail_log row
Handoff: all pwSendOnce_ sends now gated; RMS-05 missed-esc test can rely on this. No blockers.
