# perf1-03 — DONE
Status: done
Files: src/features/shared/jobs/dbbook.ts; tests/jobs/dbbook.test.ts
Changes: fdAuxTab_(ctx) now uses pk:'ts_ms' + tsBuild_(windowFor_(ctx)); 'FD_AUX' case passes ctx; test asserts ['gte','ts_ms',since] and pk='ts_ms'; header-only fallback unchanged.
Checks: `npx vitest run tests/jobs/dbbook.test.ts` -> 15/15 pass; `npx tsc --noEmit` -> 0 errors.
Blockers/handoff: none. All 8 tab synthesizers now window-bound.
TL alone updates TRACKER.md.
