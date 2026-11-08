-- S07-01 (PLAN #7): dedupe pre-flight + the unique constraints the app's
-- upserts already assume on prod_daily_layers and queue_submissions. Without
-- them applyOp falls back to delete+insert and check-in submissions are not
-- idempotent. Re-apply is a no-op: the deletes find no duplicates and both
-- CREATEs use IF NOT EXISTS.

-- ---------- 1) dedupe prod_daily_layers on (date,email,layer) ----------
-- Upsert key is hard-coded to (date,email,layer) in
-- src/features/shared/jobs/env.ts ('prod_daily_layers' -> keys). Survivor
-- rule: keep the LOWEST id per key group (earliest-written row wins).
-- IS NOT DISTINCT FROM also collapses NULL-key groups so the unique index
-- build below cannot fail on them.
DELETE FROM public.prod_daily_layers a
USING public.prod_daily_layers b
WHERE a.date IS NOT DISTINCT FROM b.date
  AND a.email IS NOT DISTINCT FROM b.email
  AND a.layer IS NOT DISTINCT FROM b.layer
  AND a.id > b.id;

-- ---------- 2) dedupe queue_submissions on (slot_date,slot) ----------
-- One row per check-in slot: submitCheckin (cx-queue/lib/pages.ts) updates the
-- existing row for (today, slot). Survivor rule: keep the row the app would
-- keep — the LATEST update (coalesce(updated_at, submitted_at)); remaining
-- ties break to the highest id.
DELETE FROM public.queue_submissions a
USING public.queue_submissions b
WHERE a.slot_date IS NOT DISTINCT FROM b.slot_date
  AND a.slot IS NOT DISTINCT FROM b.slot
  AND (coalesce(a.updated_at, a.submitted_at, '-infinity'::timestamptz), a.id)
    < (coalesce(b.updated_at, b.submitted_at, '-infinity'::timestamptz), b.id);

-- ---------- 3) unique constraints the upserts assume ----------
-- 014_migration_hardening already ships prod_daily_layers_date_email_layer_uidx;
-- IF NOT EXISTS no-ops where 014 applied and creates it where it did not.
CREATE UNIQUE INDEX IF NOT EXISTS prod_daily_layers_date_email_layer_uidx
  ON public.prod_daily_layers (date, email, layer);
CREATE UNIQUE INDEX IF NOT EXISTS queue_submissions_slot_date_slot_uidx
  ON public.queue_submissions (slot_date, slot);
