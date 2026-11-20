# data report - auto-checkins - round 4 (DELTA)

Verdict: PASS
Open: 0/0/0/1

Scope: data-5 fix only, per `reports/tl-5.md` — `src/features/cx-queue/lib/jobs.ts` (`todaysErr` guard on `dqRewrite_`), `tests/golden/queue-checkin-auto.test.ts` (new regression test). Untouched code not re-audited.

Reconciliation: re-ran `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> 9/9 PASS, exit 0 (`specs/auto-checkins/logs/data4-vitest.log`). New test "leaves agg_snapshots_today untouched when the todays select fails" (test:199-217): seeds `queue_snapshots` + sentinel `agg_snapshots_today` row, `hubDb.missing.add('queue_snapshots')` -> expected sentinel row survives; actual `{queue:'Ops QA Gift',open:7}` intact, delta 0, tolerance exact. Dead chain covers `select/eq/order/limit` (hub-fakes.ts:110-115), so the `todays` select genuinely errors — test is not vacuous.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-5 | MED (FIXED) | jobs.ts:388,391-393,455-457 | `todaysErr` captured; one warn beat; `dqRewrite_('agg_snapshots_today', ...)` guarded by `if (!todaysErr)`. Verified by new test. | - | data-engineer |
| data-3 | LOW (still open, deferred) | jobs.ts:378-385 | Unchanged per FIX rules: `subErr` degrades to "no submissions" -> insert attempted per cp each tick; unique index bounds damage. | On `subErr`, skip auto-insert this tick. | data-engineer |

Edge case checked: `snapErr` OK but `todaysErr` fails -> capture loop still runs, captured rows concat into `todays` (line 419) but the rewrite is skipped, so no partial/clobbered `agg_snapshots_today`; self-heals next healthy tick. `dqRemindMissedCheckins_` (line 458) still runs — acceptable; a missed-reminder false positive is bounded vs. a destructive rewrite.

Not verified / assumptions: no live DB — coupled snapErr/todaysErr failure still inferred, not observed; `dqRemindMissedCheckins_`'s own ignored `subErr` (jobs.ts ~298-303) remains verbatim legacy port, out of shard; `hub-fakes` still does not enforce the `(slot_date,slot)` unique index.
