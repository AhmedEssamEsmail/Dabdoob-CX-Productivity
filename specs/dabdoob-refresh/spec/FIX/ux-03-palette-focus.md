# FUX-03: command palette — Tab trap inside dialog + focus restore to `.rail-search`
Kind: mini
ID: FUX-03
Parent: FIX-UX1
Owner: dev
Depends: none
Criteria: reports/ux-1.md ux-3 (MED)
Skills: none
Budget: files=2; actions=4; changed_lines=25; minutes=8

## Goal
The `aria-modal` palette lets Tab leave the dialog into the background
page, and Esc/backdrop/Enter close drops focus to `document.body`.
Trap Tab/Shift+Tab and return focus to the `.rail-search` trigger on
every palette-initiated close.

## Files
- Edit: `src/features/shared/components/shell/CommandPalette.tsx` | `onKeyDown` (~L125-149)
- Edit: `src/features/shared/components/shell/AppShell.tsx` | refs block (~L98-99), `.rail-search` button (~L421-427), palette mount (~L597-603)

## Context
- `CommandPalette.tsx:125-149` | `onKeyDown` on `.cpk` — Esc/arrows/Home/End/Enter only
- `CommandPalette.tsx:164-174` | `<input className="cpk-input" autoFocus>` — the ONLY focusable node in the dialog
- `AppShell.tsx:98-99` | `navRef`/`indRef` — add the search ref here (`useRef` already imported L9)
- `AppShell.tsx:421-427` | `.rail-search` `<button>` opens the palette
- `AppShell.tsx:597-603` | `<CommandPalette … onClose={() => setPaletteOpen(false)}>` — all palette close paths (Esc, backdrop, Enter-activate) call this prop

## Contract
- CommandPalette `onKeyDown`: add a FIRST branch `if (event.key ===
  'Tab') { event.preventDefault(); return }` — traps both Tab and
  Shift+Tab (input is the only focusable node, focus stays on it).
- AppShell: `const railSearchRef = useRef<HTMLButtonElement>(null)`;
  `ref={railSearchRef}` on the `.rail-search` button; change the mount to
  `onClose={() => { setPaletteOpen(false); railSearchRef.current?.focus() }}`.
- Do NOT touch the global ⌘K/Ctrl+K keydown toggle (~L180), the
  route-change `setPaletteOpen(false)` (~L234), `aria-modal`, roles, or
  any markup/styles.
- Out of scope: `scrollIntoView` (FUX-04), combobox ARIA (FUX-05).

## Actions
1. CommandPalette: add the Tab/Shift+Tab preventDefault branch in `onKeyDown`.
2. AppShell: add `railSearchRef`, attach it to `.rail-search`.
3. AppShell: wrap `onClose` to also `railSearchRef.current?.focus()`.
4. `npx eslint` both files + `npx tsc --noEmit` clean.

## Done when
- Tab and Shift+Tab inside the dialog cannot move focus out (preventDefault on `Tab`).
- Esc, backdrop click, and Enter-activate each run the new `onClose`, which focuses `.rail-search` after closing.
- `npx tsc --noEmit` clean; `useRef` import unchanged (already present).

## Verify
- Run: `npx eslint src/features/shared/components/shell/CommandPalette.tsx src/features/shared/components/shell/AppShell.tsx && npx tsc --noEmit` -> clean

## Handoff
`.rail-search` now carries `railSearchRef`; palette close focuses it.
Write results/FUX-03.md (<=10 lines); TL alone updates TRACKER.md.
