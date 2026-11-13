# Aging page shows closed tickets as old+open

## Symptom
`/aging` lists tickets that are closed in Freshdesk as still open and
increasingly old. Examples: 351136, 351351, 351068, 350945 (all shown as
"Pending on 3PL", ~240 h).

## Root cause (verified against prod)
- `aging_open_tickets` is rebuilt by `buildQueueAggregates_` from the `tickets`
  mirror; `dqBuildAging_` correctly drops non-`open_statuses` rows — the aging
  rows are stale because the mirror is stale (synced_at 2026-11-04/06).
- Every `freshdesk_sync` run since the typed-mirror cutover errors with
  `invalid input syntax for type timestamp with time zone: ""` (refresh_log,
  2026-11-13). `fdTicketToRow_` emits `''` for missing timestamps
  (`resolved_at`, `closed_at`, `first_responded_at`, `status_updated_at`,
  `due_by`, `fr_due_by`, and `created_at`/`updated_at` when absent) and `''`
  for missing `priority`; remote `tickets` columns are `timestamptz`/`integer`
  (remote_reconcile 20261106151132), so the whole batch upsert throws, the
  error escapes `fdSyncLoop_`, and the cursor is never saved.
- `v2_fd_inc_cursor` was intentionally reset to `2026-09-01T00:00:00Z`
  (fd-direct-mirrors ops1-02) to repopulate subject/order_id — each run
  re-fetches pages from Sep-1 (~3 min), fails on the first upsert, cursor
  never advances. Net effect: zero ticket updates since ~Nov 6.

## Fix
- `fdTicketToRow_`: emit `null` (not `''`) for absent timestamptz fields and
  `priority` (`fdIso_` returns `string | null`).
- `dqUpsertTickets_`: chunk the upsert (500/batch) — the Sep-1 catch-up batch
  is up to ~30k rows, over PostgREST payload limits.
- Regression test: `fdTicketToRow_` emits null timestamps; upsert chunks.

## Success criteria
1. `fdTicketToRow_` returns `null` for missing timestamps/priority (not `''`).
2. `dqUpsertTickets_` splits large batches.
3. typecheck + targeted vitest pass; commit + push; Vercel deploy READY.
4. Next job-data-tick consumes the Sep-1 cursor; `refresh_log` shows
   `freshdesk_sync` ok and statuses converge (closed tickets drop off the
   aging board).

## Gates
`npx tsc --noEmit` · `npx vitest run tests/jobs` · push then poll Vercel
deployment until READY (workflow.md deploy gate).

## Non-goals
- No DB migration needed (columns already typed; `''` never stored).
- No reset of `v2_fd_inc_cursor` — Sep-1 re-fetch is the intended catch-up.
