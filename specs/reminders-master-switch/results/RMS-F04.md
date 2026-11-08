# RMS-F04
Status: done
Files: src/features/cx-quality/lib/server.ts; tests/golden/reminders-off-qa.test.ts
Checks: npx vitest run tests/golden/reminders-off-qa.test.ts — 2 passed; npx tsc --noEmit — clean
Result: reminders off skips QA popup backfill and reminder emails while still marking reminded_date; enabling later does not retroactively email already-marked CTLs.
Handoff: none
