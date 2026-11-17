# TRACKER: qa-live-sheets-freeze
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (pre-existing, NOT ours — never revert):
- M src/app/cx-kit.css, refresh.css, styles/{desk,operations,people,productivity,quality,queue}.css (parallel workstream)
- ?? nul, ?? scripts/ops/probe-sync-health.ts, ?? tests/css-form-guards.test.ts
- ?? specs/{aging-stale-status/reports,e2e-contract-green,holform-overlap-sweep,qa-live-sheets-freeze}
- ?? supabase/migrations/20261116175742_drop_dead_and_mirror_only_tables.sql (pending; drops aux_spans)
- M src/features/shared/platform/bootstrap.ts (appeared mid-run; parallel workstream, not any leaf)

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | done | all 4 children done |
| S01-01 | mini/S01 | dev | none | 2/5/200/10 | PASS | done | results/S01-01.md; vitest 5/5; 2 files scoped |
| S01-02 | mini/S01 | dev | S01-01 | 3/6/80/10 | PASS | done | results/S01-02.md; tsc 0; 3 files scoped |
| S01-03 | mini/S01 | dev | S01-02 | 6/7/40/10 | PASS | done | results/S01-03.md; 6 files scoped, tsc 0 |
| S01-04 | mini/S01 | test-engineer | S01-03 | 1/4/160/10 | PASS | done | results/S01-04.md; scan gate green, probe-fail sanity verified |
| S02 | package/- | - | - | n/a | not dispatchable | done | S02-03+S02-02 done; 8 tabs synthesize; tests green |
| S02-01 | mini/S02 | dev | none | 2/7/400/10 | FAIL | superseded | context 6 ptrs > 5; replaced by S02-03 |
| S02-03 | mini/S02 | dev | none | 2/7/400/10 | PASS | done | results/S02-03.md + S02-03-fix1.md (eslint: dropped cx-productivity/tph import -> local tphHourMs_ over shared dqWallToUtc_); vitest 13/13; tsc 0 |
| S02-02 | mini/S02 | dev | S02-03 | 2/7/400/10 | PASS | done | results/S02-02.md; vitest 13/13; tsc 0; all 8 tabs synthesize |
| S03 | package/- | - | - | n/a | not dispatchable | done | S03-01 done; env.ts zero sheet refs; freeze-scan EXPECTED updated for exempt seed script |
| S03-01 | mini/S03 | dev | S01-02, S02 | 2/7/250/10 | PASS | done | results/S03-01.md; tests/jobs 115/115; tsc 0; fetchWorkbookTabs/googleapis refs = 0 in env.ts |
| S11 | package/- | - | - | n/a | not dispatchable | done | both children done; remote apply + prod seed run = PM handoffs |
| S11-01 | mini/S11 | supabase-expert | none | 1/3/30/8 | PASS | done | results/S11-01.md; 20261116204115_recreate_aux_spans.sql; replayed clean on scratch pg (5 cols+idx+RLS, 0 rows); remote apply = PM db push |
| S11-02 | mini/S11 | dev | none | 2/6/220/10 | PASS | done | results/S11-02.md; tsc 0; 1 approved SHEETS_FREEZE_VIOLATION; prod seed run env-blocked -> PM handoff |
| S07 | package/- | - | - | n/a | not dispatchable | done | children done; remote apply pending |
| S07-01 | mini/S07 | supabase-expert | none | 1/3/80/10 | PASS | done | results/S07-01.md; 20261116202604_recreate_dq_hct.sql (15 cols+synced_at, uniq email, RLS/no-policies); remote apply pending |
| S07-02 | mini/S07 | dev | S07-01, S01-03 | 2/6/220/10 | PASS | done | results/S07-02.md; 21/21 vitest; hand-back contract recorded |
| S08 | package/- | - | - | n/a | not dispatchable | done | S08-01 done |
| S08-01 | mini/S08 | dev | none | 1/4/30/10 | PASS | done | results/S08-01.md; route DB-only, tsc 0, grep 0 hits |
| S09 | package/- | - | - | n/a | not dispatchable | done | S09-01 done; remote apply pending |
| S09-01 | mini/S09 | supabase-expert | none | 2/6/200/10 | PASS | done | results/S09-01.md + S09-01-remote-cron.md; 20261116202809_pg_cron_scoped_wave1.sql (5 jobs, 0 literals); remote apply pending |
| fix-sec-1 | package/- | - | - | n/a | not dispatchable | done | reports/sec-1.md (1M fixed; 3L deferred) |
| sec1-01 | mini/fix-sec-1 | dev | none | 2/4/80/8 | PASS | done | results/sec1-01.md (repo-root results/); manualHct only at dqSyncRoster_; violation log for other callers; +3 spy tests, 13/13 |
| fix-data-1 | package/- | - | - | n/a | not dispatchable | done | all 3 children done; gate6 green (qe-fd-cache known-external) |
| data1-01 | mini/fix-data-1 | dev | none | 3/4/60/8 | PASS | done | results/data1-01.md; hmsToSec_ + L=days*1440; fixtures 90/86400; vitest 19/19; 3 scoped files |
| data1-02 | mini/fix-data-1 | dev | data1-01 (shares env-dbbook.test.ts) | 2/3/60/8 | PASS | done | results/data1-02.md; books[key]=first tab Error on any real error; tabErrors persistence removed; +1 partial-fail case; vitest 20/20 |
| data1-03 | mini/fix-data-1 | dev | none | 2/3/50/8 | PASS | done | results/data1-03.md; snapByEmail Map on dqCleanEmail_ last-wins; +1 collision case; vitest 7/7 |
| fix-perf-1 | package/- | - | - | n/a | not dispatchable | done | reports/perf-1.md; 4 leaves done; perf-1 resolved by user workstream mid-run |
| perf1-01 | mini/fix-perf-1 | dev | none | 1/1/5/5 | PASS | done | results/perf1-01.md (repo-root results/); maxDuration=300 at route.ts:14; tsc transient err was perf1-03 mid-flight |
| perf1-02 | mini/fix-perf-1 | supabase-expert | none | 1/3/30/8 | PASS | done | results/perf1-02.md (repo-root results/); 20261117123304_idx_qa_audits_audit_date.sql; plain CREATE INDEX IF NOT EXISTS (CONCURRENTLY illegal in runner txn); remote apply = PM batch |
| perf1-03 | mini/fix-perf-1 | dev | none | 2/3/40/8 | PASS | done | results/perf1-03.md (repo-root results/); fdAuxTab_(ctx) pk:ts_ms + tsBuild_(windowFor_); +1 filter assert; vitest 15/15 |
| perf1-04 | mini/fix-perf-1 | supabase-expert | none | 1/2/10/5 | PASS | done | results/perf1-04.md; scorecard '30 6'->'45 6' (:154) + header :18; aggregates untouched; ships with pending db push |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| spec/S02.md#S02-01 | Context pointers 6 > 5 (read-only source/doc limit) | S02-03 (context deduped to 5, same scope) | resolved — S02-03 done |

## Spec gaps (approved scope with NO leaf — for PM/spec-architect)
- RESOLVED: aux_spans recreate-empty -> spec'd as S11-01, done (20261116204115_recreate_aux_spans.sql).
- RESOLVED: prod_assumptions seed + admin control -> spec'd as S11-02, code done; prod seed run = PM handoff.
- Remote `supabase db push` apply for new migrations: approved by user; leaf contracts leave apply outside scope (PM/deploy step, verify `Target:` + `env -u SUPABASE_ACCESS_TOKEN`).

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit` | PASS 0 errors |
| 1 | lint | `npx eslint .` | PASS 0 errors; 5 pre-existing warnings (untouched files) |
| 1 | unit | `npx vitest run` | 1425/1426; 1 FAIL tests/quality/qe-fd-cache.test.ts — cx-quality engine-live domain, no leaf file in import graph (pre-existing/parallel workstream) |
| 2 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate2-tsc.log) |
| 2 | lint | `npx eslint .` | FAIL 1 error — dbbook.ts restricted cx-productivity import -> S02-03 fix1 (gate2-eslint.log) |
| 2 | unit | `npx vitest run` | 1441/1443; FAIL qe-fd-cache (known) + sheets-freeze-scan allowlist missed exempt seed script -> S01-04 fix1 (gate2-vitest.log) |
| 3 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate3-tsc.log) |
| 3 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate3-eslint.log) |
| 3 | unit | `npx vitest run` | 1442/1443; 1 FAIL tests/quality/qe-fd-cache.test.ts — known parallel-workstream failure (gate3-vitest.log) |
| 4 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate4-tsc.log) |
| 4 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate4-eslint.log) |
| 4 | unit | `npx vitest run` | 1444/1445; sole FAIL qe-fd-cache.test.ts — known-external (gate4-vitest.log) |
| 5 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate5-tsc.log) |
| 5 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate5-eslint.log) |
| 5 | unit | `npx vitest run` | 1447/1448; sole FAIL qe-fd-cache.test.ts — known-external; +3 sec1-01 cases pass (gate5-vitest.log) |
| 6 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate6-tsc.log) |
| 6 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate6-eslint.log) |
| 6 | unit | `npx vitest run` | 1449/1450; sole FAIL qe-fd-cache.test.ts — known-external; +2 fix-data-1 cases pass (gate6-vitest.log) |
| 7 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate7-tsc.log) — incl. user's migrate.ts hand-back fix |
| 7 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate7-eslint.log) |
| 7 | unit | `npx vitest run` | 1449/1450; sole FAIL qe-fd-cache.test.ts — known-external; +1 perf1-03 FD_AUX bound case (gate7-vitest.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 MED dbbook blanket catch | reports/qa-1.md | qa1-01 (dev) | done | results/qa1-01.md; missingOk_ helper, 7 sites, 15/15 vitest |
| qa-2 LOW stray `nul` | reports/qa-1.md | qa1-02 (dev) | done | results/qa1-02.md; file deleted |
| qa-3 LOW stray probe-sync-health.ts | reports/qa-1.md | qa1-02 (dev) | done | results/qa1-02.md; deleted (adopt rejected — recon done) |
| qa-4 LOW stale env.ts EXPECTED entry | reports/qa-1.md | qa1-03 (test-engineer) | done | results/qa1-03.md; scan test 2/2 |
| sec-1 MED manualHct baked in dqReadHct_ | reports/sec-1.md | sec1-01 (dev) | done | results/sec1-01.md; dqReadHct_(opts?) logs [SHEETS_FREEZE_VIOLATION] w/o manualHct; qaActiveEmails_ try/catch verified -> fail-open null, no grandfather |
| sec-2 LOW mirrors peek oracle/unbounded slice | reports/sec-1.md | dev | deferred | wave-2 per owner note (grandfathered wave-1, logged) |
| sec-3 LOW list-sheets/qaFirstSheetRows_ googleapis seams | reports/sec-1.md | dev | deferred | wave-2 de-sheeting per owner note; pinned in scan EXPECTED |
| sec-4 LOW dq_hct upsert NULL/empty-email dup rows | reports/sec-1.md | data-engineer | deferred | owner fix says "before remote apply" — remote apply still pending; flagged to PM in tl-4 |
| data-1 HIGH 'Maqsam Calls' L fractional-days not minutes + dead duration fallback | reports/data-1.md | data1-01 (dev) | done | spec/fix-data-1.md#data1-01; results/data1-01.md |
| data-2 MED env.ts tabErrors pocketed -> silent-empty grids | reports/data-1.md | data1-02 (dev) | done | spec/fix-data-1.md#data1-02; results/data1-02.md |
| data-3 LOW same-batch cleaned-email upsert conflict | reports/data-1.md + reports/sec-2.md sec-5 | data1-03 (dev) | done | spec/fix-data-1.md#data1-03; results/data1-03.md; closes sec-5 too |
| data-4 LOW stale mirrors.ts docstring | reports/data-1.md | - | deferred | not routed by PM; LOW doc-only |
| perf-1 HIGH unbounded readRows + per-row UPDATEs in qaReconcileQueueLog_ | reports/perf-1.md | user (cx-quality/**) | hand-back -> resolved-by-user | USER HAND-BACK recorded per plan precedent; user workstream then landed the fix mid-run (migrate.ts +25/-6: bounded readAllPaged w/ state!=audited + kind/submitted_at/status filters, grouped .in() updates) — evidence specs/.../results/fix-perf-1.md + gate7 tsc/eslint green |
| perf-2 MED no maxDuration on job-qa-engine route | reports/perf-1.md | perf1-01 (dev) | done | results/perf1-01.md; route.ts:14 maxDuration=300 |
| perf-3 LOW qa_audits audit_date seq-scan | reports/perf-1.md | perf1-02 (supabase-expert) | done | results/perf1-02.md; 20261117123304_idx_qa_audits_audit_date.sql; remote apply pending PM batch |
| perf-4 LOW fdAuxTab_ unbounded aux_spans read | reports/perf-1.md | perf1-03 (dev) | done | results/perf1-03.md; pk:ts_ms + window bound; vitest 15/15 |
| perf-5 LOW two heavy pg_cron jobs same minute | reports/perf-1.md | perf1-04 (supabase-expert) | done | results/perf1-04.md; scorecard '45 6 * * *'; edit-in-place valid (migration still unapplied) |

## Blocked / needs user
- Remote apply pending (pre-approved per task; PM/deploy executes): `supabase db push` will apply 20261116175742 + 20261116202604_recreate_dq_hct + 20261116202809_pg_cron_scoped_wave1 (now with staggered scorecard 06:45) + 20261116204115_recreate_aux_spans + 20261117123304_idx_qa_audits_audit_date. Verify `Target:` + `env -u SUPABASE_ACCESS_TOKEN`.
- NEEDS_APPROVAL/USER: remote `app.settings.app_url` + `app.settings.cron_secret` are BOTH UNSET (S09-01 evidence) — pg_cron jobs fail loudly until provisioned via ALTER DATABASE; values sourced from Vercel env (never print secrets). Not covered by a leaf.
- prod_assumptions seed VALUES {mq,text,wa}: S11-02 code done; prod seed run env-blocked (placeholder GOOGLE_PRIVATE_KEY) -> PM runs `npx tsx --tsconfig scripts/tsconfig.json scripts/ops/seed-prod-assumptions.ts` with real prod env (leaf-approved handoff).
