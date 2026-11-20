# data report - auto-checkins - round 3 (DELTA)

Verdict: FAIL
Open: 0/0/1/1

Scope: prior open findings (data-3 LOW deferred, data-4 MED) + delta per `reports/tl-4.md`: `src/features/cx-queue/lib/jobs.ts` (snapErr abort), `tests/golden/hub-fakes.ts` (`in()` on dead chain), `tests/golden/queue-checkin-auto.test.ts` (new regression test).

Reconciliation: re-ran `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> 8/8 PASS, exit 0 (`specs/auto-checkins/logs/data3-vitest.log`). SnapErr sample: frozen `2026-10-15|14:00` rows + `hubDb.missing.add('queue_snapshots')` -> expected captured=0, subs=0, `data_as_of` stays `2026-10-15T11:05:00Z`; actual identical, delta 0, tolerance exact. `in() { return dead }` present at hub-fakes.ts:121 — the missing-table error now propagates through the snapKeys `.in()` chain as intended.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | MED (FIXED) | jobs.ts:365 | Prior fix retained: `.in('snapshot_key', ...)` resolves cross-year cps; Dec-31 test still green. | - | data-engineer |
| data-2 | MED (FIXED) | jobs.ts:418-425 | Prior fix retained: `subDone` path retries `resolvePopups` per tick in own try/catch. | - | data-engineer |
| data-3 | LOW (still open, deferred) | jobs.ts:378-385 | Unchanged: `subErr` degrades to "no submissions" -> insert attempted per cp each tick; unique index bounds damage. | On `subErr`, skip auto-insert this tick. | data-engineer |
| data-4 | MED (FIXED) | jobs.ts:365,390-373 | `snapErr` captured; one warn beat; loop iterates `snapErr ? [] : cps` so a failed key lookup aborts capture AND auto-insert AND popup-resolve (retried next tick). Verified by new test (test:179-197). | - | data-engineer |
| data-5 | MED (new) | jobs.ts:388,449 | Same degrade class the data-4 fix just guarded: the `todays` select on the same table ignores its error, so the very transient failure that trips `snapErr` likely also yields `todays=[]`, and `dqRewrite_` then deletes every `agg_snapshots_today` row. Silent (successful delete, no beat); derived table self-heals next healthy tick, but the today-snapshot view empties precisely during the blip. | Capture the `todays` select error; on error skip `dqRewrite_` this tick (or abort before the rewrite). | data-engineer |

Verified PASS (no new findings): insert-only semantics, `system:job` actor, 'late' stamp vs `dueAt`, `queues_json` shape (`agents:null`, `status:'Auto'`, captured `open/oldestH/unassigned/stale/data_as_of`), orphaned-submission retry from frozen `dqSnapshotRows_`, non-fresh tick still raises missed reminder — all unchanged and consistent with PLAN criteria 1-6.

Not verified / assumptions: no live DB — snapErr/todays-failure coupling inferred (same table, back-to-back queries), not observed; `dqRemindMissedCheckins_`'s own ignored `subErr` (jobs.ts:298-303) can false-positive "missed" under a per-query transient failure — verbatim legacy port, out of this shard's delta; `hub-fakes` still does not enforce the `(slot_date,slot)` unique index.
