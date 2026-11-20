# TRACKER: ctls-page-cleanup
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass.

Baseline dirty tree at start (pre-existing, do not revert):
- `?? scripts/ops/qa-ctls-check.ts`
- `?? scripts/ops/qa-ctls-sync.ts`
- `?? specs/ctls-page-cleanup/`

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | mixed | - | n/a | not dispatchable | verified | all children done; integration gates below |
| S01-01 | mini/S01 | supabase-expert | none | 1/3/80/10 | PASS | verified | results/S01-01.md; supabase/migrations/20261120121758_close_historical_ctls.sql; auto-applies on merge |
| S01-02 | mini/S01 | dev | none | 4/6/170/10 | PASS | verified | results/S01-02.md; 4 files, +18/-6 src + new test; vitest 4/4, tsc clean |
| S01-03 | mini/S01 | dev | S01-02 | 2/4/70/10 | PASS | verified | results/S01-03.md; 2 files +21/-3; tsc+eslint clean |
| qa1-01 | mini/fix-qa-1 | supabase-expert | none | 1/3/30/10 | PASS | verified | results/qa1-01.md; 1 file, submitted_at+sla_met guarded casts; scoped diff verified |
| ux1-01 | mini/fix-ux-1 | dev | none | 1/3/15/5 | PASS | verified | results/ux1-01.md; 1 file +1 line (`c.canClose &&` in findOpenCtls); scoped diff verified |
| adm1-01 | mini/fix-adm-1 | dev | none | 2/3/30/5 | PASS | verified | results/adm1-01.md; admin disjunct dropped + admin test case; vitest 4/4; scoped diff verified |
| adm1-02 | mini/fix-adm-1 | dev | none | 1/1/10/5 | PASS | verified | results/adm1-02.md; `n ?` toolbar guard (1 line); tsc clean; scoped diff verified |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit` | PASS (logs/tsc.log) |
| 1 | unit | `npx vitest run tests/quality/qa-ctl-scope.test.ts` | PASS 4/4 (logs/vitest.log) |
| 1 | lint | `npm run lint` | FAIL: 1 pre-existing error in untouched `tests/golden/queue-aggregates.test.ts:123` (no-explicit-any) + 7 baseline warnings; changed files clean (logs/lint.log) |
| 2 | typecheck | `npx tsc --noEmit` | PASS (logs/tsc-r2.log) |
| 2 | unit | `npx vitest run tests/quality/qa-ctl-scope.test.ts` | PASS 4/4 (logs/vitest-r2.log) |
| 2 | lint | `npm run lint` | same baseline: 1 pre-existing error `tests/golden/queue-aggregates.test.ts:123` + 7 warnings; changed file clean (logs/lint-r2.log) |
| 2 | security | `npm run test:security` | PASS 4/4 (logs/sec-r2.log) |
| 3 | typecheck | `npx tsc --noEmit` | PASS (logs/tsc-r3.log) |
| 3 | unit | `npx vitest run tests/quality/qa-ctl-scope.test.ts` | PASS 4/4 (logs/vitest-r3.log) |
| 3 | lint | `npm run lint` | same baseline: 1 pre-existing error `tests/golden/queue-aggregates.test.ts:123` + 7 warnings; changed files clean (logs/lint-r3.log) |
| 3 | security | `npm run test:security` | PASS 4/4 (logs/sec-r3.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 (MED): unguarded timestamptz cast + lexicographic sla_met on sheet dates | reports/qa-1.md | qa1-01 -> supabase-expert | verified | results/qa1-01.md; guarded `~ '^\d{4}-\d{2}-\d{2}'` casts + parsed-date sla_met |
| qa-2 (LOW): shift-reason copy wrong under scope 'all' | reports/qa-1.md | - | deferred | LOW -> deferred per FIX rules |
| ux-1 (MED): ref lookup ignores canClose -> dead-end submit | reports/ux-1.md | ux1-01 -> dev | verified | results/ux1-01.md; `c.canClose &&` added to findOpenCtls; tsc+vitest+sec clean |
| ux-2 (LOW): empty-state copy wrong under scope 'all' | reports/ux-1.md | - | deferred | LOW -> deferred per FIX rules |
| ux-3 (LOW): shift-reason meta line wrong under scope 'all' (same as qa-2) | reports/ux-1.md | - | deferred | LOW -> deferred per FIX rules |
| ux-4 (LOW): no busy affordance on list during scope refetch | reports/ux-1.md | - | deferred | LOW; optional, logged-only for parity with sibling |
| F1 (blocking): admin bypass in qaCtlScopeVisible_ | reports/fix-admin-scope.md | adm1-01 -> dev | verified | results/adm1-01.md; `scope==='all' \|\| tl_email===me` for all roles |
| F2 (blocking): Seg hidden for admins | reports/fix-admin-scope.md | adm1-02 -> dev | verified | results/adm1-02.md; `n ?` guard; Seg renders for admins |
| F3 (blocking): admin test expectations | reports/fix-admin-scope.md | adm1-01 -> dev | verified | bundled with adm1-01; vitest 4/4 |

## Blocked / needs user
- Migration `20261120121758_close_historical_ctls.sql` auto-applies on merge to main (AGENTS.md); no manual remote run needed.
- Baseline lint error `tests/golden/queue-aggregates.test.ts:123` predates this diff — flagged to PM, not fixed (out of shard scope).
