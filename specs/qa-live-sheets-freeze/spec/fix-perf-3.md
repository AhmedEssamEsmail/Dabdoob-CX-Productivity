# fix-perf-3 — FIX leaves for reports/perf-3.md (round 3, all rows blocking)

Parent task: qa-live-sheets-freeze FIX. Source report rows: perf-6..perf-10.
Same-file serialisation: perf3-01 before perf3-02 (scorecard-server.ts);
perf3-03 before perf3-04 (heatmap.ts). perf3-05 is independent.

## perf3-01: range-bound scIo_ prefetch (perf-6 MED)
Kind: mini
ID: perf3-01
Parent: fix-perf-3
Owner: dev
Depends: none
Criteria: PLAN perf budget — page loads must not issue sequential PostgREST pages of >1000-row tables on cold cache
Skills: none
Budget: files=4; actions=5; changed_lines=140; minutes=10

### Goal
`scIo_` prefetches only the date window its caller will read — sc_daily,
sc_behaviour and kpi_behaviour_log bounded by pushed date predicates (the
whole-table `readStore` prefetch on sc_daily ≈1.6-2.5k rows, growing
~1.5k/mo, disappears).

### Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | `scIo_` (:319-341) + call sites :404, :441
- Edit: `src/features/cx-queue/lib/tlqueue.ts` | `scores` seam :628
- Edit: `src/features/cx-people/lib/one-on-ones-page.ts` | `scIo_` call :456
- Edit: `tests/perf/scorecard-range.test.ts` | scIo_ bound/parity cases only

### Context
- `src/features/cx-people/lib/scorecard-server.ts:206-217` | existing `scReadRange_` (pushed gte/lte; sc_behaviour keeps undated rows) — reuse it
- `src/features/cx-people/lib/scorecard-server.ts:378-447` | `scRange_`, `getScorecardPage` prev-window read `io.readRange('sc_*', pf, pt)` with `pf = from − spanDays`, `pt = from − 1`
- `src/features/cx-people/lib/scorecard/index.ts:350-361,579-648` | `scCasesInRange_` (undated rows derive month '' → can never pass), `scLoad_` reads `[range.from, range.to]`, `pwScoreMonths_` range `{prev-01, today}`
- `src/features/shared/platform/time.ts:100-109` | `pwPrevMonth` helper
- `src/features/shared/platform/repo.ts:187-217` | `readAllPaged` opts (columns/pk/build)

### Contract
- `scIo_(cfg: Cfg, range: { from: string; to: string })` — new required arg; return shape `{ readRange, behaviourLogRows, monthRows, workbookFor }` unchanged.
- Inside: `spanDays = round((parse(range.to) − parse(range.from)) / 86400000) + 1`; `pf = dqAddDays_(range.from, -spanDays)`.
- sc_daily + sc_behaviour via `scReadRange_(name, pf, range.to)` (covers the `[pf, pt]` prev-window read and `scLoad_`'s `[from, to]`).
- kpi_behaviour_log via `readAllPaged` with `date.gte.pf, date.lte.range.to` — exact parity: undated log rows can never surface through `scCasesInRange_`.
- sc_months keeps `readStore` (PK month, one row/month — small per report).
- Callers: `getScorecardPage`/`getScorecardDetail` pass `range`; tlqueue `:628` and one-on-ones `:456` pass `{ from: pwPrevMonth(today.slice(0,7)) + '-01', to: today }` (the `pwScoreMonths_` scLoad_ window).
- Invariant: no caller may `readRange` outside `[pf, range.to]`; the sync filter stays as the parity guard.
Out of scope: `scReplaceMonth_`/`scRefreshMonth_` (perf-10 leaf), qa_audits column trim (perf3-02), heatmap.ts (perf3-03/04), any other file.

### Actions
1. Change `scIo_` signature to `(cfg, range)`; compute `spanDays`/`pf`; switch sc_daily + sc_behaviour to `scReadRange_`; bound kpi_behaviour_log by date gte/lte; keep `readStore('sc_months')`.
2. Pass `range` at the two scorecard-server call sites (:404, :441).
3. Pass `{from: pwPrevMonth(today.slice(0,7)) + '-01', to: today}` at tlqueue.ts:628 (import the helper).
4. Same window at one-on-ones-page.ts:456.
5. Extend `tests/perf/scorecard-range.test.ts`: seed in/out-of-window + undated rows for the three tables; assert pushed `gte`/`lte`/`or` ops and that `io.readRange`/`behaviourLogRows` equal the legacy whole-table filter for in-range data.

### Done when
- sc_daily, sc_behaviour, kpi_behaviour_log reads all carry a pushed date bound; only sc_months uses `readStore`.
- All four `scIo_` call sites compile against the new signature.
- Focused tests assert the pushed predicates and in-window parity.

### Verify
- Run: `npx vitest run tests/perf/scorecard-range.test.ts tests/golden/scorecard.test.ts tests/golden/queue-tlqueue.test.ts` -> all pass
- Run: `npx tsc --noEmit` -> 0 errors

### Handoff
`scIo_(cfg, range)` signature is final; perf3-02 edits the same file after this leaf lands.
Write results/perf3-01.md (<=10 lines); TL alone updates TRACKER.md.

## perf3-02: qa_audits column projection (perf-9 LOW)
Kind: mini
ID: perf3-02
Parent: fix-perf-3
Owner: dev
Depends: perf3-01 (same file — serial)
Criteria: PLAN perf budget — lean column picks on mirror reads
Skills: none
Budget: files=1; actions=2; changed_lines=10; minutes=4

### Goal
The `qa_audits` month read in `scDailyRowsDb_` selects only the 6 used
columns instead of `SELECT *` (~30 cols).

### Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | `scDailyRowsDb_` qa_audits read :247

### Context
- `src/features/cx-people/lib/scorecard-server.ts:242-278` | prod_daily_layers already trims to 11 cols (:244); used audit fields are `audit_date`, `agent_email`, `kind`, `status`, `score_final`, `score` (:268-277)

### Contract
- `readAllPaged('qa_audits', { columns: 'audit_date,agent_email,kind,status,score_final,score', build: <unchanged gte/lt> })`.
- No other change to `scDailyRowsDb_` or the file.
Out of scope: everything else in scorecard-server.ts; the scIo_ range work (perf3-01, already landed).

### Actions
1. Add the `columns` option to the qa_audits `readAllPaged` call.
2. Run the existing focused test.

### Done when
- The qa_audits select lists exactly the 6 columns; window filter unchanged.
- `sc-daily-db` tests still pass.

### Verify
- Run: `npx vitest run tests/platform/sc-daily-db.test.ts` -> pass
- Run: `npx tsc --noEmit` -> 0 errors

### Handoff
None.
Write results/perf3-02.md (<=10 lines); TL alone updates TRACKER.md.

## perf3-03: wa_parcels tracker read time bound (perf-7 MED)
Kind: mini
ID: perf3-03
Parent: fix-perf-3
Owner: dev
Depends: none
Criteria: PLAN perf flag — DB queries stay window-bounded
Skills: none
Budget: files=2; actions=4; changed_lines=30; minutes=8

### Goal
The `tracker_records` wa_parcels read in `hmSourceCells_` stops scanning the
whole tracker history: either a verified `submitted_at` lower bound or an
explicit documented size bound (per report fallback).

### Files
- Edit: `src/features/cx-queue/lib/heatmap.ts` | `hmSourceCells_` wa read :610-614 (+docblock :569-574 if fallback)
- Edit: `tests/platform/hm-db-source.test.ts` | bound assertion only (if bound applied)

### Context
- `src/features/cx-queue/lib/heatmap.ts:575-631` | `hmSourceCells_` window math (`fromMs`, `iso`); wa rows push unconditionally on `values.creation_date`/`date_only`
- `supabase/migrations/20261105172348_operations.sql:53-62` | `tracker_records` cols incl. `submitted_at timestamptz`; index `(tracker_id,row_n)`
- `reports/perf-3.md` perf-7 row | prescribed fix + verification precondition
- `tests/platform/hm-db-source.test.ts` | existing hmSourceCells_ supabase-double harness

### Contract
- Preferred: add `.gte('submitted_at', iso(fromMs - 86400000))` to the wa `readAllPaged` build (one-day slack, matching the maqsam read pattern) — ONLY after verifying on a remote/live sample (or the strongest available evidence: a local DB sample, seed/migration evidence, or an established code invariant) that `submitted_at` tracks `values.creation_date` for wa_parcels.
- Fallback (cannot verify, or correlation disproved): do NOT add the predicate; instead document the whole-tracker size bound + why it is unbounded in the `hmSourceCells_` docblock, and record `BLOCKED: needs live remote sample` in the results file.
- Keep `pk: 'row_n'` and `columns: 'values'`; JS row mapping unchanged.
Out of scope: freshchat bound (perf3-04), tlqueue.ts tracker read, any other file/region.

### Actions
1. Attempt the `submitted_at` ↔ `values.creation_date` correlation check (remote sample if accessible, else best local evidence); record what was checked.
2. If correlated: add `.gte('submitted_at', iso(fromMs - 86400000))` to the build.
3. If not verifiable: docblock note on `hmSourceCells_` stating the explicit bound (wa_parcels ⊆ tracker_records, paged whole-tracker read) and the unmet precondition.
4. If the bound was applied: extend `tests/platform/hm-db-source.test.ts` to assert the pushed `gte` on `submitted_at` for the wa read.

### Done when
- Either the pushed `submitted_at` bound exists with correlation evidence recorded, or the docblock carries the explicit bound + the results file flags the unmet verification.
- No behaviour change for in-window wa rows.
- Focused test green (or unchanged if fallback taken).

### Verify
- Run: `npx vitest run tests/platform/hm-db-source.test.ts tests/golden/queue-heatmap.test.ts` -> pass
- Run: `npx tsc --noEmit` -> 0 errors

### Handoff
If verification was impossible, TL reports `NEEDS_USER/BLOCKED` for the live-sample precondition.
Write results/perf3-03.md (<=10 lines); TL alone updates TRACKER.md.

## perf3-04: freshchat read upper bound + ts_ms ordering (perf-8 LOW)
Kind: mini
ID: perf3-04
Parent: fix-perf-3
Owner: dev
Depends: perf3-03 (same file — serial)
Criteria: PLAN perf flag — DB queries stay window-bounded
Skills: none
Budget: files=2; actions=2; changed_lines=15; minutes=4

### Goal
The `freshchat` read in `hmSourceCells_` becomes two-sided windowed and
pages on `ts_ms` instead of the default `id` (uses `idx_freshchat_ts`).

### Files
- Edit: `src/features/cx-queue/lib/heatmap.ts` | freshchat `readAllPaged` :590-593
- Edit: `tests/platform/hm-db-source.test.ts` | pushed `lt`/pk assertion

### Context
- `src/features/cx-queue/lib/heatmap.ts:580-599` | symmetric maqsam read (`pk:'ts_ms'`, `gte/lt`); JS filter `ms < fromMs || ms >= toMs` at :596-597 stays as the parity guard

### Contract
- `readAllPaged('freshchat', { columns: <unchanged>, pk: 'ts_ms', build: (q) => q.gte('ts_ms', fromMs - 7 * 86400000).lt('ts_ms', toMs) })`.
- `pk:'ts_ms'` like the maqsam read; JS window filter unchanged (exact parity).
Out of scope: the wa_parcels read (perf3-03), any other region/file.

### Actions
1. Add `pk: 'ts_ms'` and `.lt('ts_ms', toMs)` to the freshchat read.
2. Extend `tests/platform/hm-db-source.test.ts`: assert the pushed `lt` and `ts_ms` ordering for the freshchat read.

### Done when
- The freshchat read pushes both `gte` and `lt` on `ts_ms` and orders by `ts_ms`.
- Same emitted freshchat rows as before for the window.
- Focused test green.

### Verify
- Run: `npx vitest run tests/platform/hm-db-source.test.ts tests/golden/queue-heatmap.test.ts` -> pass
- Run: `npx tsc --noEmit` -> 0 errors

### Handoff
None.
Write results/perf3-04.md (<=10 lines); TL alone updates TRACKER.md.

## perf3-05: sc_daily month index migration (perf-10 LOW)
Kind: mini
ID: perf3-05
Parent: fix-perf-3
Owner: supabase-expert
Depends: none
Criteria: PLAN db flag — migration files only; remote apply = PM
Skills: none
Budget: files=1; actions=3; changed_lines=20; minutes=6

### Goal
The `eq('month')` reads/deletes on `sc_daily` (`scRefreshMonth_` :541,
`scReplaceMonth_` :454) are index-served — verified against actual schema
evidence, with a new timestamped migration only if a gap exists.

### Files
- Generated: `supabase/migrations/` | one output of `supabase migration new idx_sc_daily_month` (only if the check shows a gap)

### Context
- `src/features/cx-people/lib/scorecard-server.ts:453-462,541` | the two `eq('month')` call sites (delete + stored-rows read)
- `supabase/migrations/20261105172248_people.sql:294-317` | `sc_daily` DDL: `UNIQUE (month, date, email)` (:315) + `idx_sc_daily_range(date,email)` (:317)
- `supabase/migrations/20261109130415_dedupe_uniques_logs_ops.sql:142-153` | precedent unique-index migration style
- `reports/perf-3.md` perf-10 row | prescribed fix

### Contract
- First establish whether the `UNIQUE (month, date, email)` constraint (index `sc_daily_month_date_email_key`, leftmost `month`) exists on the remote DB — remote `pg_indexes`/`pg_constraint` check if accessible, else migration-file evidence.
- If a leftmost-`month` index already exists: do NOT create a redundant index; record `satisfied-by-existing <index name>` + evidence in results.
- If genuinely absent: one new timestamped migration, `CREATE INDEX IF NOT EXISTS idx_sc_daily_month ON public.sc_daily (month);` (plain CREATE INDEX — CONCURRENTLY is illegal in the runner txn, per perf1-02 precedent).
- Remote apply is OUT of scope — PM/deploy batch only.
Out of scope: switching `scReplaceMonth_` to upsert (separate behavioural change, not prescribed), any .ts file, remote writes.

### Actions
1. Check remote/migration evidence for an existing leftmost-`month` index on sc_daily.
2. If absent: `npx supabase migration new idx_sc_daily_month`, fill with the CREATE INDEX above, replay-verify on local DB if one is running.
3. Record evidence (index name + source of truth checked) in results/perf3-05.md.

### Done when
- Either a new migration file exists with exactly the prescribed index, or results document the existing covering index with evidence.
- No remote writes performed.
- `supabase migration list` / file lint shows a valid new file (if created).

### Verify
- Run: `ls supabase/migrations | tail -3` -> new timestamped file present (or results explain the no-op)

### Handoff
Migration file name (if created) joins the pending PM `db push` batch.
Write results/perf3-05.md (<=10 lines); TL alone updates TRACKER.md.
