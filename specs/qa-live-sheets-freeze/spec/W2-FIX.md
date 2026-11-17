# W2-FIX: leftover LOWs — mirrors.ts docstring + migrate.ts reconcile hardening
Kind: package
ID: W2-FIX
Dispatch: NEVER

## Goal and contract
The two deferred LOW findings Amendment 4 #7 pulls into wave 2. (a) data-4:
the `mirrors.ts` header docstring still describes the retired sheet-read
model. (b) `qaReconcileQueueLog_` in USER-OWNED `cx-quality/lib/migrate.ts` —
touches explicitly limited to the already-approved reconcile function: the
two `.catch(() => [])` silent swallows go, and the grouped `.in('key', …)`
updates chunk at ~100 keys so a big reconcile can't blow the PostgREST IN-list
limit. Two independent leaves, parallel-safe.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| W2-FIX-01 | dev | none | #7 data-4 stale mirrors docstring | 1/1/10/5 |
| W2-FIX-02 | dev | none | #7 reconcile catch removal + .in() chunk | 1/3/50/6 |

## W2-FIX-01: mirrors.ts header docstring — vendor-API reality (data-4)
Kind: mini
ID: W2-FIX-01
Parent: W2-FIX
Owner: dev
Depends: none
Criteria: PLAN Amendment 4 #7; reports/data-1.md finding data-4 (LOW)
Skills: none
Budget: files=1; actions=1; changed_lines=10; minutes=5

### Goal
The `mirrors.ts` docblock stops claiming incremental runs "re-read the whole
tab (the Sheets API has to)" — mirrors fetch the vendor APIs and upsert by
watermark.

### Files
- Edit: `src/features/shared/jobs/mirrors.ts` | docblock lines :5-21 only

### Context
- `src/features/shared/jobs/mirrors.ts:18-21` | the stale watermark sentence
- `src/features/shared/jobs/mirrors.ts:234-320` | `syncMirror` — the real model: `spec.fetch` pulls vendor APIs per window; `last_ts_ms - OVERLAP_MS` cut; `dedupe_key` idempotent upserts

### Contract
Doc-only. Reword the "Watermark:" sentence (and any neighbouring clause that
says a tab is re-read) to: incremental runs re-pull the vendor API window but
only upsert rows newer than `last_ts_ms` minus the 24 h overlap; dedupe_key
keeps re-writes idempotent. Keep the row-model section's historical tab-layout
notes (they document the cell contract, not the read mechanism). No code,
comment, or import changes anywhere else.
Out of scope: every code line, other docblocks, other files.

### Actions
1. Rewrite the stale docstring lines per contract.

### Done when
- No docblock line claims a sheet/tab re-read on incremental syncs; `npx tsc --noEmit` unaffected.

### Verify
- Run: `rg "re-read the whole tab|Sheets API has to" src/features/shared/jobs/mirrors.ts` -> no matches.

### Handoff
Closes data-4 — the last unrouted data-1 finding.
Write results/W2-FIX-01.md (<=10 lines); TL alone updates TRACKER.md.

## W2-FIX-02: qaReconcileQueueLog_ — loud read errors + chunked .in() updates
Kind: mini
ID: W2-FIX-02
Parent: W2-FIX
Owner: dev
Depends: none
Criteria: PLAN Amendment 4 #7 (migrate.ts reconcile `.catch(()=>[])` + `.in('key',…)` chunk — the two approved LOW touches inside the user's perf-1 function)
Skills: none
Budget: files=1; actions=3; changed_lines=50; minutes=6

### Goal
`qaReconcileQueueLog_` no longer swallows read errors into empty arrays (a
failed read silently marked nothing audited), and the per-group
`.in('key', g.keys)` update splits into ~100-key chunks so large reconciles
stay under PostgREST IN-list limits.

### Files
- Edit: `src/features/cx-quality/lib/migrate.ts` | `qaReconcileQueueLog_` body only (:406-460) — APPROVED-TOUCH region; nothing else in this user-owned file

### Context
- `src/features/cx-quality/lib/migrate.ts:406-460` | the function: two `readAllPaged(...).catch(() => [])` reads (:408, :417) and the grouped update loop (:454-460)
- `src/features/cx-quality/lib/migrate.ts:19` | `described` already imported for the existing update-path error
- `specs/qa-live-sheets-freeze/TRACKER.md` perf-1 row | user's own rewrite of this function (bounded reads + grouped .in() updates) — this leaf touches ONLY the same two spots Amendment 4 approved

### Contract
- Delete BOTH `.catch(() => [] as Row[])` wrappers: a failed `qe_queue_log` or `qa_audits` read now throws and aborts the reconcile (the `/api/cron/job-qa-engine` step surfaces it as a failed step — loud, not silently-empty).
- The `for (const g of Object.values(groups))` loop: for each group, iterate `g.keys` in slices of 100 and issue one `.update(...).eq('queued_date', …).in('key', slice)` per slice; `error` -> `throw described(error, { table: 'qe_queue_log' })` exactly as today.
- Everything else in the function (gates, filters, grouping, return shape `{updated, revived}`) byte-identical.
Out of scope: EVERY other line of migrate.ts and cx-quality/**, the route, tests (user-owned domain — no test file added; tsc is the gate).

### Actions
1. Remove the two `.catch(() => [] as Row[])` (and re-check the `audits` ternary still types).
2. Chunk the `.in('key', g.keys)` update loop at 100 keys per slice.
3. `npx tsc --noEmit` clean.

### Done when
- No `.catch(() => [])` remains inside `qaReconcileQueueLog_`; every `.in('key', …)` call receives <=100 keys; tsc clean.

### Verify
- Run: `npx tsc --noEmit && rg "catch\(\(\) => \[\]" src/features/cx-quality/lib/migrate.ts` -> 0 errors / no matches.

### Handoff
Reconcile fails loudly and chunks its writes — closes the wave-2 fix batch. No guard implication (not a sheet read).
Write results/W2-FIX-02.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
Both leaves done; package verified when the mirrors docblock reads vendor-API and `rg "catch\(\(\) => \[\]" src/features/cx-quality/lib/migrate.ts` is empty with the update loop chunked.
