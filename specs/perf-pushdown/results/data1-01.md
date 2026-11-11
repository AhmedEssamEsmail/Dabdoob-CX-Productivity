status: done (follow-up: eslint warning fixed)
files: src/features/cx-productivity/components/tph-grid-views.tsx (eslint-disable comment above dep array :211)
checks: `npx eslint src/features/cx-productivity/components/tph-grid-views.tsx` -> exit 0, 0 problems; `npx vitest run tests/perf/tph-grid-memo.test.tsx` -> 7/7 passed
deps: [missingMap, d.off, d.channels, d.activities] unchanged; comment cites We's field contract
handoff: data1-02 covers audit-queue sort-apply deps
