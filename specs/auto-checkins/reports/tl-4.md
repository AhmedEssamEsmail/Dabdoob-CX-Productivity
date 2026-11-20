# tl-4: FIX round for reports/data-2.md (DELTA)

Input: `reports/data-2.md` — verdict FAIL, open 0/0/1/1.

## Findings routed
| Finding | Sev | Disposition |
|---|---|---|
| data-1, data-2 (MED) | FIXED | verified already-done by reviewer; no work |
| data-3 (LOW) | open | stays `deferred` per FIX rules (LOW -> deferred) |
| data-4 (MED, new) | open | `spec/fix-data-2.md#data2-01` -> data-engineer -> **done** |

## data2-01 (data-4): `snapKeys` select error aborts capture+auto-insert
Changed files:
- `src/features/cx-queue/lib/jobs.ts` — `snapKeys` select now captures `error`
  as `snapErr`; on error one `hbBeat('queue_snapshot','warn',...)` and the
  per-cp loop iterates `snapErr ? [] : cps` (have=unknown-abort). `todays`
  load, `dqRewrite_`, `dqRemindMissedCheckins_` unchanged.
- `tests/golden/hub-fakes.ts` — `in() { return dead }` added to the `dead`
  chain so `hubDb.missing` surfaces `{error}` through `.in()` (same seam as
  the earlier `.not()` extension).
- `tests/golden/queue-checkin-auto.test.ts` — new regression test "aborts
  capture and auto-insert when the snapKeys select fails".

Evidence: `results/data2-01.md`. Gates: `npx vitest run` (5-file targeted
set) 55/55 PASS (`logs/fix-data2-vitest.log`); `npx tsc --noEmit` exit 0
(`logs/fix-data2-tsc.log`).

## Notes for the reviewer (DELTA scope)
- Out-of-scope observation: `tests/golden/hub-overview.test.ts` is dirty vs
  HEAD with an unrelated D-QUALITY `ok.quality` strip — not part of this
  shard; left untouched (pre-existing baseline edit).
- `hub-fakes.ts` diff vs HEAD also bundles prior uncommitted `.not()`/
  `neq()` dead-chain additions from earlier rounds.
- No reviewer-spawning shard requests; none ignored. No git actions.
