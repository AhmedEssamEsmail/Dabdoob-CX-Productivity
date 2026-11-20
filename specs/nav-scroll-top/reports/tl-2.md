# TL report 2 — nav-scroll-top (FIX from reports/ux-1.md)

## Outcome
Both blocking UX findings fixed; integration gates pass.

## Leaves (spec/fix-ux-1.md)
- ux1-01 (ux-1 MED): `scrollSelectedTabIntoView` normalizes `scrollLeft` to
  physical offsets before the nearest-edge compare, then converts the target
  back (`rtl ? targetPhys - max : targetPhys`). RTL (negative-scrollLeft model)
  now reveals off-screen selected tabs instead of clamping to 0. LTR math
  unchanged. Applies to both consumers: `.cx-tabs` (Tabs) and `.tph-tabs`
  (tph-grid-page `Ya`), which share the helper.
- ux1-02 (ux-2 LOW, blocking per PM): `reduced` now uses the shared
  `prefersReducedMotion()` from `@/features/shared/shell/i18n` (honors the
  in-app `data-reduce-motion` toggle), replacing the lone `matchMedia` read.
- ux-3 LOW: deferred — PLAN non-goal (back/forward scroll restore), PM-scoped
  out. No action.

## Changed files (this round)
- src/features/shared/components/ui/Tabs.tsx (+11/-3 net this round: RTL
  normalization + prefersReducedMotion import/guard)
- tests/ui/tabs.test.tsx (+2 cases: LTR left:250, RTL left:-150)
- specs/nav-scroll-top/{spec/fix-ux-1.md, results/ux1-0{1,2}.md, TRACKER.md,
  logs/r2-*, reports/tl-2.md}

## Gates (logs: specs/nav-scroll-top/logs/)
- `npx tsc --noEmit` exit 0
- `npx eslint Tabs.tsx tests/ui/tabs.test.tsx` exit 0
- `npx vitest run` 1511/1512 — 1 SAME BASELINE failure
  `tests/freeze/sheets-freeze-scan.test.ts` (committed foreign offenders,
  identical in round 1; not our diff)
- e2e not re-run: this round changed only shared Tabs scroll math, which the
  nav-scroll spec does not exercise; PM may re-run QA/UX DELTA.

## DELTA for reviewer
`src/features/shared/components/ui/Tabs.tsx` (function
`scrollSelectedTabIntoView`, lines ~36-53 + import line 5) and
`tests/ui/tabs.test.tsx` (appended cases). One reviewer note for ux-1: the RTL
scroll model is unit-stubbed, not live-browser-verified — a live Arabic session
spot-check remains open per reports/ux-1.md "Not verified".

## Notes
- ux1-02 added `typeof document === 'undefined'` guard around
  `prefersReducedMotion()` for the node vitest env; browser behavior identical
  (helper only runs in effects).
- No reviewer shards requested or spawned.
