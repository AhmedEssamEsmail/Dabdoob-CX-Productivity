# ux report - nav-scroll-top - round 1 (FULL)

Verdict: FAIL
Open: 0/0/1/2

Scope: the 5 changed source files from `reports/tl-1.md`
(`Tabs.tsx`, `ui/index.ts`, `tph-grid-page.tsx`, `agents-page.tsx`,
`AppShell.tsx`). Diff-only review; the bug fix itself is UX-correct.

States checked: keyboard (tab roving unchanged), focus (none regressed by
diff), mobile (e2e 375px pass per tl-1), reduced motion (see ux-2), RTL
(see ux-1), long text/overflow (tab strip overflow-x), dark, loading,
empty, error, disabled — last four n/a (no new UI rendered).

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|----|-----|----------------------------|----------|-----------|------------|
| ux-1 | MED | src/features/shared/components/ui/Tabs.tsx:41-48 (`.cx-tabs`, `.tph-tabs` via tph-grid-page.tsx:69) | `scrollSelectedTabIntoView` compares `tab.offsetLeft`/`offsetWidth` (physical, >=0) against `list.scrollLeft`. In RTL (`lang=ar` sets `dir=rtl`, i18n.ts:54) Chrome/Firefox/Safari use the negative-scrollLeft model, so `scrollLeft <= 0`; every computed `target` is positive and `scrollTo({left: target})` clamps to 0. Result in Arabic UI: selecting an off-screen tab never reveals it, and any selection snaps a user-scrolled strip back to inline-start. Keyboard handlers in the same files already branch on `direction === 'rtl'`, so RTL is a supported mode; the previous native `scrollIntoView` handled it. | Normalize to physical offsets: `const max = list.scrollWidth - list.clientWidth; const rtl = getComputedStyle(list).direction === 'rtl'; const physLeft = rtl ? max + left : left;` compute `targetPhys` against `physLeft`/`physLeft + clientWidth`, then `list.scrollTo({ left: rtl ? targetPhys - max : targetPhys, ... })`. | dev |
| ux-2 | LOW | src/features/shared/components/ui/Tabs.tsx:46 | Helper checks only `matchMedia('(prefers-reduced-motion)')`, ignoring the in-app `data-reduce-motion` toggle that the codebase's shared `prefersReducedMotion()` (i18n.ts:59-65) and `Gs()`/`reduceMotion()` siblings all honor. Minor: smooth horizontal slide on a secondary control; gap pre-existed in the inline version. | Replace the matchMedia read with `prefersReducedMotion()` from `@/features/shared/shell/i18n`. | dev |
| ux-3 | LOW | src/features/shared/components/shell/AppShell.tsx:221-226 | The path-keyed `useLayoutEffect` scrolls to top on *any* pathname change, including browser Back/Forward (popstate): Back now lands at scrollY=0 instead of restoring prior position. PLAN explicitly lists back/forward semantics as a non-goal — logged only, no fix required this round. | (Out of scope.) If ever addressed: skip the pin when `window.history.state?.idx` indicates a pop, or gate on nav-rail-originated pushes. | dev |

## Passes confirmed (no finding)

- AppShell guard runs in `useLayoutEffect` pre-paint with `behavior:'instant'` — no flash, no smooth-scroll motion issue; skips initial mount (deep links, browser restoration) and real `#` anchors (skip link `#main`, `#up-next`, tabs) via the `!hash.startsWith('#/')` check.
- Same-path query-param changes (`use-search-param-state` `scroll:false` pushes) don't retrigger the effect — scroll correctly preserved.
- Both scroll containers are correct targets: `.cx-tabs` and `.tph-tabs` both have `overflow-x:auto` — `list.scrollTo` scrolls only the strip, never the window. This is the core fix and it is UX-sound.
- `agents-page.tsx` removal of the 800ms rAF scroll-pin eliminates a fight-the-user hack — improvement.
- Remaining `scrollIntoView` call sites (audit-queue:129/320, ctls:332, overview:270, hub-shared:71, CommandPalette:135) are all user-action-triggered, not mount-time — out of scope and correct.
- No new interactive elements, so no new label/focus/target-size obligations; WIG rules checked against the diff (layout reads are in effects, not render; `instant` honors reduced-motion trivially).

## Not verified / assumptions

- RTL scrollLeft model assumed negative (true for current Chrome/Edge/Firefox/Safari; only legacy WebKit used positive-reverse). ux-1 should be re-checked in a live Arabic session if a cheap check exists.
- e2e spec passes 2/2 per tl-1 (desktop + 375px); not re-run — layout judged from code.
- Back/forward restoration (ux-3) is plan-scoped out; flagged so the PM can consciously accept.
