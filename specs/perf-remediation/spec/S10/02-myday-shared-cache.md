# S10-02: shared-cache.ts + myday.ts off the instance-local Map
Kind: mini
ID: S10-02
Parent: S10
Owner: dev
Depends: S10-01, S08-01
Criteria: PLAN #10 (my-day section cache shared across function instances)
Skills: none
Budget: files=2; actions=5; changed_lines=150; minutes=9

## Goal
New `platform/shared-cache.ts` exposes async `dbCacheGet/Put/Remove` over
`app_cache` (S10-01) via `db()`, and `myday.ts` routes every
`AS_CACHE_PREFIX` (`cc_myday_v2_*`) cache touch through it — same keys,
same TTL, same best-effort failure tolerance.

## Files
- Create: `src/features/shared/platform/shared-cache.ts` | `import 'server-only'`; the three async helpers
- Edit: `src/features/cx-hub/lib/myday.ts` | cache call sites ~:583-592 (followups), :660-681 (per-part get/put), :681 (drop all parts), :753 (drop core)

## Context
- `src/features/shared/platform/repo.ts:37-64` | cacheGet/Put/Remove semantics to mirror (string in/out, TTL seconds, null on miss, swallow errors)
- `src/features/cx-hub/lib/myday.ts:35-37,580-594,655-685,750-755` | exact call sites; `asDropCachedFollowUp_` is currently SYNC -> becomes async, awaited at its call site (:576)
- `src/features/shared/platform/stores.ts:27-40` | missingOk error->empty convention
- S10-01 table: `app_cache(key PK, value, expires_at)`

## Contract
- `dbCacheGet(key): Promise<string|null>` — select by key; expired or missing -> null (lazy-delete expired rows is allowed but not required); any error -> null.
- `dbCachePut(key, value, ttlSeconds): Promise<void>` — upsert `{key, value, expires_at: now+ttl}`; errors swallowed.
- `dbCacheRemove(key): Promise<void>` — delete by key (exact match; for prefix drops, select `.like(key+'%')` keys then delete, or `.like` delete — pick the minimal safe form); errors swallowed.
- myday.ts: every cacheGet/cachePut/cacheRemove on an `AS_CACHE_PREFIX` key becomes the shared helper (awaited). `asDropCachedFollowUp_` turns async; update `markFollowUpDone` and any other caller (grep it) to `await`.
- Do NOT migrate non-myday keys — repo's cacheGet/Put/Remove imports stay for any remaining uses in myday.ts; remove only dead imports.
Out of scope: repo.ts, other features' caches, the repo Map itself.

## Actions
1. shared-cache.ts: implement the three helpers per contract.
2. myday.ts: convert the followups cache get/put/remove (~:583-592).
3. myday.ts: convert the per-part get/put + drop-all (~:660-681) and drop-core (~:753).
4. myday.ts: make `asDropCachedFollowUp_` async; await its call sites.
5. Verify imports: drop removed cache* imports only if unused; `npx tsc --noEmit` clean.

## Done when
- No `cacheGet|cachePut|cacheRemove` call in myday.ts touches an `AS_CACHE_PREFIX` key.
- All three helpers exist and are used; failure paths stay non-throwing.
- `npx vitest run tests/golden/hub-my-day.test.ts` green; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/golden/hub-my-day.test.ts` -> all pass.

## Handoff
`shared-cache.ts` is available for future cross-instance caches.
Write results/S10-02.md (<=10 lines); TL alone updates TRACKER.md.
