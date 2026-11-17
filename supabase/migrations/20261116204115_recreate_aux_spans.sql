-- S11-01: recreate public.aux_spans EMPTY, reversing the pending drop in
-- 20261116175742_drop_dead_and_mirror_only_tables.sql (PLAN Amendment 3:
-- RECREATE approved; reports/tl-1.md spec gap 2). The ~13k history rows are
-- an accepted loss — NO backfill.
--
-- Shape is the exact pre-drop DDL (20261109134359_s06_new_tables.sql:21-28,65,
-- itself the 004_mirror_tables.sql mirror shape): id identity PK, dedupe_key
-- UNIQUE (the FD_AUX upsert key, ops-tabs.ts:97-100), ts_ms, cols jsonb
-- (verbatim A..G row cells), synced_at.
--
-- Idempotent: IF NOT EXISTS throughout — a no-op wherever the drop was never
-- applied, a true recreate wherever it was.

CREATE TABLE IF NOT EXISTS public.aux_spans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key text UNIQUE,
  ts_ms bigint,
  cols jsonb,
  synced_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_aux_spans_ts ON public.aux_spans(ts_ms);

-- RLS posture unchanged: enabled with NO policies = deny-all for
-- anon/authenticated (dq_hct / S08-04 convention); the service-role server
-- client bypasses RLS for sync writes. ALTER ... ENABLE is idempotent.
ALTER TABLE public.aux_spans ENABLE ROW LEVEL SECURITY;
