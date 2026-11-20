# TRACKER: nav-scroll-top
Mode: FIX — round 1: `reports/debug-1.md` (done). Round 2: `reports/ux-1.md`
(ux-1 MED + ux-2 LOW blocking; ux-3 LOW plan-scoped-out, no action).
Round 3: `reports/qa-2.md` (qa-2 MED blocking; qa-1 LOW fixed trivially in
same leaf via QA's recommended rect-delta rewrite).
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Baseline dirty tree (foreign — do NOT touch): `specs/table-center-align/*`,
`src/app/cx-kit.css`, `src/app/styles/quality.css`,
`src/features/cx-quality/*`, `tests/css/table-center-align.test.ts`,
`tests/quality/*`, `results/adm1-01.md`, `specs/qa-build-missing-agents/`,
`e2e/nav-scroll-top.spec.ts` (debugger-authored regression, keep).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| fix-debug-1 | package/- | - | - | n/a | not dispatchable | pending | spec/fix-debug-1.md |
| dbg1-01 | mini/fix-debug-1 | dev | none | 2/3/60/10 | PASS | done | results/dbg1-01.md; tsc+eslint exit 0; helper exported |
| dbg1-02 | mini/fix-debug-1 | dev | dbg1-01 | 1/2/20/5 | PASS | done | results/dbg1-02.md; tsc+eslint exit 0 |
| dbg1-03 | mini/fix-debug-1 | dev | dbg1-01 | 1/1/30/5 | PASS | done | results/dbg1-03.md; tsc+eslint exit 0 |
| dbg1-04 | mini/fix-debug-1 | dev | dbg1-01 | 1/2/20/5 | PASS | done | results/dbg1-04.md; e2e regression 2/2 pass |
| fix-ux-1 | package/- | - | - | n/a | not dispatchable | done | spec/fix-ux-1.md; integration gates pass |
| ux1-01 | mini/fix-ux-1 | dev | none | 2/3/80/10 | PASS | done | results/ux1-01.md; vitest 7/7, tsc+eslint 0 |
| ux1-02 | mini/fix-ux-1 | dev | ux1-01 (same file, serial) | 1/2/15/5 | PASS | done | results/ux1-02.md; vitest 7/7, tsc+eslint 0 |
| fix-qa-2 | package/- | - | - | n/a | not dispatchable | done | spec/fix-qa-2.md; gates pass |
| qa2-01 | mini/fix-qa-2 | dev | none | 2/4/80/10 | PASS | done | results/qa2-01.md; 2 attempts (attempt 1 sign-flip corrected); vitest 8/8, tsc+eslint 0, e2e 2/2 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit` | exit 0 |
| 1 | lint | `npx eslint .` | exit 1 — 1 pre-existing error in committed `tests/golden/queue-aggregates.test.ts` (baseline, not our diff); all 4 changed files clean |
| 1 | unit | `npx vitest run` | 1509/1510 pass — 1 pre-existing failure `tests/freeze/sheets-freeze-scan.test.ts` (committed scripts/ops offenders, baseline) |
| 1 | e2e regression | `npx playwright test e2e/nav-scroll-top.spec.ts --project=chromium --workers=1` | exit 0 — 2/2 passed (desktop+mobile) after dbg1-04 |
| 2 | typecheck | `npx tsc --noEmit` | exit 0 (logs/r2-tsc.log) |
| 2 | lint | `npx eslint src/features/shared/components/ui/Tabs.tsx tests/ui/tabs.test.tsx` | exit 0 (logs/r2-eslint.log) |
| 2 | unit | `npx vitest run` | exit 1 — 1511/1512; 1 SAME BASELINE failure `tests/freeze/sheets-freeze-scan.test.ts` (foreign, unchanged since r1) |
| 3 | typecheck | `npx tsc --noEmit` | exit 0 (logs/r3-tsc.log) |
| 3 | lint | `npx eslint src/features/shared/components/ui/Tabs.tsx tests/ui/tabs.test.tsx` | exit 0 (logs/r3-eslint.log) |
| 3 | unit (targeted) | `npx vitest run tests/ui/tabs.test.tsx` | exit 0 — 8/8 (logs/r3-vitest-tabs.log) |
| 3 | e2e regression | `npx playwright test e2e/nav-scroll-top.spec.ts --project=chromium --workers=1` | exit 0 — 2/2 (logs/r3-e2e.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| dbg-1 HIGH Tabs.tsx scrollIntoView | reports/debug-1.md | dbg1-01 | done | results/dbg1-01.md |
| dbg-2 HIGH tph-grid-page scrollIntoView | reports/debug-1.md | dbg1-02 | done | results/dbg1-02.md |
| dbg-3 MED agents-page scroll pin | reports/debug-1.md | dbg1-03 | done | results/dbg1-03.md |
| dbg-4 LOW AppShell scroll pin | reports/debug-1.md | dbg1-04 | done | promoted from deferred: e2e still failed (scroll anchoring, probe-verified) |
| ux-1 MED Tabs.tsx RTL scrollLeft | reports/ux-1.md | ux1-01 | done | physical-offset normalization per reviewer's exact fix; RTL unit case passes |
| ux-2 LOW Tabs.tsx matchMedia | reports/ux-1.md | ux1-02 | done | `prefersReducedMotion()` replaces matchMedia read |
| ux-3 LOW AppShell popstate | reports/ux-1.md | none | deferred | PLAN non-goal (back/forward); PM-scoped out |
| qa-2 MED Tabs.tsx RTL positive-reverse model | reports/qa-2.md | qa2-01 | done | rect-delta + model-agnostic `scrollBy({left: delta})`; scrollLeft no longer read/written — immune to all models |
| qa-1 LOW Tabs.tsx offsetParent-relative geometry | reports/qa-2.md (carried from qa-1.md) | qa2-01 | done | trivial: offsetLeft/offsetWidth removed by the same rect-delta rewrite |

## Blocked / needs user
- (none)
