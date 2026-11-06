-- ---------- Migration hardening (WP-30/32 outputs; applied before WP-51 re-runs) ----------
-- Natural-key UNIQUEs so insert-only sheet tables can upsert idempotently.
-- Without these, `tlp_queue_daily`/`tlp_team`/`queue_submissions`/`dq_aging_flags`
-- plain-insert — a re-run duplicates. Apply BEFORE the WP-51 run if idempotence
-- is wanted; then set upsertOn on the corresponding mappings.

CREATE UNIQUE INDEX IF NOT EXISTS tlp_queue_daily_date_tl_uidx
  ON public.tlp_queue_daily (date, tl_email);
CREATE UNIQUE INDEX IF NOT EXISTS tlp_team_tl_month_uidx
  ON public.tlp_team (tl_email, month);
CREATE UNIQUE INDEX IF NOT EXISTS queue_submissions_submission_uidx
  ON public.queue_submissions (submission_id);
CREATE UNIQUE INDEX IF NOT EXISTS dq_aging_flags_flag_uidx
  ON public.dq_aging_flags (flag_id);

-- ---------- Missing DDL flagged by WP-30 (queue-quality mappings) ----------
-- `qe_fd_cache` (QaEngine 'Ticket Detail Cache' tab) and `qa_access_log`
-- ('QaAccessLog' tab) have mappings but no table. Create-or-drop is an owner
-- decision; shapes below follow the sheet headers verbatim (text columns).

CREATE TABLE IF NOT EXISTS public.qe_fd_cache (
  ticket_id      TEXT PRIMARY KEY,
  detail_json    JSONB,
  cached_at      TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.qa_access_log (
  id             BIGSERIAL PRIMARY KEY,
  at             TIMESTAMPTZ,
  actor          TEXT,
  action         TEXT,
  detail         TEXT
);
ALTER TABLE public.qe_fd_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_all ON public.qe_fd_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY app_all ON public.qa_access_log FOR ALL USING (true) WITH CHECK (true);
