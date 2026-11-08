# S10-01: app_cache key/value table for cross-instance caches
Kind: mini
ID: S10-01
Parent: S10
Owner: supabase-expert
Depends: S07-03
Criteria: PLAN #10 (Supabase table replacing the instance-local section cache)
Skills: none
Budget: files=1; actions=2; changed_lines=40; minutes=5

## Goal
One migration file creating `public.app_cache` — a server-only key/value
store with expiry — for the my-day section cache (and future shared
caches). RLS enabled, NO public policies (service-role access only,
consistent with the S08-04 lockdown).

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`; record the actual filename in results

## Context
- `src/features/cx-hub/lib/myday.ts:35-36` | consumer: keys `cc_myday_v2_<part>`, values are JSON strings, TTL 21600s
- `src/features/shared/platform/repo.ts:28-64` | the Map semantics being replaced (string value, expiresAt, best-effort)
- `supabase/migrations/014_migration_hardening.sql:207-222` | RLS-enable convention (here: enable + create NO policies)

## Contract
- `app_cache`: `key text PRIMARY KEY`, `value text NOT NULL`, `expires_at timestamptz NOT NULL`, `updated_at timestamptz DEFAULT now()` (or equivalent per the expert's conventions).
- `ALTER TABLE public.app_cache ENABLE ROW LEVEL SECURITY` + no policies => anon/auth denied; service role (post-S08-01 `db()`) bypasses.
- Optional `expires_at` index only if the skill recommends it for sweeps — keep the file minimal otherwise.
- Idempotent (`IF NOT EXISTS`); remote apply user-approved, not this leaf.
Out of scope: code changes (S10-02), sweeps/cron cleanup jobs, other tables.

## Actions
1. Create the table per contract.
2. Enable RLS with no policies; header comment states the service-role-only intent.

## Done when
- Migration exists, idempotent, matches the contract columns.
- `supabase migration lint` (or skill-equivalent check) passes.

## Verify
- Run: `supabase migration list` -> the new file is registered.

## Handoff
S10-02 writes/reads this table via db(). Write results/S10-01.md (<=10 lines)
with the filename; TL alone updates TRACKER.md.
