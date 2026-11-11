# data6-01 result
Status: DONE
Files: src/features/cx-queue/lib/jobs.ts (gte/lte prefix bound over dueDates min/max), src/features/cx-queue/lib/server.ts (gte/lte + order slot_date asc tie-break), tests/golden/reminders-off-dq.test.ts (+1 case), tests/golden/queue-checkin.test.ts (+1 non-oracle case + submitQueueCheckin import).
Checks: `npx vitest run tests/golden/reminders-off-dq.test.ts tests/golden/queue-checkin.test.ts` -> 42/42 green; `npx tsc --noEmit` -> 0 errors (full run).
Notes: no `.in('slot_date'`/`.eq('slot_date'` remains on queue_submissions reads in src/. JS re-filters unchanged.
Handoff: none; snapshot-table eq sites remain intentionally raw per contract.
