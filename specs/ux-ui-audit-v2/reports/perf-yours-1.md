# perf report - ux-ui-audit-v2 - round 1 (DELTA)

Scope: owned half only — S07-15/16/17, S12-20/22/23/24/25/26/28/29/30/33 (S12-27 superseded), S14-07 and their changed regions. Static measurement (diffs, greps, byte/line counts) + TL verify logs; no runtime traces run. `npm run test:performance` is a vacuous stub (PLAN §research-notes, PERF-12) — **not** treated as an enforced budget; budgets cited are the perf-review defaults.

Verdict: **FAIL** — carried HIGH finding open in changed regions (perf-3); the scoped delta itself shows **no measured regression, zero new findings**.
Open: 0B / 1H / 1M / 0L (both carried, neither introduced by this delta)

## Measurements

| Metric | Before → After | Budget | Evidence |
|---|---|---|---|
| Build | exit 0, compile 9.5s, 156/156 static pages | gate green | `logs/vfy-build.log` |
| `test:performance` | 14/14 pass, 300ms — asserts hardcoded constants (`simulatedDuration=50`) | vacuous, not a gate | `logs/tl-perf.log`, `tests/performance/api.spec.ts:1-5` |
| New JS from primitive migration | +`Chip.tsx` 664B +`Empty.tsx` 730B +`cx.ts` 124B src (~<0.5KB gz); both already exported via `components/ui/index.ts:19,44` and re-exported via `shell/ui.tsx:202`; 14/14 touched cx-quality files already imported the barrel → no new chunk edges | <30KB gz / <10% per route | source + `git diff` import lines |
| DOM nodes per migrated site | `pill` span→`Chip` span: 1→1 (both render a `::before` dot — `cx-kit.css:782` vs `refresh.css:240`); `empty` div>div.s→`Empty` div>strong: 2→2; TrendChart `O===0` renders `<Empty>` instead of scroll-div+SVG: ~−10 nodes (quality-scores-page.tsx:99-105) | parity | diff `logs` + source |
| New hooks/state/effects in changed regions | 0 added — pure className/JSX-token swaps; dead `useRef`+`ref={p}` deleted (S07-16) | no new render work | diffs; `useState` grep: quality 121, people 148, hub 88, queue 101 (pre-existing profile) |
| New layout reads / network calls | 0 — `getBoundingClientRect`/`offset*` hits are pre-existing tooltip handlers only | none added | grep scoped dirs |
| Selector coverage (CLS risk) | all renamed classes resolve: `.cx-panel` cx-kit.css:524, `.cx-chip` +`[data-status]` :42-62/:770, `.cx-empty` :799, `.qa-details-panel` quality.css:123-126 (4 rules renamed 1:1, same props), `.qs-hero--flat` quality.css:192, `.pv-card--flat` productivity.css:233; legacy `.card`/`.pill`/`.empty` rules still present (refresh.css:58,233 — S12-32 scope) → any missed site still styled | no unstyled flash | greps above |
| Residual loser-class sites | 0 bare `card`/`pill`/`empty` className tokens in `src/features/`; remaining hits are exempt `-card`/`-empty`-suffixed skins (`md-card*`, `qa-card*`, `tph-card*`, `pv-cards`, `md-empty`, `va-empty`, `trk-empty` on `<Empty>`) | 0 | grep `className="[^"]*\b(card|pill|empty)` |
| Dead classes removed | `.qa-health`, `.qa-cov-wrap` had **no** CSS rules anywhere → zero paint impact | — | grep stylesheets; S07-16 diff |
| Gates (TL verify) | tsc 0; eslint 0 err/526 warns (−431 vs tl5); vitest 1196/1196; goldens 169/169; a11y e2e 3/3 10.4s | pass | tl-yours.md, `logs/vfy-*.log`, `s14-07-e2e.log` |

## Findings

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| perf-3 | HIGH | `src/features/cx-quality/components/audit-queue-page.tsx` (620 LOC, 8 hooks), `audit-queue-detail.tsx` (1501 LOC), `quality-analytics-page.tsx` (1249 LOC), `one-on-ones-views.tsx` (2488 LOC) | Carried from audit-perf.md: monolithic render trees, no memo boundary — `React.memo`/`memo` imported in only 2 src files; useState counts unchanged by this delta (quality 121, people 148). Route tree still re-renders full page per keystroke; INP<200ms at risk on dense grids. This delta's token swaps neither worsen nor fix it (leaf components add 0 state). Split + memo row/cell renderers | Split data/presentational subtrees; `React.memo` on row renderers; `useMemo` derived collections (audit-queue + tph-grid + one-on-ones first) | dev |
| perf-12 | MED | `tests/performance/api.spec.ts` | Carried: suite asserts simulated constants; "no regression vs baselines" currently unenforceable — this report's PASS/FAIL on the delta is static-measure only. DECISION.md marks rewrite "Stays out" | Real check per budget class (chunk-byte budget from build manifest + Playwright vitals sample) — excluded from this plan; needs maintainer approval | dev (excluded per DECISION) |

## Not measured / assumptions

- No runtime vitals (LCP/CLS/INP) sampled — no harness budget exists; static evidence only (node counts, selector resolution, hook deltas).
- Per-route first-load JS bytes unavailable: Next 16.4.3 Turbopack build log prints routes but no size table; `<0.5KB gz` estimate is from source bytes of two leaf components, not a manifest parse.
- S14-07 changed zero source (e2e re-run only) — excluded from delta math.
- File-size drops (e.g. audit-queue-page −1687 diff lines) come from foreign split shards outside this scope; credited as context only, not claimed.
- `Link`/`resolveLink` swap in quality-scores-page.tsx (foreign change in a scoped file) adds a standard next/link — no measurable cost; noted not flagged.
