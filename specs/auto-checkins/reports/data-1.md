# data report - auto-checkins - round 1 (FULL)

Verdict: FAIL
Open: 0/0/2/1

Reconciliation: metric "Check-ins in today" (`slotsDone` = count of `dqSlotState_`='done' slots) — any `queue_submissions` row counts, so auto rows increment it exactly once per (slot_date, slot). Re-ran `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> 5/5 PASS (`spec/logs/../logs/data1-vitest.log`, i.e. `specs/auto-checkins/logs/data1-vitest.log`): queues_json numbers equal the captured/frozen `queue_snapshots` rows exactly (open/oldestH/unassigned/stale/data_as_of, both paths), 2 ticks -> 1 row. Expected vs actual: delta 0, tolerance exact. Row shape verified vs `submitCheckin` (pages.ts:235-239): identical column set; 'late' iff `now > dueAt` matches manual.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | MED | jobs.ts:365,385-410 | `have` is loaded `.eq('year', year)` (today's year) but `cps` spans yesterday+today; on Jan 1 a Dec-31 slot inside its 6h window misses `have`, so the capture branch re-upserts the frozen Dec-31 snapshot with live Jan-1 numbers, then auto-inserts a submission embedding those wrong-as-of numbers (breaks the tl-2 "frozen rows, never live" guarantee). Once/year, bounded to the ~22:00 slot crossing midnight. | Load `have` per cp scope: `.in('year', [...new Set(cps.map(c => Number(c.date.slice(0,4))))])` or `.in('snapshot_key', cps.map(c => c.key))`. | data-engineer |
| data-2 | MED | jobs.ts:413-434 | `resolvePopups` is inside the same try as `appendRow` but guarded by `if (subDone[cp.key]) continue`: if insert succeeds and `resolvePopups` throws, every later tick skips the cp (submission now exists) and the stale `queue_checkin_missed` popup stays open forever for a done slot. | Move popup resolution out of the insert-guarded path (e.g. resolve for any cp in `subDone`, or retry resolve before `continue` on `subDone[cp.key]`). | data-engineer |
| data-3 | LOW | jobs.ts:373-378 | A failed existence SELECT (`subErr`) degrades to "no submissions" -> insert attempted per snapshotted cp each tick; the `(slot_date,slot)` unique index blocks dupes but each burns a failed insert + warn beat until the read recovers. | Optional: on `subErr`, skip auto-insert this tick (capture/reminder unaffected) or count violations quietly. | data-engineer |

Verified PASS (no findings): auto row is insert-only (appendRow, no update path) and idempotent via `subDone` + `queue_submissions_slot_date_slot_uidx` (migration 20261108204952:38); non-fresh ticks skip capture+insert while `dqRemindMissedCheckins_` still fires; the reminder re-reads submissions in the same call so auto rows suppress it; 'late' stamp, `system:job` actor, agents=null/status='Auto' queues_json, and `snapshot_key=cp.key` all match PLAN; earlier-cards consume only queue/agents/status/note so extra number fields are inert; no consumer reads `sourceAsOf` from queues_json.

Not verified / assumptions: no live DB access — unique-index race behavior verified by migration DDL only; `hub-fakes` does not enforce the (slot_date,slot) unique index, so test-level idempotency relies on the `subDone` gate alone.
