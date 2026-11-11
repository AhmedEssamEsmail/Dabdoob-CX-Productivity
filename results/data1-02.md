status: done
files: src/features/cx-quality/components/audit-queue-page.tsx
changes: destructured applyQueue/applyPassed; sortedQueue/sortedPassed deps now track apply fns plus row inputs
checks: `npx vitest run tests/perf/audit-queue-memo.test.tsx` -> 4/4 passed
handoff: none
