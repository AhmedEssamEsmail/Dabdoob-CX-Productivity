FIX-03 done. Deleted test-only getUser/requireAuth from lib/auth.ts;
removed their describes/imports in auth.test.ts; removed them from
authModule() + fixed doc comment in tests/golden/hub-fakes.ts.
Checks: vitest auth.test.ts = 8/8 pass; tsc --noEmit has 4 errors, ALL in
src/app/api/cron/job-data-tick/route.ts (unterminated template literal,
TS1109/TS1160) — unrelated file modified by another in-flight shard, zero
errors in my 3 files. No file imports deleted names from lib/auth.
