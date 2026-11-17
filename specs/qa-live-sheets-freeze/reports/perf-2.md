# perf report - qa-live-sheets-freeze - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/0L — all 5 round-1 findings verified fixed at code level.

Scope (per tl-6): `cx-quality/lib/migrate.ts` (+25/-6, user workstream),
`api/cron/job-qa-engine/route.ts`, `jobs/dbbook.ts`,
`migrations/20261116202809_pg_cron_scoped_wave1.sql` (edit-in-place),
NEW `migrations/20261117123304_idx_qa_audits_audit_date.sql`.

## Re-measurements vs round 1

- **perf-1 (HIGH) — FIXED**: `qaReconcileQueueLog_` (migrate.ts:406-460)
  - `qe_queue_log` read now carries `or('state.is.null,state.neq.audited')`
    (:407) — PostgREST filters server-side; only the pending/expired subset of
    the 3,887-row table crosses the wire, vs SELECT * of all rows before.
    `readAllPaged` default pk resolves to `id bigserial primary key`
    (20261105172048:212) → ordered paging is valid; the `.catch(() => [])`
    cannot mask a missing-column error.
  - `qa_audits` read now `kind='audit' AND submitted_at >= oldestPendingDay
    AND status != 'voided'` (:414-417); skipped entirely when no pending rows
    (oldestDay='' → audits=[]). Wire volume bounded by reconcile window, not
    table size.
  - Per-row UPDATE loop replaced by grouped `.eq('queued_date').in('key',…)`
    batches (:448-460) — uses `qe_queue_log_date_idx` (20261105172048:241).
- **perf-2 (MED) — FIXED**: `export const maxDuration = 300` at route.ts:14,
  matching the three sibling heavy crons. Reconcile + CTL steps are each
  try/catch-isolated (:30-40) so a step failure cannot abort the chain.
- **perf-3 (LOW) — FIXED (pending apply)**: `20261117123304` creates
  `idx_qa_audits_audit_date ON qa_audits(audit_date)` — directly serves
  `qualityTab_`'s audit_date range. Plain CREATE INDEX inside runner txn is
  correct (CONCURRENTLY illegal there; ~1-4k rows). Ships with the approved
  `db push` batch (TRACKER:107).
- **perf-4 (LOW) — FIXED**: `fdAuxTab_` now `pk:'ts_ms'` +
  `tsBuild_(windowFor_(ctx))` (dbbook.ts:251-255) — identical bound to the 7
  sibling tabs (uses idx_aux_spans_ts; table currently 0 rows).
- **perf-5 (LOW) — FIXED (pending apply)**: `cxh-scorecard-nightly` moved to
  `'45 6 * * *'` (:154); `cxh-job-nightly-aggregates` stays `'30 6 * * *'`
  (:106). 15-min stagger, qa-engine still 07:30.

## Findings

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| — | — | — | none open | — | — |

## Not measured / assumptions

- No remote DB access: row counts and reconcile page counts are
  code-path-derived; PostgREST page = 1000 (repo.ts:202).
- Residual (not findings): reconcile still `SELECT *` on both tables — ~8 of
  the columns are used; bounded by the state/date predicates. Worst-case
  update groups ≈ changed-row count when audited_at values are all distinct,
  but bounded by the pending/expired subset, each a PK-indexed statement.
- `qa_audits.submitted_at` has no index; the bounded reconcile filter still
  seq-scans ~1-4k rows server-side to evaluate predicates — trivial cost,
  no wire amplification. Add only if table grows ≫10k.
- Grandfathered sheet readers (deferred:true) still hit Google on request
  path — wave-1 sanctioned; wave-2 tracked elsewhere.
- Advisory unchanged: `server.ts:637` unbounded `qa_queue` read (user-owned,
  pre-existing, same note as perf-1 round).
