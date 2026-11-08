# S03-04: readStoreFiltered helper + queue pages/server filtered reads
Kind: mini
ID: S03-04
Parent: S03
Owner: dev
Depends: S02-01
Criteria: PLAN #3 (agg_snapshots_today / queue_submissions / dq_aging_flags reads)
Skills: none
Budget: files=3; actions=6; changed_lines=90; minutes=9

## Goal
Add `readStoreFiltered` to `platform/stores.ts` (same `{rows, exists}`
missingOk contract as `readStore`, but with caller-supplied PostgREST
filters) and use it for the hot reads in `cx-queue/lib/pages.ts` and
`cx-queue/lib/server.ts`.

## Files
- Edit: `src/features/shared/platform/stores.ts` | add `readStoreFiltered` next to `readStore` (27-35)
- Edit: `src/features/cx-queue/lib/server.ts` | `getQueueHealthPage` (:76) + `getOpenAgingFlags` (:117)
- Edit: `src/features/cx-queue/lib/pages.ts` | `getCheckinsPage` (:118,:139) + `submitCheckin` (:208,:219)

## Context
- `src/features/shared/platform/stores.ts:20-35` | StoreRead shape + readStore to extend
- `src/features/cx-queue/lib/server.ts:72-103` | `today` derivable via `dqDateKey_(now, dqSetting_(cfg,'business_tz'))`; `exists` flags feed the `snapshots:'unavailable'`/`submissions:'unavailable'` markers — preserve them
- `src/features/cx-queue/lib/server.ts:115-119` | dq_aging_flags read — filter by the same predicate `dqOpenAgingFlags_` applies in-memory IF it maps to a real column (inspect the fn); else keep the full read and record why
- `src/features/cx-queue/lib/pages.ts:111-142,199-219` | submissions needed for [today, yesterday]; snapshots for `slot_date===today` / `snapshot_key===cp.key`

## Contract
- `readStoreFiltered(name, filter: (q) => q): Promise<StoreRead>` — builds `db().from(name).select('*')`, applies the caller's filter builder, returns `{rows, exists}` with the same error->`exists:false` behavior as readStore. (Alternatively accept `{eq?, in?, is?}` — pick ONE small shape; no string-SQL.)
- server.ts: agg_snapshots_today -> `.eq('slot_date', today)`; queue_submissions -> `.eq('slot_date', today)`; `exists` markers preserved.
- server.ts: dq_aging_flags -> the open-flag column filter when a real column exists; else full read + recorded reason.
- pages.ts: queue_submissions -> `.in('slot_date', [today, yesterday])` at both sites; agg_snapshots_today -> `.eq('slot_date', today)` (:139) and `.eq('snapshot_key', cp.key)` (:208).
- `dqCachedLive` small agg tables (agg_queue_now, agg_inflow_*) are out of scope — they are bounded aggregates.
Out of scope: jobs.ts (S03-03), env.ts, dqRewrite_ write paths.

## Actions
1. stores.ts: implement `readStoreFiltered` (doc header naming it the filtered sibling of readStore).
2. server.ts: filtered agg_snapshots_today + queue_submissions reads in getQueueHealthPage (compute `today` first).
3. server.ts: filter dq_aging_flags by the open predicate when column-mappable (evidence either way in results).
4. pages.ts: `slot_date in [today, yesterday]` submissions reads at :118 and :219.
5. pages.ts: slot_date/snapshot_key-filtered snapshots reads at :139/:208.
6. Remove now-unused `readStore` imports where fully replaced (keep dqCachedLive imports).

## Done when
- The named reads carry server-side filters; `snapshots`/`submissions` markers still flip to 'unavailable' on a real read failure.
- `npx vitest run tests/golden/queue.test.ts tests/golden/queue-checkin.test.ts` green.

## Verify
- Run: `npx vitest run tests/golden/queue.test.ts tests/golden/queue-checkin.test.ts` -> all pass.

## Handoff
`readStoreFiltered` is available for future leaves (not required elsewhere
here). Write results/S03-04.md (<=10 lines); TL alone updates TRACKER.md.
