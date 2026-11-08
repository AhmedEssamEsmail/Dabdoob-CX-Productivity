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
| S01 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S01-01 | mini/S01 | dev | none | 1/2/40/5 | PASS | done | results/S01-01.md; tsc clean |
| S01-02 | mini/S01 | dev | none | 4/6/250/10 | PASS | done | results/S01-02.md; vitest 12/12 + mock fix (hub-fakes/security getClaims+ilike): golden+security 890/890 |
| S02 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S02-01 | mini/S02 | dev | none | 1/4/120/8 | PASS | done | results/S02-01.md; vitest 60/60 |
| S02-02 | mini/S02 | dev | S02-01 | 1/4/40/6 | PASS | done | results/S02-02.md; vitest 24/24 |
| S02-03 | mini/S02 | dev | S02-01 | 3/4/40/6 | PASS | done | results/S02-03.md; vitest 28/28, hourly <=3 tables |
| S02-04 | mini/S02 | dev | S02-01 | 1/3/30/5 | PASS | done | results/S02-04.md; vitest 7/7 |
| S02-05 | mini/S02 | dev | S02-01 | 1/2/15/4 | PASS | done | results/S02-05.md; vitest 6/6 |
| S02-06 | mini/S02 | dev | S02-01 | 6/6/40/8 | PASS | done | results/S02-06.md; all 5 routes CLEAN, golden 874/874 |
| S03 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S03-01 | mini/S03 | dev | S02-01 | 3/5/80/8 | PASS | done | results/S03-01.md; tph golden 22/22, tsc clean |
| S03-02 | mini/S03 | dev | S03-01 | 6/6/20/5 | PASS | done | results/S03-02.md; tsc clean, all 6 routes forward param |
| S03-03 | mini/S03 | dev | S02-01 | 1/4/60/8 | PASS | done | results/S03-03.md; 33/33; freshchat kept full (documented) |
| S03-04 | mini/S03 | dev | S02-01 | 3/6/90/9 | PASS | done | results/S03-04.md; golden 49/49 |
| S03-05a | mini/S03 | dev | none | 1/10/60/8 | PASS | done | results/S03-05a.md; quality 64/64, tsc clean |
| S03-05b | mini/S03 | dev | S03-05a | 1/9/60/9 | PASS | done | results/S03-05b.md; quality 64/64, 6 converted |
| S04 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S04-01 | mini/S04 | dev | none | 2/4/150/10 | PASS | done | results/S04-01.md; vitest 14/14, tsc clean |
| S04-02 | mini/S04 | dev | none | 1/5/80/8 | PASS | done | results/S04-02.md; popups 3/3; alerts-test failure = stale hub-fakes mock (fix in flight) |
| S05 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S05-01 | mini/S05 | dev | S01-02, S04-02 | 3/4/80/7 | PASS | done | results/S05-01.md; vitest 7/7, tsc clean |
| S05-02 | mini/S05 | dev | S05-01 | 3/5/120/9 | PASS | done | results/S05-02.md; eslint+tsc clean |
| S06 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S06-01 | mini/S06 | dev | S01-02 | 3/3/90/6 | PASS | done | results/S06-01.md; api-fragments 28/28 |
| S06-02 | mini/S06 | dev | S06-01 | 1/3/60/7 | PASS | done | results/S06-02.md; tsc clean |
| S07 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S07-01 | mini/S07 | supabase-expert | none | 1/3/80/6 | PASS | done | results/S07-01.md; migration 20261108204952 registered |
| S07-02 | mini/S07 | supabase-expert | S07-01 | 1/6/40/5 | PASS | done | results/S07-02.md; migration 20261108205258 registered |
| S07-03 | mini/S07 | supabase-expert | S07-02 | 1/5/35/5 | PASS | done | results/S07-03.md; migration 20261108205536 registered |
| S08 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S08-01 | mini/S08 | dev | S04-01 | 2/4/60/6 | PASS | done | results/S08-01.md; vitest 74/74, tsc clean |
| S08-02 | mini/S08 | dev | S08-01 | 2/4/50/6 | PASS | done | results/S08-02.md; 82/82 after mock fix |
| S08-03 | mini/S08 | dev | S08-01 | 8/8/60/8 | PASS | done | results/S08-03.md; api-fragments 28/28, tsc clean |
| S08-04 | mini/S08 | supabase-expert | S08-02,S08-03,S03-01,S10-01 | 1/2/80/6 | PASS | done | results/S08-04.md; migration 20261108205852 registered |
| S09 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S09-01 | mini/S09 | dev | none | 1/5/20/4 | PASS | done | results/S09-01.md; JSON valid |
| S09-02 | mini/S09 | dev | S02-03 | 3/4/60/8 | PASS | done | results/S09-02.md; vitest 28/28, tsc clean |
| S10 | package/- | - | - | n/a | not dispatchable | done | all children done; integration gates green |
| S10-01 | mini/S10 | supabase-expert | S07-03 | 1/2/40/5 | PASS | done | results/S10-01.md; migration 20261108205645 registered |
| S10-02 | mini/S10 | dev | S10-01, S08-01 | 2/5/150/9 | PASS | done | results/S10-02.md; hub-my-day 24/24, tsc clean |
| S11-01 | mini/- | tech-writer | S09-01 | 1/2/20/4 | PASS | done | results/S11-01.md; docs/ARCHITECTURE.md cron table synced |

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

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|

## Blocked / needs user
- NEEDS_APPROVAL: remote apply of migration 20261108204952_dedupe_uniques_prod_daily_layers_queue_submissions.sql (dedupe DELETEs + 2 unique indexes; destructive on duplicate rows). Spec convention: migration FILES only; remote apply needs user approval.
- NEEDS_APPROVAL: remote apply of migration 20261108205258_lookup_indexes_prod_roster_agg.sql (6 indexes, non-destructive).
- NEEDS_APPROVAL: remote apply of migration 20261108205536_lookup_indexes_tickets_refresh_queue.sql (5 indexes; CONCURRENTLY — must NOT run inside a transaction).
- NEEDS_APPROVAL: remote apply of migration 20261108205645_app_cache_table.sql (new app_cache table; non-destructive).
- NEEDS_APPROVAL: remote apply of migration 20261108205852_rls_lockdown_drop_app_all_policies.sql (drops app_all — denies anon/auth table access BY DESIGN; apply only after service-role code is deployed).
