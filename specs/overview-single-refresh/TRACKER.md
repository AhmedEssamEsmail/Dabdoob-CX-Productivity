# TRACKER: overview-single-refresh
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (not ours): `specs/ui-shell-polish/reports/*.png` (modified);
untracked `specs/next-security-upgrade/`, `specs/qa-build-no-touches/`,
`specs/unified-page-format/logs/`; untracked `tests/overview-single-refresh.test.ts`
(regression test from debugger, part of this task's evidence).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| fix-dbg-1 | package/- | - | - | n/a | not dispatchable | verified | reports/debug-1.md |
| dbg1-01 | mini/fix-dbg-1 | dev | none | 1/2/10/5 | PASS | verified | results/dbg1-01.md; tsc clean |
| dbg1-02 | mini/fix-dbg-1 | dev | dbg1-01 | 1/5/30/10 | PASS | verified | results/dbg1-02.md; vitest 2/2 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| (none) | | | |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | regression | `npx vitest run tests/overview-single-refresh.test.ts` | PASS 2/2 |
| 1 | typecheck | `npx tsc --noEmit` | PASS (log: logs/final-tsc.log) |
| 1 | lint (touched files) | `npx eslint src/features/cx-hub/components/overview-page.tsx src/features/cx-hub/components/hub-shared.tsx` | PASS (log: logs/final-eslint.log) |
| 1 | unit | `npx vitest run` | PASS 117 files / 1479 tests (log: logs/final-vitest.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| dbg-1 duplicate `Hf` in `Queues now` (HIGH) | reports/debug-1.md | dbg1-02 | done | results/dbg1-02.md |
| dbg-2 `Eo` lacks deps passthrough (HIGH) | reports/debug-1.md | dbg1-01 | done | results/dbg1-01.md |

## Blocked / needs user
- (none)
