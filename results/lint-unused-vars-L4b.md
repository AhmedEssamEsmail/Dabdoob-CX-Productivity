# lint-unused-vars L4b — tests/perf/

Status: DONE — 8/8 warnings fixed, 7 files changed.

## Changes
- dq-live-cache, fallback-log, flush-invalidate, job-preload, read-all-paged,
  prod-analytics (`_table` stub, ~line 11-13): wired into thrown error ->
  `` throw new Error(`install fakeDb per test: from(${_table})`) `` (same as
  tph-store/stores-filter pattern).
- qa-pushdown:185 — destructure-omit `{ asOf, cached, ...rest }` replaced by
  spread + `delete rest.asOf` / `delete rest.cached` (behaviour-identical,
  input not mutated).

## Evidence
- `npx eslint tests/perf`: clean, 0 problems (log /tmp/l4b-eslint-after.log)
- `npx vitest run tests/perf`: 18 files / 104 tests pass; 5 failures confined
  to untracked audit-queue-memo.test.tsx (3) + tph-grid-memo.test.tsx (2) —
  memo-dep call-count assertions, in-flight by another agent, not mine.
- hm-engine.js untouched; no eslint-disable used; no other files touched.
