# FIX spec: nav-scroll-top — reports/ux-1.md

Source findings: `../reports/ux-1.md` (ux-1 MED and ux-2 LOW blocking; ux-3 LOW is
plan-scoped-out per PM — no leaf, no action).
Both findings sit in `scrollSelectedTabIntoView` (`Tabs.tsx`), shared by
`.cx-tabs` (Tabs) and `.tph-tabs` (`tph-grid-page.tsx` `Ya`) — one fix
propagates to both consumers. Same-file leaves => SERIAL: ux1-01 then ux1-02.

## ux1-01: RTL-correct selected-tab reveal in scrollSelectedTabIntoView
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: PLAN #2 (no regression — RTL tab strips must still reveal)
Skills: none
Budget: files=2; actions=3; changed_lines=80; minutes=10

### Goal
`scrollSelectedTabIntoView` reveals the selected tab horizontally in RTL
(`dir=rtl`, set by `i18n.ts` for `lang=ar`). Today it compares physical
`tab.offsetLeft`/`offsetWidth` against raw `list.scrollLeft`, which is
NEGATIVE under the modern RTL scroll model (Chrome/Edge/Firefox/Safari), so
every computed `target` is positive and `scrollTo` clamps to 0: off-screen
selected tabs never reveal and selections snap the strip back to inline-start
(ux-1, fixes `reports/ux-1.md` row ux-1).

### Files
- Edit: `src/features/shared/components/ui/Tabs.tsx` | `scrollSelectedTabIntoView` body, lines 41-48
- Edit: `tests/ui/tabs.test.tsx` | append focused cases for the same function

### Context
- `src/features/shared/components/ui/Tabs.tsx:36-49` | current helper: `left = list.scrollLeft`, `tabLeft/tabRight` from offsets, `scrollTo({left: target})` — breaks under negative RTL scrollLeft
- `src/features/shared/components/ui/Tabs.tsx:75` | `getComputedStyle(...).direction === 'rtl'` — the established in-file RTL detection pattern
- `src/features/shared/shell/i18n.ts:54` | `n.dir = t.lang === 'ar' ? 'rtl' : 'ltr'` — RTL is a supported mode
- `specs/nav-scroll-top/reports/ux-1.md` row ux-1 | exact reviewer-prescribed normalization math
- `tests/ui/tabs.test.tsx` | existing vitest file; import `scrollSelectedTabIntoView` from `@/features/shared/components/ui/Tabs`; jsdom elements lack real scroll — build stub list/tab objects cast to `HTMLElement`, `vi.fn()` for `scrollTo`, spy `window.getComputedStyle` for `direction`

### Contract
Keep signature `scrollSelectedTabIntoView(list: HTMLElement | null): void` and
the existing early returns and reduced-motion behavior read (unchanged — ux1-02
owns that line). Normalize before comparing:
- `const max = list.scrollWidth - list.clientWidth`
- `const rtl = getComputedStyle(list).direction === 'rtl'`
- `const physLeft = rtl ? max + list.scrollLeft : list.scrollLeft`
- compute `targetPhys` with the SAME nearest-edge logic against
  `physLeft` / `physLeft + list.clientWidth`
- `list.scrollTo({ left: rtl ? targetPhys - max : targetPhys, behavior })`
LTR results must be byte-for-byte identical to today. MUST still not touch
`window`/document scroll or any element outside `list`.
Out of scope: the `reduced`/`matchMedia` line (ux1-02), `nextTabIndex`, tab
markup, `tph-grid-page.tsx`, every other file.

### Actions
1. Apply the normalization above inside `scrollSelectedTabIntoView`.
2. Add a vitest case: LTR list (scrollWidth 500, clientWidth 100, scrollLeft 0, selected tab offsetLeft 300/offsetWidth 50) asserts `scrollTo` called with `left: 250` — proves LTR unchanged.
3. Add a vitest case: same geometry but `direction: 'rtl'` and `scrollLeft: -350` asserts `scrollTo` called with `left: -150` — proves physical conversion (targetPhys 250 -> 250-400).

### Done when
- RTL stubs produce a negative `scrollTo` `left` that lands the selected tab inside the viewport; LTR output identical to the pre-fix math.
- `scrollIntoView` still absent from `Tabs.tsx`; no changes outside the two listed files.

### Verify
- Run: `npx vitest run tests/ui/tabs.test.tsx` -> exit 0, new cases pass
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/shared/components/ui/Tabs.tsx tests/ui/tabs.test.tsx` -> exit 0

### Handoff
None (helper signature unchanged; `.tph-tabs` consumer inherits the fix).
Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.

## ux1-02: honor in-app data-reduce-motion in scrollSelectedTabIntoView
Kind: mini
ID: ux1-02
Parent: fix-ux-1
Owner: dev
Depends: ux1-01 (same file — serial)
Criteria: PLAN #2 (no regression — reduced-motion consistency)
Skills: none
Budget: files=1; actions=2; changed_lines=15; minutes=5

### Goal
`scrollSelectedTabIntoView` suppresses smooth scrolling when EITHER the OS
`prefers-reduced-motion` media query OR the in-app `data-reduce-motion` toggle
is on, by using the codebase's shared `prefersReducedMotion()` instead of its
own `matchMedia` read (ux-2, fixes `reports/ux-1.md` row ux-2).

### Files
- Edit: `src/features/shared/components/ui/Tabs.tsx` | import block (line ~4) and the `reduced` line in `scrollSelectedTabIntoView`

### Context
- `src/features/shared/components/ui/Tabs.tsx` | `const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches` — ignores `data-reduce-motion`
- `src/features/shared/shell/i18n.ts:59-65` | `prefersReducedMotion()` checks the media query OR `document.documentElement.hasAttribute('data-reduce-motion')`
- `src/features/shared/components/shell/ui.tsx:12` | precedent import: `import { prefersReducedMotion } from '@/features/shared/shell/i18n'`

### Contract
Replace the `reduced` computation with `const reduced = prefersReducedMotion()`
and add the named import above. No other behavioral change; keep whatever
surrounding code ux1-01 leaves.
Out of scope: the RTL math (ux1-01), `prefersReducedMotion` itself, any other
file or call site.

### Actions
1. Add `import { prefersReducedMotion } from '@/features/shared/shell/i18n'` to the imports.
2. Replace the `const reduced = window.matchMedia?...` line with `const reduced = prefersReducedMotion()`.

### Done when
- `grep -n "matchMedia" src/features/shared/components/ui/Tabs.tsx` returns nothing; helper still compiles and chooses `'auto'`/`'smooth'` via `prefersReducedMotion()`.

### Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/shared/components/ui/Tabs.tsx` -> exit 0
- Run: `npx vitest run tests/ui/tabs.test.tsx` -> exit 0 (no regression)

### Handoff
None. TL runs typecheck/lint/unit at integration.
Write results/ux1-02.md (<=10 lines); TL alone updates TRACKER.md.

## Deferred

- ux-3 LOW (AppShell popstate scroll restore) — PLAN scope/non-goals explicitly
  excludes back/forward restoration; PM already scoped it out. No action.
