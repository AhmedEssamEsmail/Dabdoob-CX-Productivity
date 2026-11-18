-- agg_snapshots_today holds one row per (snapshot_key, queue); a unique index on
-- snapshot_key alone made every multi-queue check-in snapshot fail with a duplicate key.
DROP INDEX IF EXISTS public.agg_snapshots_today_snapshot_key_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS agg_snapshots_today_snapshot_key_queue_uidx
  ON public.agg_snapshots_today (snapshot_key, queue);
