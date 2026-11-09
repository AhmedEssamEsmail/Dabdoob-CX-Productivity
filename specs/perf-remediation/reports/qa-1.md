# qa report - perf-remediation - round 1 (FULL)

Verdict: **FAIL** (BLOCKER open — `next build` gate fails)
Open: 1 BLOCKER / 1 MED / 2 LOW

Checks run (exit codes; logs in `specs/perf-remediation/logs/`):
- `npx tsc --noEmit` -> 0 (qa-tsc.log, empty)
- `npx eslint .` -> 0 errors / 366 warnings, matches TL "pre-existing" count (qa-eslint.log)
- `npx vitest run` -> 0, 54 files / 1124 tests (qa-vitest.log)
- `npm run test:security` -> 0, 4/4 (qa-security.log)
- `next build` -> exit 1 (qa-build.log): `Route "/audit-queue": uncached or runtime data during prerendering` -> `Export encountered an error on /audit-queue/page, exiting the build`, worker code 1
- `npm run test:e2e` -> not run (needs dev server + seeded Supabase auth; moot while build fails)

## Criteria coverage (PLAN.md)
1. OK — `auth.getUser()` gone from src; `getClaims()` in proxy.ts:29 + identity.ts:36; `realEmail`/`currentUser`/`viewAsState` wrapped in React `cache()`. 150ms latency not measurable locally.
2. OK — `buildJobEnv` loads only `opts.tables`; `prefetchTables()` lazy; `job-tph-hourly` route uses `{roster:false}` + 2 tables.
3. OK — filtered reads in stores.ts (`readStoreFiltered`), tph/page.ts (`gte('date',lo)`), queue jobs/pages, qa `qaRowBy_`; freshchat full read intentionally unfiltered (documented, TL S03-03).
4. OK — `updateRows` = 1 `.in()` select + 1 upsert (repo.ts:203-247); `resolvePopups` single `.update()`. Test evidence: tests/platform/repo.test.ts asserts call counts + 42P10 fallback.
5. OK — `/api/popups` GET returns `{popups,alerts,now}` off one `currentEmail()`; `OneOnOneAlerts` consumes `incoming` prop; POST /api/alerts/one-on-one kept for dismiss.
6. OK — `__CC_BOOT__` emitted in layout.tsx via shared `getAppBootstrap` (also backs /api/bootstrap); options lazy via `/api/options/<key>` — BUT see qa-1.
7. OK — 5 migration files match PLAN list verbatim (uniques prod_daily_layers(date,email,layer), queue_submissions(slot_date,slot); all 11 named indexes; dedupe pre-flights with survivor rules).
8. OK — `db()`/`supabase` singleton now service-role (lib/supabase.ts:8); RLS lockdown file drops `app_all` + re-enables RLS, no policies; no client-side `.from(` (all `Array.from`); security spec mocks `getClaims`.
9. PARTIAL — reminders + tph-hourly scheduled; past-days `budgetMs:55_000`; but `job-data-tick` daily, not `*/15` -> qa-2.
10. OK — `app_cache` table + `dbCacheGet/Put/Remove`; myday `asCachedPart_`/`asClearCache_` migrated.
11. FAIL — build gate (qa-1).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| qa-1 | BLOCKER | src/app/layout.tsx:21 | `RootLayout` is now `async` and awaits `getAppBootstrap` -> `createAuthClient` -> `cookies()`; with `cacheComponents: true` every route fails prerender ("uncached or runtime data"), first at `/audit-queue`; `next build` exits 1 (qa-build.log:15-31). Attribute: f1d731a did not touch layout. | Opt the app out of instant prerender per the build error's block hint — `export const instant = false` in `src/app/layout.tsx` (every route is behind auth anyway), or move the data access behind `<Suspense>`/`connection()` per `node_modules/next/dist/docs` blocking-prerender guidance. | dev |
| qa-2 | MED | vercel.json:221-222 | Criterion 9 specifies `job-data-tick` `*/15`; shipped schedule is daily `0 5 * * *` (c0f3908: "Hobby plan rejects */15", ARCHITECTURE.md:38 documents cap). Route docstring still says "every 15 min" — delta sync/queue aging/check-in snapshots now run once/day. | PM decision: amend PLAN criterion to daily (update route docstring) or get sub-daily scheduling another way (Vercel Pro / pg_cron cutover / external scheduler). | dev |
| qa-3 | LOW | src/features/shared/lib/auth.ts:26 | `getUser` now returns a stub `{ email }` — silently drops id/metadata vs the real `User` type; `getUser`/`requireAuth` were already only referenced by tests. Future callers will mis-handle. | Delete `getUser`/`requireAuth` (test-only) or annotate return type `{email:string}\|null` + doc comment. | dev |
| qa-4 | LOW | src/features/shared/shell/context.ts:113-122 | `pollTick` fabricates `now` from the client clock while `/api/popups` already returns server `now` (`oo.now`) — field ignored, skew possible for soon->start promotion. | Return `data.now` from the payload instead of `new Date().toISOString()`. | dev |

Not verified / assumptions:
- Perf budgets (bootstrap <=150ms warm, tph payload <500KB, prod_intervals ~0 scans) are post-deploy metrics — unverifiable here.
- 5 migrations are FILES ONLY; remote apply is NEEDS_APPROVAL (order matters; lockdown last). RLS deny-all unverifiable until applied.
- `popups.recipient`/`queue_submissions` eq filters assume stored values are normalized (raisePopup writes `normEmail`); legacy mixed-case rows, if any, would be missed.
- `viewAsState(fresh)` inside React `cache()` keeps VA_MEMO TTL semantics; per-request memo confirmed against Next docs convention in PLAN.
- `admin/migrate/route.ts:8` still creates a service-role client at module top level (pre-existing, outside this diff).
- `.qa-tmp/` empty dir left untracked in repo root — not part of diff; remove if stray.
