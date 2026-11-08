# TL report 1 — perf-remediation BUILD

## Status: ALL 28 mini-leaves DONE; integration gates green
Every `Kind: mini` leaf in `spec/00-index.md` dispatched, completed and verified.
No RESHARD_NEEDED, no deferred, no blocked leaves.

## Waves (max 4 workers, disjoint files; same-file writers serial)
- W1: S02-01, S01-02, S04-01, S07-01
- W2: S02-03, S03-01, S08-01, S07-02
- W3: S07-03, S09-02, S08-02, S08-03
- W4: S08-02 fix, S10-01, S04-02, S06-01
- W5: S01-02 mock fix, S08-04, S05-01, S10-02
- W6: S05-02, S06-02, S03-02, S03-05a
- W7: S02-06, S03-03, S03-04, S03-05b
- W8: S01-01, S02-02, S02-04, S02-05; then S09-01, S11-01

## Integration gates (TL checkpoint)
- `npx tsc --noEmit` — PASS (0 errors)
- `npx vitest run` — PASS (54 files, 1123/1123)
- `npx eslint .` — PASS (0 errors; 366 pre-existing warnings)
- `npm run test:security`, `next build`, perf budgets — PM gates, not run here.

## Fixes routed back (max 2 attempts, all resolved)
- S08-02: stale auth-client mock in tests/jobs/run-step-errors.test.ts -> mock retargeted to db(); 82/82.
- S01-02 fallout: hub-fakes.ts + security.spec.ts lacked getClaims (and ilike for the roster filter) -> mocks extended; golden+security 890/890.
- S04-01: `no-explicit-any` in new repo.test.ts suite -> typed FakeBuilder; eslint 0.
- S06-01: bootstrap.ts imported cx-quality (no-restricted-imports) -> getAppBootstrap(loadQuality) DI; callers pass qaBootFlags; eslint 0.

## Changed files (ours only; dabdoob-refresh dirty baseline untouched)
- src/proxy.ts; src/app/layout.tsx; src/app/api/{bootstrap,popups,alerts/one-on-one}/route.ts; api/tph/* (8 routes); api/prod/* (5); api/admin/{mirrors,source-health}; api/cron/job-tph-{hourly,past-days}
- src/features/shared/{lib/supabase.ts,lib/auth.ts,lib/auth.test.ts,platform/{repo,identity,viewas,popups,stores,notify,bootstrap,shared-cache,index?}.ts,jobs/env.ts,shell/context.ts,components/shell/{Popups,OneOnOneAlerts}.tsx}
- src/features/cx-productivity/{jobs/{productivity,tph,backfill,quarterly}.ts,lib/tph/{page,write,run,index}.ts}
- src/features/cx-queue/lib/{jobs,server,pages}.ts; src/features/cx-quality/lib/server.ts; src/features/cx-hub/lib/myday.ts
- tests/platform/repo.test.ts; tests/jobs/run-step-errors.test.ts; tests/golden/hub-fakes.ts; tests/security/security.spec.ts
- vercel.json; docs/ARCHITECTURE.md
- supabase/migrations/20261108204952_dedupe_uniques_*.sql, 20261108205258_lookup_indexes_prod_*.sql, 20261108205536_lookup_indexes_tickets_*.sql, 20261108205645_app_cache_table.sql, 20261108205852_rls_lockdown_*.sql

## NEEDS_APPROVAL (remote DB apply — user must approve; order matters)
1. 20261108204952 dedupe+uniques (deletes duplicate rows)
2. 20261108205258 + 20261108205536 indexes (CONCURRENTLY — no transaction)
3. 20261108205645 app_cache table
4. 20261108205852 RLS lockdown — apply ONLY after service-role code deploys

## Notes for PM
- S02-06 audit: all 5 non-prod env routes CLEAN (no prefetch needed).
- S03-03: freshchat inflow read intentionally left unfiltered (ts_ms != counted field); documented in results.
- S08-01 kept `supabase` as a lazy Proxy for 11 route consumers (contract-allowed).
- No shard asked for reviewers/devops; none spawned.
- TRACKER: specs/perf-remediation/TRACKER.md
