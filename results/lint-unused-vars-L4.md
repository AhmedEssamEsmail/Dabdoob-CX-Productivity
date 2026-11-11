# lint-unused-vars L4 — tests/

Status: RESHARD_NEEDED (14 files total > 10-file mini-leaf cap; perf portion was a directory-grant glob)

## Completed (7 named files, 17 warnings -> 0)
- tests/golden/desk.test.ts — dropped unused `const { port }` destructure (1688)
- tests/golden/prod-validation.test.ts — removed `expectSame` import; `offsetMs: (ms)=>` -> `()=>` (481)
- tests/golden/productivity.test.ts — removed `prodComputeRange_` import, dead `const cfg = CFG()`, `openSpreadsheet` unused `id` param
- tests/golden/scorecard.test.ts — removed dead `const CFG` (46); `readRange` dropped unused `from`/`to` params (474)
- tests/golden/tph.test.ts — removed `TPH_SLOTS`, `TPH_OFF`, `tphBuildCallMinutes_` imports; dead `YESTERDAY`; dead `const chans`
- tests/lib/fetch-json.test.ts — unused fetch stub params -> `vi.fn<(url, init?) => Promise<...>>` generic keeps `spy.mock.calls` typing
- tests/platform/signin-verdict.test.ts — `from: ()` stub; mock sites `() => supa.from()`

## Remaining (new leaf L4b suggested): tests/perf/** — 7 files, 8 warnings
- dq-live-cache.test.ts:13, fallback-log.test.ts:13, flush-invalidate.test.ts:13, job-preload.test.ts:13, prod-analytics.test.ts:11, read-all-paged.test.ts:13 — `from: (_table: string)` in vi.hoisted stub; fix like signin-verdict (drop param, `() => supa.from()` at mock sites) OR wire `table` into the thrown error (see tph-store.test.ts pattern). Check each file's `supa.from` call sites first.
- qa-pushdown.test.ts:186 — `asOf`, `cached` destructured but unused

## Evidence
- `npx eslint <7 files>`: 0 warnings (log: %TEMP%/l4-verify1.log)
- `npx vitest run tests`: my files all pass; 2 unrelated failures in untracked tests/perf/*-memo.test.tsx (memo-dep assertions, not touched; likely in-flight by another agent)
- `npx tsc --noEmit`: exit 0
- hm-engine.js untouched (owned by another agent)
