# perf report - qa-live-sheets-freeze - round 4 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/0L

Scope: verify all 5 perf-3 findings against tl-10 changed files —
`scorecard-server.ts` (perf-6/9), `tlqueue.ts` + `one-on-ones-page.ts`
(perf-6 call sites), `heatmap.ts` (perf-7/8),
`tests/perf/scorecard-range.test.ts`, `tests/platform/hm-db-source.test.ts`.
perf-10 was a no-op; re-verified against people.sql.

## Measurements (before -> after)

- **perf-6 (MED) -> CLOSED.** `scIo_(cfg, range)` (scorecard-server.ts:322-350)
  now prefetches sc_daily/sc_behaviour via `scReadRange_` over
  `[from - spanDays, to]` (idx_sc_daily_range(date,email)) and
  kpi_behaviour_log via `gte/lte('date', pf, to)`; sc_months stays whole-table
  (1 row/month — trivial). Whole-table prefetch (sc_daily ~1.6-2.5k rows ->
  >=2 pages, +~1.5k/mo -> ~21 pages in 14 mo) -> bounded ~2x range window
  (62d for a month view -> <=3k rows -> <=3 pages, growth-independent).
  All 4 call sites pass a range (:413, :450, one-on-ones-page.ts:457,
  tlqueue.ts:630). `getScorecardPage`'s prev-window slice at :426 uses the
  identical `pf = from - spanDays` (:424) — prefetch coverage exact.
  tests/perf/scorecard-range.test.ts locks the pushed ops + legacy-filter
  parity (vitest 1467/1468, sole fail known-external per tl-10).
- **perf-7 (MED) -> CLOSED via prescribed fallback.** `submitted_at` NULL on
  migrated wa_parcels rows is confirmed in code — ops-tabs.ts:163/:185 set
  `row.submitted_at = null` for the tracker transforms (WA mapping :204). A
  `gte` would drop every row, so whole-tracker read is retained; bound +
  unmet precondition now documented in `hmSourceCells_` docblock
  (heatmap.ts:575-585). Cost stays <=3 pages (wa_parcels subset of 2,376-row
  tracker_records) on an admin-only path.
- **perf-8 (LOW) -> CLOSED.** freshchat read now
  `.gte('ts_ms', fromMs-7d).lt('ts_ms', toMs)` + `pk:'ts_ms'`
  (heatmap.ts:602-606) — symmetric window, idx_freshchat_ts serves
  filter+order.
- **perf-9 (LOW) -> CLOSED.** qa_audits month read projects 6 cols
  (scorecard-server.ts:248), matching the prod_daily_layers trim at :244.
- **perf-10 (LOW) -> CLOSED (satisfied-by-existing, no migration).**
  people.sql:315 `UNIQUE (month, date, email)` creates
  `sc_daily_month_date_email_key` — leftmost `month` covers the
  `eq('month')` read and `delete().eq('month')` in `scReplaceMonth_` (:463).
  Correct call by supabase-expert; my round-3 suggested index was redundant.

## New findings

None.

## Correctness notes checked (no regression)

- `sc_behaviour.date`/`sc_daily.date` are TEXT NOT NULL DEFAULT ''
  (people.sql:297,323) — the `.or('date.is.null,date.eq.,and(...)')` term is
  valid PostgREST (text empty-string eq; `is.null` is a harmless dead term).
- Undated kpi_behaviour_log rows dropped by the new bound: downstream
  `scCasesInRange_` (scorecard/index.ts:613) already discarded date '' rows —
  no semantic loss. `prevTeam` (:425-431) never consumed `behaviourLogRows`
  pre-fix either.
- `kpi_behaviour_log` pages on unique `log_id` (repo.ts:156) — deterministic.

## Not measured / assumptions

- No remote EXPLAIN this round; page counts remain row-count-derived
  (PLAN A4 counts, 2026-11-17).
- `pk:'ts_ms'` range-paging orders by a non-unique bigint; a page boundary
  landing inside a same-ms cluster could skip/dup rows — ms-epoch ties are
  rare and the pattern pre-exists on maqsam (heatmap.ts:594); the reads are
  window-padded (±1d/7d) so a boundary dup is absorbed by JS re-filter.
- `idx_qa_audits_audit_date` (20261117123304) still assumed applied/queued
  with the pending `db push` batch; without it the bounded qa_audits month
  read seq-scans ~1-4k rows — no wire amplification.
- Advisory unchanged: user-owned `server.ts:637` unbounded `qa_queue` read
  (out of scope).
