# RMS-F03: dqRemindMissedCheckins_ writes dedupe rows while off
Status: done
Files: src/features/cx-queue/lib/jobs.ts (gate sendMail on remindersOn, popup dedupe unconditional); tests/golden/reminders-off-dq.test.ts (new contract + second checkpoint)
Checks: `npx vitest run tests/golden/reminders-off-dq.test.ts` 1/1 pass; `npx tsc --noEmit` clean
Notes: off run writes queue_checkin_missed popup, empty mail_log; re-enable suppresses same checkpoint, new checkpoint mails normally
Handoff: none
