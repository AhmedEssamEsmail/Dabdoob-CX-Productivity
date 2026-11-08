# RMS-05 results
Status: done
Files: edited src/features/cx-people/lib/reminders.ts (remindersOn import + gated escalation sendMail ternary); created tests/golden/reminders-off-missed.test.ts
Checks: `npx vitest run tests/golden/reminders-off-missed.test.ts` 1/1 pass; `npx tsc --noEmit` clean
Behaviour: off-state run marks SC-TODAY missed, writes missed:* and missed-esc:* dedupe rows all status skipped_off; popups and mail_log empty; escalation counter unchanged (escalated=1)
Handoff: none — last direct sendMail in people reminder jobs gated; blockers none
