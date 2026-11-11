# fakes-01 — hub-fakes mkQuery gains range + comparison ops
Status: done. `tests/golden/hub-fakes.ts` only: `cmpVals` helper (numeric-string aware; `''`↔null seam sorts last/fails filters like SQL NULL), `.range(from,to)` inclusive post-order slice, `.gte/.gt/.lte/.lt` filter push, `.order()` now appends keys (readAllPaged orderBy-then-pk), same ops on missing-table stub + `Q` iface.
Checks: `npx vitest run tests/golden/` → 870/876, exit 1 (log `logs/fakes-01-vitest.log`); all 246 `range is not a function` TypeErrors cleared. `npx tsc --noEmit` → hub-fakes clean; 1 pre-existing app error `src/app/api/prod/analytics/route.ts(55,7) TS2571` (TableQuery `.gte` returns unknown — prod typing gap, not mine).
Residual real regressions (not fixed, enumerate per contract):
- tests/golden/desk.test.ts:716/723 — `approvals[1].threadId "t-fresh-send" != "t6"`
- tests/golden/desk.test.ts:1823/1834 — `approvals[1].threadId "t-stuck" != "t6"` (ordering)
- tests/golden/operations.test.ts:1085 — view-as refusal message picked wrong tracker write
- tests/golden/people-jobs.test.ts:549 — digest line[0] picks `T-OD` not `T-HALF`
Handoff: golden fake trustworthy; the 6 above look like S10 ordering/selection regressions for TL triage.
