# data1-03 — roster.active NOT NULL migration

Status: done
Files: supabase/migrations/20261112165047_roster_active_not_null.sql (new)
Body: `UPDATE public.roster SET active = TRUE WHERE active IS NULL;` then `ALTER TABLE public.roster ALTER COLUMN active SET NOT NULL;` (DEFAULT TRUE kept).
Checks: `git status --porcelain supabase/migrations` -> exactly one new file from this leaf (`20261112165047_...`); 5 other `??` files predate it (earlier timestamps, prior shards). No remote commands run; file auto-applies on merge to main.
Destructive? No DDL run anywhere; on merge the UPDATE backfills NULLs->TRUE then SET NOT NULL (brief ACCESS EXCLUSIVE lock on roster).
Blockers: none.
Handoff: NEEDS_APPROVAL: apply supabase/migrations/20261112165047_roster_active_not_null.sql (roster.active backfill + NOT NULL; destructive? n — NULL->TRUE backfill only).
