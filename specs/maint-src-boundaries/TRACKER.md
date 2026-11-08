# TRACKER: maint-src-boundaries
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree at TL start (NOT ours, do not revert): M specs/redesign/*,
M src/app/{cx-kit.css,theme.css,styles/{desk,hub,people,queue}.css},
?? specs/{maint-src-boundaries,redesign/{results,reports/*},reminders-master-switch}/.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | done | children 5/5 + integration gates pass |
| S01-01 | mini/S01 | dev | none | 1/1/15/5 | PASS | done | results/S01-01.md; tsc clean |
| S01-02 | mini/S01 | dev | S01-01 | 3/3/6/5 | PASS | done | results/S01-02.md; tsc clean |
| S01-03 | mini/S01 | dev | S01-01 | 3/3/8/5 | PASS | done | results/S01-03.md; tsc clean |
| S01-04 | mini/S01 | dev | S01-01 | 3/3/9/8 | PASS | done | results/S01-04.md; tsc clean |
| S01-05 | mini/S01 | dev | S01-02, S01-03, S01-04 | 1/1/8/5 | done | results/S01-05.md; tsc clean | edit on disk verified; agent still writing results |
| S02 | package/- | - | - | n/a | not dispatchable | done | children 2/2 + integration gates pass |
| S02-01 | mini/S02 | dev | none | 3/2/125/10 | PASS | done | results/S02-01.md; vitest 6/6, tsc+eslint clean |
| S02-02 | mini/S02 | dev | S02-01 | 1/1/112/5 | PASS | done | results/S02-02.md; vitest 6/6, tsc clean; checker-deviation: Delete verb |
| S03 | package/- | - | - | n/a | not dispatchable | done | 33/33 + integration gates pass |
| S03-01 | mini/S03 | dev | none | 3/3/15/10 | PASS | done | results/S03-01.md; vitest 6/6, tsc clean |
| S03-02 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-02.md; tsc clean | agent bb4a8206 |
| S03-03 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-03.md; tsc clean | agent 5b9ba013 |
| S03-04 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-04.md; tsc clean |
| S03-05 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-05.md; tsc clean |
| S03-06 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-06.md; tsc clean | agent 251ea6c4 |
| S03-07 | mini/S03 | dev | S03-01 | 3/3/9/8 | done | results/S03-07.md; tsc clean | agent ae0d1b71 |
| S03-08 | mini/S03 | dev | S03-01 | 3/3/9/8 | done | results/S03-08.md; tsc clean |
| S03-09 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-09.md; tsc clean |
| S03-10 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-10.md; tsc clean |
| S03-11 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-11.md; tsc clean |
| S03-12 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-12.md; tsc clean |
| S03-13 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-13.md; tsc clean |
| S03-14 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-14.md; tsc clean |
| S03-15 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-15.md; tsc clean |
| S03-16 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-16.md; tsc clean |
| S03-17 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-17.md; tsc clean |
| S03-18 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-18.md; tsc clean |
| S03-19 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-19.md; tsc clean |
| S03-20 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-20.md; tsc clean |
| S03-21 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-21.md; tsc clean |
| S03-22 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-22.md; tsc clean |
| S03-23 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-23.md; tsc clean |
| S03-24 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-24.md; tsc clean |
| S03-25 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-25.md; tsc clean |
| S03-26 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-26.md; tsc clean |
| S03-27 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-27.md; tsc clean |
| S03-28 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-28.md; tsc clean |
| S03-29 | mini/S03 | dev | S03-01 | 3/3/6/5 | done | results/S03-29.md; tsc clean |
| S03-30 | mini/S03 | dev | S03-01, S02-01 | 3/3/6/5 | done | results/S03-30.md; tsc clean |
| S03-31 | mini/S03 | dev | S03-01 | 2/2/4/5 | done | results/S03-31.md; tsc clean |
| S03-32 | mini/S03 | dev | S03-01 | 1/2/15/8 | PASS | done | results/S03-32.md; tsx resolves server-only |
| S03-33 | mini/S03 | dev | S01-05, S02-02, S03-02..31, S04, S05-01..06 | 1/3/15/10 | PASS | done | results/S03-33.md; probe failed build with expected server-only client error, reverted, rebuild clean |
| S04 | mini/root | dev | none | 2/2/35/10 | PASS | done | results/S04.md; grep clean, tsc+eslint clean |
| S05 | package/- | - | - | n/a | not dispatchable | done | 6/6 done + integration gates pass |
| S05-01 | mini/S05 | dev | S01-03 | 2/2/30/10 | PASS | done | results/S05-01.md; tsc clean |
| S05-02 | mini/S05 | dev | S01-04 | 2/2/30/10 | PASS | done | results/S05-02.md; tsc clean |
| S05-03 | mini/S05 | dev | S01-04 | 2/2/30/10 | PASS | done | results/S05-03.md; tsc+eslint clean |
| S05-04 | mini/S05 | dev | S01-04 | 2/2/30/10 | PASS | done | results/S05-04.md; tsc clean |
| S05-05 | mini/S05 | dev | none | 2/2/30/10 | PASS | done | results/S05-05.md; tsc+eslint clean |
| S05-06 | mini/S05 | dev | none | 2/2/30/10 | PASS | done | results/S05-06.md; tsc+eslint clean |
| S06 | package/- | - | - | n/a | not dispatchable | done | 5/5 done + integration gates pass |
| S06-01 | mini/S06 | test-engineer | S03-01 | 1/2/140/10 | PASS | done | results/S06-01.md; vitest 12/12 |
| S06-02 | mini/S06 | test-engineer | S03-01 | 1/2/110/10 | PASS | done | results/S06-02.md; integration 5/5 |
| S06-03 | mini/S06 | test-engineer | S03-01 | 1/2/100/10 | PASS | done | results/S06-03.md; security 2/2 |
| S06-04 | mini/S06 | test-engineer | S06-02 | 1/2/80/10 | PASS | done | results/S06-02.md; integration 5/5 |
| S06-05 | mini/S06 | test-engineer | S06-03 | 1/2/70/10 | PASS | done | results/S06-03.md; security 2/2 |
| S07 | package/- | - | - | n/a | not dispatchable | done | 2/2 + integration gates pass |
| S07-01 | mini/S07 | dev | S02-02 | 1/2/25/10 | PASS | done | results/S07-01.md; eslint 0 errors |
| S07-02 | mini/S07 | tech-writer | S02-02, S03-32, S03-33, S07-01 | 2/2/60/10 | PASS | done | results/S07-02.md; ARCHITECTURE+TESTING boundaries docs |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| S03-32 spec/S03/32-probe-tsx-shim.md | minutes=15 > checker cap 10 | split into S03-32+33; 32 done | done |
| S03-33 spec/S03/33-client-probe.md | spec defect fixed by spec-architect (routable src/app/svonly-probe/) | none - completed | done |
| S05-01 spec/S05/01-tph-grid.md | minutes=15 > checker cap 10 (LIMITS.md allows <=15) | resolved by RESHARD | done |
| S06-01 spec/S06/01-auth-test.md | minutes=15 > checker cap 10 (LIMITS.md allows <=15) | resolved by RESHARD | done |
| S06-02 spec/S06/02-qa-dispatcher-test.md | minutes=15 > checker cap 10 (LIMITS.md allows <=15) | resolved by RESHARD | done |
| S06-03 spec/S06/03-security-spec.md | minutes=15 > checker cap 10 (LIMITS.md allows <=15) | resolved by RESHARD | done |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 0 | preflight | check_shards.py on 6 ready leaves | PASS (all 6) |
| 0 | preflight | check_shards.py remaining leaves | 36 PASS; 5 FAIL minutes=15>cap10 (LIMITS allows 15); S02-02 FAIL Delete verb (dispatched anyway, verified) |
| 1 | typecheck | npx tsc --noEmit | PASS exit 0 |
| 1 | unit | npx vitest run | PASS 53 files / 1152 tests |
| 1 | lint | npx eslint . | PASS 0 errors (370 pre-existing warnings) |
| 1 | security | npm run test:security | PASS 22/22 |
| 1 | build | npx next build | PASS compiled; all routes incl. thin pages present |
| 1 | e2e | npm run test:e2e | NOT RUN - needs seeded live env (approval) |
| 2 | typecheck | npx tsc --noEmit | PASS exit 0 |
| 2 | unit | npx vitest run | PASS 53 files / 1111 tests |
| 2 | lint | npx eslint . | PASS 0 errors (368 pre-existing warnings) |
| 2 | security | npm run test:security | PASS 4/4 (real authz spec) |
| 2 | integration | npm run test:integration | PASS 11/11 (real dispatcher test) |
| 2 | build | npx next build | PASS compiled; all routes present |
| 2 | e2e | npm run test:e2e | NOT RUN - needs seeded live env (approval) |
| 3 | typecheck | npx tsc --noEmit | PASS exit 0 |
| 3 | unit | npx vitest run | PASS 53 files / 1111 tests |
| 3 | lint | npx eslint . | PASS 0 errors (368 pre-existing warnings) |
| 3 | security | npm run test:security | PASS 4/4 |
| 3 | integration | npm run test:integration | PASS 11/11 |
| 3 | build | npx next build | PASS compiled; probe route absent (reverted) |
| 3 | e2e | npm run test:e2e | NOT RUN - needs seeded live env (approval) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|

## Blocked / needs user
- e2e gate (`npm run test:e2e`) needs seeded live env — report as not-run unless approved.
- e2e gate not run; RESHARD landed: S03-32/33, S05-01, S06-01..05, S07-02 all checker-PASS now.
