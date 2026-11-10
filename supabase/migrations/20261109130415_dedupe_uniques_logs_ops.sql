-- S02-02 (PLAN #5): dedupe pre-flight + the unique indexes the mapping
-- `upsertOn` flips (S02-05/S02-07) assume on the 8 log/ops insert-only
-- tables. Without them a re-run of the migration appends duplicate rows
-- (see specs/megaplan/audits/migration-run.md §4 — every table below is on
-- the one-shot hazard list). Re-apply is a no-op: deletes find no dupes,
-- ALTER/UPDATE are guarded, and every CREATE uses IF NOT EXISTS.
--
-- Pattern copied from 20261108204952 (dedupe + keep highest id = last write
-- wins). Difference: on append-only logs a NULL key part marks a real event,
-- so the dedupe joins use plain `=` on NULLABLE columns — `a.col = b.col` is
-- never true for NULL, keeping those rows — and IS NOT DISTINCT FROM on
-- NOT NULL columns. Each unique index still builds because Postgres treats
-- NULLs as distinct.
--
-- Per-table NULL-key probes to eyeball before applying (all read-only):
--   SELECT count(*) FROM <t> WHERE <any key col> IS NULL;
--   SELECT <key cols>, count(*) FROM <t> GROUP BY <key cols> HAVING count(*) > 1;

-- ---------- 1) refresh_log -> log_id ----------
-- Transform already mints log_id='mig-'+ctx.index for sheet rows
-- (queue-quality.ts:494) and app writers emit log_id (004), so log_id IS the
-- dedupe key; remote rows are provably non-NULL (legacy schema had it
-- NOT NULL). `=` keeps any dashboard-inserted NULL rows as distinct events.
-- probe: SELECT count(*) FROM public.refresh_log WHERE log_id IS NULL;
DELETE FROM public.refresh_log a
USING public.refresh_log b
WHERE a.log_id = b.log_id
  AND a.ctid < b.ctid; -- refresh_log has no id column; ctid is the row-physical tie-breaker

CREATE UNIQUE INDEX IF NOT EXISTS refresh_log_log_id_uidx
  ON public.refresh_log (log_id);

-- ---------- 2) qe_builds -> ran_at ----------
-- ran_at is TEXT NOT NULL (006); single clean key, no fallback needed.
-- probe: SELECT ran_at, count(*) FROM public.qe_builds GROUP BY 1 HAVING count(*) > 1;
DELETE FROM public.qe_builds a
USING public.qe_builds b
WHERE a.ran_at IS NOT DISTINCT FROM b.ran_at
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS qe_builds_ran_at_uidx
  ON public.qe_builds (ran_at);

-- ---------- 3) options -> (list_key, value) ----------
-- idx_options_list_value (002) is on (list_key, lower(value)) — an
-- expression index PostgREST cannot use as an upsert conflict target, so a
-- plain (list_key,value) unique is required. Case-variant pairs
-- ('US','usa') are already impossible where that expression unique index
-- exists; they are legitimate distinct keys under the plain index.
-- probe: SELECT list_key, lower(value), count(*) FROM public.options
--        GROUP BY 1,2 HAVING count(*) > 1;          -- case-variant dupes
-- probe: SELECT list_key, value, count(*) FROM public.options
--        GROUP BY 1,2 HAVING count(*) > 1;          -- exact dupes
DELETE FROM public.options a
USING public.options b
WHERE a.list_key IS NOT DISTINCT FROM b.list_key
  AND a.value IS NOT DISTINCT FROM b.value
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS options_list_key_value_uidx
  ON public.options (list_key, value);

-- ---------- 4) holidays -> (country, date, name) ----------
-- All three NOT NULL (002); 0 rows migrated, table may be empty — dedupe
-- no-ops harmlessly either way.
DELETE FROM public.holidays a
USING public.holidays b
WHERE a.country IS NOT DISTINCT FROM b.country
  AND a.date IS NOT DISTINCT FROM b.date
  AND a.name IS NOT DISTINCT FROM b.name
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS holidays_country_date_name_uidx
  ON public.holidays (country, date, name);

-- ---------- 5) mail_log -> (sent_at, "to", subject) ----------
-- sent_at is the only nullable key part (002): `=` keeps NULL-sent_at rows
-- as distinct mail attempts; "to"/subject are NOT NULL.
-- probe: SELECT count(*) FROM public.mail_log WHERE sent_at IS NULL;
DELETE FROM public.mail_log a
USING public.mail_log b
WHERE a.sent_at = b.sent_at
  AND a."to" IS NOT DISTINCT FROM b."to"
  AND a.subject IS NOT DISTINCT FROM b.subject
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS mail_log_sent_at_to_subject_uidx
  ON public.mail_log (sent_at, "to", subject);

-- ---------- 6) qa_access_log -> dedupe_key (fallback) ----------
-- email/action/submitted_at are ALL nullable (014): no clean composite, and
-- NULL-key audit rows would silently bypass any natural unique index — so
-- per the fallback rule this adds `dedupe_key TEXT` and uniques it. S09-01
-- replaced the positional mint: the QaAccessLog transform now sends
-- 'mig-'+sha1(email|action|submitted_by|submitted_at) — cells joined '|',
-- each String(v ?? '') — so this backfill must emit byte-identical keys or
-- an approved re-run inserts a duplicate set (results/S09-01.md).
-- email/action/submitted_by are TEXT (stored = verbatim sheet cell);
-- submitted_at is timestamptz — `::text` is the canonical stored form per
-- the S09-02 contract (a sheet-display string is unrecoverable from the
-- cast value; recorded in results/S09-02.md). All-empty identity keeps the
-- unique positional fallback — ctx.index is not stored, so 'mig-'+id
-- stands in (PK guarantees the unique index still builds).
-- pgcrypto lives in `extensions` on Supabase; qualified call matches the
-- cron.schedule/net.http_get precedent; IF NOT EXISTS keeps re-apply a no-op.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.qa_access_log ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

UPDATE public.qa_access_log t
SET dedupe_key = CASE
  WHEN coalesce(t.email::text, '') = ''
   AND coalesce(t.action::text, '') = ''
   AND coalesce(t.submitted_by::text, '') = ''
   AND coalesce(t.submitted_at::text, '') = ''
  THEN 'mig-' || t.id
  ELSE 'mig-' || encode(extensions.digest(
         coalesce(t.email::text, '') || '|' ||
         coalesce(t.action::text, '') || '|' ||
         coalesce(t.submitted_by::text, '') || '|' ||
         coalesce(t.submitted_at::text, ''),
         'sha1'), 'hex')
END
WHERE t.dedupe_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS qa_access_log_dedupe_key_uidx
  ON public.qa_access_log (dedupe_key);

-- ---------- 7) follow_up_done -> (thread_id, done_at) ----------
-- thread_id NOT NULL, done_at nullable (005): `=` on done_at keeps any
-- NULL-done_at Done clicks as distinct rows.
-- probe: SELECT count(*) FROM public.follow_up_done WHERE done_at IS NULL;
DELETE FROM public.follow_up_done a
USING public.follow_up_done b
WHERE a.thread_id IS NOT DISTINCT FROM b.thread_id
  AND a.done_at = b.done_at
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS follow_up_done_thread_done_uidx
  ON public.follow_up_done (thread_id, done_at);

-- ---------- 8) sc_behaviour -> (month, date, email, note) ----------
-- All four TEXT NOT NULL DEFAULT '' (008): clean composite.
DELETE FROM public.sc_behaviour a
USING public.sc_behaviour b
WHERE a.month IS NOT DISTINCT FROM b.month
  AND a.date IS NOT DISTINCT FROM b.date
  AND a.email IS NOT DISTINCT FROM b.email
  AND a.note IS NOT DISTINCT FROM b.note
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS sc_behaviour_month_date_email_note_uidx
  ON public.sc_behaviour (month, date, email, note);
