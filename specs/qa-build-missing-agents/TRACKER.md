# TRACKER: qa-build-missing-agents
Mode: FIX (source report `reports/debug-1.md`, every row blocking)
Fix spec: `fix-debug-1.md` — leaves dbg1-01, dbg1-02 (serial: same file).
Baseline dirty tree (pre-FIX, do not revert): `specs/qa-build-missing-agents/`,
`tests/quality/qe-touch-scan-cap.test.ts` (regression test, untracked, currently failing).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| dbg1-01 | mini/fix-debug-1 | dev | none | 1/2/40/8 | PASS | done | results/dbg1-01.md; vitest qe-touch-scan-cap 1 pass, tsc clean; diff 17+/8- scoped to qeReadTouches_ |
| dbg1-02 | mini/fix-debug-1 | dev | dbg1-01 | 1/2/10/4 | PASS | done | results/dbg1-02.md; tests/quality 36/36, tsc clean; diff scoped to qeReadLog_ |
| data1-01 | mini/fix-data-1 | dev | none | 3/4/90/9 | PASS | done | results/data1-01.md; diff = 1 key line each in server.ts/pure.ts + doc comment + new test; tests/quality 39/39, tsc clean |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| pre-fix | repro | `npx vitest run tests/quality/qe-touch-scan-cap.test.ts` | FAIL `expected 1000 to be 2500` (per debug-1) |
| fix | typecheck | `npx tsc --noEmit` | PASS (exit 0) |
| fix | unit | `npx vitest run` | 1498/1499; 1 pre-existing fail `tests/freeze/sheets-freeze-scan.test.ts` (flags committed scripts/ops/qa-*.ts, unrelated to diff) |
| fix | lint | `npx eslint .` | 1 error + 7 warnings, all pre-existing in unrelated files (tests/golden, scripts/ops, cx-queue/jobs.ts); engine-live.ts scoped lint clean |
| fix-r2 | typecheck | `npx tsc --noEmit` | PASS (exit 0, empty log tl2-tsc.log) |
| fix-r2 | unit | `npx vitest run` | 1501/1502; 1 pre-existing fail `tests/freeze/sheets-freeze-scan.test.ts` (same scripts/ops/qa-*.ts allowlist flags as r1, unrelated to diff) |
| fix-r2 | lint | `npx eslint .` | 1 error + 7 warnings — identical pre-existing set as r1; server.ts/pure.ts/new test scoped lint clean |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| dbg-1: qeReadTouches_ single .limit(60000) truncated to 1000 rows | debug-1 | dbg1-01 | done | regression test green (2500 rows) |
| dbg-2: qeReadLog_ readRows limit 200000 -> capped single query | debug-1 | dbg1-02 | done | limit dropped; readAllPaged path |
| data-1 (MED): extraTaken keyed by qeCanonAgent_ (first+last) vs weekTaken/pool full-name keys -> requests never consume slots, over-offer past 30/wk cap | data-1 | data1-01 | done | both functions now key by raw agent_name; regression test qa-requested-taken-key.test.ts 3/3 |
| data-2 (LOW): expired log rows still count into weekTaken | data-1 | (none) | deferred | judgement call: parity presumed, 0 expired rows exist to verify legacy intent; quota-policy change needs user/PM decision, not a fix |

## Blocked / needs user
- (none)
