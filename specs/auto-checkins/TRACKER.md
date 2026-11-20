# TRACKER: auto-checkins
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (pre-existing, NOT shard work — do not revert):
- M src/app/styles/quality.css
- M src/features/cx-quality/components/audit-queue-detail.tsx
- M src/features/cx-quality/components/audit-queue-page.tsx
- M src/features/cx-quality/components/qa-shared.tsx
- M src/features/cx-quality/components/quality-analytics-page.tsx
- ?? specs/auto-checkins/ (this spec), ?? specs/qa-audit-footer-compact/, ?? tests/quality/qa-audit-footer-compact.test.tsx

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| AC-01 | mini/- | dev | none | 2/6/350/10 (actual 3f/~172l incl. approved hub-fakes extension) | PASS (structural+semantic) | verified | results/AC-01.md; vitest 46/46 targeted; tsc clean; attempt 2 added `.not()` to tests/golden/hub-fakes.ts |
| qa1-01 | mini/fix-qa-1 | dev | none | 2/4/150/10 (actual 2f/~95l net new incl. test) | PASS (structural+semantic) | verified | results/qa1-01.md; vitest 45/45 targeted; tsc clean; retry gate reuses frozen snapshot rows via dqSnapshotRows_, try/catch + hbBeat warn |
| data1-01 | mini/fix-data-1 | data-engineer | none | 2/3/80/10 (actual 2f/~75l incl. test) | PASS (structural+semantic) | verified | results/data1-01.md; `have` now `.in('snapshot_key', cps.map(c=>c.key))`; +1 cross-year regression test; vitest 6/6 |
| data1-02 | mini/fix-data-1 | data-engineer | data1-01 | 2/3/60/10 (actual 2f/~30l incl. test) | PASS (structural+semantic) | verified | results/data1-02.md; `subDone` guard resolves popup in own try/catch; +1 regression test; vitest 7/7 |
| data2-01 | mini/fix-data-2 | data-engineer | none | 3/3/70/10 (actual 3f/~55l incl. test + dead-chain `in()`) | PASS (structural+semantic) | verified | results/data2-01.md; snapErr -> warn beat + `for (const cp of snapErr ? [] : cps)`; +1 regression test; vitest 55/55, tsc clean |
| data3-01 | mini/fix-data-3 | data-engineer | none | 2/2/60/10 (actual 2f/~40l incl. test) | PASS (structural+semantic) | verified | results/data3-01.md; todaysErr -> warn beat + `if (!todaysErr) dqRewrite_`; +1 regression test; vitest 56/56, tsc clean |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | targeted unit | `npx vitest run tests/golden/queue-checkin-auto.test.ts tests/golden/queue-checkin.test.ts tests/golden/reminders-off-dq.test.ts` | PASS 46/46 (results-ac01-vitest.log) |
| 1 | typecheck | `npx tsc --noEmit` | PASS 0 errors (results-ac01-tsc.log, tl-tsc-check.log) |
| 1 | full unit | `npx vitest run` | 1528/1530 pass; 2 PRE-EXISTING failures unrelated to AC-01: sheets-freeze-scan (committed scripts/ops/qa-*.ts offenders) + table-center-align (baseline-dirty quality.css / qa-whylist) — see tl-vitest-full.log |
| 2 | targeted unit | `npx vitest run tests/golden/queue-checkin-auto.test.ts tests/golden/queue-checkin.test.ts` | PASS 45/45 (spec/logs/fix-qa1-vitest.log) |
| 2 | typecheck | `npx tsc --noEmit` | PASS exit 0 (spec/logs/fix-qa1-tsc.log) |
| 3 | typecheck | `npx tsc --noEmit` | PASS exit 0 (spec/logs/fix-data1-tsc.log) |
| 3 | targeted unit | `npx vitest run tests/golden/queue-checkin-auto.test.ts tests/golden/queue-checkin.test.ts tests/golden/reminders-off-dq.test.ts tests/golden/reminders-off-missed.test.ts tests/golden/reminders-off-popups.test.ts` | PASS 54/54 (spec/logs/fix-data1-vitest.log) |
|| 4 | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/fix-data2-tsc.log) |
|| 4 | targeted unit | `npx vitest run` same 5-file set as round 3 | PASS 55/55 (logs/fix-data2-vitest.log) |
|| 5 | targeted unit | `npx vitest run` same 5-file set as round 3 | PASS 56/56 (logs/fix-data3-vitest.log) |
|| 5 | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/fix-data3-tsc.log, fix-data3-tsc.exit) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 MED: orphaned auto-submission never retried when have[cp.key] short-circuits | reports/qa-1.md | qa1-01 -> dev | done | new test 'retries an orphaned submission' + restructured gate; vitest 45/45, tsc clean |
| qa-2 LOW: 5 stray root logs (results-ac01-*.log, tl-*.log) | reports/qa-1.md | - | deferred | LOW per FIX rules; delete later |
| qa-3 LOW: missing assertion on no-fresh-missed-popup at NOW_LATE | reports/qa-1.md | - | deferred | LOW per FIX rules |
| data-1 MED: `have` loaded `.eq('year', today)` misses cross-year Dec-31 cp inside 6h window on Jan 1 -> re-upserts frozen snapshot with live numbers | reports/data-1.md | data1-01 -> data-engineer | done | fix-data-1.md#data1-01; results/data1-01.md |
| data-2 MED: `resolvePopups` inside insert-guarded path; resolve throw after insert -> stale missed popup never resolved | reports/data-1.md | data1-02 -> data-engineer | done | fix-data-1.md#data1-02; results/data1-02.md |
| data-3 LOW: `subErr` degrades to "no submissions" -> duplicate-insert attempts per tick | reports/data-1.md, still open in reports/data-2.md | - | deferred | LOW per FIX rules |
| data-4 MED: `snapKeys` SELECT error ignored -> `have` empty -> recapture upsert overwrites frozen snapshots + wrong-as-of auto-submission | reports/data-2.md | data2-01 -> data-engineer | done | results/data2-01.md; vitest 55/55, tsc clean |
| data-3 LOW: `subErr` degrades to "no submissions" -> duplicate-insert attempts per tick | reports/data-1.md, still open in reports/data-3.md | - | deferred | LOW per FIX rules |
| data-5 MED: `todays` select ignores its error -> `todays=[]` -> `dqRewrite_` wipes `agg_snapshots_today` silently during the blip | reports/data-3.md | data3-01 -> data-engineer | done | results/data3-01.md; vitest 56/56, tsc clean |

## Blocked / needs user
- (none)
