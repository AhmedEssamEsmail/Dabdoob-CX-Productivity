# data3-01 — sc_months fcr_dated boolean
Status: done
Files: src/features/cx-people/lib/scorecard-server.ts (meta.fcr_dated = merged.fcrRows > 0); tests/platform/sc-daily-db.test.ts (sc_months upsert asserts + zero-fcr micro-case)
Checks: `npx vitest run tests/platform/sc-daily-db.test.ts` 7/7 pass; `npx tsc --noEmit` exit 0
Blockers/handoff: none
