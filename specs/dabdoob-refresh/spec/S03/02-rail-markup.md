# S03-02: AppShell rail markup — fixed Dabdoob CX brand, ⌘K search box, avatar foot
Kind: mini
ID: S03-02
Parent: S03
Owner: dev
Depends: S02-02
Criteria: PLAN #1 #3
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\react-best-practices\SKILL.md
Budget: files=1; actions=6; changed_lines=130; minutes=10

## Goal
`AppShell.tsx`'s rail becomes the mockup rail: fixed "Dabdoob CX" brand
with "Operations console" sub, a `.rail-search` button between head and
nav, and an avatar-led user card in `.rail-foot`.

## Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | rail JSX only (L358-494)

## Context
- `mockups/pages/02-home.html:14-22` | rail-brand + rail-search markup (brand-mark bars svg, `Search or jump to…` + `⌘K` kbd)
- `mockups/pages/02-home.html:61-65` | rail-foot avatar + who-name/who-role + icon-btn
- `src/features/shared/components/shell/AppShell.tsx:358-494` | current rail JSX
- `mockups/assets/mock.css:79-149` | class contract (S02-02/S02-05 styles)

## Contract
- `.rail-head .brand`: keep the link/target logic; `.brand-mark` gains the
  mock bars svg (`<path d="M5 19V9M10 19V5M15 19v-7M20 19v-3"/>`); brand
  text becomes literal `Dabdoob CX` (`.brand-name`) + `.brand-sub`
  `Operations console` — NOT `ctxTitle` (brand never mutates per section).
- New `<button type="button" className="rail-search">` right after
  `.rail-head` (before `<nav>`): magnifier svg + `D('Search or jump to…')`
  + `<kbd>⌘K</kbd>`; `onClick` calls a prop-free stub for now:
  `setPaletteOpen(true)` — declare `const [paletteOpen, setPaletteOpen] =
  useState(false)` near the other state (S03-03 consumes it; do NOT render
  the palette yet).
- `.rail-foot`: prepend `.avatar` with `user.name` initials (first letters
  of first+last name parts, uppercase, aria-hidden); rename `.who`/`.who-meta`
  content into `.who-name`/`.who-role` spans inside `.rail-who` (keep the
  old classes as additional classNames OR keep elements p.who/p.who-meta —
  pick one consistent mapping and keep `.rail-who` wrapper). Keep
  `.rail-collapse` button + aria contract unchanged.
- Keep `#nav`, `.nav`, `.nav-link`, `.nav-group--app`, `aria-current`,
  `.nav-toggle` accessible name `Menu`, `.rail-va` block, `D()` strings.

## Actions
1. Add `paletteOpen` state + import nothing new (useState already imported).
2. Brand: svg inside `.brand-mark`; `.brand-name` -> `Dabdoob CX`; add `.brand-sub` div.
3. Insert `.rail-search` button (svg + label + kbd) with `onClick={() => setPaletteOpen(true)}`.
4. Rail-foot: `.avatar` initials + rename who lines to `.who-name`/`.who-role` (with fallback keeping `p.who` classes consistent with S02-05 CSS).
5. Keep all ids/aria hooks; `npx eslint` the file.
6. `npx tsc --noEmit` clean.

## Done when
- Brand shows `Dabdoob CX` + `Operations console` on every app context.
- `.rail-search` button exists between `.rail-head` and `#nav`.
- `.avatar` shows user initials in `.rail-foot`.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S03-03 wires `paletteOpen` to `<CommandPalette>` and the ⌘K keydown.
Write results/S03-02.md (<=10 lines); TL alone updates TRACKER.md.
