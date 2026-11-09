status: done
files: src/app/api/cron/job-tph-hourly/route.ts, src/app/api/cron/scorecard-nightly/route.ts, src/app/api/integrations/freshchat/route.ts, src/app/api/integrations/freshdesk/route.ts, src/app/api/integrations/gmail/route.ts, src/app/api/integrations/maqsam/route.ts, tests/jobs/routes.test.ts
checks: Bearer ${process.env.CRON_SECRET} grep -> 0 matches; vitest routes.test.ts 10/10 green; tsc --noEmit -> 0
notes: fail-closed Bearer gate applied to all 6 routes; new regression test asserts 401 for 'Bearer undefined' + missing auth under NODE_ENV=production with CRON_SECRET deleted (routeHourly GET + routeGmail POST)
handoff: none
