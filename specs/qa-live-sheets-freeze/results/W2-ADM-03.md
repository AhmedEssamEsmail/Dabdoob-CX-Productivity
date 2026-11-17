status: done; repo tsc has unrelated blocker
files: src/features/shared/migration/engine.ts; src/app/api/admin/list-sheets/route.ts
checks: removed both `{ deferred: true }` read opts; list-sheets POST keeps auth then returns 410; googleapis block deleted
checks: deferred/googleapis matches = 0 (rg not on PATH; used grep tool)
verify: `npx tsc --noEmit` failed only tests/golden/viewas-sweep.test.ts(55,10) TS2305 missing `runPriorHeatmapRegression`; no diagnostics in touched files
handoff: TL triage unrelated tsc error; engine/list-sheets freeze behavior implemented
