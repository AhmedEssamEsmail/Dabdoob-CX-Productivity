# TRACKER: perf-remediation
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (pre-existing, NOT ours — do not revert):
specs/dabdoob-refresh/* (TRACKER, reports, results, spec/FIX, spec/NAV),
specs/legacy-parity/data/legacy-i18n-ar.json, src/app/refresh.css,
src/app/styles/operations.css, src/app/styles/queue.css,
src/features/cx-people/* (agents-page.tsx, scorecard-server.ts, scorecard/index.ts),
src/features/shared/components/shell/AppShell.tsx,
tests/golden/scorecard.test.ts, e2e/nav-collapse.spec.ts.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S01-01 | mini/S01 | dev | none | 1/2/40/5 | PASS | verified | results/S01-01.md; tsc clean |
| S01-02 | mini/S01 | dev | none | 4/6/250/10 | PASS | verified | results/S01-02.md; vitest 12/12 + mock fix (hub-fakes/security getClaims+ilike): golden+security 890/890 |
| S02 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S02-01 | mini/S02 | dev | none | 1/4/120/8 | PASS | verified | results/S02-01.md; vitest 60/60 |
| S02-02 | mini/S02 | dev | S02-01 | 1/4/40/6 | PASS | verified | results/S02-02.md; vitest 24/24 |
| S02-03 | mini/S02 | dev | S02-01 | 3/4/40/6 | PASS | verified | results/S02-03.md; vitest 28/28, hourly <=3 tables |
| S02-04 | mini/S02 | dev | S02-01 | 1/3/30/5 | PASS | verified | results/S02-04.md; vitest 7/7 |
| S02-05 | mini/S02 | dev | S02-01 | 1/2/15/4 | PASS | verified | results/S02-05.md; vitest 6/6 |
| S02-06 | mini/S02 | dev | S02-01 | 6/6/40/8 | PASS | verified | results/S02-06.md; all 5 routes CLEAN, golden 874/874 |
| S03 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S03-01 | mini/S03 | dev | S02-01 | 3/5/80/8 | PASS | verified | results/S03-01.md; tph golden 22/22, tsc clean |
| S03-02 | mini/S03 | dev | S03-01 | 6/6/20/5 | PASS | verified | results/S03-02.md; tsc clean, all 6 routes forward param |
| S03-03 | mini/S03 | dev | S02-01 | 1/4/60/8 | PASS | verified | results/S03-03.md; 33/33; freshchat kept full (documented) |
| S03-04 | mini/S03 | dev | S02-01 | 3/6/90/9 | PASS | verified | results/S03-04.md; golden 49/49 |
| S03-05a | mini/S03 | dev | none | 1/10/60/8 | PASS | verified | results/S03-05a.md; quality 64/64, tsc clean |
| S03-05b | mini/S03 | dev | S03-05a | 1/9/60/9 | PASS | verified | results/S03-05b.md; quality 64/64, 6 converted |
| S04 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S04-01 | mini/S04 | dev | none | 2/4/150/10 | PASS | verified | results/S04-01.md; vitest 14/14, tsc clean |
| S04-02 | mini/S04 | dev | none | 1/5/80/8 | PASS | verified | results/S04-02.md; popups 3/3; alerts-test failure = stale hub-fakes mock (fix in flight) |
| S05 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S05-01 | mini/S05 | dev | S01-02, S04-02 | 3/4/80/7 | PASS | verified | results/S05-01.md; vitest 7/7, tsc clean |
| S05-02 | mini/S05 | dev | S05-01 | 3/5/120/9 | PASS | verified | results/S05-02.md; eslint+tsc clean |
| S06 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S06-01 | mini/S06 | dev | S01-02 | 3/3/90/6 | PASS | verified | results/S06-01.md; api-fragments 28/28 |
| S06-02 | mini/S06 | dev | S06-01 | 1/3/60/7 | PASS | verified | results/S06-02.md; tsc clean |
| S07 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S07-01 | mini/S07 | supabase-expert | none | 1/3/80/6 | PASS | verified | results/S07-01.md; migration 20261108204952 registered |
| S07-02 | mini/S07 | supabase-expert | S07-01 | 1/6/40/5 | PASS | verified | results/S07-02.md; migration 20261108205258 registered |
| S07-03 | mini/S07 | supabase-expert | S07-02 | 1/5/35/5 | PASS | verified | results/S07-03.md; migration 20261108205536 registered |
| S08 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S08-01 | mini/S08 | dev | S04-01 | 2/4/60/6 | PASS | verified | results/S08-01.md; vitest 74/74, tsc clean |
| S08-02 | mini/S08 | dev | S08-01 | 2/4/50/6 | PASS | verified | results/S08-02.md; 82/82 after mock fix |
| S08-03 | mini/S08 | dev | S08-01 | 8/8/60/8 | PASS | verified | results/S08-03.md; api-fragments 28/28, tsc clean |
| S08-04 | mini/S08 | supabase-expert | S08-02,S08-03,S03-01,S10-01 | 1/2/80/6 | PASS | verified | results/S08-04.md; migration 20261108205852 registered |
| S09 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S09-01 | mini/S09 | dev | none | 1/5/20/4 | PASS | verified | results/S09-01.md; JSON valid |
| S09-02 | mini/S09 | dev | S02-03 | 3/4/60/8 | PASS | verified | results/S09-02.md; vitest 28/28, tsc clean |
| S10 | package/- | - | - | n/a | not dispatchable | verified | all children done; integration gates green |
| S10-01 | mini/S10 | supabase-expert | S07-03 | 1/2/40/5 | PASS | verified | results/S10-01.md; migration 20261108205645 registered |
| S10-02 | mini/S10 | dev | S10-01, S08-01 | 2/5/150/9 | PASS | verified | results/S10-02.md; hub-my-day 24/24, tsc clean |
| S11-01 | mini/- | tech-writer | S09-01 | 1/2/20/4 | PASS | verified | results/S11-01.md; docs/ARCHITECTURE.md cron table synced |
| FIX-01 | mini/- | dev | none | 1/2/15/6 | PASS | verified | results/FIX-01.md; instant=false added; next build 154/154 exit 0 |
| FIX-02a | mini/- | supabase-expert | none | 1/4/80/8 | PASS | verified | results/FIX-02a.md; migration 20261108231643 (settings/vault secret, idempotent) |
| FIX-02b | mini/- | dev | none | 3/3/25/5 | PASS | verified | results/FIX-02b.md; vercel entry gone, docstring+ARCH fixed (attempt 2: `*/` comment bug) |
| FIX-03 | mini/- | dev | none | 3/3/60/6 | PASS | verified | results/FIX-03.md; stubs+tests+mock removed; vitest 8/8 |
| FIX-04 | mini/- | dev | none | 1/1/10/4 | PASS | verified | results/FIX-04.md; data.now ?? client fallback; golden 875/875 |
| FIX-05 | mini/- | dev | none | 6/6/60/8 | PASS | verified | results/FIX-05.md; 5 cronOk fail-closed in prod; routes.test 9/9 |
| FIX-06 | mini/- | dev | none | 2/2/60/7 | PASS | verified | results/FIX-06.md; patchByKey upsert; repo.test 15/15 |
| FIX-07 | mini/- | supabase-expert | none | 2/3/60/8 | PASS | verified | results/FIX-07.md; cxh-job-data-tick-health 7-59/15 + ARCH runbook |
| FIX-08a | mini/- | dev | none | 10/10/110/9 | PASS | verified | results/FIX-08a.md; 10 cron gates fail-closed; tsc+eslint clean |
| FIX-08b | mini/- | dev | none | 7/8/100/9 | PASS | verified | results/FIX-08b.md; 6 routes + `Bearer undefined` 401 regression test; routes.test 10/10 |
| FIX-09 | mini/- | dev | none | 2/3/90/8 | PASS | verified | results/FIX-09.md; signature-grouped upserts; repo.test 16/16 |
| FIX-10 | mini/- | supabase-expert | none | 1/2/15/4 | PASS | verified | results/FIX-10.md; a.id < b.id keep-latest in 20261108204952 |
| FIX-11 | mini/- | supabase-expert | FIX-10 | 1/2/10/4 | PASS | verified | results/FIX-11.md; idx_refresh_log_started_at in 20261108205536 |
| FIX-12 | mini/- | supabase-expert | none | 1/3/40/6 | PASS | verified | results/FIX-12.md; migration 20261108234911 registered |
| FIX-13 | mini/- | data-engineer | none | 3/3/30/6 | PASS | verified | results/FIX-13.md; JSON.stringify keyOf + stub parity; tph-jobs 7/7 |
| FIX-14 | mini/- | dev | none | 2/2/25/5 | PASS | verified | results/FIX-14.md; normEmail cache key; reminders-off-popups 4/4 |
| FIX-15a | mini/- | dev | none | 1/4/80/8 | PASS | verified | results/FIX-15a.md; qaRowsWhere_ + 3 sites; tsc clean, quality 64/64 |
| FIX-15b | mini/- | dev | FIX-15a | 1/4/90/9 | PASS | verified | results/FIX-15b.md; 4 sites bounded + monthAudits for dispute stats; quality 64/64 |
| FIX-16 | mini/- | dev | none | 2/3/90/9 | PASS | verified | results/FIX-16.md; dqTicketsReadOr_ .or bound; 33/33 vitest, tsc clean |
| FIX-17 | mini/- | dev | none | 2/3/25/5 | PASS | verified | results/FIX-17.md; 31d gte + limit 5000 on 2 routes; tsc+eslint clean |
| FIX-18 | mini/- | dev | none | 1/2/15/5 | PASS | verified | results/FIX-18.md; .or(pending,date.gte.decidedFrom); tsc+eslint clean |
| FIX-19 | mini/- | dev | FIX-16 | 2/3/40/6 | PASS | verified | results/FIX-19.md; gte today-45d (verified horizon mtd+30d); vitest 2/2 |
| FIX-20 | mini/- | dev | none | 2/3/60/8 | PASS | verified | results/FIX-20.md; status.ilike."*v*" per status; 34/34 vitest, tsc clean |
| FIX-21 | mini/- | dev | none | 2/2/40/6 | PASS | verified | results/FIX-21.md; JSON.stringify signature + collision test; repo.test 17/17 |
| FIX-22 | mini/- | dev | none | 5/5/5/4 | PASS | verified | results/FIX-22.md; 5 strays deleted; git status clean of them |
| FIX-23 | mini/- | test-engineer | none | 1/2/10/4 | PASS | verified | results/FIX-23.md; stubEnv CRON_SECRET x2; routes.test 10/10 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | npx tsc --noEmit | PASS (0 errors) |
| 1 | unit | npx vitest run | PASS (54 files, 1123/1123) |
| 1 | lint | npx eslint . | PASS (0 errors, 366 warnings pre-existing) |
| 1 | security | npm run test:security | not run - PM gate |
| 1 | build | next build | not run - PM gate |
| 2 | typecheck | npx tsc --noEmit | PASS (0 errors; fix2-tsc.log) |
| 2 | unit | npx vitest run | PASS (54 files, 1120/1120; fix2-vitest.log) |
| 2 | lint | npx eslint . | PASS (0 errors, 366 warnings pre-existing; fix2-eslint.log) |
| 2 | security | npm run test:security | PASS (4/4; fix2-security.log) |
| 2 | build | next build | PASS (154/154 pages, exit 0; fix2-build.log) |
| 3 | typecheck | npx tsc --noEmit | PASS (0 errors) |
| 3 | unit | npx vitest run | PASS (54 files, 1122/1122; fix3-vitest.log) |
| 3 | lint | npx eslint . | PASS (0 errors, 366 warnings pre-existing; fix3-eslint.log) |
| 3 | security | npm run test:security | PASS (4/4; fix3-security.log) |
| 3 | build | next build | PASS (154/154 pages, exit 0; fix3-build.log) |
| 4 | typecheck | npx tsc --noEmit | PASS (0 errors; fix4-tsc.log) |
| 4 | lint | npx eslint . | PASS (0 errors, 366 warnings pre-existing; fix4-eslint.log) |
| 4 | unit | npx vitest run | PASS (54 files, 1123/1123; fix4-vitest.log) |
| 4 | security | npm run test:security | PASS (4/4; fix4-security.log) |
| 4 | build | next build | PASS (154/154 pages; fix4-build.log) |
| 5 | typecheck | npx tsc --noEmit | PASS (0 errors; fix5-tsc.log) |
| 5 | unit | npx vitest run | PASS (54 files, 1126/1126; fix5-vitest.log) |
| 5 | lint | npx eslint . | PASS (0 errors, 366 warnings pre-existing; fix5-eslint.log) |
| 5 | security | npm run test:security | PASS (4/4; fix5-security.log) |
| 5 | build | next build | PASS (154/154 pages; fix5-build.log) |
| 6 | typecheck | npx tsc --noEmit | PASS (0 errors; fix6-tsc.log) |
| 6 | unit | npx vitest run | PASS (55 files, 1128/1128; fix6-vitest.log) |
| 6 | lint | npx eslint . | PASS (0 errors, 366 warnings pre-existing; fix6-eslint.log) |
| 6 | security | npm run test:security | PASS (4/4; fix6-security.log) |
| 6 | build | next build | PASS (154/154 pages; fix6-build.log) |
| 7 | typecheck | npx tsc --noEmit | PASS (0 errors; fix7-tsc.log) |
| 7 | unit | npx vitest run | PASS (55 files, 1129/1129; fix7-vitest.log) |
| 7 | lint | npx eslint . | PASS (0 errors, 366 warnings pre-existing; fix7-eslint.log) |
| 7 | security | npm run test:security | PASS (4/4; fix7-security.log) |
| 7 | build | next build | PASS (154/154 pages; fix7-build.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 BLOCKER (layout async -> prerender fail) | reports/qa-1.md | FIX-01 (dev) | verified | instant=false; build exit 0 |
| qa-2 MED (job-data-tick daily not */15; PM: pg_cron+pg_net, drop vercel entry, fix docstring) | reports/qa-1.md | FIX-02a (supabase-expert) + FIX-02b (dev) | verified | 20261108231643 migration + vercel.json/docstring/ARCH updates |
| qa-3 LOW (getUser/requireAuth stub drops User fields; treated blocking per task) | reports/qa-1.md | FIX-03 (dev) | verified | stubs deleted (3 files) |
| qa-4 LOW (pollTick client-clock now; treated blocking per task) | reports/qa-1.md | FIX-04 (dev) | verified | server now + fallback |
| sec-1 MED (cronOk fail-open when CRON_SECRET unset; all 5 copies) | reports/sec-1.md | FIX-05 (dev) | verified | NODE_ENV!=='production' guard in all 5 copies + 401 regression test |
| sec-2 LOW (updateRows batched upsert full-row lost-update; blocking per task) | reports/sec-1.md | FIX-06 (dev) | verified | patchByKey key+patch upsert; merged `out` kept; fallback intact |
| sec-3 LOW (net.http_get fire-and-forget -> silent scheduler outage; blocking per task) | reports/sec-1.md | FIX-07 (supabase-expert) | verified | cxh-job-data-tick-health asserts latest net._http_response 200 -> RAISE EXCEPTION |
| sec-4 MED (16 routes: `Bearer ${CRON_SECRET}` unguarded -> `Bearer undefined` authenticates when secret unset) | reports/sec-2.md | FIX-08a + FIX-08b (dev) | verified | hoisted secret + fail-closed prod + dev escape in all 16; grep 0 matches; regression test 401s `Bearer undefined` |
| data-1 BLOCKER (updateRows heterogeneous patch key-sets -> PostgREST default-fill clobber or batch 400) | reports/data-1.md | FIX-09 (dev) | verified | grouped by sorted patch-key signature, one upsert per group; regression asserts uniform key-sets (live PostgREST verify still open — mocked db() only) |
| data-2 MED (prod_daily_layers dedupe keeps stale row) | reports/data-1.md | FIX-10 (supabase-expert) | verified | a.id < b.id keep-latest + comment fix in 20261108204952 (unapplied) |
| data-3 LOW (refresh_log index mismatches only reader) | reports/data-1.md | FIX-11 (supabase-expert) | verified | idx_refresh_log_started_at replaces (job, finished_at) in 20261108205536 (unapplied) |
| data-4 LOW (roster.email no unique -> batch upsert always 42P10-fallbacks) | reports/data-1.md | FIX-12 (supabase-expert) | verified | new migration 20261108234911: dedupe keep-latest + roster_email_uidx |
| data-5 LOW (env.ts keyOf ''-join collisions in memoUpsert) | reports/data-1.md | FIX-13 (data-engineer) | verified | JSON.stringify keyOf in env.ts:292 + helpers.ts:58; collision regression test |
| data-6 LOW (popupsPoll raw-email cache key vs normEmail invalidation) | reports/data-1.md | FIX-14 (dev) | verified | POPUPS_POLL_KEY + normEmail(email); mixed-case regression test |
| perf-1 MED (7 whole-table qaRows_('qa_audits') hot-path reads; ~170ms mean) | reports/perf-1.md | FIX-15a + FIX-15b (dev) | verified | qaRowsWhere_ (eq/in/is/gte, empty-in->[]); all 7 sites bounded: eq ticket_id/kind/agent_email, gte audit_date, in audit_ids; in-memory conjuncts retained |
| perf-2 MED (tickets read no where-clause; 176k seq scan every */15 tick) | reports/perf-1.md | FIX-16 (dev) | verified | .or(status.in open-status variants OR created/resolved >= bizTz today-1d 00:00); queue-tickets-read.test.ts regression |
| perf-3 LOW (intervals+daily-layers zero-param whole-table select) — blocking per task | reports/perf-1.md | FIX-17 (dev) | verified | gte date=today-31d when no date param + .limit(5000) on both routes |
| perf-4 LOW (prod_flags admin branch all-time decided) — blocking per task | reports/perf-1.md | FIX-18 (dev) | verified | .or(decision.eq.pending,date.gte.decidedFrom); pending unbounded, decided windowed |
| perf-5 LOW (prod_daily_layers all-time nightly read) — blocking per task | reports/perf-1.md | FIX-19 (dev) | verified | .gte('date', today-45d) — superset of dqAgentPerf_ real horizon (mtd+30d); test extended |
| qa-1 MED (dqTicketsReadOr_ status.in variants miss case/ws forms dqBuildAging_ accepts -> silent aging drops) | reports/qa-3.md | FIX-20 (dev) | verified | per-status status.ilike."*v*" or-terms (case + trim-ws superset, in-memory filter unchanged); test asserts ilike shape + rejects status.in |
| qa-2 LOW (repo.ts updateRows signature join('') collides; blocking per task) | reports/qa-3.md | FIX-21 (dev) | verified | JSON.stringify(sorted keys); {a,bc} vs {ab,c} collision regression -> 2 upserts |
| qa-3 LOW (stray nul x2, tsc-FIX17/18 logs, .qa-tmp/; blocking per task) | reports/qa-3.md | FIX-22 (dev) | verified | 5 strays deleted; TL also removed worker-stray vitest-fix23.log |
| qa-4 LOW (routes.test delete CRON_SECRET not restored; blocking per task) | reports/qa-3.md | FIX-23 (test-engineer) | verified | vi.stubEnv('CRON_SECRET','') in both tests; 401 asserts unchanged |

## Remote apply log (2026-11-09, all resolved)
- 20261108204952 / 20261108205258 / 20261108205536: applied earlier in post-FIX-10/11 form — verified remotely (idx_refresh_log_started_at + both unique indexes exist).
- 20261108205645 app_cache_table: applied via Supabase MCP. Verified: table exists, RLS on, no policies.
- 20261108234911 roster_email_unique: applied via Supabase MCP. Verified: roster_email_uidx exists (dedupe no-op — live table is email-PK shape).
- 20261108205852 rls_lockdown: applied manually by owner in dashboard SQL editor after MCP destructive-confirm was declined and owner re-confirmed. Verified: 0 public policies, RLS on all public base tables. NOTE: applied BEFORE the service-role deploy — prod (main @ abda24f) still serves pre-S08 code, so anon/auth table reads in prod UI will fail until feat/cx-hub-ui-redesign merges and deploys. Owner accepted this window.
- 20261108231643 job_data_tick_pg_cron: applied manually by owner, then RESCHEDULED via MCP — the hosted postgres role cannot ALTER DATABASE/ROLE SET "app.settings.*" (42501), so the cron command inlines app_url + rotated CRON_SECRET instead of current_setting() (same convention as 012_pg_cron_schedule placeholders). Verified: cxh-job-data-tick */15 + cxh-job-data-tick-health 7-59/15 both active, no current_setting/placeholder in command.
- CRON_SECRET rotated 2026-11-09 (old value unrecoverable — Vercel sensitive env vars are write-only). New value set in Vercel production env via MCP and inlined in the cron command. REQUIRES a production redeploy to take effect in the running app — ticks will 401 (health job will flag) until the next prod deploy picks up the new env.
- Bookkeeping: file-version rows inserted into supabase_migrations.schema_migrations for all four (the two MCP applies registered under run-date versions; file-version rows added for migration-list parity).
- Remaining outside DB scope: merge feat/cx-hub-ui-redesign -> main + production deploy (required to end the RLS-lockdown breakage window and to activate the rotated CRON_SECRET).
