# RMS-06 result
Status: done
Files: src/features/cx-queue/lib/jobs.ts; tests/golden/reminders-off-dq.test.ts
Checks: `npx vitest run tests/golden/reminders-off-dq.test.ts` — 1 passed
Handoff: `dqRemindMissedCheckins_` now returns before reads/writes when `reminders_enabled` is false; `dqCheckinTick_` unchanged.
Blockers: none
