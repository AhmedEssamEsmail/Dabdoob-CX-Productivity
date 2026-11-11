# data3-01 — DONE
Status: done. dqRewrite_ now evicts `live|<table>` best-effort after the delete succeeds (covers the `!rows.length` early-return); failed delete still throws before eviction.
Files: src/features/cx-queue/lib/jobs.ts (cacheRemove import + try/catch cacheRemove after delErr check); tests/jobs/queue-tickets-read.test.ts (new case: cacheClear + seeded live| keys, asserts cacheGet null after buildQueueAggregates_).
Checks: `npx vitest run tests/jobs/queue-tickets-read.test.ts tests/perf/flush-invalidate.test.ts` -> 2 files, 5 tests, all pass.
Handoff: none. Post-refresh dqCachedLive readers see fresh aggregates.
