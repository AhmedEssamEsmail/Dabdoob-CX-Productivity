-- S02-01: fd_activities typed columns (fd-direct-mirrors).
-- Adds the 9 readable cells from the Activities sheet layout
-- (src/features/shared/jobs/engine-live.ts:142-144) as typed columns so
-- writers can dual-write and readers can stop parsing `cols`. All nullable,
-- no defaults: existing rows stay NULL until S05-02 backfills. `cols`,
-- `dedupe_key`, `ts_ms`, `synced_at` untouched for the transition; `cols`
-- is dropped in S05-04 once readers move off it.

ALTER TABLE public.fd_activities
  ADD COLUMN IF NOT EXISTS performed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ticket_id text,
  ADD COLUMN IF NOT EXISTS performer_name text,
  ADD COLUMN IF NOT EXISTS performer_type text,
  ADD COLUMN IF NOT EXISTS activity_type text,
  ADD COLUMN IF NOT EXISTS field_changed text,
  ADD COLUMN IF NOT EXISTS new_value text,
  ADD COLUMN IF NOT EXISTS old_value text,
  ADD COLUMN IF NOT EXISTS group_name text;
CREATE INDEX IF NOT EXISTS idx_fd_activities_ticket ON public.fd_activities(ticket_id);
