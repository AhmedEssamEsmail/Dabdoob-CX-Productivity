# upsert-fake-01: add `.upsert` to perf-test fake builders
Status: done.
Files: tests/perf/qa-pushdown.test.ts, tests/perf/qe-lookups.test.ts (each: `ups` var + deferred apply in run() + `upsert` builder method).
Semantics: mirrors hub-fakes:254-268 — dedupe on `onConflict` keys (default `id`), `Object.assign` on hit else push (id autoincrement); resolves `{data: ups.rows, error: null}` via existing then(); records `['upsert', keys]` op. Applied deferred in run() like qa-upsert.test.ts so data = upserted rows.
Other perf fakes: grep found only these two builders missing upsert among files hitting qaUpsertIn_ (qa-upsert.test.ts already had it; fallback-log/flush-invalidate use own env helpers).
Check: `npx vitest run tests/perf/qa-pushdown.test.ts tests/perf/qe-lookups.test.ts tests/golden/hub-people-holidays.test.ts` -> 3 files / 33 tests all pass, exit 0 (log: specs/perf-pushdown/logs/upsert-fake-01.log). 0 `upsert is not a function`; holiday oracle green too.
Residuals: none. Handoff: none.
