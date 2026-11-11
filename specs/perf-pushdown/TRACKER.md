# TRACKER: perf-pushdown
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree at TL start (2026-11-11): `M specs/perf-pushdown/PLAN.md`,
`M specs/perf-pushdown/spec/00-index.md` (spec-authoring edits — not worker scope).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S01-01 | mini/S01 | supabase-expert | none | 1/4/60/8 | PASS (struct+sem) | verified | results/S01-01.md; PERF_BASELINE.md 4 DB sections; preconditions 0/0; max-rows "default 1000 assumed" |
| S01-02 | mini/S01 | data-engineer | S01-01 | 1/4/80/10 | PASS (struct+sem) | verified | results/S01-02.md; PERF_BASELINE.md complete; P-16/P-17 DROP; baseline 500s on prod/analytics + getQaScoresPage (pre-existing) |
| S02 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S02-01 | mini/S02 | dev | none | 2/4/150/9 | PASS (struct+sem) | verified | results/S02-01.md; readAllPaged+PK_OVERRIDES; vitest 24/24; tsc clean |
| S03 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S03-01 | mini/S03 | dev | S01-02, S02-01 | 2/3/80/7 | PASS (struct+sem) | verified | results/S03-01.md; sc_daily gte/lte + sc_behaviour or(null+range); vitest 15/15 |
| S04 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S04-01 | mini/S04 | dev | none | 2/3/90/8 | PASS (struct+sem) | verified | results/S04-01.md; day-bounded qe_queue_log; vitest 1/1; tsc clean (test ~150 lines vs 90 est) |
| S04-02 | mini/S04 | dev | S04-01 | 2/4/90/8 | PASS (struct+sem) | verified | results/S04-02.md; bounded outcomes+queue-values; vitest 67/67; tsc clean |
| S05 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S05-01 | mini/S05 | dev | S01-02 | 2/4/110/9 | PASS (struct+sem) | verified | results/S05-01.md; pwDirectory cache() + roleForEmail eq; vitest 11/11; tsc clean |
| S05-02 | mini/S05 | dev | S05-01 | 2/3/60/6 | PASS (struct+sem) | verified | results/S05-02.md; projected roster reads w/ real col names; vitest 14/14 |
| S06 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S06-01 | mini/S06 | dev | S02-01, S05-01 | 3/6/250/10 | PASS (struct+sem) | verified | results/S06-01.md; projected+bounded+120s cache; vitest 4/4; prod_window_hist.date index missing (perf-gate note) |
| S07 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S07-01 | mini/S07 | dev | S02-01, S05-01 | 2/5/140/9 | PASS (struct+sem) | verified | results/S07-01.md; window+projections+configAll/pwDirectory; vitest 28/28 (caveat: pwDirectory injects config admins into dir.by) |
| S07-02 | mini/S07 | dev | S07-01 | 6/7/60/8 | PASS (struct+sem) | verified | results/S07-02.md; 5 day routes + page trend/refreshLog; vitest 17/17 (fallback-log TS7006 flagged, verify at checkpoint) |
| S07-03 | mini/S07 | supabase-expert | S01-02 | 1/4/60/8 | PASS (struct+sem) | verified | results/S07-03.md; P-16 skipped: <107 rows + date-leading index exists |
| S08 | package/- | - | - | n/a | not dispatchable | verified | all leaves done (serial chain server.ts) |
| S08-01 | mini/S08 | dev | S02-01, S04-02 | 2/4/90/8 | PASS (struct+sem) | verified | results/S08-01.md; qaRowsWhere_ lte+paged, audit basis bounded (gte=prevFrom deviation, superset kept); vitest 67/67 |
| S08-02 | mini/S08 | dev | S08-01 | 2/2/40/5 | PASS (struct+sem) | verified | results/S08-02.md; myAudits auditor+14d bound; vitest 4/4 |
| S08-03 | mini/S08 | dev | S08-02 | 2/4/70/7 | PASS (struct+sem) | verified | results/S08-03.md; auditor bounds + Promise.all; vitest 5/5 |
| S08-04 | mini/S08 | dev | S08-03 | 2/2/40/5 | PASS (struct+sem) | verified | results/S08-04.md; 8 reads in one Promise.all; vitest 70/70 |
| S08-05 | mini/S08 | dev | S08-04 | 2/3/60/7 | PASS (struct+sem) | verified | results/S08-05.md; drill bounds gated to audit basis (interaction precedent); vitest 10/10 |
| S08-06 | mini/S08 | dev | S08-05 | 2/3/50/6 | PASS (struct+sem) | verified | results/S08-06.md; open-CTL eq + due ctl_id in; vitest 11/11 |
| S08-07 | mini/S08 | dev | S08-06 | 2/3/50/6 | PASS (struct+sem) | verified | results/S08-07.md; open-CTL + audit_id in bounds; vitest 12/12 |
| S08-08 | mini/S08 | dev | S08-07 | 2/2/30/5 | PASS (struct+sem) | verified | results/S08-08.md; kind eq audit bound; vitest 13/13 |
| S08-09 | mini/S08 | dev | S08-08 | 2/2/30/5 | PASS (struct+sem) | done (defect) | results/S08-09.md; is-null bound NOT superset for '' rows -> qa-blank-01 fix in chain |
| qa-blank-01 | mini/S08-fix | dev | S08-09 | 2/3/40/5 | PASS (struct+sem) | verified | results/qa-blank-01.md; qaRowsWhere_ +or option; or(null,eq'') bound; vitest 14/14 |
| S08-10 | mini/S08 | dev | S08-09 | 2/2/30/5 | PASS (struct+sem) | verified | results/S08-10.md; ctls eq agent_email; vitest 15/15 |
| S08-11 | mini/S08 | dev | S08-10 | 2/2/30/5 | PASS (struct+sem) | verified | results/S08-11.md; ctls eq audit_id; vitest 16/16 |
| S08-12 | mini/S08 | dev | S08-11 | 2/2/30/5 | PASS (struct+sem) | verified | results/S08-12.md; queue eq ticket_id + in open; vitest 17/17 — S08 COMPLETE |
| S09 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S09-01 | mini/S09 | dev | S08-12 | 2/4/90/8 | PASS (struct+sem) | verified | results/S09-01.md; qaUpsertIn_ bulk upsert + 42P10 verbatim fallback; vitest 67/67 — S09 COMPLETE |
| S10 | package/- | - | - | n/a | not dispatchable | verified | all leaves done (serial chain stores.ts) |
| S10-01 | mini/S10 | dev | S02-01 | 2/4/110/8 | PASS (struct+sem) | verified | results/S10-01.md; StoreFilter gte/lte + paged reads; vitest 23/23; tsc clean |
| S10-02 | mini/S10 | dev | S10-01 | 2/5/100/9 | PASS (struct+sem) | verified | results/S10-02.md; aggregates bounded; own test 2/2; golden verify blocked by fakes-01 (pre-existing fake gap) |
| S10-03 | mini/S10 | dev | S10-01 | 3/5/70/7 | PASS (struct+sem) | verified | results/S10-03.md; 4 lookups filtered; vitest 16/16 (churn ~165 vs 70 est, under cap) |
| S11 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S11-01 | mini/S11 | dev | S10-01 | 2/3/60/6 | PASS (struct+sem) | verified | results/S11-01.md; live|name 45s TTL; vitest 3/3; tsc clean |
| S11-02 | mini/S11 | dev | S11-01 | 2/3/50/6 | PASS (struct+sem) | verified | results/S11-02.md; flushWrites invalidates live| keys; vitest 9/9; tsc clean |
| S11-03 | mini/S11 | dev | S05-01, S10-01, S11-01 | 2/6/110/9 | PASS (struct+sem) | verified | results/S11-03.md; Promise.all + inflow gte bound; vitest 42/42 golden queue |
| S12 | package/- | - | - | n/a | not dispatchable | verified | all leaves done (env.ts after S11-02) |
| S12-01 | mini/S12 | dev | S01-02, S02-01, S11-02 | 2/5/140/9 | PASS (struct+sem) | verified | results/S12-01.md; TABLE_BOUNDS paged preloads; vitest 11/11; 4 tables left unbounded (recorded) |
| S12-02 | mini/S12 | dev | S02-01, S12-01 | 3/4/80/7 | PASS (struct+sem) | verified | results/S12-02.md; log-once per (table,keys) in env+repo; vitest 19/19 |
| S13 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S13-01 | mini/S13 | dev | none | 3/4/80/8 | PASS (struct+sem) | verified | results/S13-01.md; ecosystem-dynamic wrapper ssr:false; tsc+vitest+eslint clean; First-Load-JS n/a in Next 16.4.3 (import-shape verified) |
| S13-02 | mini/S13 | dev | none | 2/4/60/7 | PASS (struct+sem) | verified | results/S13-02.md; lazy googleapis both files; tsc+eslint clean; no other eager importers |
| S14 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S14-01 | mini/S14 | supabase-expert | S01-02 | 1/4/60/8 | PASS (struct+sem) | verified | results/S14-01.md; P-17 skipped: 2184 rows <5k; no migration |
| S14-02 | mini/S14 | data-engineer | none | 1/4/60/7 | PASS (struct+sem) | verified | results/S14-02.md; bulk config/roster upserts + all error checks; tsc clean (migrate:dry-run NEEDS_APPROVAL, deferred) |
| S15 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S15-01 | mini/S15 | dev | none | 2/4/240/10 | PASS (struct+sem) | verified | results/S15-01.md; PERF_PROFILE.md; 3 fix leaves to file (/tph-grid >50ms); audit-queue inconclusive (needs seeded re-profile) |
| S16 | package/- | - | - | n/a | not dispatchable | verified | all leaves done
| S16-01 | mini/S16 | tech-writer | S09-01, S12-02, S13-02, S14-02, S15-01, S07-03, S14-01, S01-02 | 2/4/80/8 | PASS (struct+sem) | verified | results/S16-01.md; PERFORMANCE_PLAN status lines + PERF_BASELINE ## After skeleton |
| fakes-01 | mini/S02-fix | test-engineer | none | 1/4/80/7 | PASS (struct+sem) | verified | results/fakes-01.md; golden 870/876; 6 residuals -> fakes-02 |
| fakes-02 | mini/S02-fix | dev | fakes-01 | 1/4/80/8 | PASS (struct+sem) | verified | results/fakes-02.md; all 6 app-side ordering regressions -> ord-01/02/03 |
| ord-01 | mini/S02-fix | dev | fakes-02 | 1/3/30/5 | PASS (struct+sem) | verified | results/ord-01.md; total comparator w/ updated_at desc reproduces legacy order; desk.test.ts 160/160 |
| ord-02 | mini/S02-fix | dev | fakes-02 | 1/3/40/6 | PASS (struct+sem) | verified | results/ord-02.md; unordered registry read restores sheet order; operations 188/188 |
| ord-03 | mini/S02-fix | dev | fakes-02 | 2/3/40/6 | PASS (struct+sem) | verified | results/ord-03.md; work-core stable-sort by serial id; people-jobs 14/14 |
| p19-01 | mini/S15-fix | dev | none | 2/3/60/7 | PASS (struct+sem) | verified | results/p19-01.md; Xa deps narrowed; vitest 3/3; re-profile at checkpoint |
| p19-02 | mini/S15-fix | dev | p19-01 | 2/3/60/7 | PASS (struct+sem) | verified | results/p19-02.md; EsPaintGrid memo; vitest 4/4 |
| p19-03 | mini/S15-fix | dev | none | 2/3/50/6 | PASS (struct+sem) | verified | results/p19-03.md; Ga dep [d]->[d.table]; vitest 2/2 |
| p19-05 | mini/S15-fix | test-engineer | p19-02 | 1/3/120/6 | PASS (struct+sem) | verified | results/p19-05.md; Xa block restored; file 7/7 green |
| p19-04 | mini/S15-fix | dev | none | 2/4/80/8 | PASS (struct+sem) | verified | results/p19-04.md; /audit-queue still unmeasured — qa_queue.id missing (drift); re-profile after pk-drift-01 |
| p19-06 | mini/S15-fix | dev | pk-apply-01 | 2/4/80/8 | PASS (struct+sem) | verified | results/p19-06.md; tph-grid 246->178ms; audit-queue measured ~266-292ms -> p19-07 |
| p19-07 | mini/S15-fix | dev | p19-06 | 2/3/80/7 | PASS (struct+sem) | verified | results/p19-07.md; 8 derivations memoized; LoAF ~252ms (dev noise); test 4/4 — ALL LEAVES COMPLETE |
| pk-drift-01 | mini/S02-fix | dev | fakes-02 | 2/4/90/8 | PASS (struct+sem) | verified | results/pk-drift-01.md; +15 overrides (incl qa_queue->queue_id, qa_audits->audit_id); ~10 escalated -> pk-scan-01; dqReadTail flagged |
| pk-scan-01 | mini/S02-fix | supabase-expert | pk-drift-01 | 1/3/60/7 | PASS (struct+sem) | verified | results/pk-scan-01.md + docs/perf/pk-drift-evidence.md; 6 overrides verified, 4 id-pkey, queue_status_submissions absent->PM |
| pk-apply-01 | mini/S02-fix | dev | pk-scan-01 | 3/4/70/7 | PASS (struct+sem) | verified | results/pk-apply-01.md; +6 verified overrides; dqReadTail pk-aware; vitest 16/16; tsc clean |
| upsert-fake-01 | mini/S02-fix | test-engineer | none | 3/3/60/6 | PASS (struct+sem) | verified | results/upsert-fake-01.md; upsert added to 2 perf fakes; 33/33 green |
| holiday-eq-01 | mini/S10-fix | dev | none | 2/2/30/5 | PASS (struct+sem) | verified | results/holiday-eq-01.md; country removed from pushed eq; holidays 13/13; tsc clean |
| lint-test-01 | mini/S02-fix | test-engineer | upsert-fake-01 | 2/2/15/4 | PASS (struct+sem) | verified | results/lint-test-01.md; 3 errors fixed + stale holiday eq assertion updated; eslint+vitest 0 |
| after-timing-01 | mini/S01-fix | data-engineer | none | 2/3/40/9 | PASS (struct+sem) | verified | results/after-timing-01.md; ## After filled; scores 500->200; queue -49/-55%; prod/analytics still 500 (new: prod_daily_layers.productiveMinResolution missing -> layers-scan/fix) |
| layers-scan-01 | mini/S06-fix | supabase-expert | none | 1/3/60/7 | PASS (struct+sem) | verified | results/layers-scan-01.md + docs/perf/prod-analytics-cols.md; only prod_daily_layers broken (snake_case); 3 others verified |
| layers-fix-01 | mini/S06-fix | dev | layers-scan-01 | 2/2/30/5 | PASS (struct+sem) | verified | results/layers-fix-01.md; snake_case aliases; prod-analytics 4/4; tsc clean — ALL LEAVES COMPLETE |
| pm1-01 | mini/pm1-fix | dev | none | 1/3/10/5 | PASS (struct+sem) | verified | results/pm1-01.md; 1-line rename verified via git diff; tsc 0 err; people tests 38/38; stale name now comments-only |
| pm1-02 | mini/pm1-fix | supabase-expert | none | 1/3/20/6 | PASS (struct+sem) | verified | results/pm1-02.md; 20261111083859_add_prod_window_hist_date_index.sql — single idempotent CREATE INDEX; remote SELECT n/a (no MCP, repo DDL evidence used); NEEDS_APPROVAL: apply on merge to main |
| qa1-01 | mini/qa-1 | dev | none | 2/3/40/6 | PASS (struct+sem) | verified | results/qa1-01.md; or-string +date.eq. branch; date:'' fixture; vitest 2/2; TL-verified diff |
| qa1-02 | mini/qa-2 | data-engineer | none | 2/4/30/10 | PASS (struct+sem) | verified | results/qa1-02.md + logs/after-timings-qa1.log; 4 runs, median 1.817s still 500 — error changed to `from is not defined` (preserved verbatim legacy bug analytics.ts:293-295); schema-drift error gone; rebuild skipped w/ reason (build postdates fix + parallel edits) |
| qa1-03 | mini/qa-3 | dev | none | 3/2/5/4 | PASS (struct+sem) | verified | results/qa1-03.md; nul + 2 stray logs deleted; git status grep 0 |
| qa1-04 | mini/qa-4 | dev | none | 3/5/80/9 | PASS (struct+sem) | verified | results/qa1-04.md; by roster-only + lookup() fallback; :1086 unions dir.admins (recorded); test 6/6; TL-verified diff |
| qa1-05 | mini/qa-5 | test-engineer | none | 2/2/10/4 | PASS (struct+sem) | verified | results/qa1-05.md; _table referenced in guard; eslint 0 warn; vitest 14/14 |
| pm2-01 | mini/pm-2 | dev | none | 3/4/60/8 | PASS (struct+sem) | verified | results/pm2-01.md; eval->weeks[0] guard; vitest 29/29 (TL-run); scoped tsc 0; diff TL-verified (~28 lines) |
| data1-01 | mini/data-1 | dev | none | 1/2/15/4 | PASS (struct+sem) | verified | results/data1-01.md; deps ->[missingMap,d.off,d.channels,d.activities] + documented eslint-disable (We field contract); vitest 7/7; eslint 0; diff TL-verified |
| data1-02 | mini/data-1 | dev | none | 1/2/15/4 | PASS (struct+sem) | verified | results/data1-02.md; destructured apply fns in deps; vitest 4/4; diff TL-verified |
| data2-01 | mini/data-2 | supabase-expert | none | 5/4/140/10 | PASS (struct+sem) | verified | results/data2-01.md; gte min/lte max+U+FFFD prefix bound at 4 reads; T-suffixed fixture flows through; vitest 42/42; NEEDS_APPROVAL remote count (no MCP) |
| data3-01 | mini/data-3 | dev | none | 2/3/50/6 | PASS (struct+sem) | verified | results/data3-01.md; cacheRemove('live\|'+table) after delErr check (both branches); vitest 5/5 |
| data4-01 | mini/data-4 | dev | none | 2/3/60/7 | PASS (struct+sem) | verified | results/data4-01.md; dedupeRows_ last-wins feeds upsert+delete+insert; vitest 5/5; diff TL-verified |
| data5-01 | mini/data-5 | dev | none | 2/3/60/7 | PASS (struct+sem) | verified | results/data5-01.md; chunked readAllPaged 500-key in updateRows; vitest 21/21; tsc 0 |
| data6-01 | mini/data-6 | dev | none | 4/5/80/8 | PASS (struct+sem) | verified | results/data6-01.md; gte/lte prefix bound + order tie-break; +76/-5 lines; vitest 1298/1298; tsc 0 |
| perf1-02 | mini/perf-1 | dev | none | 1/3/40/6 | PASS (struct+sem) | verified | results/perf1-02.md; both reads via readAllPaged (+3/-14); vitest 63/63; tsc 0; diff TL-verified |
| perf1-03 | mini/perf-1 | supabase-expert | none | 2/4/30/6 | PASS (struct+sem) | verified | results/perf1-03.md; path A — (date,class) UNIQUE covers; migration deleted; evidence note appended to PERF_BASELINE.md |
| perf1-01 | mini/perf-1 | data-engineer | perf1-02, perf1-03 | 2/7/80/10 | PASS (struct+sem) | done (perf-5 BREACH recorded) | results/perf1-01.md; build RQxQ00OoPfT22Fj8nO3wI; analytics 500->200 @0.121s/3,448B PASS; hub/home 2.189s vs 1.459 BREACH all 3 runs; perf-4 documented; logs/perf1-timings.log |
| pm3-01 | mini/pm-3 | dev | none | 3/6/90/10 | PASS (struct+sem) | verified | results/pm3-01.md + logs/pm3-profile.log; [perf] instrumentation in aggregates.ts (kept); all 9 direct reads <=212ms warm — regression isolated to DQ_HOME_PROVIDERS span ~1.45-2.25s (people 658-695/work 566-1299/plan 227-258) |
| pm3-02 | mini/pm-3 | dev | pm3-01 | 3/6/80/10 | PASS (struct+sem) | verified | results/pm3-02.md + logs/pm3-pg{,-server}.log; PG_PROFILE-gated pgFetch wrapper; ~41 calls/req, provider span ~27 serial calls = 9 schedule tables x3 (tlp_shifts x14@101-464ms); no slow query, not CPU |
| pm3-03 | mini/pm-3 | dev | pm3-02 | 6/9/250/10 | PASS (struct+sem) | verified | results/pm3-03.md + logs/pm3-retime.log; Promise.all providers + wc_tl_sched_v1 cache + in-flight dedupe (pwRows_/wcTlSchedule) + single schedule fetch; median 0.859s vs 1.459 T0 = PASS (-41%), ~7.3KB, 200 x3; provider span ~0.25s; [perf]+PG_PROFILE retained |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| (generated) tests/golden/hub-fakes.ts fake gap | S02-01 readAllPaged -> .range missing in mkQuery; 246 golden failures | fakes-01..02, ord-01..03, upsert-fake-01, lint-test-01 (spec/fix-fakes-1.md) | done — 1291/1291 green |
| (generated) S15-01 findings | 3 commits >50ms on /tph-grid + audit-queue unmeasured | p19-01..p19-07 (spec/fix-p19-1.md) | all done; tph-grid 246->178ms; audit-queue memoized ~252ms (dev noise) |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | unit (golden subset, mid-build) | `npx vitest run tests/golden/` | FAIL 246/876 — root cause mkQuery missing .range (fakes-01 dispatched); log: logs/golden-check.log |
| 2 | typecheck | `npx tsc --noEmit` | PASS 0 errors; log: logs/tsc-checkpoint.log |
| 2 | lint | `npx eslint .` | FAIL 3 errors/439 warnings — lookups.test.ts any x2 + queue-pages.test.ts prefer-const (lint-test-01 dispatched); log: logs/eslint-full.log |
| 2 | unit (full) | `npx vitest run` | FAIL 6/1287 — 5x upsert-not-a-function (upsert-fake-01) + 1 holiday oracle case-sensitivity (holiday-eq-01); log: logs/vitest-full.log |
| 3 | unit (full, post-fix) | `npx vitest run` | PASS 1287/1287; log: logs/vitest-full-2.log |
| 3 | lint (post-fix) | `npx eslint .` | PASS 0 errors (439 warnings pre-existing/tolerated); log: logs/eslint-full-2.log |
| 3 | integration | `npm run test:integration` | PASS 11/11; log: logs/gate-integration.log |
| 3 | security | `npm run test:security` | PASS 4/4; log: logs/gate-security.log |
| 3 | performance | `npm run test:performance` | PASS 14/14; log: logs/gate-performance.log |
| 3 | build | `npm run build` | PASS compiled 12.5s + TS 17.9s + route table; log: logs/gate-build.log |
| 3 | e2e | `npm run test:e2e` | PASS 170/180 (10 skipped, 0 failed, 2.5m); log: logs/gate-e2e.log |
| 4 | unit (final) | `npx vitest run` | PASS 1291/1291 (86 files); log: logs/vitest-final.log |
| 5 (pm1) | typecheck + targeted unit (pm1-01 scope) | `npx tsc --noEmit`; `vitest run tests/golden/people*.test.ts` | PASS 0 errors; 38/38 (worker-run, diff TL-verified; TL npx/node exec auto-denied in background) |
| 6 (qa1) | typecheck + eslint (touched) + unit (full) | `npx tsc --noEmit`; `npx eslint` touched+tests/perf; `npx vitest run` | PASS 0 errors; 0 errors / 8 warn (pre-existing baseline files; flagged 2 now clean); 1292/1292 (86 files, +1 new qa1-04 case); logs: logs/qa1-gate-{tsc,eslint,vitest}.log |
| 7 (pm2) | unit (targeted) + typecheck | `npx vitest run tests/golden/prod-validation.test.ts tests/perf/prod-analytics.test.ts`; `npx tsc --noEmit` | vitest PASS 29/29 (TL-run; logs/pm2-vitest.log); tsc: worker scoped `tsc -p` over 3 touched files+imports EXIT=0; TL full run emitted 0 errors but exceeded exec window (>25m cold) — full-repo tsc deferred to PM gate round |
| 8 (data1) | unit (full) | `npx vitest run` | PASS 1296/1296 (86 files, +4 new cases); log: logs/data1-gate-vitest.log |
| 8 (data1) | lint (touched) | `npx eslint` 12 touched files | PASS 0 errors; 1 NEW warning (exhaustive-deps :211) resolved via documented eslint-disable in data1-01 follow-up — re-run EXIT=0; log: logs/data1-gate-eslint.log |
| 9 (data6) | unit (full) + typecheck | `npx vitest run`; `npx tsc --noEmit` | PASS 1298/1298 (86 files, +2 new cases); tsc 0 errors (worker-run full); log: logs/data6-gate-vitest.log |
| 10 (perf-1 FIX) | unit (full) + typecheck + served build | `npx vitest run`; `npx tsc --noEmit`; `npm run build` + `next start -p 3100` re-time | PASS 1298/1298 (log: logs/perf1-gate-vitest.log); tsc 0 (worker); build exit 0, BUILD_ID RQxQ00OoPfT22Fj8nO3wI serving :3100; analytics 200 PASS, hub/home BREACH recorded |
| 11 (pm-3 FIX) | unit (full) + typecheck + lint (touched) + served build | `npx vitest run`; `npx tsc --noEmit`; `npx eslint` 5 touched files; `npm run build` + `next start -p 3100` re-time | PASS 1298/1298 (log: logs/pm3-gate-vitest.log); tsc 0 (log: logs/pm3-gate-tsc.log); eslint 0 (log: logs/pm3-gate-eslint.log); build OQ3PvVtUCyDf_oX63UwoY serving :3100; hub/home median 0.859s <=1.459 PASS |
| 12 (ux-1 FIX) | targeted unit + lint (touched) | `npx vitest run tests/perf/ecosystem-dynamic.test.ts`; `npx eslint` 3 touched files | PASS 3/3 (+1 new fallback-shape case); eslint 0 errors (worker-run, results/ux1-01.md); TL-verified diff +~20 lines across 3 files |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| F1 stale table name `queue_status_submissions` (pre-existing bug) | reports/pm-1.md | pm1-01 (dev) | verified | results/pm1-01.md; one-on-ones-page.ts:578 -> queue_submissions; tsc 0; 38/38 green |
| F2 missing index `prod_window_hist.date` (user approved migration) | reports/pm-1.md | pm1-02 (supabase-expert) | verified | results/pm1-02.md; supabase/migrations/20261111083859_add_prod_window_hist_date_index.sql (file only; apply needs approval/ships on merge) |
| qa-1 HIGH sc_behaviour `date=''` rows dropped by or-clause | reports/qa-1.md | qa1-01 (dev) | verified | results/qa1-01.md; or +date.eq. branch; `date:''` parity test green |
| qa-2 MED stale prod/analytics After timing (pre layers-fix-01) | reports/qa-1.md | qa1-02 (data-engineer) | verified | results/qa1-02.md; re-timed 1.817s/500 — NEW residual: preserved legacy `eval('from')` bug analytics.ts:293-295 (pre-existing, needs PM triage) |
| qa-3 MED leftover artifacts `nul` + 2 stray logs | reports/qa-1.md | qa1-03 (dev) | verified | results/qa1-03.md; 3 files deleted, git status clean |
| qa-4 LOW `dir.by` injected admins may surface in enumerations | reports/qa-1.md | qa1-04 (dev) | verified | results/qa1-04.md; by roster-only + lookup fallback; :1086 uses dir.admins union; test proves both invariants |
| qa-5 LOW 2 new eslint warnings `_table` unused | reports/qa-1.md | qa1-05 (test-engineer) | verified | results/qa1-05.md; eslint 0 warn on both files; vitest 14/14 |
| F3 preserved `eval('from')` bug in prod analytics admin hist path (user approved fix) | reports/pm-2.md | pm2-01 (dev) | verified | results/pm2-01.md; eval removed, hist bound `inp.weeks[0]`; golden test flipped to populated calibration; perf test asserts `cal.idle['3']===4` on admin GET |
| data-1 HIGH 5 memo tests red (dep-identity invalidation) — reproduced by TL: 5/11 fail | reports/data-1.md | data1-01 (dev) + data1-02 (dev) | verified | split: Xa missingItems deps / audit-queue sort-apply deps; both green; log: logs/data1-failures.log |
| data-2 MED slot_date eq/in drops stored non-ISO rows (consumer slices 0,10) | reports/data-1.md | data2-01 (supabase-expert) | verified | results/data2-01.md; prefix-superset gte/lte bound, strict superset; remote count still NEEDS_APPROVAL |
| data-3 MED dqRewrite_ never evicts live\|<table> -> 45s stale reads | reports/data-1.md | data3-01 (dev) | verified | results/data3-01.md; evict after delErr check covers empty branch; vitest 5/5 |
| data-4 MED env upsert dup key tuples -> second-time error / dup insert | reports/data-1.md | data4-01 (dev) | verified | results/data4-01.md; dedupeRows_ Map last-wins; vitest 5/5 |
| data-5 LOW (blocking per PM) updateRows batch select unpaginated >1000 matches | reports/data-1.md | data5-01 (dev) | verified | results/data5-01.md; chunked readAllPaged; repo.test >pageSize case green |
| data-6 MED last 2 raw slot_date predicates miss non-ISO rows (jobs.ts:292 .in; server.ts:296 .eq dedupe) | reports/data-2.md | data6-01 (dev) | verified | results/data6-01.md; T-suffixed row suppresses false missed-reminder + takes update path (no dup append); TL-verified diff; repo sweep clean |
| perf-1 MED prod/analytics still 500 — served build predates pm2-01 fix; rebuild+restart+re-time | reports/perf-1.md | perf1-01 (data-engineer) | verified | 500->200, median 0.121s <=0.487 T0, 3,448B; final build RQxQ00OoPfT22Fj8nO3wI verified serving pm2-01 fix |
| perf-2 MED tlqueue maqsamRows/fdActivityRows unpaginated (fd_activities 686k rows) | reports/perf-1.md | perf1-02 (dev) | verified | results/perf1-02.md; readAllPaged both windows; vitest 63/63; tsc 0; TL-verified diff +3/-14 |
| perf-3 LOW (blocking per PM) redundant prod_window_hist date index — user approved removal if (date,class) unique covers | reports/perf-1.md | perf1-03 (supabase-expert) | verified | results/perf1-03.md; coverage proven -> migration DELETED; evidence in PERF_BASELINE.md `### prod_window_hist index decision (perf-3)` |
| perf-4 LOW (blocking per PM) >=50% payload target unmet; document/restate per-endpoint | reports/perf-1.md | perf1-01 (data-engineer) | verified | PERF_BASELINE.md payload note: BREACH restated — pushed tables minor payload share (tph/page -24.4%, hub/home +3.4%, analytics 3,448B first measurable) |
| perf-5 LOW (blocking per PM) hub/home re-time +34% on stale build; re-confirm on final build | reports/perf-1.md | perf1-01 (data-engineer) | done (BREACH — residual for PM) | reproducible on final build: median 2.189s vs 1.459 T0, all 3 runs > baseline; recorded, no fix attempted per leaf |
| F4 hub/home +50% over T0 baseline (budget breach; pm-3 asks debugger for isolation — not spawnable by TL, dev covered it via pm3-01 instrumentation) | reports/pm-3.md | pm3-01 -> pm3-02 -> pm3-03 (dev) | verified | spec/fix-pm-3.md; root cause = ~27 serial provider calls (9 schedule tables x3 via wcTlScheduleSource/pwRows_); fix = Promise.all providers + shared schedule fetch + in-flight dedupe; median 0.859s vs 1.459 T0 (-41%); baseline dirty tree at FIX start: 65 modified/untracked (cumulative spec work) |
| ux-1 MED loading fallback: bare `.eco3-page-msg` — rail clickable, no cover, pop-in | reports/ux-1.md | ux1-01 (dev) | verified | spec/fix-ux-1.md#ux1-01; `.eco3-page` fixed cover + `.eco3-head` h1 restored; results/ux1-01.md |
| ux-2 MED fallback missing `role="status"` (WCAG 4.1.3) — bundled into ux-1 fix per report | reports/ux-1.md | ux1-01 (dev) | verified | same leaf; role="status" on `.eco3-page-msg` |
| ux-3 LOW (blocking per PM) loader copy lacks trailing `…`; must stay verbatim across sites | reports/ux-1.md | ux1-01 (dev) | verified | same leaf; `Loading the ecosystem…` verbatim in all 3 loader sites (dynamic :13; page :31,:142) |

## Blocked / needs user
- RESIDUAL (perf-1.md perf-5): `GET /api/hub/home` reproducibly breaches the `<= baseline` budget on the final build — median 2.189 s vs T0 1.459 s, all 3 runs above (logs/perf1-timings.log). Not a stale-build artifact. RESOLVED by pm-3.md F4 -> pm3-01/02/03: median 0.859 s (-41% vs T0) on build OQ3PvVtUCyDf_oX63UwoY; PERF_BASELINE `## After` updated.
- OPEN (data-1 r1): remote read-only `slot_date` format counts (`queue_submissions`, `queue_snapshots`, `agg_snapshots_today`; `!~ '^\d{4}-\d{2}-\d{2}$'`) — no MCP; needs approved remote SELECT. Non-blocking: data2-01 superset bound ships regardless; if >0 in snapshot tables -> separate cleanup for PM (consumers compare raw — no parity break).
- RESOLVED via pm-2.md F3 -> pm2-01: `GET /api/prod/analytics` 500 `from is not defined` (preserved verbatim legacy bug `eval('from')` analytics.ts:293-295). User approved FIXING it — parity waived for this bug; hist filtered by `weeks[0]` lower bound instead.
- (none) — S01-01 remote read-only SELECTs APPROVED 2026-11-11; PostgREST max-rows unknown -> "default 1000 assumed" to be recorded in PERF_BASELINE.md.
- RESOLVED via pm-1.md F1 -> pm1-01: pk-scan-01 found remote table `queue_status_submissions` absent; user approved rename to `queue_submissions` at one-on-ones-page.ts:578. Evidence: docs/perf/pk-drift-evidence.md.
- RESOLVED via pm-1.md F2 -> pm1-02: S06-01 found `prod_window_hist.date` index missing; user approved a timestamped migration file (no remote apply).

## Dispatch queue (max 4 workers)
Wave 1: S01-01, S02-01, S04-01, S15-01 (disjoint files; critical-path heads + independent profiling)
Wave 2: S13-01, S13-02, S14-02 + leaves unlocked by wave-1 completions (S01-02 after S01-01; S04-02 after S04-01)
