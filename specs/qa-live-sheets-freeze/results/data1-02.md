# data1-02 — DONE
Status: implemented + verified.
Files: src/features/shared/jobs/env.ts (prefetchWorkbook: any tab error -> books[key]=Error, return before merge; tabErrors removed from stored books), tests/jobs/env-dbbook.test.ts (mock errors map, beforeEach reset, partial-failure regression case).
Checks: `npx vitest run tests/jobs/env-dbbook.test.ts tests/jobs/dbbook.test.ts` -> 2 files, 20 tests, all pass.
Handoff: books values are {cells,book} or Error only; missing-store header-only path unchanged.
