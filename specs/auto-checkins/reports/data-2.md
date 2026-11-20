# data report - auto-checkins - round 2 (DELTA)

Verdict: FAIL
Open: 0/0/1/1

Scope: prior open findings (data-1..data-3) + delta in `src/features/cx-queue/lib/jobs.ts` and `tests/golden/queue-checkin-auto.test.ts` per `reports/tl-3.md`.

Reconciliation: re-ran `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> 7/7 PASS, exit 0 (`specs/auto-checkins/logs/data2-vitest.log`). Cross-year sample: frozen `2025-12-31|23:00` rows on a Jan-1 tick — expected 0 recaptures, `data_as_of` stays `2025-12-31T19:40:00Z`, submission embeds frozen stamps; actual identical, delta 0, tolerance exact. Popup-retry sample: pre-existing submission + open `queue_checkin_missed` popup -> `resolved_at` set, subs stay 1; delta 0.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | MED (FIXED) | jobs.ts:365 | `have` now `.in('snapshot_key', cps.map(c=>c.key))`; Dec-31 cp on Jan-1 tick resolves to `have[key]=true`, no recapture. Verified by new regression test (test:155-177). | - | data-engineer |
| data-2 | MED (FIXED) | jobs.ts:413-420 | `subDone[cp.key]` path now attempts `resolvePopups` in own try/catch + warn before `continue`; failed post-insert resolve at :438 is retried every later tick. `resolvePopups` is a bounded no-op when nothing open (`.is('resolved_at',null)`, popups.ts:115). Verified by new test (test:137-153). | - | data-engineer |
| data-3 | LOW (still open, deferred by tl-3) | jobs.ts:373-378 | Unchanged: `subErr` degrades to "no submissions" -> insert attempted per cp each tick; `(slot_date,slot)` unique index bounds damage to failed inserts + warn beats. | On `subErr`, skip auto-insert this tick. | data-engineer |
| data-4 | MED (new) | jobs.ts:365 | Same degrade class, unbounded: `snapKeys` SELECT error is ignored, so a transient read failure empties `have` -> every in-window cp recaptures from live and the `upsert` (:404) overwrites already-frozen `queue_snapshots` rows (captured_at/data_as_of/numbers), then auto-inserts a submission embedding wrong-as-of data — breaks the "frozen rows, never live" guarantee like data-1 did. Pre-existing pattern, now the sole gap in it. | Capture the select error; if it fails, `continue`/skip capture+auto-insert this tick (or treat `have` as unknown-abort, not empty). | data-engineer |

Verified PASS (no new findings): `todays`/`agg_snapshots_today` rewrite still correctly year+today-scoped (line 383, `cp.date===today` concat guard :408); `dates` range query covers cross-year submissions; per-tick `resolvePopups` calls bounded to <=8 no-op updates; insert-only path, `system:job` actor, 'late' stamp, queues_json shape all unchanged and consistent with PLAN.

Not verified / assumptions: no live DB — transient-select-failure probability inferred, not observed; `hub-fakes` still does not enforce the `(slot_date,slot)` unique index.
