# fix-qa-2 — reports/qa-2.md findings

Blocking finding qa-2 (MED): `scrollSelectedTabIntoView` only normalizes the
negative RTL scrollLeft model (Chrome/FF); WebKit's positive-reverse model
(`scrollLeft: max → 0`) breaks tab reveal in Safari+RTL. qa-1 (LOW, carried
forward): `offsetLeft`/`offsetWidth` are offsetParent-relative; a positioned
ancestor skews the math. The rect-delta rewrite QA recommends for qa-2 also
removes the offsetParent dependence, so qa-1 is fixed trivially in the same
leaf.

## qa2-01: Cross-model RTL tab reveal in scrollSelectedTabIntoView
Kind: mini
ID: qa2-01
Parent: fix-qa-2
Owner: dev
Depends: none
Criteria: reports/qa-2.md finding qa-2 (MED); qa-1 (LOW) closed as side effect
Skills: none
Budget: files=2; actions=4; changed_lines=80; minutes=10

### Goal
`scrollSelectedTabIntoView` reveals the selected tab in LTR and in BOTH RTL
scrollLeft models (negative Chrome/FF and positive-reverse WebKit/Safari), and
its geometry no longer depends on `offsetParent` positioning.

### Files
- Edit: `src/features/shared/components/ui/Tabs.tsx` | `scrollSelectedTabIntoView` (~L37-53) only
- Edit: `tests/ui/tabs.test.tsx` | `scrollSelectedTabIntoView` describe block only

### Context
- `specs/nav-scroll-top/reports/qa-2.md` | findings qa-2 (with exact fix options) and qa-1
- `src/features/shared/components/ui/Tabs.tsx:37-53` | current negative-model-only math
- `src/features/cx-productivity/components/tph-grid-page.tsx:13,69` | other consumer of this helper

### Contract
Keep the exported signature `scrollSelectedTabIntoView(list: HTMLElement | null): void`
and keep the `prefersReducedMotion()` smooth/auto behaviour gating.
Acceptable implementations (QA's options; pick ONE):
a. Rect-delta approach (preferred): measure via `getBoundingClientRect()` deltas
   between the selected tab and `list` (physical, model-agnostic — also removes
   the `offsetParent` dependence, closing qa-1), then apply the delta via
   `list.scrollBy({left: delta, behavior})`.
b. Model detection: if `rtl && list.scrollLeft > 0` treat as positive-reverse
   (`physLeft = max - list.scrollLeft`) and emit the model-correct scroll value.
Must NOT scroll the window — only the tablist horizontally.
Out of scope: `nextTabIndex`, keyboard handling, rendering/ARIA, all other files.

### Actions
1. Rewrite the measurement/write logic in `scrollSelectedTabIntoView` per option (a) or (b).
2. Update the two existing `scrollSelectedTabIntoView` unit cases to the new mechanism.
3. Add a positive-reverse RTL case (scrollLeft > 0 model) asserting the off-screen tab is revealed — must fail on the old code.
4. Run targeted checks (below).

### Done when
- Unit tests cover LTR, RTL negative, and RTL positive-reverse; all pass and the new case fails on pre-change code.
- No `offsetLeft`/`offsetWidth` dependence remains (qa-1 closed), or the file's results note explicitly explains why it was kept.
- tsc + eslint exit 0 on the two changed files.

### Verify
- Run: `npx vitest run tests/ui/tabs.test.tsx` -> all cases pass
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/shared/components/ui/Tabs.tsx tests/ui/tabs.test.tsx` -> exit 0

### Handoff
Helper signature unchanged; tph-grid-page consumer needs no changes.
Write results/qa2-01.md (<=10 lines); TL alone updates TRACKER.md.
