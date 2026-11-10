-- S02-01 (PLAN #5): dedupe pre-flight + the unique conflict targets the
-- mapping `upsertOn` flips (S02-04 queue-quality, S02-08 qa_volume) assume on
-- the 8 queue/agg insert-only snapshot stores. Without them a re-run appends
-- duplicates (specs/megaplan/audits/migration-run.md §4 hazard list).
--
-- Natural keys (one row per source row):
--   aging_open_tickets   -> ticket_id
--   agg_queue_now        -> (queue, kind)
--   agg_inflow_weekly    -> (period, channel, country)
--   agg_inflow_monthly   -> (period, channel, country)
--   agg_agent_perf       -> (email, period)
--   agg_agent_daily      -> (date, email)
--   agg_snapshots_today  -> snapshot_key
--   qa_volume            -> (date, channel, contact_type)
--
-- Fallback rule: every key column above is nullable (except qa_volume.date).
-- After the dedupe pass, if a table still holds a row where ANY key column IS
-- NULL, a plain UNIQUE index can never be an upsert conflict target for that
-- row (Postgres treats NULLs as distinct) -> mint `dedupe_key TEXT` for every
-- row ('mig-' || row_number() OVER (ORDER BY id) - 1, S02-02 convention) and
-- UNIQUE that instead. The probe runs at apply time inside each DO block;
-- RAISE NOTICE names the conflict target each table ended on -- relay those
-- lines to S02-04/S02-08 (one `transform:dedupe_key` per fallback table).
--
-- Idempotent: deletes keep the highest id per key group (last write wins;
-- IS NOT DISTINCT FROM collapses NULL-key groups), ALTER is guarded, the
-- backfill only fills rows where dedupe_key IS NULL, and every CREATE uses
-- IF NOT EXISTS. Pattern: 20261108204952 + 20261109130415.

-- ---------- 1) aging_open_tickets -> ticket_id ----------
-- probe: SELECT count(*) FROM public.aging_open_tickets WHERE ticket_id IS NULL;
DELETE FROM public.aging_open_tickets a
USING public.aging_open_tickets b
WHERE a.ticket_id IS NOT DISTINCT FROM b.ticket_id
  AND a.id < b.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.aging_open_tickets WHERE ticket_id IS NULL) THEN
    EXECUTE 'ALTER TABLE public.aging_open_tickets ADD COLUMN IF NOT EXISTS dedupe_key TEXT';
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn
      FROM public.aging_open_tickets
    )
    UPDATE public.aging_open_tickets t
    SET dedupe_key = 'mig-' || ranked.rn
    FROM ranked
    WHERE t.id = ranked.id
      AND t.dedupe_key IS NULL;
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS aging_open_tickets_dedupe_key_uidx ON public.aging_open_tickets (dedupe_key)';
    RAISE NOTICE 'aging_open_tickets: NULL-key rows present -> conflict target dedupe_key (transform:dedupe_key)';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS aging_open_tickets_ticket_id_uidx ON public.aging_open_tickets (ticket_id)';
    RAISE NOTICE 'aging_open_tickets: conflict target (ticket_id)';
  END IF;
END $$;

-- ---------- 2) agg_queue_now -> (queue, kind) ----------
-- probe: SELECT count(*) FROM public.agg_queue_now WHERE queue IS NULL OR kind IS NULL;
DELETE FROM public.agg_queue_now a
USING public.agg_queue_now b
WHERE a.queue IS NOT DISTINCT FROM b.queue
  AND a.kind IS NOT DISTINCT FROM b.kind
  AND a.id < b.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agg_queue_now WHERE queue IS NULL OR kind IS NULL) THEN
    EXECUTE 'ALTER TABLE public.agg_queue_now ADD COLUMN IF NOT EXISTS dedupe_key TEXT';
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn
      FROM public.agg_queue_now
    )
    UPDATE public.agg_queue_now t
    SET dedupe_key = 'mig-' || ranked.rn
    FROM ranked
    WHERE t.id = ranked.id
      AND t.dedupe_key IS NULL;
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_queue_now_dedupe_key_uidx ON public.agg_queue_now (dedupe_key)';
    RAISE NOTICE 'agg_queue_now: NULL-key rows present -> conflict target dedupe_key (transform:dedupe_key)';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_queue_now_queue_kind_uidx ON public.agg_queue_now (queue, kind)';
    RAISE NOTICE 'agg_queue_now: conflict target (queue, kind)';
  END IF;
END $$;

-- ---------- 3) agg_inflow_weekly -> (period, channel, country) ----------
-- probe: SELECT count(*) FROM public.agg_inflow_weekly WHERE period IS NULL OR channel IS NULL OR country IS NULL;
DELETE FROM public.agg_inflow_weekly a
USING public.agg_inflow_weekly b
WHERE a.period IS NOT DISTINCT FROM b.period
  AND a.channel IS NOT DISTINCT FROM b.channel
  AND a.country IS NOT DISTINCT FROM b.country
  AND a.id < b.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agg_inflow_weekly WHERE period IS NULL OR channel IS NULL OR country IS NULL) THEN
    EXECUTE 'ALTER TABLE public.agg_inflow_weekly ADD COLUMN IF NOT EXISTS dedupe_key TEXT';
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn
      FROM public.agg_inflow_weekly
    )
    UPDATE public.agg_inflow_weekly t
    SET dedupe_key = 'mig-' || ranked.rn
    FROM ranked
    WHERE t.id = ranked.id
      AND t.dedupe_key IS NULL;
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_inflow_weekly_dedupe_key_uidx ON public.agg_inflow_weekly (dedupe_key)';
    RAISE NOTICE 'agg_inflow_weekly: NULL-key rows present -> conflict target dedupe_key (transform:dedupe_key)';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_inflow_weekly_period_channel_country_uidx ON public.agg_inflow_weekly (period, channel, country)';
    RAISE NOTICE 'agg_inflow_weekly: conflict target (period, channel, country)';
  END IF;
END $$;

-- ---------- 4) agg_inflow_monthly -> (period, channel, country) ----------
-- probe: SELECT count(*) FROM public.agg_inflow_monthly WHERE period IS NULL OR channel IS NULL OR country IS NULL;
DELETE FROM public.agg_inflow_monthly a
USING public.agg_inflow_monthly b
WHERE a.period IS NOT DISTINCT FROM b.period
  AND a.channel IS NOT DISTINCT FROM b.channel
  AND a.country IS NOT DISTINCT FROM b.country
  AND a.id < b.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agg_inflow_monthly WHERE period IS NULL OR channel IS NULL OR country IS NULL) THEN
    EXECUTE 'ALTER TABLE public.agg_inflow_monthly ADD COLUMN IF NOT EXISTS dedupe_key TEXT';
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn
      FROM public.agg_inflow_monthly
    )
    UPDATE public.agg_inflow_monthly t
    SET dedupe_key = 'mig-' || ranked.rn
    FROM ranked
    WHERE t.id = ranked.id
      AND t.dedupe_key IS NULL;
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_inflow_monthly_dedupe_key_uidx ON public.agg_inflow_monthly (dedupe_key)';
    RAISE NOTICE 'agg_inflow_monthly: NULL-key rows present -> conflict target dedupe_key (transform:dedupe_key)';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_inflow_monthly_period_channel_country_uidx ON public.agg_inflow_monthly (period, channel, country)';
    RAISE NOTICE 'agg_inflow_monthly: conflict target (period, channel, country)';
  END IF;
END $$;

-- ---------- 5) agg_agent_perf -> (email, period) ----------
-- probe: SELECT count(*) FROM public.agg_agent_perf WHERE email IS NULL OR period IS NULL;
DELETE FROM public.agg_agent_perf a
USING public.agg_agent_perf b
WHERE a.email IS NOT DISTINCT FROM b.email
  AND a.period IS NOT DISTINCT FROM b.period
  AND a.id < b.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agg_agent_perf WHERE email IS NULL OR period IS NULL) THEN
    EXECUTE 'ALTER TABLE public.agg_agent_perf ADD COLUMN IF NOT EXISTS dedupe_key TEXT';
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn
      FROM public.agg_agent_perf
    )
    UPDATE public.agg_agent_perf t
    SET dedupe_key = 'mig-' || ranked.rn
    FROM ranked
    WHERE t.id = ranked.id
      AND t.dedupe_key IS NULL;
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_agent_perf_dedupe_key_uidx ON public.agg_agent_perf (dedupe_key)';
    RAISE NOTICE 'agg_agent_perf: NULL-key rows present -> conflict target dedupe_key (transform:dedupe_key)';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_agent_perf_email_period_uidx ON public.agg_agent_perf (email, period)';
    RAISE NOTICE 'agg_agent_perf: conflict target (email, period)';
  END IF;
END $$;

-- ---------- 6) agg_agent_daily -> (date, email) ----------
-- probe: SELECT count(*) FROM public.agg_agent_daily WHERE date IS NULL OR email IS NULL;
DELETE FROM public.agg_agent_daily a
USING public.agg_agent_daily b
WHERE a.date IS NOT DISTINCT FROM b.date
  AND a.email IS NOT DISTINCT FROM b.email
  AND a.id < b.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agg_agent_daily WHERE date IS NULL OR email IS NULL) THEN
    EXECUTE 'ALTER TABLE public.agg_agent_daily ADD COLUMN IF NOT EXISTS dedupe_key TEXT';
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn
      FROM public.agg_agent_daily
    )
    UPDATE public.agg_agent_daily t
    SET dedupe_key = 'mig-' || ranked.rn
    FROM ranked
    WHERE t.id = ranked.id
      AND t.dedupe_key IS NULL;
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_agent_daily_dedupe_key_uidx ON public.agg_agent_daily (dedupe_key)';
    RAISE NOTICE 'agg_agent_daily: NULL-key rows present -> conflict target dedupe_key (transform:dedupe_key)';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_agent_daily_date_email_uidx ON public.agg_agent_daily (date, email)';
    RAISE NOTICE 'agg_agent_daily: conflict target (date, email)';
  END IF;
END $$;

-- ---------- 7) agg_snapshots_today -> snapshot_key ----------
-- probe: SELECT count(*) FROM public.agg_snapshots_today WHERE snapshot_key IS NULL;
DELETE FROM public.agg_snapshots_today a
USING public.agg_snapshots_today b
WHERE a.snapshot_key IS NOT DISTINCT FROM b.snapshot_key
  AND a.id < b.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agg_snapshots_today WHERE snapshot_key IS NULL) THEN
    EXECUTE 'ALTER TABLE public.agg_snapshots_today ADD COLUMN IF NOT EXISTS dedupe_key TEXT';
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn
      FROM public.agg_snapshots_today
    )
    UPDATE public.agg_snapshots_today t
    SET dedupe_key = 'mig-' || ranked.rn
    FROM ranked
    WHERE t.id = ranked.id
      AND t.dedupe_key IS NULL;
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_snapshots_today_dedupe_key_uidx ON public.agg_snapshots_today (dedupe_key)';
    RAISE NOTICE 'agg_snapshots_today: NULL-key rows present -> conflict target dedupe_key (transform:dedupe_key)';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS agg_snapshots_today_snapshot_key_uidx ON public.agg_snapshots_today (snapshot_key)';
    RAISE NOTICE 'agg_snapshots_today: conflict target (snapshot_key)';
  END IF;
END $$;

-- ---------- 8) qa_volume -> (date, channel, contact_type) ----------
-- 006 already declares UNIQUE(date, channel, contact_type); where that holds
-- remotely the DELETE finds no dupes and the named index is a harmless twin
-- of the constraint's backing index. date is NOT NULL; channel/contact_type
-- nullable -> probe all three.
-- probe: SELECT count(*) FROM public.qa_volume WHERE date IS NULL OR channel IS NULL OR contact_type IS NULL;
DELETE FROM public.qa_volume a
USING public.qa_volume b
WHERE a.date IS NOT DISTINCT FROM b.date
  AND a.channel IS NOT DISTINCT FROM b.channel
  AND a.contact_type IS NOT DISTINCT FROM b.contact_type
  AND a.id < b.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.qa_volume WHERE date IS NULL OR channel IS NULL OR contact_type IS NULL) THEN
    EXECUTE 'ALTER TABLE public.qa_volume ADD COLUMN IF NOT EXISTS dedupe_key TEXT';
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn
      FROM public.qa_volume
    )
    UPDATE public.qa_volume t
    SET dedupe_key = 'mig-' || ranked.rn
    FROM ranked
    WHERE t.id = ranked.id
      AND t.dedupe_key IS NULL;
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS qa_volume_dedupe_key_uidx ON public.qa_volume (dedupe_key)';
    RAISE NOTICE 'qa_volume: NULL-key rows present -> conflict target dedupe_key (transform:dedupe_key)';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS qa_volume_date_channel_contact_type_uidx ON public.qa_volume (date, channel, contact_type)';
    RAISE NOTICE 'qa_volume: conflict target (date, channel, contact_type)';
  END IF;
END $$;
