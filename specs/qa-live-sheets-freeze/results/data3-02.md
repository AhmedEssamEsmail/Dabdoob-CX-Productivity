# data3-02 — scorecard audit filter aligned to qaRollupAudits_
Status: done
Files: src/features/cx-people/lib/scorecard-server.ts (scDailyRowsDb_ guards + docblock), tests/platform/sc-daily-db.test.ts (audit fixture + expectations)
Change: kind guard now `String(r.kind || 'audit') !== 'audit'`; status excludes raw 'voided'/'disputed' (no toLowerCase), matching core.ts canonical predicate.
Checks: `npx vitest run tests/platform/sc-daily-db.test.ts` -> 7/7 pass; `npx tsc --noEmit` -> exit 0.
Handoff: none. New fixture rows: status 'disputed' skipped, kind '' counted (audits=4, score_x_audits=370).
