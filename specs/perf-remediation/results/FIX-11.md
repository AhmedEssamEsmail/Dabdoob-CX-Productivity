# FIX-11 results — done
- Edited `supabase/migrations/20261108205536_lookup_indexes_tickets_refresh_queue.sql` (in place, still unapplied remotely).
- Replaced `idx_refresh_log_job_finished_at (job, finished_at)` with
  `idx_refresh_log_started_at ON public.refresh_log (started_at)`; comment now cites
  the unfiltered `ORDER BY started_at DESC LIMIT 300` tail read at page.ts:148.
- tickets CONCURRENTLY indexes and queue_submissions index: untouched.
- Verify: `grep -n "refresh_log"` shows only the started_at variant; no job/finished_at index remains.
- No MCP supabase server configured here; no remote apply performed.
- Pending: `NEEDS_APPROVAL: apply 20261108205536_lookup_indexes_tickets_refresh_queue.sql` (destructive? n — adds indexes only).
