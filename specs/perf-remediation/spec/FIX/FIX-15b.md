# FIX-15b: Server-side bounds for join/date-window `qa_audits` reads (perf-1, part 2)
Kind: mini
ID: FIX-15b
Parent: -
Owner: dev
Depends: FIX-15a
Criteria: perf-1 finding perf-1 (MED): whole-table `qaRows_('qa_audits')` on hot paths (pg_stat ~170ms mean, unbounded growth)
Skills: none
Budget: files=1; actions=4; changed_lines=90; minutes=9

## Goal
Convert the FOUR remaining cited `qaRows_('qa_audits')` sites — quota page
date-window read and the three auditsBy-map joins — so only needed rows cross
the wire, using `qaRowsWhere_` from FIX-15a. Identical page outputs and error
paths.

## Files
- Edit: `src/features/cx-quality/lib/server.ts` | the 4 cited call sites only

## Context
- `src/features/cx-quality/lib/server.ts:615-630` | site 4 (quota page): `audits` feeds ONLY `qaWeekQuota_` (8 weeks) and `qaFailMemory_`
- `src/features/cx-quality/lib/analytics.ts:386-409` | `qaFailMemory_` already drops rows with `d < today-90` (`QA_REPEAT_LOOKBACK_DAYS = 90`, analytics.ts:364-365)
- `src/features/cx-quality/lib/server.ts:1102-1122` | site 5 (getQaCtlPage): `auditsBy` is dereferenced ONLY via `auditsBy[String(c.audit_id)]` for the `mine` CTL subset
- `src/features/cx-quality/lib/server.ts:1158-1180` + `src/features/cx-quality/lib/core.ts:333-351` | site 6 (submitQaCtl): `qaFindOpenCtls_` reads `auditsBy` only for `status === 'open'` ctls; later only `auditsBy[String(row.audit_id)]`
- `src/features/cx-quality/lib/server.ts:1280-1293` | site 7 (getQaDisputesPage): `auditsBy[String(d.audit_id)]` only for disputes passing the existing filter at ~1290

## Contract
- Site 4 (~line 621): `qaRowsWhere_('qa_audits', { gte: { audit_date: dqAddDays_(today, -90) } })`. `audit_date` is a `yyyy-MM-dd` string so `.gte` string-compares correctly; 8 quota weeks (56d) and the 90d fail-memory window are both inside the bound. Verify `audits` has no other consumer in the function before converting.
- Site 5 (~1109): reorder — fetch `all` ctls first (that `qaRows_('qa_ctls')` read is NOT in scope), compute `mine` exactly as today, collect their `audit_id`s, then `qaRowsWhere_('qa_audits', { in: { audit_id: ids } })`. Missing key => `undefined` exactly as today.
- Site 6 (~1163): bound `in` `audit_id` = ids of ctls with `status === 'open'` UNION (when `input.ctlId` is given) the `audit_id` of the matched ctl row — the only keys ever dereferenced (`qaFindOpenCtls_` only touches open ctls; `auditsBy[row.audit_id]` covers the ctlId path). Empty id list -> helper returns `[]`; 'No open CTL' / 'audit is missing' error paths unchanged.
- Site 7 (~1281): reorder — fetch disputes first, apply the existing filter (open/escalated/`decided_at >= since`), collect `audit_id`s, then `in`. Disputes read itself unchanged.
- `qaRowsWhere_` handles empty `in` (returns `[]`); add no other filtering changes.
Out of scope: every other `qaRows_` read/table; helper changes; other files.

## Actions
1. Convert quota-page read to `gte audit_date` bound.
2. Convert getQaCtlPage auditsBy to `in` mine-audit_ids (reorder after `mine`).
3. Convert submitQaCtl auditsBy to `in` open-ctl + ctlId audit_ids.
4. Convert getQaDisputesPage auditsBy to `in` filtered-dispute audit_ids (reorder after filter).

## Done when
- No unfiltered `qaRows_('qa_audits')` remains at the 4 sites (grep shows `qaRowsWhere_` at ~621/1109/1163/1281 equivalents).
- Reordered reads produce identical `auditsBy` lookups for every dereferenced key.
- `npx tsc --noEmit` clean; `npx vitest run tests/golden/quality.test.ts` green.

## Verify
- Run: `npx tsc --noEmit` -> 0 errors; `npx vitest run tests/golden/quality.test.ts` -> all pass.

## Handoff
perf-1 resolved: all 7 cited hot-path `qa_audits` reads are server-side bounded.
Write results/FIX-15b.md (<=10 lines); TL alone updates TRACKER.md.
