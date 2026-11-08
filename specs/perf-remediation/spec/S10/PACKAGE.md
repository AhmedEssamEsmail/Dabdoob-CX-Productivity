# S10: Shared my-day section cache (Supabase table)
Kind: package
ID: S10
Dispatch: NEVER

## Goal and contract
PLAN criterion #10: the my-day `cc_myday_v2_*` section cache moves off the
instance-local `repo.ts` Map to a Supabase table so warm sections are
shared across function instances. Design: `app_cache` table
(key text PK, value text, expires_at timestamptz; RLS enabled, no public
policies — service-role only), accessed through a new
`platform/shared-cache.ts` (`dbCacheGet/Put/Remove`, async, missingOk-null
best-effort like the Map it replaces). Only `cc_myday_v2_*` callers
migrate — the repo Map keeps serving everything else (viewas, dq stamps,
poll stamps). Invariants: AS_CACHE_SECONDS (21600), AS_PARTS semantics,
section envelope shapes, "the script cache was best-effort" failure
tolerance. Non-goals: moving other cache consumers, TTL sweeps/janitors.

## Children
Index: `S10/00-index.md`
- app_cache table migration: S10-01 | shared-cache helper + myday swap: S10-02

## Completion
Both done; my-day warm path reads/writes the table, not the Map.
