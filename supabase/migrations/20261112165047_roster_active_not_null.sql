-- data1-03: enforce roster.active DEFAULT TRUE contract (data-1.md finding data-2)
-- Backfill NULLs (NULL means active today) then enforce NOT NULL.
UPDATE public.roster SET active = TRUE WHERE active IS NULL;
ALTER TABLE public.roster ALTER COLUMN active SET NOT NULL;
