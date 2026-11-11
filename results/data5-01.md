# data5-01: updateRows batch select paged
Status: DONE
Files: src/features/shared/platform/repo.ts (updateRows select -> chunked readAllPaged, 500-key chunks); tests/platform/repo.test.ts (new >pageSize case)
Checks: `npx vitest run tests/platform/repo.test.ts tests/perf/fallback-log.test.ts` -> 21/21 green; `npx tsc --noEmit` -> 0 errors
Notes: keys chunked at 500; each chunk pages via readAllPaged (`.in` re-applied per page); selErr now surfaces as thrown Error from readAllPaged; byKey dedupe makes page order irrelevant
Handoff: >1000-key updateRows truncation closed; no caller changes
