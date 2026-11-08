status: done
files: src/features/cx-people/lib/scorecard/index.ts; src/features/cx-people/lib/scorecard-server.ts; tests/golden/scorecard.test.ts
changes: added scTrend_ 8-bucket per-agent trend; getScorecardPage now returns agents[].trend and prevTeam
checks: npx vitest run tests/golden/scorecard.test.ts -> 13 passed; npx tsc --noEmit -> clean
handoff: data.agents[i].trend and data.prevTeam ready for FUX-12
blockers: none
