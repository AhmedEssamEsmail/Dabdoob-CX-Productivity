# tl-5: FIX round for reports/data-3.md (DELTA)

Input: `reports/data-3.md` — verdict FAIL, open 0/0/1/1.

## Findings routed
| Finding | Sev | Disposition |
|---|---|---|
| data-1, data-2, data-4 (MED) | FIXED | verified already-done by reviewer; no work |
| data-3 (LOW) | open | stays `deferred` per FIX rules (LOW -> deferred) |
| data-5 (MED, new) | open | `spec/fix-data-3.md#data3-01` -> data-engineer -> **done** |

## data3-01 (data-5): `todays` select error aborts the agg_snapshots_today rewrite
Changed files:
- `src/features/cx-queue/lib/jobs.ts` — `todays` select now captures `error`
  as `todaysErr`; on error one `hbBeat('queue_snapshot','warn',...)` and the
  rewrite is guarded by `if (!todaysErr) await dqRewrite_('agg_snapshots_today', ...)`.
  `dqRemindMissedCheckins_` still runs; success path unchanged.
- `tests/golden/queue-checkin-auto.test.ts` — new regression test "leaves
  agg_snapshots_today untouched when the todays select fails" (seeds
  `queue_snapshots` + `agg_snapshots_today`, injects failure via
  `hubDb.missing.add('queue_snapshots')`; no hub-fakes change needed — the
  `dead` chain already covers `select/eq/order/limit`).

Evidence: `results/data3-01.md`. Gates: `npx vitest run` (5-file targeted
set) 56/56 PASS (`logs/fix-data3-vitest.log`); `npx tsc --noEmit` exit 0
(`logs/fix-data3-tsc.log`, `logs/fix-data3-tsc.exit`).

## Notes for the reviewer (DELTA scope)
- Reviewer-flagged assumptions unchanged: `dqRemindMissedCheckins_`'s own
  ignored `subErr` (jobs.ts ~298-303) remains a verbatim legacy port, out of
  this shard; `hub-fakes` still does not enforce the `(slot_date,slot)`
  unique index; `data-3` LOW stays deferred.
- No reviewer-spawning shard requests; none ignored. No git actions.
