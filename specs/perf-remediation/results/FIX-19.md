# FIX-19 results
Status: done
Files: src/features/cx-queue/lib/jobs.ts (prod_daily_layers read now `.gte('date', dqAddDays_(today, -45))`), tests/jobs/queue-tickets-read.test.ts (new perf-5 case).
Checks: `npx vitest run tests/jobs/queue-tickets-read.test.ts` 2/2 pass; `npx tsc --noEmit` 0 errors.
Horizon: dqAgentPerf_ max back-reach is MTD monthStart (~today-31d) > dailyFrom (today-30d); -45d covers it. Dead `<=2` branch reads nothing extra.
Handoff: none.
