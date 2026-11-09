-- FIX-12 (data-4): dedupe pre-flight + the unique constraint the app's
-- roster-sync upserts already assume on roster(email). Without it every
-- updateRows batch upsert hits 42P10 and falls back to per-row updates
-- (src/features/shared/platform/repo.ts:240-247). Re-apply is a no-op:
-- the delete finds no duplicates and the CREATE uses IF NOT EXISTS.
-- Mirrors 20261108204952 (dedupe guard first, then IF NOT EXISTS uidx).

-- ---------- 1) dedupe roster on (email) ----------
-- Upsert key is hard-coded to 'email' in roster.ts (updateRows ROSTER_TABLE).
-- Survivor rule: keep the HIGHEST id per email group (latest-written row
-- wins — memoUpsert last-write-wins semantics make the freshest row
-- authoritative), same as FIX-10's corrected block. IS NOT DISTINCT FROM
-- also collapses NULL-email groups so the unique index build below cannot
-- fail on them. The live table is the drifted id-surrogate shape (001's
-- email-PK shape could never emit 42P10); the ctid branch keeps the guard
-- parseable if ever applied to the 001 shape, where no dups can exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roster' AND column_name = 'id'
  ) THEN
    DELETE FROM public.roster a
    USING public.roster b
    WHERE a.email IS NOT DISTINCT FROM b.email
      AND a.id < b.id;
  ELSE
    DELETE FROM public.roster a
    USING public.roster b
    WHERE a.email IS NOT DISTINCT FROM b.email
      AND a.ctid < b.ctid;
  END IF;
END $$;

-- ---------- 2) unique constraint the upserts assume ----------
-- Plain build: roster is small (same convention as prod_daily_layers uidx).
CREATE UNIQUE INDEX IF NOT EXISTS roster_email_uidx
  ON public.roster (email);
