-- S07-03 (PLAN #7, index group B): remaining audit-listed lookup indexes.
-- tickets is the hot table (~176k rows / 72MB, written by the sync jobs), so
-- its three indexes build CONCURRENTLY — a plain CREATE INDEX would block
-- writes for the whole build. refresh_log and queue_submissions are small;
-- plain builds finish in milliseconds. All IF NOT EXISTS: re-apply no-ops.
--
-- CONCURRENTLY cannot run inside a transaction block. Apply via
-- `supabase db push` / `migration up` (CLI v3 runs pipeline-incompatible
-- statements standalone outside the batch txn) or `psql -f` — never inside
-- BEGIN/COMMIT or psql --single-transaction. If a build is interrupted it
-- leaves an INVALID index under the name, which IF NOT EXISTS would then
-- skip: `DROP INDEX CONCURRENTLY <name>` before re-applying.

-- tickets.status / group_name / created_at: queue reads filter on these —
-- src/features/cx-queue/lib/jobs.ts:94-97,160-164.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_status
  ON public.tickets (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_group_name
  ON public.tickets (group_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_at
  ON public.tickets (created_at);

-- refresh_log(job,finished_at): last-finished-run-per-job lookups
-- (dqLastRun pattern); tail reads at cx-productivity/lib/tph/page.ts:140.
CREATE INDEX IF NOT EXISTS idx_refresh_log_job_finished_at
  ON public.refresh_log (job, finished_at);

-- queue_submissions(slot_date): per-day check-in reads. (slot_date,slot)_uidx
-- already covers equality via leftmost prefix; PLAN #7 lists this standalone
-- index so it ships per contract.
CREATE INDEX IF NOT EXISTS idx_queue_submissions_slot_date
  ON public.queue_submissions (slot_date);
