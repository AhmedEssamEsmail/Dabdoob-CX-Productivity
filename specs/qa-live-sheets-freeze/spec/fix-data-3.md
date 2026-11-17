# fix-data-3 — FIX leaves for reports/data-3.md (qa-live-sheets-freeze)

Source report: `specs/qa-live-sheets-freeze/reports/data-3.md`. One leaf per
routed finding: data-6 (HIGH), data-7 (MED), data-8 (MED). LOW rows
data-9..data-12 are deferred per the FIX-mode LOW rule (several need remote
sampling or are spec-accepted residuals) — flagged to PM in reports/tl-9.md.

## data3-01: sc_months upsert writes a boolean fcr_dated, not ''
Kind: mini
ID: data3-01
Parent: fix-data-3
Owner: dev
Depends: none
Criteria: data-3 report finding data-6 (HIGH)
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=6

### Goal
Every successful `scRefreshMonth_` currently dies at `scMonthUpsert_`:
`meta.fcr_dated = ''` violates `sc_months.fcr_dated BOOLEAN NOT NULL`
(20261105172248_people.sql:346), so sc_daily rows are committed but the month
row is never updated and the heartbeat marks 'scorecard' failed. Write a real
boolean instead.

### Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | inside `scRefreshMonth_` only: the `meta.fcr_dated` assignment (~:568); update the `scDailyRowsDb_` docblock (:224-230) or nearby comment only if it states `fcr_dated = ''`
- Edit: `tests/platform/sc-daily-db.test.ts` | `scRefreshMonth_ DB rebuild` describe (:237-298): assert the sc_months upsert payload type

### Context
- `src/features/cx-people/lib/scorecard-server.ts:518-575` | `scRefreshMonth_` — `merged` is in scope at :568 (`merged.fcrRows` = preserved verdict count); `scMonthUpsert_` spreads meta verbatim into the upsert (:472-475)
- `supabase/migrations/20261105172248_people.sql:346` | `fcr_dated BOOLEAN NOT NULL DEFAULT FALSE` — '' is invalid input syntax for boolean; `behaviour_found = 1` survives via boolin, do not touch it
- `tests/platform/sc-daily-db.test.ts:275-289` | the existing test already captures the sc_months upsert in `h.writes` — assert on `ins.rows`/`upsert` payload `fcr_dated` being `typeof 'boolean'`
- `src/features/cx-people/lib/scorecard/index.ts:528` | `fcrDated: yes(rr.fcr_dated)` — reader coerces boolean fine

### Contract
`meta.fcr_dated = merged.fcrRows > 0` — stored verdicts are keyed date|email,
so preserved FCR rows are dated by construction (`false` flat is also
acceptable; a non-boolean is not). No other meta field changes. The `fail()`
path is untouched (it copies `prev` values). Out of scope: scMergeFcr_,
scReplaceMonth_, any migration, remote schema changes.

### Actions
1. scorecard-server.ts: replace `meta.fcr_dated = ''` with the boolean expression above.
2. sc-daily-db.test.ts: in the 'rebuilds sc_daily from DB' case, capture the `sc_months` upsert payload and assert `fcr_dated === true` (stored fcr rows exist in the fixture) and `typeof === 'boolean'`; add a second assertion or micro-case that a refresh with zero stored fcr rows upserts `fcr_dated === false`.
3. Run the file's vitest.

### Done when
- No `fcr_dated = ''` remains in scorecard-server.ts; the sc_months upsert always carries a boolean.
- `npx vitest run tests/platform/sc-daily-db.test.ts` passes with the new type assertions.
- `npx tsc --noEmit` clean on the touched file.

### Verify
- Run: `npx vitest run tests/platform/sc-daily-db.test.ts` -> all pass

### Handoff
None. Write results/data3-01.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.

## data3-02: scorecard audit filter matches canonical qaRollupAudits_ semantics
Kind: mini
ID: data3-02
Parent: fix-data-3
Owner: dev
Depends: data3-01 (same files — serial writer)
Criteria: data-3 report finding data-7 (MED)
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=6

### Goal
`scDailyRowsDb_`'s audit filter diverges from the codebase's canonical
`qaRollupAudits_`: `disputed` audits count on the scorecard but not on QA
pages, and `kind ''`/null rows (migrated/legacy) are dropped here but counted
canonically. Align the predicate so one agent-day's quality is identical on
both surfaces.

### Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | inside `scDailyRowsDb_` only: the `audits.forEach` predicate (:267-269) + the docblock phrase 'kind 'audit', not voided' (:227)
- Edit: `tests/platform/sc-daily-db.test.ts` | `scDailyRowsDb_ audit aggregation` case (:142-165): fixture + comment updates, new edge rows

### Context
- `src/features/cx-quality/lib/core.ts:262-265` | canonical predicate: `String(a.kind || 'audit') === 'audit' && a.status !== 'voided' && a.status !== 'disputed'` — raw status compare, NOT lowercased
- `src/features/cx-people/lib/scorecard-server.ts:265-277` | current loop guards `:268 String(r.kind) !== 'audit'` and `:269 status.toLowerCase() === 'voided'`
- `tests/platform/sc-daily-db.test.ts:145-164` | existing audit fixture (`audit()` helper :92-98) — extend it, don't duplicate it

### Contract
The filter becomes semantically identical to `qaRollupAudits_` for a qa_audits
row: keep iff `String(r.kind || 'audit') === 'audit'` AND `r.status !==
'voided'` AND `r.status !== 'disputed'` (compare raw status like canonical —
do not add `.toLowerCase()`; do not exclude `offqueue` source). Docblock at
:227 updated to match. Out of scope: core.ts, migrate.ts's queue-log filter
(report confirms it is correct), any other scorecard code.

### Actions
1. scorecard-server.ts: rewrite the two guards to the canonical predicate.
2. sc-daily-db.test.ts: extend the audit-aggregation fixture with `status: 'disputed'` (skipped) and `kind: ''` or absent-kind (counted) rows; update the expected `audits`/`score_x_audits` and the header comment.
3. Run the file's vitest.

### Done when
- The audit predicate reads `kind || 'audit'` and excludes `disputed` alongside `voided`.
- `npx vitest run tests/platform/sc-daily-db.test.ts` passes with the new edge rows.
- `npx tsc --noEmit` clean on the touched file.

### Verify
- Run: `npx vitest run tests/platform/sc-daily-db.test.ts` -> all pass

### Handoff
None. Write results/data3-02.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.

## data3-03: tlqueue io pages trackerRecords + ticketsSince through readAllPaged
Kind: mini
ID: data3-03
Parent: fix-data-3
Owner: data-engineer
Depends: none
Criteria: data-3 report finding data-8 (MED)
Skills: none
Budget: files=2; actions=3; changed_lines=120; minutes=8

### Goal
The production `tlqIo_` still reads `tracker_records` (whole OL tracker) and
`tickets` (~8-day window on a ~65k table) via unpaged `db().select()` —
PostgREST max-rows silently truncates area-SLA rows and texting pairs. Route
both through `readAllPaged`, the qa5-02 pattern already applied to the same
tables in heatmap.ts.

### Files
- Edit: `src/features/cx-queue/lib/tlqueue.ts` | inside `tlqIo_` only: the `trackerRecords` (:617-621) and `ticketsSince` (:622-626) members; add `export` to `tlqIo_` (:592) for the test
- Create: `tests/platform/tlq-io-paged.test.ts` | io-factory paging assertions

### Context
- `src/features/shared/platform/repo.ts:199-217` | `readAllPaged(name, {pk, columns, build})` — PK-ordered `.range` pager, throws `Error(error.message)`; `tickets` has `id` bigint PK (no override needed), `tracker_records` orders by `pk: 'row_n'` (= the current `.order('row_n')`)
- `src/features/cx-queue/lib/heatmap.ts:601-614` | qa5-02 precedent for both tables
- `tests/platform/hm-db-source.test.ts:40-82` | the repo-mock pattern to copy: `readAllPaged` records `pagedCalls`, `db` records `dbCalls`
- `src/features/cx-queue/lib/tlqueue.ts:592-638` | `tlqIo_` deps for the test: `configAll()` (`platform/settings`) and `readStore('roster')` (`platform/stores`) — mock both; `scores`/`upsert` are not exercised

### Contract
`trackerRecords(trackerId)` = `readAllPaged('tracker_records', { pk: 'row_n',
build: (q) => q.eq('tracker_id', trackerId) })` (rows come back row_n-ordered
exactly as today). `ticketsSince(since)` = `readAllPaged('tickets', { columns:
FD_TICKET_HEADERS.join(','), build: (q) => q.gte('created_at', since) })` —
the new `id`-asc order replaces today's unordered read (consumers filter/map,
order-insensitive). `described()` error wrapping drops with the manual
error checks — readAllPaged's throw is the established shape. Out of scope:
every other io member, `tlqBuild_` logic, the golden fakes.

### Actions
1. tlqueue.ts: export `tlqIo_` and swap both members to `readAllPaged` per the contract.
2. Create tests/platform/tlq-io-paged.test.ts: mock `@/features/shared/platform/repo` (readAllPaged/db recorder), `platform/settings` (configAll -> {}), `platform/stores` (readStore -> {rows:[]}); call `tlqIo_()` then `io.ticketsSince('2026-10-01')` + `io.trackerRecords('operational_loss')`.
3. Assert: pagedCalls contains `tickets` with `gte created_at 2026-10-01` and `tracker_records` with `eq tracker_id operational_loss` + `pk 'row_n'`; dbCalls has neither table.

### Done when
- No `db().from('tickets')` or `db().from('tracker_records')` remains in tlqueue.ts; both io members page.
- `npx vitest run tests/platform/tlq-io-paged.test.ts tests/golden/queue-tlqueue.test.ts` passes (golden unaffected — it injects a fake io).
- `npx tsc --noEmit` clean on touched files.

### Verify
- Run: `npx vitest run tests/platform/tlq-io-paged.test.ts` -> all pass

### Handoff
None. Write results/data3-03.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.
