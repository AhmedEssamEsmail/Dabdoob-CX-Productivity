# S03-03: Wire CommandPalette into AppShell — ⌘K/Ctrl+K open, close on nav
Kind: mini
ID: S03-03
Parent: S03
Owner: dev
Depends: S03-01, S03-02
Criteria: PLAN #3
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\react-best-practices\SKILL.md
Budget: files=1; actions=4; changed_lines=60; minutes=8

## Goal
⌘K/Ctrl+K (and the rail-search button) opens `CommandPalette`; it closes
on Esc/backdrop/selection and on route change.

## Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | listener + render wiring

## Context
- `src/features/shared/components/shell/CommandPalette.tsx` | props `{boot, ctxApp, onClose}` (S03-01)
- `src/features/shared/components/shell/AppShell.tsx:88-99` | state block; rail-search stub sets `paletteOpen`
- `src/features/shared/components/shell/AppShell.tsx:525` | render tail (next to `<Popups>`)

## Contract
- Import `CommandPalette`.
- `useEffect` keydown on `document`: `(e.metaKey || e.ctrlKey) && key==='k'`
  -> `preventDefault` + toggle `paletteOpen`; ignore when target is an
  editable element UNLESS it's the palette input itself (toggle still
  closes). Register once, clean up.
- Route change closes: extend the existing `prevRoutePath` adjust-during-
  render block (or a small `useEffect` on `path`) to `setPaletteOpen(false)`.
- Render `{paletteOpen ? <CommandPalette boot={boot} ctxApp={ctxApp}
  onClose={() => setPaletteOpen(false)} /> : null}` next to
  `<Popups popups={boot.popups} />` inside `.shell`.
- No other behavior changes.

## Actions
1. Import `CommandPalette` at the top.
2. Add the ⌘K/Ctrl+K `useEffect` listener (toggle + cleanup).
3. Close on route change (`path` effect or prevRoute block).
4. Render the palette conditionally beside `<Popups>`.

## Done when
- ⌘K and Ctrl+K toggle the palette; Esc/backdrop/selection close it.
- Navigating to another page closes it.
- `npx tsc --noEmit` + `npx eslint src/features/shared/components/shell/AppShell.tsx` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
e2e hook for S06-01: palette DOM = `.cpk-backdrop`/`.cpk-item`.
Write results/S03-03.md (<=10 lines); TL alone updates TRACKER.md.
