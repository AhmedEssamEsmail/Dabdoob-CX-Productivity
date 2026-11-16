# TRACKER: holform-overlap-sweep
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Mode: FIX — input `reports/debug-1.md` (all 13 rows blocking). Fix spec:
`fix-debug-1.md` (leaves dbg1-01..dbg1-04, all Owner=dev, disjoint files, parallel).

Baseline dirty tree (pre-dispatch, do not revert): untracked `nul`,
`scripts/ops/probe-sync-health.ts`, `specs/aging-stale-status/reports/`,
`specs/e2e-contract-green/`, `specs/holform-overlap-sweep/`,
`specs/qa-live-sheets-freeze/`, `supabase/migrations/20261116175742_drop_dead_and_mirror_only_tables.sql`,
`tests/css-form-guards.test.ts`.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| fix-debug-1 | package/- | - | - | n/a | not dispatchable | verified | reports/debug-1.md; integration gates logged below |
| dbg1-01 | mini/fix-debug-1 | dev | none | 1/3/40/6 | PASS (preflight) | verified | results/dbg1-01.md; refresh.css +3 rules (3 site checks green) |
| dbg1-02 | mini/fix-debug-1 | dev | none | 1/3/40/6 | PASS (preflight) | verified | results/dbg1-02.md; people.css +3 rules (4 checks green) |
| dbg1-03 | mini/fix-debug-1 | dev | none | 4/4/50/8 | PASS (preflight) | verified | results/dbg1-03.md; 4 files +1 rule each (10 checks green) |
| dbg1-04 | mini/fix-debug-1 | dev | none | 2/3/40/6 | PASS (preflight) | verified | results/dbg1-04.md; cx-kit.css +2 rules, desk.css :79 extended (4 checks green) |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | targeted unit | `npx vitest run tests/css-form-guards.test.ts` | PASS 22/22 (13 sites fixed + 9 anchors held); log: logs/gate-vitest.log |
| 1 | typecheck | `npx tsc --noEmit` | PASS exit 0, empty log: logs/gate-tsc.log |
| 1 | lint | `npx eslint .` | PASS exit 0; 0 errors, 5 pre-existing warnings (admin-page.tsx, tests/perf) — log: logs/gate-eslint.log |
| 1 | unit (full) | `npx vitest run` | 1415/1416 pass; 1 UNRELATED pre-existing fail: tests/quality/qe-fd-cache.test.ts `logs cache failures to refresh_log` (refresh_log mock assertion; CSS-only diff cannot affect — flagged to PM) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| dbg-1 .dq-holform (refresh.css:545) | debug-1.md | dbg1-01 | verified | |
| dbg-2 .dq-editor (refresh.css:541) | debug-1.md | dbg1-01 | verified | |
| dbg-3 .pw-new-action (people.css:57) | debug-1.md | dbg1-02 | verified | |
| dbg-4 .qa-bq (quality.css:93) | debug-1.md | dbg1-03 | verified | |
| dbg-5 .sch-edit-row (queue.css:214) | debug-1.md | dbg1-03 | verified | |
| dbg-6 .tph-taskform (productivity.css:116) | debug-1.md | dbg1-03 | verified | |
| dbg-7 .pw-inline (people.css:30) | debug-1.md | dbg1-02 | verified | |
| dbg-8 .oo-proj-grid (people.css:226) | debug-1.md | dbg1-02 | verified | |
| dbg-9 .cx-queuerow (cx-kit.css:765) | debug-1.md | dbg1-04 | verified | |
| dbg-10 .dk-otd__grid (desk.css:78) | debug-1.md | dbg1-04 | verified | |
| dbg-11 .cx-filters (cx-kit.css:587) | debug-1.md | dbg1-04 | verified | |
| dbg-12 .aging-page-head .page-actions (refresh.css:30) | debug-1.md | dbg1-01 | verified | |
| dbg-13 .trk-dep-row (operations.css:53) | debug-1.md | dbg1-03 | verified | |

## Blocked / needs user
- (none)
