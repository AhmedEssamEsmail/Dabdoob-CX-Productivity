# S03-01: CommandPalette component — fuzzy page switcher + unit test
Kind: mini
ID: S03-01
Parent: S03
Owner: dev
Depends: none
Criteria: PLAN #3
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\react-best-practices\SKILL.md
Budget: files=2; actions=5; changed_lines=300; minutes=10

## Goal
New `shell/CommandPalette.tsx`: a modal ⌘K dialog listing the pages the
signed-in user may open, fuzzy-filtered, fully keyboard navigable.

## Files
- Create: `src/features/shared/components/shell/CommandPalette.tsx` | dialog + list + key handling
- Create: `tests/shell/command-palette.test.ts` | unit tests for `filterPalettePages`

## Context
- `src/features/shared/components/shell/registry.ts:6-13` | `RouteDef {path,title,group,reqs,roles,purpose}` + `PAGES`
- `src/features/shared/shell/gates.ts` | `pageAllowed(page,boot)`, `inApp`, `groupEntryLink`, `resolveLink`, `pageHref`
- `src/features/shared/components/shell/AppShell.tsx:322,379-461` | how links resolve per app + `GROUP_LABELS`
- `mockups/assets/mock.css` (S02-02) | `.cpk-*` class contract

## Contract
`'use client'`. Props: `{ boot: Bootstrap; ctxApp: string; onClose: () => void }`.
- `export function filterPalettePages(pages: RouteDef[], query: string):
  RouteDef[]` — pure: subsequence/case-insensitive fuzzy match on
  `title + ' ' + path + ' ' + group`; empty query returns input order.
- Component: `role="dialog" aria-modal="true"` inside `.cpk-backdrop`
  (click backdrop/Esc -> `onClose`); `.cpk` card holds `.cpk-input`
  (autofocus, `aria-label` = D('Search pages')), then `.cpk-list`
  (`role="listbox"`) grouped by `GROUP_LABELS[group]` via `D()` — list
  every `PAGES` entry where `pageAllowed(page, boot)` (NOT `inApp`-gated:
  the palette crosses apps, like the rail's app entries).
- Row `.cpk-item` (`role="option"`, `aria-selected` on the active index):
  `NavIcon` + `D(page.title)` + group label `cpk-kbd`-style hint; when the
  page is outside `ctxApp` use `resolveLink('#/'+page.path, PAGES, true,
  ctxApp)` — missing links render disabled (`aria-disabled`, no nav).
- ArrowUp/Down cycle active item (also Home/End); Enter activates; Esc
  closes. Same-app pick: `router.push('/'+page.path)` then `onClose()`;
  cross-app pick: `location.assign(link.href)` (full reload like `_top`).
- Mouse click behaves like Enter; hover sets active index. Body scroll
  lock while open; list capped ~20 items (slice after filter).
- Test (vitest, no DOM): filtering by title substring, by path, group
  grouping order preserved, case-insensitive, empty query = all.

## Actions
1. Write `filterPalettePages` + group-order helper in the component file (exported for the test).
2. Write the dialog component (backdrop, input, listbox, keydown map, Enter/Esc/activate).
3. Wire `NavIcon`, `D()`, gates and `useRouter`/`location.assign` activation.
4. Write `tests/shell/command-palette.test.ts` covering the five filter cases.
5. `npx vitest run tests/shell/command-palette.test.ts` green.

## Done when
- Palette opens only its own DOM (`.cpk-backdrop > .cpk`), lists allowed pages grouped by `D(GROUP_LABELS)`.
- Arrow/Enter/Esc behave; disabled rows for unresolved cross-app links.
- The 5 filter tests pass; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/shell/command-palette.test.ts` -> green

## Handoff
S03-03 renders `<CommandPalette boot ctxApp onClose>`; `.cpk-*` styles come
from refresh.css (S02-02).
Write results/S03-01.md (<=10 lines); TL alone updates TRACKER.md.
