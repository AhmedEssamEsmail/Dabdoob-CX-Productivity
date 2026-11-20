# FIX spec: nav-scroll-top — reports/debug-1.md

Source findings: `../reports/debug-1.md` (all rows blocking except dbg-4 LOW, deferred).
Regression test `e2e/nav-scroll-top.spec.ts` already exists (untracked, authored by debugger) and currently fails; do not edit it. Integration runs it after leaves land.

## dbg1-01: horizontal-only selected-tab reveal in shared Tabs
Kind: mini
ID: dbg1-01
Parent: fix-debug-1
Owner: dev
Depends: none
Criteria: PLAN #1, #2
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=10

### Goal
The `[active]` mount/change effect in the shared `Tabs` component reveals the
selected tab horizontally inside `.cx-tabs` WITHOUT ever touching the
window/document scroll chain (fixes debug-1 dbg-1; root cause of the
nav-lands-scrolled bug on every Tabs consumer).

### Files
- Edit: `src/features/shared/components/ui/Tabs.tsx` | the `useEffect([active])` at lines 54-59 + new exported helper
- Edit: `src/features/shared/components/ui/index.ts` | re-export the helper next to the existing `Tabs` export (line ~34)

### Context
- `src/features/shared/components/ui/Tabs.tsx:44-59` | `listRef` on `.cx-tabs`, effect calls `scrollIntoView({inline:'nearest',block:'nearest',behavior:'smooth'})` — smooth scroll propagates to document and re-lands ~750 ms later on the stale pre-navigation scrollY
- `specs/nav-scroll-top/reports/debug-1.md` | instrumented proof: noop/behavior:'auto' patches hold scrollY at top
- `e2e/nav-scroll-top.spec.ts` | existing failing regression spec (do not edit)

### Contract
New exported function `scrollSelectedTabIntoView(list: HTMLElement | null): void`:
- queries `list` for `[aria-selected="true"]`; no-op if absent
- computes horizontal reveal from `tab.offsetLeft`/`tab.offsetWidth` vs
  `list.scrollLeft`/`list.clientWidth` (nearest-edge semantics)
- calls `list.scrollTo({ left: target, behavior })` with
  `behavior: 'smooth'`, or `'auto'` when
  `matchMedia('(prefers-reduced-motion: reduce)').matches`
- MUST NOT call `scrollIntoView`, `window.scroll*`, or touch any element
  outside `list`
Re-export it from `ui/index.ts` so `dbg1-02` can import it via
`@/features/shared/components/ui`.
Out of scope: keyboard nav logic, tab markup, any other file, `agents-page.tsx`
pin removal (dbg1-03), tph tablist (dbg1-02).

### Actions
1. Add `scrollSelectedTabIntoView` to `Tabs.tsx` per contract (module scope, exported).
2. Replace the effect body (lines 54-59) with `scrollSelectedTabIntoView(listRef.current)` keeping the `[active]` dep.
3. Add `export { scrollSelectedTabIntoView } from './Tabs'` to `ui/index.ts`.

### Done when
- No `scrollIntoView` remains in `Tabs.tsx`; selected tab still reveals horizontally inside overflowing `.cx-tabs`.
- `scrollSelectedTabIntoView` is importable from `@/features/shared/components/ui`.

### Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/shared/components/ui/Tabs.tsx src/features/shared/components/ui/index.ts` -> exit 0

### Handoff
Exports `scrollSelectedTabIntoView` for `dbg1-02`. Unblocks `dbg1-03` (pin removal).
Write results/dbg1-01.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-02: use shared horizontal-only reveal in TPH tablist
Kind: mini
ID: dbg1-02
Parent: fix-debug-1
Owner: dev
Depends: dbg1-01
Criteria: PLAN #1, #2
Skills: none
Budget: files=1; actions=2; changed_lines=20; minutes=5

### Goal
The TPH `Ya` tablist's `[tab]` effect uses the shared horizontal-only helper
instead of element `scrollIntoView` (fixes debug-1 dbg-2; `/tph` reproduced
residual scrollY=191).

### Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | `Ya` component effect at lines 66-73 + its import line 11

### Context
- `src/features/cx-productivity/components/tph-grid-page.tsx:66-73` | `ref` on `.tph-tabs`; effect queries `[aria-selected="true"]` and calls `scrollIntoView({inline:'nearest',block:'nearest',behavior: rm ? 'auto' : 'smooth'})`
- `src/features/shared/components/ui/Tabs.tsx` | provides `scrollSelectedTabIntoView` after dbg1-01

### Contract
Call `scrollSelectedTabIntoView(ref.current)` in the `[tab]` effect; delete the
inline matchMedia/querySelector/scrollIntoView code. Import the helper via the
existing `@/features/shared/components/ui` barrel import (line 11).
Out of scope: keyboard nav, other components in this file, `tph-grid-shared.ts`,
`tph-grid-views.tsx`, `tph-grid-matrix.tsx`.

### Actions
1. Add `scrollSelectedTabIntoView` to the named import from `@/features/shared/components/ui`.
2. Replace the effect body (lines 68-73) with `scrollSelectedTabIntoView(ref.current)` keeping the `[tab]` dep.

### Done when
- No `scrollIntoView` or inline `matchMedia` reduced-motion check remains in `Ya`; selected TPH tab still reveals horizontally inside `.tph-tabs`.

### Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/cx-productivity/components/tph-grid-page.tsx` -> exit 0

### Handoff
None.
Write results/dbg1-02.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-03: remove agents-page scroll-pin workaround
Kind: mini
ID: dbg1-03
Parent: fix-debug-1
Owner: dev
Depends: dbg1-01
Criteria: PLAN #1, #2
Skills: none
Budget: files=1; actions=1; changed_lines=30; minutes=5

### Goal
Delete the 800 ms `requestAnimationFrame` `window.scrollTo(0,0)` pin in
`agents-page.tsx` — a workaround for the bug fixed by dbg1-01 (debug-1 dbg-3);
it blocks user scroll and would clobber `#hash` deep links.

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | the `didPinTop` block at lines 597-621 (comment + ref + `useEffect([data])`)

### Context
- `src/features/cx-people/components/agents-page.tsx:597-621` | pin block with comment "scorecard Tabs scroll the selected tab into view on mount … drags the window down"; `didPinTop` ref is used ONLY by this effect
- `specs/nav-scroll-top/reports/debug-1.md` dbg-3 | after the shared fix lands, the pin compensates for nothing

### Contract
Remove the comment block, `const didPinTop = useRef(false)`, and the whole
`useEffect` (including its cleanup and the `intents`/`opts` listener wiring).
Keep the adjacent `useEffect([view, agent, ...])` detail-fetch effect untouched.
`useRef`/`useEffect` imports stay (still used elsewhere in the file).
Out of scope: everything else in this file; the page's `Tabs` usage at ~line 800.

### Actions
1. Delete lines 597-621 (comment through the closing `}, [data])`).

### Done when
- `grep -n "didPinTop\|scrollTo" src/features/cx-people/components/agents-page.tsx` returns nothing; file still compiles.

### Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/cx-people/components/agents-page.tsx` -> exit 0

### Handoff
None.
Write results/dbg1-03.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-04: pin scrollY=0 on route change in AppShell (scroll-anchoring guard)
Kind: mini
ID: dbg1-04
Parent: fix-debug-1
Owner: dev
Depends: dbg1-01
Criteria: PLAN #1, #2
Skills: none
Budget: files=1; actions=2; changed_lines=20; minutes=5

### Goal
After client-side route change, the window lands at scrollY === 0 even when the
fresh page renders shorter then grows (browser scroll anchoring re-pushes the
viewport toward the old offset — PROVEN by probe: after dbg1-01, no JS call
moves the scroll, yet it returns to 600; `overflow-anchor:none` holds it).
Was reported as dbg-4 LOW/defense-in-depth; integration showed it is REQUIRED
for PLAN #1 (regression spec still failed at scrollY=600/88 without it).

### Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | new `useLayoutEffect` right after the `firstRoute` block at lines 212-217

### Context
- `src/features/shared/components/shell/AppShell.tsx:212-217` | `firstRoute` ref + `useEffect([path])` — `firstRoute.current` is still `true` during the first `useLayoutEffect` pass (layout effects run before the passive effect that flips it), so `if (firstRoute.current) return` skips the initial mount correctly
- `src/features/shared/components/shell/AppShell.tsx:122-140` | `pathname`, `path = routePath(pathname)`, `useLayoutEffect` already imported
- `src/features/shared/components/shell/HashShim.tsx` | legacy `#/…` route-hash rewriting — real in-page anchors are non-`#/` hashes
- `e2e/nav-scroll-top.spec.ts` | failing regression spec asserting `scrollY === 0` (do not edit)

### Contract
New `useLayoutEffect` keyed on `[path]`:
- `if (firstRoute.current) return` — initial mount stays untouched
- read `window.location.hash`; if set and NOT starting with `'#/'`, return —
  real in-page anchors/deep links keep their browser landing (PLAN #2)
- otherwise `window.scrollTo({ top: 0, behavior: 'instant' })`
  (cast to `ScrollBehavior` if the lib.dom version lacks `'instant'`)
Out of scope: everything else in this file — nav rail, palette, HashShim,
SiteChrome.tsx, any `overflow-anchor` CSS.

### Actions
1. Insert the `useLayoutEffect` immediately after the `firstRoute` effect (after line 217) per contract.
2. Keep imports as-is (`useLayoutEffect` already imported).

### Done when
- The effect exists keyed on `[path]` with the two skip conditions; `tsc` and `eslint` on the file pass.

### Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/shared/components/shell/AppShell.tsx` -> exit 0

### Handoff
None. TL runs the e2e regression spec at integration.
Write results/dbg1-04.md (<=10 lines); TL alone updates TRACKER.md.

## Deferred

- (none — former dbg-4 LOW promoted to leaf dbg1-04 after integration proved it blocking: scroll anchoring restores the pre-nav offset with zero JS calls)
