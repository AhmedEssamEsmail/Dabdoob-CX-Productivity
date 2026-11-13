-- S05-04: drop the `cols` jsonb payload column from the three sheet mirrors
-- (fd_activities, maqsam_calls, freshchat). Typed columns from S02 are now the
-- canonical row shape; S05-02 backfilled them and S05-03 stopped all writers
-- emitting `cols` and all readers selecting it.
--
-- Kept per mirror: id, dedupe_key, ts_ms, synced_at (+ typed columns).
-- dedupe_key remains sha1(table|JSON.stringify(cells)) — computed from the
-- writer's cells, not this column, so it is unaffected.
--
-- IF EXISTS keeps the migration idempotent. Apply only after the S05-03 code
-- deploy reaches production (remote apply is approval-gated per AGENTS.md).

ALTER TABLE public.fd_activities DROP COLUMN IF EXISTS cols;
ALTER TABLE public.maqsam_calls  DROP COLUMN IF EXISTS cols;
ALTER TABLE public.freshchat     DROP COLUMN IF EXISTS cols;
