status: done
files: src/features/shared/jobs/env.ts; tests/perf/fallback-log.test.ts
changes: added last-wins key-tuple row dedupe before upsert/delete/insert; added regression coverage for success and constraint-fallback paths
checks: `npx vitest run tests/perf/fallback-log.test.ts tests/perf/flush-invalidate.test.ts` -> 2 files passed, 5 tests passed
handoff: none; no blockers
