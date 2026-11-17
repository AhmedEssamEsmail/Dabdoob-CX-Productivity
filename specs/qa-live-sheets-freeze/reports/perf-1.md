# perf report - qa-live-sheets-freeze - round 1 (FULL)

Verdict: FAIL
Open: 0B/1H/1M/3L

Scope: all changed files across tl-1..tl-5 (wave-1 leaves + fix rounds) and what
they call: `jobs/dbbook.ts`, `jobs/env.ts`, `jobs/sheets.ts`,
`lib/sheets-freeze.ts`, `cx-hub/lib/roster.ts`,
`api/cron/job-qa-engine/route.ts`, migrations `20261116202604` (dq_hct),
`20261116202809` (pg_cron), `20261116204115` (aux_spans), plus called-into
`cx-quality/lib/{migrate,engine-live,server}.ts` (read-only; user-owned).

## Measurements

- **Sheet reads on request path**: 0 un-gated — every live `readSheet`/
  `fetchWorkbookTabs` call site passes `{deferred:true}` (scorecard-server:478/592,
  heatmap:568/588, tlqueue:631, admin/mirrors:35, source-health:170/190,
  engine:238/300) or `{manualHct:true}` (roster.ts:314, sole grant). Guard is
  O(1) per tab (sheets-freeze.ts:26-33). Grep-verified vs PLAN criterion #1.
- **dbbook job reads**: all window-bounded — `month` key or `sinceMs` =
  today-45d-1d (env.ts:308, dbbook.ts:40-51). `ts_ms` indexes exist on all three
  mirror tables (idx_fd_activities_ts, idx_maqsam_calls_ts, idx_freshchat_ts —
  20261101175759:19/28/37); tracker_records (tracker_id,row_n) index matches
  auxExceptionsTab_ (20261105172348:62). Tab fetch parallelism bounded to
  ≤6 tabs/book via `Promise.all` (env.ts:463-471).
- **job-qa-engine route**: calls `qaReconcileQueueLog_()` daily — it does
  `readRows('qa_audits')` + `readRows('qe_queue_log')` with **no limit** →
  `readAllPaged` SELECT * over the full tables (repo.ts:225-234, migrate.ts:406/412);
  qe_queue_log = 3,887 rows (PLAN research) → ≥4 sequential 1000-row pages;
  qa_audits is a >1000-row incident table, all columns, then a per-row
  sequential UPDATE loop (migrate.ts:436-441). Scheduled 07:30 UTC = 10:30
  Kuwait = work hours.
- **maxDuration**: `job-qa-engine/route.ts` = 0 (absent) vs 12/12 sibling cron
  routes declaring 60–300s (heavy analogs job-productivity-daily,
  daily-layers, job-tph-past-days all = 300).
- **Engine build reads** (`qeBuildQueue` via route): bounded — touches read =
  ts_ms window + `.order(ts_ms)` + `LIMIT 60000` on indexed column
  (engine-live.ts:176-183); tickets detail = `.in(ticket_id, ×200)` batches
  (:282-287). qe_queue_log daily rewrite: `limit:200000` read + delete-all +
  500-row insert batches (:585-597) — heavy but bounded at ~3.9k rows.
- **Roster snapshot** (roster.ts:321-332): dedupe-last-wins on cleaned email,
  ≤500-row upsert slices on `dq_hct_email_key` unique index — ~1 batch at
  HCT scale (~50 in-scope rows). `jobRosterSync` admin-gated (roster.ts:453).
- **pg_cron** (20261116202809): 5 jobs, settings-guard, zero secret literals;
  `net.http_get` is non-blocking (fire-and-forget, 60s client timeout does not
  bound the function — Vercel maxDuration does). Two heavy jobs share
  `'30 6 * * *'` (nightly-aggregates + scorecard-nightly, lines 105/153).

## Findings

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| perf-1 | HIGH | src/features/cx-quality/lib/migrate.ts:406,412 (called from src/app/api/cron/job-qa-engine/route.ts:30) | New daily cron re-introduces the incident anti-pattern: unbounded `readRows` full-table scans of `qa_audits` (>1000-row incident table) + `qe_queue_log` (3,887 rows) — every column, N sequential 1000-row pages — then sequential per-row UPDATEs (:436-441), all at 10:30 Kuwait work hours. PLAN budget: "no unthrottled full-table scans of qa_audits/qa_queue/qa_ctls during work hours". | Bound both reads: audits → filter `kind='audit'` + `status != 'voided'` + `submitted_at >= <oldest pending/expired queued_date>`; log → `.in('state', ['pending','expired'])` or not-audited only. Batch the UPDATE loop via `updateRows(qe_queue_log,'key',…)` or one `.in()` update per (queued_date). NOTE: file is user-owned cx-quality — hand-back per plan precedent (tl-1), like the server.ts:383 repoint. | dev (user hand-back) |
| perf-2 | MED | src/app/api/cron/job-qa-engine/route.ts (absent) | No `export const maxDuration` — 0s explicit vs 300s on the three closest heavy cron routes. Route runs build+import → reconcile → CTL-reminders serially; under the platform default the invocation can be killed mid-chain after queue import (partial writes, reconcile/reminders lost daily). | Add `export const maxDuration = 300` (matches job-productivity-daily/daily-layers/job-tph-past-days). | dev |
| perf-3 | LOW | src/features/shared/jobs/dbbook.ts:164-180 | `qualityTab_` filters `audit_date` range alone; qa_audits indexes are (agent_email,audit_date), (auditor_email,audit_date), ticket_id, queue_id, calibration_id (20261105172048:98-102) — leftmost mismatch → seq-scan + sort-by-audit_id per page, every productivity job run. Row count unmeasured remotely. | New migration: `CREATE INDEX CONCURRENTLY idx_qa_audits_audit_date ON public.qa_audits (audit_date)` — also serves the bounded reconcile once perf-1 lands. | supabase-expert |
| perf-4 | LOW | src/features/shared/jobs/dbbook.ts:248-253 | `fdAuxTab_` is the only tab synthesizer ignoring the ctx window: unbounded `readAllPaged('aux_spans')` per month-book prefetch. Today aux_spans = 0 rows (recreated empty, 20261116204115) → 1 query; grows unboundedly when the FD_AUX upstream lands. | Add `build: tsBuild_(windowFor_(ctx))` (idx_aux_spans_ts exists) — matches sibling tabs. | dev |
| perf-5 | LOW | supabase/migrations/20261116202809_pg_cron_scoped_wave1.sql:105,153 | `cxh-job-nightly-aggregates` and `cxh-scorecard-nightly` both `'30 6 * * *'` — two heavy nightly jobs fired the same minute (scorecard-nightly is a maxDuration=300 route). | Stagger one job, e.g. scorecard → `'45 6 * * *'` (before qa-engine's 07:30). | supabase-expert |

## Not measured / assumptions

- No remote DB access this round: qa_audits/qa_queue row counts, per-page
  latency, and reconcile UPDATE fan-out are code-path-derived, not timed.
  PostgREST page size = 1000 (repo.ts:202).
- Vercel plan/default function duration for this project not verified —
  perf-2 severity assumes default < job runtime; the serial 3-step chain and
  sibling 300s convention justify the flag regardless.
- Grandfathered sheet readers still hit Google on request path (deferred:
  logs `[SHEETS_FREEZE_VIOLATION]`, does not throw) — wave-1 sanctioned per
  PLAN Amendment 2; wave-2 de-sheeting is tracked elsewhere.
- `app_cache` durable-cache seam (PLAN scope) not implemented in any wave-1
  leaf — repo.ts still sync Map (repo.ts:35-64); page-level query architecture
  in cx-quality is a stated non-goal (advisory only).
- `server.ts:637` `readRows('qa_queue', { cols: 16 } as never)` — `cols` is
  not a ReadOptions field, so this is an unbounded full-qa_queue read on the
  page path; user-owned file, advisory only (same incident pattern as perf-1,
  not introduced by this wave).
