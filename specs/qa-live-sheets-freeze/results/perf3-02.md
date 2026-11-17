# perf3-02 — qa_audits column projection
Status: done
Files: src/features/cx-people/lib/scorecard-server.ts (scDailyRowsDb_ qa_audits readAllPaged, ~:247-250)
Change: added `columns: 'audit_date,agent_email,kind,status,score_final,score'`; gte/lt window filter unchanged.
Checks: `npx vitest run tests/platform/sc-daily-db.test.ts` -> 7/7 pass; `npx tsc --noEmit` -> 0 errors.
Handoff: none.
