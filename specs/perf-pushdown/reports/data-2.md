# data report - perf-pushdown - round 2 (DELTA)

Verdict: FAIL — one new MED: the data-2 prefix-bound fix covered 4 of 6 raw `slot_date`
SQL predicates feeding normalized consumers; two sites keep the same miss-by-SQL class.

Open: 0B / 0H / 1M / 0L
Closed: data-1, data-2 (4 sites), data-3, data-4, data-5

## Reconciliation

- Full gate re-run (independent): `npx vitest run` -> **1296/1296**, 86 files (log
  `logs/data2-gate-vitest.log`); memo files alone 11/11 (`tph-grid-memo` 7,
  `audit-queue-memo` 4) — the 5 previously red tests are green. Tolerance: byte-parity.
- data-1: `tph-grid-views.tsx:212` deps narrowed to `[missingMap, d.off, d.channels,
  d.activities]` (fields `We` consumes); `audit-queue-page.tsx:225-228` deps on stable
  destructured `apply` fns — green.
- data-2: `dqNormCell_` only rewrites `Date` objects; Postgres text returns strings, so
  `dqSubmissionsFor_`'s `slice(0,10)` accepts exactly the strings the new bound
  `[day, day+'\ufffd')` selects — a true parity bound, not just a superset. Verified at
  aggregates.ts:170-173, server.ts:80-83, pages.ts:136-139, pages.ts:240. Snapshot tables
  stay on `eq` and `dqTodaySnapshots_` compares raw `===` (index.ts:161) — identical
  semantics, parity holds.
- data-3: `cacheRemove('live|'+table)` at jobs.ts:75 fires after the delete check and
  before the empty-rows return — covers all rewrite paths.
- data-4: `dedupeRows_` (env.ts:670-676) last-wins feeds the upsert, the `.in` delete
  vals and `tuplesOf` — dup key tuples can no longer reach insert/fallback.
- data-5: `updateRows` (repo.ts:324-333) chunks keys by 500 through `readAllPaged` —
  no unpaginated select remains.

## Findings

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-6 | MED | `src/features/cx-queue/lib/jobs.ts:292`; `src/features/cx-queue/lib/server.ts:296-301` | Same data-2 class, missed sites: `.in('slot_date', dueDates)` and `.eq('slot_date', input.slot_date)` match raw text while `dqSubmissionsFor_` normalizes `slice(0,10)` — a stored `'YYYY-MM-DDT…'` row passes the JS filter but is missed by SQL -> submitted check-in reads "missed" (false reminder popup+mail) or a duplicate row is appended instead of updated. Conditional on variant rows existing (remote count still unrun — NEEDS_APPROVAL). | Replace `.in` with `gte(min)/lte(max+'\ufffd')` prefix bound over `dueDates`; widen the dedupe lookup the same way (or `or('slot_date.eq.<d>,slot_date.gte.<d>&lt.<d+1>')`). | dev |

## Not verified / assumptions

- Remote `slot_date` format counts (3 tables) still unrun (no MCP; tl-4 NEEDS_APPROVAL
  stands). data-6 is latent if every stored row is ISO.
- Snapshot writes store `cp.date` (ISO) — variants could only come from migrated/legacy
  rows; cleanup is a separate data task, not a parity break.
- `submitQueueCheckin` eq site folded into data-6 (same fix shape) rather than a second ID.
