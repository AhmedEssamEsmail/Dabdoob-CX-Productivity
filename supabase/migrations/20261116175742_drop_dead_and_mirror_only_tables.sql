-- Drop dead and migration-tooling-only tables.
--
-- Dead (zero code references):
--   sc_daily_legacy_pre008, sc_behaviour_legacy_pre008, sc_months_legacy_pre008
--     - pre-cutover backups created by ALTER TABLE ... RENAME in
--       20261106151132_remote_reconcile.sql; nothing reads them.
--   tickets_legacy_pre003
--     - pre-schema-fix JSON-shape tickets backup, same migration.
--   cache_stamps
--     - legacy Sheets cache-versioning table; Postgres reads are direct so the
--       versioning is unused. Only a stale PK_OVERRIDES entry and an empty test
--       fixture mention it.
--
-- Mirror-tooling only (written by the Sheets migration pipeline, never read by
-- the app). NB these still hold migrated rows (aux_spans ~13k,
-- call_transcripts ~5.6k, v1_task_occurrences ~349) — data is discarded:
--   aux_spans, call_transcripts, v1_task_occurrences
--
-- Remote-only V1 leftovers (0 rows, zero code references, absent from this
-- migration history — predates local tracking; IF EXISTS keeps local runs safe):
--   fcr_monthly, fcr_weekly, kpi_logs, kpi_unplanned_leave,
--   qa_daily, qa_flag_log, qa_flags, qa_months
--
-- NOT dropped: sc_daily/sc_behaviour/sc_months and fcr_daily exist on remote
-- and are queried by the app despite being missing from local migrations
-- (remote drift — needs separate reconciliation).

DROP TABLE IF EXISTS public.sc_daily_legacy_pre008;
DROP TABLE IF EXISTS public.sc_behaviour_legacy_pre008;
DROP TABLE IF EXISTS public.sc_months_legacy_pre008;
DROP TABLE IF EXISTS public.tickets_legacy_pre003;
DROP TABLE IF EXISTS public.cache_stamps;
DROP TABLE IF EXISTS public.aux_spans;
DROP TABLE IF EXISTS public.call_transcripts;
DROP TABLE IF EXISTS public.v1_task_occurrences;
DROP TABLE IF EXISTS public.fcr_monthly;
DROP TABLE IF EXISTS public.fcr_weekly;
DROP TABLE IF EXISTS public.kpi_logs;
DROP TABLE IF EXISTS public.kpi_unplanned_leave;
DROP TABLE IF EXISTS public.qa_daily;
DROP TABLE IF EXISTS public.qa_flag_log;
DROP TABLE IF EXISTS public.qa_flags;
DROP TABLE IF EXISTS public.qa_months;
