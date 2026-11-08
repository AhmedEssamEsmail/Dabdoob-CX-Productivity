# S03-03: cx-queue jobs.ts filters its aggregate/mirror/submission reads
Kind: mini
ID: S03-03
Parent: S03
Owner: dev
Depends: S02-01
Criteria: PLAN #3 (freshchat / maqsam_calls / agg_inflow_daily / queue_submissions hot reads)
Skills: none
Budget: files=1; actions=4; changed_lines=60; minutes=8

## Goal
`src/features/cx-queue/lib/jobs.ts` replaces four whole-table reads with
server-side filtered `db()` queries bounded to the window the aggregation
actually consumes.

## Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `buildInflowAggregates_` (:145,:150,:177) and `dqRemindMissedCheckins_` (:254,:264)

## Context
- `src/features/cx-queue/lib/jobs.ts:139-177` | inflow window: `fromKey`/`since` already computed (:140,:159); freshchat (:145) and maqsam_calls (:150) via readStore, `agg_inflow_daily` full select (:177)
- `supabase/migrations/004_mirror_tables.sql:21-37` | mirror rows expose `ts_ms` (indexed) + `cols` jsonb + `dedupe_key` — filterable date column is `ts_ms`
- `src/features/cx-queue/lib/jobs.ts:247-264` | `due.map(c=>c.date)` bounds the submissions read; popups kind-filtered select at :264
- `src/features/shared/platform/stores.ts:27-40` | missingOk -> {rows:[],exists:false} semantics to mirror in the replacements

## Contract
- freshchat + maqsam_calls reads become `db().from(t).select('cols,dedupe_key,ts_ms').gte('ts_ms', <ms of 'since'>)` — use the SAME lower bound the counting uses (`since` = fromKey-1d). Verify `ts_ms` is the timestamp `dqCountInflow_` actually counts on; if it is not the counted field for one store, leave THAT read unfiltered and record why in results — do not guess.
- `agg_inflow_daily` read (:177): `.select('*').gte('date', fromKey)` — the upsert-merge only touches rows inside covered source ranges; rows older than fromKey are never rewritten (verify `counts.ranges` bounds before filtering; if ranges can extend earlier, use the min range bound instead).
- `queue_submissions` (:254): `db().from(t).select('*').in('slot_date', due.map(c=>c.date))` preserving `exists` behavior (error -> pass null to dqSubmissionsFor_ exactly as `subStore.exists===false` does today).
- `popups` (:264): keep `.eq('kind','queue_checkin_missed')`, narrow columns to `select('ref,recipient')`.
- `buildQueueAggregates_` freshchat read (:104) is UNCHANGED here — its aging semantics need the whole chat set; record that decision in results.
Out of scope: other files, pages.ts/server.ts (S03-04), write paths.

## Actions
1. Inflow: replace freshchat read with the filtered db() select (ts_ms >= sinceMs).
2. Inflow: same for maqsam_calls (keep the cols -> [id,start,state,direction,country] mapping).
3. Inflow: filter agg_inflow_daily by the merge window.
4. dqRemindMissedCheckins_: slot_date-filtered submissions read + narrowed popups select.

## Done when
- No `readStore('freshchat'|'maqsam_calls')` or unbounded `agg_inflow_daily`/`queue_submissions` select remains in this file's named regions (except the documented :104 keep).
- `npx vitest run tests/golden/queue-aggregates.test.ts tests/golden/reminders-off-dq.test.ts` green.

## Verify
- Run: `npx vitest run tests/golden/queue-aggregates.test.ts tests/golden/reminders-off-dq.test.ts` -> all pass.

## Handoff
Report which filters applied + any kept full reads w/ reason.
Write results/S03-03.md (<=10 lines); TL alone updates TRACKER.md.
