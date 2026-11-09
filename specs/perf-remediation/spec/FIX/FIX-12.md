# FIX-12: roster.email lacks the unique constraint repo upserts assume
Kind: mini
ID: FIX-12
Parent: -
Owner: supabase-expert
Depends: none
Criteria: data report data-4 (LOW, blocking per task) — every roster-sync
batch upsert hits 42P10 and falls back to per-row updates
Skills: C:\Users\AHMED\AppData\Roaming\devin\skills\supabase-postgres-best-practices\SKILL.md
Budget: files=1; actions=3; changed_lines=40; minutes=6

## Goal
One new migration giving `roster(email)` the unique constraint that
`src/features/shared/platform/repo.ts` updateRows/upsert path assumes
(its 42P10 fallback is hit on every roster-sync batch today). Follow the same
pattern as `20261108204952`: dedupe guard first (keep-latest survivor rule),
then `CREATE UNIQUE INDEX IF NOT EXISTS`.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new roster_email_unique`

## Context
- `reports/data-1.md` finding data-4 | 001_core_tables.sql:37 ships only a plain idx_roster_email
- `supabase/migrations/20261108204952_dedupe_uniques_prod_daily_layers_queue_submissions.sql` | pattern to mirror (dedupe + IF NOT EXISTS uidx)
- `src/features/shared/platform/repo.ts:240-247` | the upsert + 42P10 fallback this unblocks

## Contract
- Dedupe `roster` on email (`IS NOT DISTINCT FROM`, keep the HIGHEST id /
  freshest row — same survivor rule as FIX-10's corrected block).
- `CREATE UNIQUE INDEX IF NOT EXISTS <name> ON public.roster (email)` —
  plain build (roster is small; follow project convention for size).
- File must be idempotent / re-apply no-op like sibling migrations.
Out of scope: repo.ts and any TS, any other migration, remote apply
(NEEDS_APPROVAL — TL records it).

## Actions
1. `supabase migration new roster_email_unique`; record the real filename.
2. Add the dedupe-guard DELETE (keep-latest survivor) with a header comment.
3. Add `CREATE UNIQUE INDEX IF NOT EXISTS roster_email_uidx ON public.roster (email)`.

## Done when
- New migration file exists under supabase/migrations/ with guard + unique index.
- SQL is idempotent (re-apply safe) and syntactically valid.

## Verify
- Run: `supabase migration list` -> the new file is registered (or the skill's equivalent local validation).

## Handoff
New unapplied migration -> TL adds NEEDS_APPROVAL row. Write results/FIX-12.md
(<=10 lines); TL alone updates TRACKER.md.
