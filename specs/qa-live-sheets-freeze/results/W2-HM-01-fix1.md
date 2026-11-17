# W2-HM-01-fix1 — status: DONE
Files: tests/golden/viewas-sweep.test.ts (:55 import -> buildHeatmapFromSource; :286 sweep row renamed).
Checks: `npx vitest run tests/golden/viewas-sweep.test.ts` -> 65/65 pass. `npx tsc --noEmit` -> 0 diagnostics (log empty).
Blocker/handoff: none. Resolved W2-HM-01 SCOPE_REQUEST; feeds W2-HM-02.
