-- S02-03 (PLAN #5): dedupe pre-flight + UNIQUE indexes for the 7 people/
-- scheduler insert-only tables so the mapping upsertOn flips (S02-05/S02-06)
-- have a real conflict target. Same pattern as 20261108204952: a guarded
-- DELETE keeps the HIGHEST id per key group (last write wins) and
-- IS NOT DISTINCT FROM collapses NULL-key groups so the index builds cannot
-- fail on them. Re-apply is a no-op: deletes find no duplicates, ALTER/CREATE
-- use IF NOT EXISTS, and the dedupe_key backfill only touches NULL rows.
--
-- Chosen keys (NULL-key probe per key column — evidence: 008/003/007 DDL
-- nullability, migration-dryrun §2 empty-cell ledger, mapping transforms):
--   one_on_one_topics        -> (log_id, position)   | position INTEGER is
--     nullable, but the dry run flags empty cells only in skipped_reason/
--     evidence_json — all 9 migrated rows carry a position — and the only
--     code path writing position '' (skipped-suggestion rows) cannot land:
--     PostgREST rejects '' for integer. Natural key holds.
--   one_on_one_private_notes -> (log_id, author_email, kind) | all TEXT NOT
--     NULL DEFAULT '' — NULL-key rows are impossible.
--   meeting_series_members   -> (series_id, email)   | both NOT NULL.
--   meeting_attendees        -> (meeting_id, email)  | both NOT NULL.
--   kpi_behaviour_log        -> log_id               | column nullable, but
--     require:['log_id'] drops NULL-key rows; table migrated 0 rows.
--   kpi_leave_log            -> log_id               | same.
--   sched_plan               -> dedupe_key (FALLBACK): every candidate key
--     column is nullable AND the sched_plan transform intentionally lands
--     variant=NULL on every migrated row, so (month,tl_email,date,shift,
--     variant) can never serve as an ON CONFLICT target (NULLs never
--     conflict). dedupe_key='mig-'+sha1(month|tl_email|date|shift|variant)
--     mirrors the S09-01 content-hash transform (results/S09-01.md) — cells
--     '|'-joined, each coalesce(col::text,'') — so a re-run's upsert keys
--     equal the backfilled keys; all-empty identity falls back to
--     'mig-'+id (ctx.index is not stored; PK keeps it unique). The mapping
--     upsertOn is 'dedupe_key'.

-- ---------- 1) one_on_one_topics on (log_id,position) ----------
DELETE FROM public.one_on_one_topics a
USING public.one_on_one_topics b
WHERE a.log_id IS NOT DISTINCT FROM b.log_id
  AND a.position IS NOT DISTINCT FROM b.position
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS one_on_one_topics_log_id_position_uidx
  ON public.one_on_one_topics (log_id, position);

-- ---------- 2) one_on_one_private_notes on (log_id,author_email,kind) ----
DELETE FROM public.one_on_one_private_notes a
USING public.one_on_one_private_notes b
WHERE a.log_id IS NOT DISTINCT FROM b.log_id
  AND a.author_email IS NOT DISTINCT FROM b.author_email
  AND a.kind IS NOT DISTINCT FROM b.kind
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS one_on_one_private_notes_log_id_author_email_kind_uidx
  ON public.one_on_one_private_notes (log_id, author_email, kind);

-- ---------- 3) meeting_series_members on (series_id,email) --------------
DELETE FROM public.meeting_series_members a
USING public.meeting_series_members b
WHERE a.series_id IS NOT DISTINCT FROM b.series_id
  AND a.email IS NOT DISTINCT FROM b.email
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS meeting_series_members_series_id_email_uidx
  ON public.meeting_series_members (series_id, email);

-- ---------- 4) meeting_attendees on (meeting_id,email) ------------------
DELETE FROM public.meeting_attendees a
USING public.meeting_attendees b
WHERE a.meeting_id IS NOT DISTINCT FROM b.meeting_id
  AND a.email IS NOT DISTINCT FROM b.email
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS meeting_attendees_meeting_id_email_uidx
  ON public.meeting_attendees (meeting_id, email);

-- ---------- 5) kpi_behaviour_log on log_id (table empty — free) ---------
DELETE FROM public.kpi_behaviour_log a
USING public.kpi_behaviour_log b
WHERE a.log_id IS NOT DISTINCT FROM b.log_id
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS kpi_behaviour_log_log_id_uidx
  ON public.kpi_behaviour_log (log_id);

-- ---------- 6) kpi_leave_log on log_id (table empty — free) -------------
DELETE FROM public.kpi_leave_log a
USING public.kpi_leave_log b
WHERE a.log_id IS NOT DISTINCT FROM b.log_id
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS kpi_leave_log_log_id_uidx
  ON public.kpi_leave_log (log_id);

-- ---------- 7) sched_plan: dedupe on the natural key, enforce dedupe_key --
-- Collapse true duplicate (month,tl_email,date,shift,variant) groups first —
-- NULL variants are grouped by IS NOT DISTINCT FROM so they dedupe too.
DELETE FROM public.sched_plan a
USING public.sched_plan b
WHERE a.month IS NOT DISTINCT FROM b.month
  AND a.tl_email IS NOT DISTINCT FROM b.tl_email
  AND a.date IS NOT DISTINCT FROM b.date
  AND a.shift IS NOT DISTINCT FROM b.shift
  AND a.variant IS NOT DISTINCT FROM b.variant
  AND a.id < b.id;

-- pgcrypto lives in `extensions` on Supabase; qualified call matches the
-- cron.schedule/net.http_get precedent; IF NOT EXISTS keeps re-apply a no-op.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.sched_plan ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Backfill must equal the S09-01 transform key byte-for-byte:
-- 'mig-'+sha1hex(month|tl_email|date|shift|variant), each cell
-- String(v ?? ''). month/tl_email/date/shift are TEXT (stored = verbatim
-- sheet cell); variant is INTEGER and lands NULL on migrated rows -> ''.
UPDATE public.sched_plan s
SET dedupe_key = CASE
  WHEN coalesce(s.month::text, '') = ''
   AND coalesce(s.tl_email::text, '') = ''
   AND coalesce(s.date::text, '') = ''
   AND coalesce(s.shift::text, '') = ''
   AND coalesce(s.variant::text, '') = ''
  THEN 'mig-' || s.id
  ELSE 'mig-' || encode(extensions.digest(
         coalesce(s.month::text, '') || '|' ||
         coalesce(s.tl_email::text, '') || '|' ||
         coalesce(s.date::text, '') || '|' ||
         coalesce(s.shift::text, '') || '|' ||
         coalesce(s.variant::text, ''),
         'sha1'), 'hex')
END
WHERE s.dedupe_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sched_plan_dedupe_key_uidx
  ON public.sched_plan (dedupe_key);
