# FIX-15a result
Status: done
Files: src/features/cx-quality/lib/server.ts (added qaRowsWhere_; converted qaTicketClash_, getQaMyAuditsPage, getQaCalibrationPage audit reads)
Checks: `npx tsc --noEmit` 0 errors; `npx vitest run tests/golden/quality.test.ts` 64/64 pass
Notes: in-memory conjuncts retained at all 3 sites; qaRows_ untouched; no other call sites changed.
Handoff: qaRowsWhere_ (eq/in/is/gte, empty-in -> []) available for FIX-15b.
