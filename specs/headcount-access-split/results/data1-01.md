# data1-01 — tphCheckAgent_ write gate keys on isCxAgent_

Status: DONE
Files: edited src/features/cx-productivity/lib/tph/write.ts (isCxAgent_ import + predicate swap at ~line 48); created tests/perf/tph-write-gate.test.ts (5 pins).
Checks: `npx vitest run tests/perf/tph-write-gate.test.ts` 5/5 pass; `npx tsc --noEmit` exit 0.
Handoff: none — leaf-local gate; legacy tphPeople_ copies in tph/index.ts remain deferred (data-4).
