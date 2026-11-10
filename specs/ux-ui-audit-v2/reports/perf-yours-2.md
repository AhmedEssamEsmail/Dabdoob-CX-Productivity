# perf report - ux-ui-audit-v2 - round 2 (DELTA — verdict clarification)

Purpose: separate two verdicts the round-1 report conflated under one FAIL.
Delegation boundary (user-explicit): this PM owns only the 14 leaf outcomes — S07-15/16/17, S12-20/22/23/24/25/26/28/29/30/33, S14-07. Carried findings **perf-3, perf-12 and shard S13-07 are NOT assigned** to this scope. They are reported here as whole-task blockers with ownership, unmodified in severity — not erased, not downgraded, not re-verified (no authority to measure outside the delegation).

Re-measurement: none needed. `git status` shows the same uncommitted shard set measured in round 1 (144 entries; S13-03/04/05 split products + partial S13-07 memo edits remain foreign-untracked). No new changes to assigned-leaf files since the r6 verify evidence; tl-yours.md is the same checkpoint round 1 cited.

## 1) Assigned-leaf delta verdict: **PASS**

Zero measured regression, zero new findings across the 14 assigned leaves (evidence carried from round 1, still current):

| Metric | Result | Budget | Evidence |
|---|---|---|---|
| New JS from primitive migration | +`Chip.tsx` 664B +`Empty.tsx` 730B +`cx.ts` 124B src (~<0.5KB gz); all 14 touched files already imported the barrel → no new chunk edges | <30KB gz / <10% per route | perf-yours-1.md; `components/ui/index.ts:19,44` |
| DOM nodes per migrated site | pill→Chip 1→1; empty→Empty 2→2; TrendChart empty-state ~−10 nodes | parity | diffs; `cx-kit.css:782` vs `refresh.css:240` |
| New hooks/state/effects | 0 added — pure className/JSX-token swaps; dead `useRef`+`ref={p}` deleted | no new render work | diffs; useState counts unchanged |
| New layout reads / network calls | 0 | none added | grep scoped dirs |
| Selector coverage (CLS risk) | all renamed classes resolve in cx-kit/quality/productivity CSS; legacy rules still present → no unstyled flash | no CLS source | greps cited in round 1 |
| Gates (TL verify r6) | tsc 0; eslint 0 err/526 warns; vitest 1196/1196; build exit 0, 156/156 pages; goldens 169/169; a11y e2e 3/3 | pass | `logs/vfy-*.log`, tl-yours.md |

Criteria check vs PLAN §budgets ("no regression vs `test:performance` baselines"): that suite is a vacuous stub (perf-12) → perf-review defaults applied instead. All default budgets met: no route-JS growth threshold crossed, no new render work, no new fetches, no CLS source. **PASS is evidence-based.**

## 2) Whole-task release verdict: **FAIL** (carried blockers, foreign-owned)

| ID | Sev | Location | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| perf-3 | HIGH | `audit-queue-page.tsx`, `audit-queue-detail.tsx` (1501 LOC), `quality-analytics-page.tsx`, `one-on-ones-views.tsx` (2488 LOC) | Monolithic render trees, no memo boundary (memo imported in only 2 src files). INP<200ms at risk on dense grids. Partially reduced by foreign S13-03/04/05 splits; **remaining memo work is inside needs-split S13-07** (TRACKER:222 — memo hot leaves in one-on-ones-views, tph-grid-*, audit-queue-detail/coverage) — pending PM reshard, not assigned here | Split + `React.memo` row/cell renderers, `useMemo` derived collections | PM (reshard S13-07) → dev |
| perf-12 | MED | `tests/performance/api.spec.ts` | Suite asserts simulated constants; "no regression vs baselines" unenforceable — all PASS/FAIL here is static-measure only | Real budget check (chunk-byte manifest + vitals sample); excluded per DECISION.md "Stays out" — needs maintainer approval | dev (excluded per DECISION) |
| S13-07 | — (process blocker) | TRACKER:180 | `needs-split` — stale Files post S13-03/04/05 splits; RESHARD_NEEDED to PM. Gates the remaining perf-3 memo fix | PM reshard | PM (not this delegation) |

Open: 0B / 1H / 1M / 0L — all carried, zero introduced by the assigned delta.

## Not measured / assumptions
- No runtime vitals (LCP/CLS/INP) — no harness exists (perf-12); static evidence only.
- Whole-task verdict is a rollup, not a re-audit of foreign leaves (S13 splits, S12-32/DQ pending items).
- `nul` file at repo root and stray `results/`/`reports/` at root are pre-existing housekeeping noise, not perf-relevant.
