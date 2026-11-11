# lint-test-01: done

- `tests/perf/lookups.test.ts`: two `no-explicit-any` fixed via local `FilterArg` type (`eq?/is?/in?: Record<string, unknown>`) on `match` + `readStoreFiltered` — matches the pushed-filter shape.
- `tests/perf/queue-pages.test.ts`: `let p` -> `const p = new Proxy(...)` (`prefer-const`); self-reference inside `get` handler stays valid (lazy closure).
- Extra in-file fix (flag for TL): `lookups.test.ts` `dqIsHoliday_` assertion + title updated — stale `eq:{country}` expectation predates holiday-eq-01's landed source change (`roster.ts:563` now pushes `eq:{date}` only); case-insensitive country guard still verified by the `'already has a holiday'` reject.
- Verify: `npx eslint tests/perf/lookups.test.ts tests/perf/queue-pages.test.ts` -> exit 0 (0 errors/warnings).
- Verify: `npx vitest run tests/perf/lookups.test.ts tests/perf/queue-pages.test.ts` -> exit 0, 7/7 pass.
- Logs removed per OUTPUT-BUDGET rule 10.
