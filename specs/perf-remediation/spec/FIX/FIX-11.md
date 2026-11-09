# FIX-11: refresh_log index does not match its only reader
Kind: mini
ID: FIX-11
Parent: -
Owner: supabase-expert
Depends: FIX-10 (same owner, serial)
Criteria: data report data-3 (LOW, blocking per task) — shipped index
(job, finished_at) is unusable for the unfiltered `ORDER BY started_at DESC
LIMIT 300` tail read; refresh_log grows unbounded
Skills: C:\Users\AHMED\AppData\Roaming\devin\skills\supabase-postgres-best-practices\SKILL.md
Budget: files=1; actions=2; changed_lines=10; minutes=4

## Goal
In migration `20261108205536_lookup_indexes_tickets_refresh_queue.sql`, change
the refresh_log index so it serves the actual query at
`src/features/cx-productivity/lib/tph/page.ts:148`:
`select('*').order('started_at', {ascending:false}).limit(300)` — unfiltered,
no job predicate. Report's chosen option: change the index to match the
actual query (code stays untouched).

## Files
- Edit: `supabase/migrations/20261108205536_lookup_indexes_tickets_refresh_queue.sql` | refresh_log index (lines ~23-26)

## Context
- `reports/data-1.md` finding data-3 | no current caller filters refresh_log by job
- `src/features/cx-productivity/lib/tph/page.ts:148` | the only reader's exact ordering
- Migration is UNAPPLIED remotely (TRACKER NEEDS_APPROVAL) — edit in place, no new file

## Contract
- Replace `idx_refresh_log_job_finished_at ON public.refresh_log (job, finished_at)`
  with a plain (non-CONCURRENT) index that directly supports the tail read,
  e.g. `idx_refresh_log_started_at ON public.refresh_log (started_at)`.
- Keep `IF NOT EXISTS` idiom; update the comment to cite the started_at tail read.
- tickets CONCURRENTLY indexes and queue_submissions index: untouched.
Out of scope: page.ts, any other migration/file, remote apply.

## Actions
1. Swap the index definition to (started_at) and rename it accordingly.
2. Update the comment above it (query is started_at-desc tail, not dqLastRun).

## Done when
- `grep -n "refresh_log" supabase/migrations/20261108205536_*.sql` shows the
  index on started_at only; no (job, finished_at) index remains.

## Verify
- Run: `grep -n "idx_refresh_log" supabase/migrations/20261108205536_lookup_indexes_tickets_refresh_queue.sql` -> started_at variant.

## Handoff
none. Write results/FIX-11.md (<=10 lines); TL alone updates TRACKER.md.
