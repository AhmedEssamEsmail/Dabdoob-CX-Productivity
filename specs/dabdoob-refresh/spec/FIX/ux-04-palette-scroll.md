# FUX-04: command palette — scroll the active option into view
Kind: mini
ID: FUX-04
Parent: FIX-UX1
Owner: dev
Depends: FUX-03 (same file — serial)
Criteria: reports/ux-1.md ux-4 (MED)
Skills: none
Budget: files=1; actions=3; changed_lines=12; minutes=5

## Goal
`.cpk-list` caps at 22rem while up to 20 items + group labels (~640px)
render; ArrowDown past ~11 items moves the `.on` highlight below the fold
with no `scrollIntoView`. Keep the active option visible.

## Files
- Edit: `src/features/shared/components/shell/CommandPalette.tsx` | hooks block + `.cpk-list` element (~L82-107, L175-209)

## Context
- `CommandPalette.tsx:82-83` | `active` state; `useEffect`/`useMemo`/`useState` imported — add `useRef` to that react import
- `CommandPalette.tsx:175` | `.cpk-list` (`role="listbox"`, `overflow-y:auto` via refresh.css:127)
- `CommandPalette.tsx:185-201` | `.cpk-item` gets `on` class at `index === active`
- `reports/ux-1.md` row ux-4 | exact fix: `scrollIntoView({block:'nearest'})`

## Contract
- `const listRef = useRef<HTMLDivElement>(null)`; attach `ref={listRef}`
  to the `.cpk-list` div.
- `useEffect(() => { listRef.current?.querySelector('.cpk-item.on')?.scrollIntoView({ block: 'nearest' }) }, [active])`.
- No per-item refs, no changes to keyboard handling, filtering, grouping
  or styles. Out of scope: focus trap (FUX-03 done), combobox ARIA
  (FUX-05).

## Actions
1. Add `useRef` to the react import and declare `listRef`.
2. Attach the ref to `.cpk-list` and add the `useEffect` on `active`.
3. `npx eslint src/features/shared/components/shell/CommandPalette.tsx` + `npx tsc --noEmit` clean.

## Done when
- Changing `active` (arrows/Home/End/mouse-enter) scrolls the `.cpk-item.on`
  node into the list viewport via `block:'nearest'`.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx eslint src/features/shared/components/shell/CommandPalette.tsx && npx tsc --noEmit` -> clean

## Handoff
none — FUX-05 adds ARIA on the same elements.
Write results/FUX-04.md (<=10 lines); TL alone updates TRACKER.md.
