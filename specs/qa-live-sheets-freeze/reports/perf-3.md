# perf report - qa-live-sheets-freeze - round 3 (FULL)

Verdict: FAIL
Open: 0B/0H/2M/3L

Scope (per task): wave-2 DB read paths — `scDailyRowsDb_` + page io seam
(`scorecard-server.ts`), `hmSourceCells_`/`buildHeatmapFromSource`
(`heatmap.ts`), tlqueue DB/`tlqIo_` path (`tlqueue.ts`), `sc_behaviour`
writes, strict guard (`sheets-freeze.ts`, `migration/engine.ts`,
`jobs/sheets.ts`), `dbbook.ts`/`env.ts` bound plumbing, admin probes
(`api/admin/mirrors|source-health`). Remote row counts from PLAN Amendment 4
(verified 2026-11-17); page size = 1000 (`repo.ts:202`).

## Measurements

- **Strict guard**: `assertSheetReadAllowed_` (sheets-freeze.ts:20-29) is
  strict — `SheetReadGateOpts` has no `deferred`; non-allowlisted reads throw
  `SheetsFreezeError`. `deferred:true` call sites in src/ = **0** (grep). Cost
  per call = ≤2 string compares + `includes` on a small extraIds array — O(1),
  once per tab, ahead of a ≥700 ms-paced Sheets call (engine.ts:127,
  sheets.ts:93). Overhead: negligible. PASS.
- **scDailyRowsDb_** (scorecard-server.ts:242-249): 3 parallel reads, all
  windowed — prod_daily_layers `date ∈ [month, month+1)` with 11-col trim
  (idx_prod_daily_layers_date, 20261108205258:21; table = 1,579 rows → ≤2
  pages); qa_audits `audit_date ∈ [month, month+1)` (idx_qa_audits_audit_date,
  20261117123304 — pending apply per perf-2); roster = 50 rows.
- **sc_behaviour writes** (:668): single-row insert; unique
  `sc_behaviour_month_date_email_note_uidx (month,date,email,note)`
  (20261109130415:152) → dup detect = one O(1) 23505. Month count probe
  (:542) is `head:true` and leftmost-covered by that index. Table = 3 rows.
  PASS.
- **hmSourceCells_** (heatmap.ts:575-631): maqsam_calls windowed
  `ts_ms ∈ [from-1d, to)` 4 cols (idx_maqsam_calls_ts); tickets windowed
  `created_at ∈ [from, to)` 3 cols (idx_tickets_created_at,
  20261108205536:20); freshchat `gte ts_ms from-7d` only; tracker_records
  `eq tracker_id='wa_parcels'` — **no time window** (≤2,376 rows today).
- **tlqIo_** (tlqueue.ts:592-637): maqsam ±1d windowed, fd_activities
  `gte from-1d`, tickets `gte created_at` (8-9d, idx exists, 24-col lean pick),
  sched_plan `.in(month)` (idx_sched_plan_month). trackerRecords = whole-tracker
  read (native-store parity with the old sheet tab). Upserts = 1 statement per
  table, small row counts. `scores` calls `scIo_` — see perf-6.
- **Admin probes**: mirrors peek head/tail ≤50, slice ≤500, `count:'exact'
  head:true` (mirrors/route.ts:49-80); source-health all head-count/limit
  ≤200 (source-health/route.ts:89-223). Bounded. PASS.
- **Reconcile leftovers** (migrate.ts:406-462, user-owned): `.in('key',…)`
  chunked ×100 (:455), no `.catch(()=>[])` on the reads. Matches perf-2
  verdict.

## Findings

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| perf-6 | MED | src/features/cx-people/lib/scorecard-server.ts:319-341 (+ src/features/cx-queue/lib/tlqueue.ts:628) | `scIo_` prefetches whole `sc_daily`, `sc_behaviour`, `kpi_behaviour_log`, `sc_months` via `readStore`→`readAllPaged` with no predicate, on every `getScorecardPage`/`getScorecardDetail` load **and** inside hourly `jobTlQueueMetrics`. sc_daily ≈1,600-2,500 rows today (rebuilt from 1,579-row prod_daily_layers + fcr orphans) → ≥2 sequential 1000-row pages per call; grows ~1.5k rows/mo → ~21 pages within 14 months. Budget: "page loads must not issue >N sequential PostgREST pages of >1000-row tables on cold cache". | Thread the requested range into `scIo_` and fetch sc_daily/sc_behaviour via `scReadRange_`-style bounds (from − spanDays … to — the function exists at :206 and hits `idx_sc_daily_range(date,email)`); keep sc_months/sc_behaviour-table reads only if small, else bound by `.in('month', months)` — `sc_behaviour_month_date_email_note_uidx` leftmost-covers month. | dev |
| perf-7 | MED | src/features/cx-queue/lib/heatmap.ts:610-614 | `tracker_records` wa_parcels read has eq + `values` (full JSONB) but **no time bound** — all wa_parcels rows ever (subset of 2,376 rows today, grows daily). Violates Amendment-4 perf flag "DB queries must stay window-bounded". Mitigants: admin-only manual path; (tracker_id,row_n) index serves eq+order; parity with legacy whole-WA-tab read. | Add `.gte('submitted_at', iso(fromMs - 86400000))` after verifying on a remote sample that `submitted_at` tracks `values.creation_date` (same dependency as data-9); if it does not correlate, document the tracker-size bound explicitly in the docblock. | dev (data check first) |
| perf-8 | LOW | src/features/cx-queue/lib/heatmap.ts:590-593 | freshchat read is one-sided — `gte('ts_ms', fromMs-7d)`, no `.lt` — reads to table end then JS-filters to the window; also orders by default pk `id` while filtering `ts_ms` (idx_freshchat_ts unused for ordering). Table = 1,753 rows → 2 pages, bounded today. | Add `.lt('ts_ms', toMs)` (symmetric with the maqsam read at :583) and `pk:'ts_ms'`. | dev |
| perf-9 | LOW | src/features/cx-people/lib/scorecard-server.ts:247 | qa_audits month read is `SELECT *` (~30 cols, quality.sql) where 6 are used; ~1-4k rows/window → ≤4 pages. prod_daily_layers in the same function already trims to 11 cols (:244). | `columns: 'audit_date,agent_email,kind,status,score_final,score'`. | dev |
| perf-10 | LOW | src/features/cx-people/lib/scorecard-server.ts:541,454 | `sc_daily` has no `month` index (only `idx_sc_daily_range(date,email)`, people.sql:317): the stored-rows read `eq('month')` and the `delete().eq('month')` in `scReplaceMonth_` seq-scan the table (≈1.6-2.5k rows, +~1.5k/mo) twice per month refresh — nightly + manual. | New migration `CREATE INDEX idx_sc_daily_month ON sc_daily(month)`; better: unique `(month,date,email)` enabling an upsert instead of delete+insert. | supabase-expert |

## Not measured / assumptions

- No remote DB access this round: page counts are row-count-derived; wa_parcels
  share of tracker_records (2,376 total) unknown — bound stated as ≤3 pages.
- `idx_qa_audits_audit_date` (20261117123304) assumed applied or queued with
  the approved `db push` batch (perf-2 note); until applied the qa_audits month
  read seq-scans ~1-4k rows server-side — trivial, no wire amplification.
- `kpi_behaviour_log` size unknown — folded into perf-6's prefetch bound.
- `scReplaceMonth_` delete+insert is non-transactional (a mid-refresh crash
  empties the month) — data-integrity note, not a perf finding.
- `scNightly_` = ≤2 months serial, ~5 queries + delete + 1 bulk insert +
  upsert each at 06:45 UTC (09:45 Kuwait) — bounded, small tables. OK.
- Advisory unchanged: `server.ts:637` unbounded `qa_queue` read (user-owned
  cx-quality, pre-existing — out of wave-2 scope).
