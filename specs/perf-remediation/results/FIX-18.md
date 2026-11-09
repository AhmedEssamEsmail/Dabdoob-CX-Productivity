# FIX-18 — done
Status: done
Files: src/app/api/prod/flags/route.ts (+1 line: `.or('decision.eq.pending,date.gte.' + decidedFrom)` on flagsQuery, applied after TL scope or; PostgREST ANDs multiple or-params).
Semantics preserved: pending any age OR decided within 30d window; in-memory filters unchanged; admin/TL views identical.
Checks: `npx tsc --noEmit` 0 errors; `npx eslint src/app/api/prod/flags/route.ts` 0 errors.
Blockers/handoff: none.
