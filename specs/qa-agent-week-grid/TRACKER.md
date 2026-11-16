# TRACKER: qa-agent-week-grid
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass.

Baseline dirty tree (pre-existing, not ours): M src/features/cx-hub/lib/roster.ts,
M src/features/cx-quality/lib/server.ts, ?? scripts/ops/probe-sync-health.ts,
?? specs/aging-stale-status/reports/, ?? specs/qa-active-toggle/,
?? specs/qa-agent-week-grid/, ?? specs/unify-roster-source/,
?? tests/platform/dq-hct-active.test.ts

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | done | children done; tsc clean; scoped eslint+vitest green |
| S01-01 | mini/S01 | dev | none | 2/3/150/10 | PASS (struct+semantic) | done | results/S01-01.md; vitest 4/4; eslint clean after any-fix (attempt 2) |
| S01-02 | mini/S01 | dev | S01-01 | 1/5/170/10 | PASS (struct+semantic) | done | results/S01-02.md; page tsx +66/-1; eslint+tsc clean |
| ux1-01 | mini/fix-ux-1 | dev | none | 2/3/80/8 | PASS (struct+semantic) | done | results/ux1-01.md; vitest 3/3 new test, eslint+tsc clean |
| ux2-01 | mini/fix-ux-2 | dev | none | 2/2/40/5 | PASS (struct+semantic) | done | results/ux2-01.md; vitest 3/3, eslint+tsc clean; 1-line scoped diff |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit` | PASS (exit 0, gate-tsc.log) |
| 1 | unit | `npx vitest run` | 1371/1372 pass; 1 pre-existing FAIL in tests/quality/qe-fd-cache.test.ts (engine-live.ts refresh_log, unrelated to shard files; deterministic, gate-qe-fd.log) |
| 1 | lint | `npx eslint .` | 19 problems; 5 were ours (test `any`) -> fixed & clean; remaining 14 are baseline files (server.ts prefer-const, probe scripts, specs/*.mjs, admin-page warn) (gate-eslint.log) |
| 1 | scoped | `npx eslint <3 touched files>` + `vitest run tests/quality/qa-agent-weeks.test.ts` | PASS (exit 0, gate-vitest-scoped.log) |
| 2 | typecheck | `npx tsc --noEmit` | PASS (exit 0, fix-ux-1-gate-tsc.log) |
| 2 | unit (tests/quality/) | `npx vitest run tests/quality/` | 18/19 pass; 1 pre-existing FAIL in qe-fd-cache.test.ts (refresh_log, same baseline as round 1, unrelated) (fix-ux-1-gate-vitest.log) |
| 2 | lint (scoped) | `npx eslint <2 touched files>` | PASS (exit 0, fix-ux-1-gate-eslint.log) |
| 3 | typecheck | `npx tsc --noEmit` | PASS (exit 0, fix-ux-2-gate-tsc.log) |
| 3 | scoped test | `npx vitest run tests/quality/qa-agent-weeks-rowhead.test.tsx` | PASS 3/3 (exit 0, fix-ux-2-gate-vitest.log) |
| 3 | lint (scoped) | `npx eslint <2 touched files>` | PASS (exit 0, fix-ux-2-gate-eslint.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| ux-1 (MED): AgentWeeks name cell `<td>` -> `<th scope="row" className="qa-cov__name">` | reports/ux-1.md | ux1-01 (dev) | fixed | results/ux1-01.md; `<th scope="row" className="qa-cov__name">` at page tsx:483 + regression test |
| ux-2 (LOW): week range only in `title` tooltip | reports/ux-1.md | - | deferred | LOW deferred per FIX rules |
| ux-3 (LOW): month grain shows 12 week cols, basis note suppressed | reports/ux-1.md | - | deferred | LOW deferred; month view out of scope per PLAN |
| ux-4 (MED): AgentWeeks corner `<th scope="col">Agent</th>` lacks `qa-cov__name` (unpinned vs sticky name col) | reports/ux-2.md | ux2-01 (dev) | fixed | results/ux2-01.md; `<th scope="col" className="qa-cov__name">Agent</th>` + extended rowhead test |
| ux-2, ux-3 (LOW) re-confirmed OPEN | reports/ux-2.md | - | deferred | unchanged; LOW deferred per FIX rules |

## Blocked / needs user
- (none)
