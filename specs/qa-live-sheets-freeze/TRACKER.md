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
| S01 | package/- | - | - | n/a | not dispatchable | verified | all 4 children done |
| S01-01 | mini/S01 | dev | none | 2/5/200/10 | PASS | verified | results/S01-01.md; vitest 5/5; 2 files scoped |
| S01-02 | mini/S01 | dev | S01-01 | 3/6/80/10 | PASS | verified | results/S01-02.md; tsc 0; 3 files scoped |
| S01-03 | mini/S01 | dev | S01-02 | 6/7/40/10 | PASS | verified | results/S01-03.md; 6 files scoped, tsc 0 |
| S01-04 | mini/S01 | test-engineer | S01-03 | 1/4/160/10 | PASS | verified | results/S01-04.md; scan gate green, probe-fail sanity verified |
| S02 | package/- | - | - | n/a | not dispatchable | verified | S02-03+S02-02 done; 8 tabs synthesize; tests green |
| S02-01 | mini/S02 | dev | none | 2/7/400/10 | FAIL | superseded | context 6 ptrs > 5; replaced by S02-03 |
| S02-03 | mini/S02 | dev | none | 2/7/400/10 | PASS | verified | results/S02-03.md + S02-03-fix1.md (eslint: dropped cx-productivity/tph import -> local tphHourMs_ over shared dqWallToUtc_); vitest 13/13; tsc 0 |
| S02-02 | mini/S02 | dev | S02-03 | 2/7/400/10 | PASS | verified | results/S02-02.md; vitest 13/13; tsc 0; all 8 tabs synthesize |
| S03 | package/- | - | - | n/a | not dispatchable | verified | S03-01 done; env.ts zero sheet refs; freeze-scan EXPECTED updated for exempt seed script |
| S03-01 | mini/S03 | dev | S01-02, S02 | 2/7/250/10 | PASS | verified | results/S03-01.md; tests/jobs 115/115; tsc 0; fetchWorkbookTabs/googleapis refs = 0 in env.ts |
| S11 | package/- | - | - | n/a | not dispatchable | verified | both children done; remote apply + prod seed run = PM handoffs |
| S11-01 | mini/S11 | supabase-expert | none | 1/3/30/8 | PASS | verified | results/S11-01.md; 20261116204115_recreate_aux_spans.sql; replayed clean on scratch pg (5 cols+idx+RLS, 0 rows); remote apply = PM db push |
| S11-02 | mini/S11 | dev | none | 2/6/220/10 | PASS | verified | results/S11-02.md; tsc 0; 1 approved SHEETS_FREEZE_VIOLATION; prod seed run env-blocked -> PM handoff |
| S07 | package/- | - | - | n/a | not dispatchable | verified | children done; remote apply pending |
| S07-01 | mini/S07 | supabase-expert | none | 1/3/80/10 | PASS | verified | results/S07-01.md; 20261116202604_recreate_dq_hct.sql (15 cols+synced_at, uniq email, RLS/no-policies); remote apply pending |
| S07-02 | mini/S07 | dev | S07-01, S01-03 | 2/6/220/10 | PASS | verified | results/S07-02.md; 21/21 vitest; hand-back contract recorded |
| S08 | package/- | - | - | n/a | not dispatchable | verified | S08-01 done |
| S08-01 | mini/S08 | dev | none | 1/4/30/10 | PASS | verified | results/S08-01.md; route DB-only, tsc 0, grep 0 hits |
| S09 | package/- | - | - | n/a | not dispatchable | verified | S09-01 done; remote apply pending |
| S09-01 | mini/S09 | supabase-expert | none | 2/6/200/10 | PASS | verified | results/S09-01.md + S09-01-remote-cron.md; 20261116202809_pg_cron_scoped_wave1.sql (5 jobs, 0 literals); remote apply pending |
| fix-sec-1 | package/- | - | - | n/a | not dispatchable | verified | reports/sec-1.md (1M fixed; 3L deferred) |
| sec1-01 | mini/fix-sec-1 | dev | none | 2/4/80/8 | PASS | verified | results/sec1-01.md (repo-root results/); manualHct only at dqSyncRoster_; violation log for other callers; +3 spy tests, 13/13 |
| fix-data-1 | package/- | - | - | n/a | not dispatchable | verified | all 3 children done; gate6 green (qe-fd-cache known-external) |
| data1-01 | mini/fix-data-1 | dev | none | 3/4/60/8 | PASS | verified | results/data1-01.md; hmsToSec_ + L=days*1440; fixtures 90/86400; vitest 19/19; 3 scoped files |
| data1-02 | mini/fix-data-1 | dev | data1-01 (shares env-dbbook.test.ts) | 2/3/60/8 | PASS | verified | results/data1-02.md; books[key]=first tab Error on any real error; tabErrors persistence removed; +1 partial-fail case; vitest 20/20 |
| data1-03 | mini/fix-data-1 | dev | none | 2/3/50/8 | PASS | verified | results/data1-03.md; snapByEmail Map on dqCleanEmail_ last-wins; +1 collision case; vitest 7/7 |
| fix-perf-1 | package/- | - | - | n/a | not dispatchable | verified | reports/perf-1.md; 4 leaves done; perf-1 resolved by user workstream mid-run |
| perf1-01 | mini/fix-perf-1 | dev | none | 1/1/5/5 | PASS | verified | results/perf1-01.md (repo-root results/); maxDuration=300 at route.ts:14; tsc transient err was perf1-03 mid-flight |
| perf1-02 | mini/fix-perf-1 | supabase-expert | none | 1/3/30/8 | PASS | verified | results/perf1-02.md (repo-root results/); 20261117123304_idx_qa_audits_audit_date.sql; plain CREATE INDEX IF NOT EXISTS (CONCURRENTLY illegal in runner txn); remote apply = PM batch |
| perf1-03 | mini/fix-perf-1 | dev | none | 2/3/40/8 | PASS | verified | results/perf1-03.md (repo-root results/); fdAuxTab_(ctx) pk:ts_ms + tsBuild_(windowFor_); +1 filter assert; vitest 15/15 |
| perf1-04 | mini/fix-perf-1 | supabase-expert | none | 1/2/10/5 | PASS | verified | results/perf1-04.md; scorecard '30 6'->'45 6' (:154) + header :18; aggregates untouched; ships with pending db push |
|| W2-SC | package/- | - | - | n/a | not dispatchable | verified | all 4 children done; gate8 green; rg sheets-syms in cx-people = 0 |
|| W2-SC-01 | mini/W2-SC | dev | none | 2/5/350/10 | PASS | verified | results/W2-SC-01.md; scDailyRowsDb_ + 3 vitest cases green; tsc clean on touched files |
|| W2-SC-02 | mini/W2-SC | dev | W2-SC-01 | 3/8/320/10 | PASS | verified | results/W2-SC-02.md; DB rebuild + scMergeFcr_ preserve; sheet readers/gates deleted; vitest 43/43; tsc 0 (attempt 2) |
|| W2-SC-03 | mini/W2-SC | dev | W2-SC-02 | 3/5/180/8 | PASS | verified | results/W2-SC-03.md; addBehaviourCase + op:'add_behaviour'; 23505->duplicate; vitest 3/3; tsc 0 |
|| W2-SC-04 | mini/W2-SC | dev | W2-SC-03 | 1/4/180/8 | PASS | verified | results/W2-SC-04.md; found panel gone; behaviour form posts add_behaviour; tsc+eslint 0 |
|| W2-HM | package/- | - | - | n/a | not dispatchable | verified | HM-01/02 + fix1 done; fetchWorkbookTabs/priorRegression/RegTable = 0 in cx-queue |
|| W2-HM-01 | mini/W2-HM | dev | none | 3/8/400/10 | PASS | verified | results/W2-HM-01.md; 5 DB grids + db_mirrors provenance; regression retired; vitest 3/3; viewas-sweep fallout -> fix1 |
|| W2-HM-01-fix1 | mini/W2-HM | dev | W2-HM-01 | 1/1/4/3 | n/a (fix leaf) | verified | results/W2-HM-01-fix1.md; tsc 0 errors; viewas-sweep 65/65 |
|| W2-HM-02 | mini/W2-HM | dev | W2-HM-01 | 1/4/80/6 | PASS | verified | agent exited silently (no results file); TL-verified: RegTable/priorRegression/ss-id input 0 hits, AdminBuild = contract, eslint 0 |
|| W2-TLQ | package/- | - | - | n/a | not dispatchable | verified | W2-TLQ-01 done; TlqIo has no book member |
|| W2-TLQ-01 | mini/W2-TLQ | dev | none | 2/7/260/10 | PASS | verified | results/W2-TLQ-01.md; book seam/fc_messages/ol_sheet_id gone; golden 49/49; tsc clean on touched |
|| W2-ADM | package/- | - | - | n/a | not dispatchable | verified | all 3 leaves done; fetchWorkbookTabs/deferred/googleapis gone from touched files |
|| W2-ADM-01 | mini/W2-ADM | dev | none | 1/4/90/8 | PASS | verified | results/W2-ADM-01.md; peek->DB mirror cells, slice<=500, fetchWorkbookTabs/deferred 0 hits |
|| W2-ADM-02 | mini/W2-ADM | dev | none | 1/5/130/10 | PASS | verified | results/W2-ADM-02.md; data-feeds block (mirrors/prod_daily_layers/prod_assumptions/dq_hct); creds check kept; sheet imports gone |
|| W2-ADM-03 | mini/W2-ADM | dev | none | 2/3/60/5 | PASS | verified | results/W2-ADM-03.md; engine {deferred:true} x2 removed; list-sheets 410 stub; greps clean |
|| W2-FIX | package/- | - | - | n/a | not dispatchable | verified | both leaves done; closes sec-2(sec-1 LOW), data-4, perf-1 reconcile leftovers |
|| W2-FIX-01 | mini/W2-FIX | dev | none | 1/1/10/5 | PASS | verified | results/W2-FIX-01.md; docblock vendor-API wording; stale phrases 0 hits |
|| W2-FIX-02 | mini/W2-FIX | dev | none | 1/3/50/6 | PASS | verified | results/W2-FIX-02.md; catch(()=>[]) x2 removed; .in() chunked @100; tsc 0 |
|| W2-STRICT | package/- | - | - | n/a | not dispatchable | verified | strict flip live; deferred gone from SheetReadGateOpts + src/ |
|| W2-STRICT-01 | mini/W2-STRICT | dev | W2-SC-02, W2-HM-01, W2-TLQ-01, W2-ADM-01/02/03 | 4/7/160/10 | PASS | verified | results/W2-STRICT-01.md; guard log-then-throw; EXPECTED shrunk; 8/8 vitest; deferred: in src = 0 |
| fix-qa-5 | package/- | - | - | n/a | not dispatchable | verified | reports/qa-5.md; 4 findings -> 5 leaves all done; gate9 green |
| qa5-01 | mini/fix-qa-5 | dev | none | 2/3/80/8 | PASS | verified | results/qa5-01.md; columns projection + snake reads; snake fixtures; vitest 6/6; tsc clean |
| qa5-02 | mini/fix-qa-5 | dev | none | 2/3/60/8 | PASS | verified | results/qa5-02.md; tickets+tracker_records via readAllPaged (pk row_n); vitest 3/3; tsc clean |
| qa5-03 | mini/fix-qa-5 | dev | qa5-02 (heatmap.ts + hm-db-source.test.ts serial) | 2/2/25/5 | PASS | verified | results/qa5-03.md; bot-gap note in buildHeatmapFromSource; engine untouched; 51/51 incl. golden |
| qa5-04 | mini/fix-qa-5 | dev | none | 6/2/10/3 | PASS | verified | results/qa5-04.md; 6 W2 files moved to spec results/ |
| qa5-05 | mini/fix-qa-5 | dev | none | 5/2/10/3 | PASS | verified | results/qa5-05.md; 5 W2 files moved; repo-root results/ free of ?? strays |
| fix-data-3 | package/- | - | - | n/a | not dispatchable | verified | reports/data-3.md; 3 leaves done (data-6/7/8); data-9..12 LOW deferred; gate10 green |
| data3-01 | mini/fix-data-3 | dev | none | 2/3/40/6 | PASS | done | results/data3-01.md; fcr_dated=merged.fcrRows>0 :569; upsert-type asserts; vitest 7/7; tsc 0 |
| data3-02 | mini/fix-data-3 | dev | data3-01 (scorecard-server.ts + sc-daily-db.test.ts serial) | 2/3/40/6 | PASS | done | results/data3-02.md; predicate = qaRollupAudits_ verbatim (:269-270); disputed/kind'' cases; 7/7; tsc 0 |
| data3-03 | mini/fix-data-3 | data-engineer | none | 2/3/120/8 | PASS | done | results/data3-03.md; tlqIo_ exported; both reads paged (:617-626); tlq-io-paged.test.ts new; 51/51; tsc 0 |
| fix-perf-3 | package/- | - | - | n/a | not dispatchable | done | reports/perf-3.md; 5 leaves done (4 landed + 1 justified no-op); gate11 green |
| perf3-01 | mini/fix-perf-3 | dev | none | 4/5/140/10 | PASS | done | results/perf3-01.md; attempt2: 4 call sites pass range, scReadRange_ bounds + bhvLog gte/lte, +scIo_ bound/parity cases; 66/66 vitest; tsc 0 |
| perf3-02 | mini/fix-perf-3 | dev | perf3-01 (scorecard-server.ts serial) | 1/2/10/4 | PASS | done | results/perf3-02.md; 6-col projection :248; sc-daily-db 7/7; tsc 0 |
| perf3-03 | mini/fix-perf-3 | dev | none | 2/4/30/8 | PASS | done | agent exited silently (no results file); TL-verified: fallback docblock heatmap.ts:574-585, submitted_at NULL for all WA rows (ops-tabs.ts:165) so gte would drop every row — bound disproven, not just unverifiable |
| perf3-04 | mini/fix-perf-3 | dev | perf3-03 (heatmap.ts serial) | 2/2/15/4 | PASS | done | agent exited silently (no results file); TL-verified: pk:'ts_ms' + .lt(ts_ms,toMs) heatmap.ts:604-605, pushed-lt/gte asserts :164-165; vitest 51/51 (perf3-04-vitest.log) |
| perf3-05 | mini/fix-perf-3 | supabase-expert | none | 1/3/20/6 | PASS | done | results/perf3-05.md; no-op satisfied-by-existing sc_daily_month_date_email_key (people.sql:315 UNIQUE month,date,email, leftmost month) |
| fix-ux-1 | package/- | - | - | n/a | not dispatchable | verified | reports/ux-1.md; 4 MED -> 4 leaves all done; gate12 green (ux-5/6/7 LOW deferred) |
| ux1-01 | mini/fix-ux-1 | dev | none | 1/1/4/3 | PASS | done | results/ux1-01.md; 'live data' @:981, 'raw tabs' 0 hits, eslint 0 |
| ux1-02 | mini/fix-ux-1 | dev | ux1-01 (heatmap-page.tsx serial) | 1/3/6/4 | PASS | done | results/ux1-02.md; role="alert" on :55/:101/:157; all 5 field-error covered, eslint 0 |
| ux1-03 | mini/fix-ux-1 | dev | none | 1/6/20/5 | PASS | done | results/ux1-03.md; rebuild vocabulary on all 6 contracted sites, eslint 0 |
| ux1-04 | mini/fix-ux-1 | dev | ux1-03 (agents-page.tsx serial) | 1/4/60/8 | PASS | done | results/ux1-04.md; behMsg/behMsgErr + runBehaviour; cx-note pair after form :503-512 |
| fix-ux-2 | package/- | - | - | n/a | not dispatchable | done | reports/ux-2.md; both leaves done; gate13 green |
| ux2-01 | mini/fix-ux-2 | dev | none | 1/8/12/6 | PASS | done | results/ux2-01.md; rebuild vocabulary at all 8 sites, eslint 0 |
| ux2-02 | mini/fix-ux-2 | dev | ux2-01 (agents-page.tsx serial) | 1/1/6/3 | PASS | done | results/ux2-02.md; error arm -> setNoteErr :293-295, eslint 0 |

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
|| 8 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate8-tsc.log) — wave-2 final integration |
|| 8 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate8-eslint.log) |
|| 8 | unit | `npx vitest run` | 1461/1462; sole FAIL qe-fd-cache.test.ts — known-external tolerated (gate8-vitest.log) |
| 9 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate9-tsc.log) |
| 9 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate9-eslint.log) |
| 9 | unit | `npx vitest run` | 1462/1463; sole FAIL qe-fd-cache.test.ts — known-external tolerated; +1 qa5-03 case (gate9-vitest.log) |
| 10 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate10-tsc.log) |
| 10 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate10-eslint.log) |
| 10 | unit | `npx vitest run` | 1465/1466; sole FAIL qe-fd-cache.test.ts — known-external tolerated; +3 fix-data-3 cases (gate10-vitest.log) |
| 11 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate11-tsc.log) — fix-perf-3 integration |
| 11 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate11-eslint.log) |
| 11 | unit | `npx vitest run` | 1467/1468; sole FAIL qe-fd-cache.test.ts — known-external tolerated; +scIo_ bound cases (gate11-vitest.log) |
| 12 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate12-tsc.log) — fix-ux-1 integration |
| 12 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate12-eslint.log) |
| 12 | unit | `npx vitest run` | 1467/1468; sole FAIL qe-fd-cache.test.ts — known-external tolerated (gate12-vitest.log) |
| 13 | typecheck | `npx tsc --noEmit` | PASS 0 errors (gate13-tsc.log) — fix-ux-2 integration |
| 13 | lint | `npx eslint .` | PASS 0 errors; same 5 pre-existing warnings, untouched files (gate13-eslint.log) |
| 13 | unit | `npx vitest run` | 1467/1468; sole FAIL qe-fd-cache.test.ts — known-external tolerated (gate13-vitest.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 MED dbbook blanket catch | reports/qa-1.md | qa1-01 (dev) | verified | results/qa1-01.md; missingOk_ helper, 7 sites, 15/15 vitest |
| qa-2 LOW stray `nul` | reports/qa-1.md | qa1-02 (dev) | verified | results/qa1-02.md; file deleted |
| qa-3 LOW stray probe-sync-health.ts | reports/qa-1.md | qa1-02 (dev) | verified | results/qa1-02.md; deleted (adopt rejected — recon done) |
| qa-4 LOW stale env.ts EXPECTED entry | reports/qa-1.md | qa1-03 (test-engineer) | verified | results/qa1-03.md; scan test 2/2 |
| sec-1 MED manualHct baked in dqReadHct_ | reports/sec-1.md | sec1-01 (dev) | verified | results/sec1-01.md; dqReadHct_(opts?) logs [SHEETS_FREEZE_VIOLATION] w/o manualHct; qaActiveEmails_ try/catch verified -> fail-open null, no grandfather |
| sec-2 LOW mirrors peek oracle/unbounded slice | reports/sec-1.md | dev | deferred | wave-2 per owner note (grandfathered wave-1, logged) |
| sec-3 LOW list-sheets/qaFirstSheetRows_ googleapis seams | reports/sec-1.md | dev | deferred | wave-2 de-sheeting per owner note; pinned in scan EXPECTED |
| sec-4 LOW dq_hct upsert NULL/empty-email dup rows | reports/sec-1.md | data-engineer | deferred | owner fix says "before remote apply" — remote apply still pending; flagged to PM in tl-4 |
| data-1 HIGH 'Maqsam Calls' L fractional-days not minutes + dead duration fallback | reports/data-1.md | data1-01 (dev) | verified | spec/fix-data-1.md#data1-01; results/data1-01.md |
| data-2 MED env.ts tabErrors pocketed -> silent-empty grids | reports/data-1.md | data1-02 (dev) | verified | spec/fix-data-1.md#data1-02; results/data1-02.md |
| data-3 LOW same-batch cleaned-email upsert conflict | reports/data-1.md + reports/sec-2.md sec-5 | data1-03 (dev) | verified | spec/fix-data-1.md#data1-03; results/data1-03.md; closes sec-5 too |
| data-4 LOW stale mirrors.ts docstring | reports/data-1.md | - | deferred | not routed by PM; LOW doc-only |
| perf-1 HIGH unbounded readRows + per-row UPDATEs in qaReconcileQueueLog_ | reports/perf-1.md | user (cx-quality/**) | hand-back -> resolved-by-user | USER HAND-BACK recorded per plan precedent; user workstream then landed the fix mid-run (migrate.ts +25/-6: bounded readAllPaged w/ state!=audited + kind/submitted_at/status filters, grouped .in() updates) — evidence specs/.../results/fix-perf-1.md + gate7 tsc/eslint green |
| perf-2 MED no maxDuration on job-qa-engine route | reports/perf-1.md | perf1-01 (dev) | verified | results/perf1-01.md; route.ts:14 maxDuration=300 |
| perf-3 LOW qa_audits audit_date seq-scan | reports/perf-1.md | perf1-02 (supabase-expert) | verified | results/perf1-02.md; 20261117123304_idx_qa_audits_audit_date.sql; remote apply pending PM batch |
| perf-4 LOW fdAuxTab_ unbounded aux_spans read | reports/perf-1.md | perf1-03 (dev) | verified | results/perf1-03.md; pk:ts_ms + window bound; vitest 15/15 |
| perf-5 LOW two heavy pg_cron jobs same minute | reports/perf-1.md | perf1-04 (supabase-expert) | verified | results/perf1-04.md; scorecard '45 6 * * *'; edit-in-place valid (migration still unapplied) |
| qa-5-1 BLOCKER scDailyRowsDb_ reads camelCase keys off snake_case prod_daily_layers | reports/qa-5.md | qa5-01 (dev) | verified | results/qa5-01.md; columns projection + snake reads; snake fixtures 6/6 |
| qa-5-2 HIGH hmSourceCells_ unpaged tickets/tracker_records reads | reports/qa-5.md | qa5-02 (dev) | verified | results/qa5-02.md; readAllPaged pk row_n / id order; 3/3 |
| qa-5-3 MED no note that freshchat mirror lacks bot flag | reports/qa-5.md | qa5-03 (dev) | verified | results/qa5-03.md; note in buildHeatmapFromSource, golden parity kept |
| qa-5-4 LOW 11 wave-2 result files in repo-root results/ | reports/qa-5.md | qa5-04+qa5-05 (dev) | verified | results/qa5-04.md + qa5-05.md; 11 files relocated, no content edits |
| data-6 HIGH fcr_dated='' breaks sc_months upsert | reports/data-3.md | data3-01 (dev) | done | spec/fix-data-3.md#data3-01; results/data3-01.md |
| data-7 MED audit filter diverges from qaRollupAudits_ | reports/data-3.md | data3-02 (dev) | done | spec/fix-data-3.md#data3-02; results/data3-02.md |
| data-8 MED tlqueue ticketsSince/trackerRecords unpaged | reports/data-3.md | data3-03 (data-engineer) | done | spec/fix-data-3.md#data3-03; results/data3-03.md; in-scope: tlqIo_ was wave-2-touched |
| data-9 LOW WA date_only ts never parses | reports/data-3.md | - | deferred | LOW; needs live remote sample of tracker_records values |
| data-10 LOW audit-only union rows dead audits cols | reports/data-3.md | - | deferred | LOW; parity-preserving |
| data-11 LOW 'Group Check' formula loss + unreachable '^exclu' skip | reports/data-3.md | - | deferred | LOW; spec-accepted residual |
| data-12 LOW orphan-append ghosts rows with all-zero fcr | reports/data-3.md | - | deferred | LOW; contract-mandated |
| perf-6 MED scIo_ whole-table prefetch (sc_daily/sc_behaviour/kpi_behaviour_log/sc_months) | reports/perf-3.md | perf3-01 (dev) | done | spec/fix-perf-3.md#perf3-01; scIo_(cfg,range), pf=from-spanDays; results/perf3-01.md |
| perf-7 MED wa_parcels tracker_records read no time bound | reports/perf-3.md | perf3-03 (dev) | done | fallback taken: submitted_at disproven (NULL on all migrated WA rows, ops-tabs.ts:165); bound documented in hmSourceCells_ docblock |
| perf-8 LOW freshchat one-sided gte + id ordering | reports/perf-3.md | perf3-04 (dev) | done | pk:'ts_ms' + .lt(ts_ms) heatmap.ts:604-605; 51/51 vitest |
| perf-9 LOW qa_audits SELECT * in scDailyRowsDb_ | reports/perf-3.md | perf3-02 (dev) | done | 6-col projection scorecard-server.ts:248 |
| perf-10 LOW sc_daily eq(month) seq-scan | reports/perf-3.md | perf3-05 (supabase-expert) | done | satisfied-by-existing: sc_daily_month_date_email_key leftmost-covers month; no migration needed |
| ux-1 MED Empty copy "from the raw tabs" | reports/ux-1.md | ux1-01 (dev) | done | spec/fix-ux-1.md#ux1-01; results/ux1-01.md; 'live data' @:981 |
| ux-2 MED stale "read" vocabulary in ScorecardAdmin | reports/ux-1.md | ux1-03 (dev) | done | spec/fix-ux-1.md#ux1-03; results/ux1-03.md; rebuild vocabulary 6 sites |
| ux-3 MED behaviour feedback not adjacent at 375px | reports/ux-1.md | ux1-04 (dev) | done | spec/fix-ux-1.md#ux1-04; results/ux1-04.md; behMsg/behMsgErr after form |
| ux-4 MED field-error missing role="alert" x3 | reports/ux-1.md | ux1-02 (dev) | done | spec/fix-ux-1.md#ux1-02; results/ux1-02.md; role="alert" :55/:101/:157 |
| ux-5 LOW missing name/autoComplete + hint on behaviour inputs | reports/ux-1.md | - | deferred | LOW per FIX rules |
| ux-6 LOW "Already logged." shown as ok not info | reports/ux-1.md | - | deferred | LOW per FIX rules |
| ux-7 LOW .pw-field-grow 288px marginal h-scroll at 320px | reports/ux-1.md | - | deferred | LOW per FIX rules; contract widths pass |
| ux-8 MED residual read/workbook vocabulary on main path | reports/ux-2.md | ux2-01 (dev) | done | spec/fix-ux-2.md#ux2-01; results/ux2-01.md; rebuild vocabulary at all 8 sites |
| ux-9 LOW rebuild error shown via green role=status note | reports/ux-2.md | ux2-02 (dev) | done | spec/fix-ux-2.md#ux2-02; results/ux2-02.md; PM promoted to blocking; setNoteErr :293-295 |

## Blocked / needs user
- RESOLVED 2026-11-17: all 5 pending migrations applied via `db query --linked --yes` + `migration repair --status applied` (db push blocked by 2 foreign remote-only versions 20261112162628/20261112165502 — left untouched). dq_hct, aux_spans, idx_qa_audits_audit_date verified on remote; 5 cxh- pg_cron jobs active (scorecard 06:45 staggered).
- RESOLVED: GUC design pivoted to Supabase Vault — host denies ALTER DATABASE/ROLE `app.*` params (42501). Vault secrets `cxh_app_url` + `cxh_cron_secret` provisioned; migration amended to read `vault.decrypted_secrets` (fix-vault-guc.md, qa-4 PASS). CRON_SECRET rotated on Vercel prod to match vault value (old external holders break — user accepted).
- RESOLVED: prod_assumptions seeded {"mq":3.5,"text":2,"wa":3} via seed script with real env exported from .env.local (process env beats dotenv files; tsx ESM hoisting makes module-level env captures skip dotenv.config).
- Deploy: commit fd82bbe pushed; Vercel deployment ffw4y88ly READY 2026-11-17 (picks up rotated CRON_SECRET). Watch `cron.job_run_details` after next scheduled run.
