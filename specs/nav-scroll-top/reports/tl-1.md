# TL report 1 — nav-scroll-top (FIX from reports/debug-1.md)

## Outcome
All 4 debug findings fixed and verified; e2e regression spec now passes 2/2.

## Leaves (spec/fix-debug-1.md)
- dbg1-01 (dbg-1): `scrollSelectedTabIntoView` — horizontal-only `list.scrollTo`
  in `Tabs.tsx`, exported via `ui/index.ts`. Removed window-propagating
  `scrollIntoView`.
- dbg1-02 (dbg-2): `tph-grid-page.tsx` `Ya` effect uses the shared helper.
- dbg1-03 (dbg-3): `agents-page.tsx` 800ms rAF `window.scrollTo` pin deleted.
- dbg1-04 (dbg-4): `AppShell.tsx` `useLayoutEffect([path])` — `scrollTo(0,
  instant)` after route change; skips initial mount and real `#` anchors.

## Key integration finding
After dbg1-01 the regression still failed (scrollY=600). Instrumented probe
(no source edits) showed ZERO JS scroll calls before the 600-restore —
`overflow-anchor:none` held the top, proving browser **scroll anchoring** as
the residual puller. dbg-4 (reported LOW/defense-in-depth) was promoted to
blocking leaf dbg1-04; with it the spec passes.

## Changed files
- src/features/shared/components/ui/Tabs.tsx (+17/-4)
- src/features/shared/components/ui/index.ts (+1)
- src/features/cx-productivity/components/tph-grid-page.tsx (+1/-4)
- src/features/cx-people/components/agents-page.tsx (-27)
- src/features/shared/components/shell/AppShell.tsx (+9)
- specs/nav-scroll-top/{spec,results,reports,TRACKER.md}; e2e/nav-scroll-top.spec.ts (debugger-authored, kept)

## Gates (logs: specs/nav-scroll-top/logs/)
- `npx tsc --noEmit` exit 0
- `npx eslint .` exit 1 — 1 BASELINE error `tests/golden/queue-aggregates.test.ts` (committed, foreign); changed files all clean
- `npx vitest run` 1509/1510 — 1 BASELINE failure `tests/freeze/sheets-freeze-scan.test.ts` (committed scripts/ops sheet readers; unrelated)
- `npx playwright test e2e/nav-scroll-top.spec.ts --project=chromium --workers=1` exit 0, 2/2 passed (desktop + mobile 375px)
- `npm run test:e2e` full suite and `npx next build` not run (heavy; PM/QA gate scope)
- DELTA for reviewer: the 5 source files above.

## Notes
- Temp probe spec `e2e/nav-scroll-probe.spec.ts` deleted after use.
- No reviewer shards requested or spawned; dbg-4 promotion rationale recorded.
