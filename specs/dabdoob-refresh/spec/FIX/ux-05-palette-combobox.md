# FUX-05: command palette — combobox ARIA wiring (expanded/controls/activedescendant)
Kind: mini
ID: FUX-05
Parent: FIX-UX1
Owner: dev
Depends: FUX-04 (same file — serial)
Criteria: reports/ux-1.md ux-5 (MED)
Skills: none
Budget: files=1; actions=3; changed_lines=15; minutes=6

## Goal
The input is a plain `aria-label`led field while `.cpk-list` is a
`role="listbox"` — nothing ties them (no `role="combobox"`,
`aria-expanded`, `aria-controls`, `aria-activedescendant`), so SR users
get silence on arrows. Wire the combobox pattern.

## Files
- Edit: `src/features/shared/components/shell/CommandPalette.tsx` | `<input>` (~L164-174), `.cpk-list` (~L175), `.cpk-item` (~L185-201)

## Context
- `CommandPalette.tsx:82-83` | `active` state — the activedescendant index
- `CommandPalette.tsx:164-174` | `<input className="cpk-input" autoFocus aria-label>`
- `CommandPalette.tsx:175` | `<div className="cpk-list" role="listbox">` — needs an `id`
- `CommandPalette.tsx:185-201` | `.cpk-item` `role="option"` `aria-selected` — needs `id`
- `reports/ux-1.md` row ux-5 | exact fix

## Contract
- `.cpk-list`: add `id="cpk-list"`.
- `.cpk-item`: add `id={\`cpk-item-${index}\`}` (flat index, already computed).
- `<input>`: add `role="combobox"`, `aria-expanded="true"`,
  `aria-controls="cpk-list"`, `aria-autocomplete="list"`,
  `aria-activedescendant={flat.length ? \`cpk-item-${active}\` : undefined}`;
  keep `autoFocus`, `aria-label`, `placeholder`, `value`, `onChange`.
- No markup restructure, no new elements, no style changes; all `D()`
  strings unchanged. Out of scope: scroll (FUX-04), focus trap (FUX-03).

## Actions
1. Add `id="cpk-list"` to the listbox and `id={\`cpk-item-${index}\`}` to each option.
2. Add the five combobox attributes to the input.
3. `npx eslint src/features/shared/components/shell/CommandPalette.tsx` + `npx tsc --noEmit` clean.

## Done when
- Input exposes `role="combobox"` + `aria-expanded`/`aria-controls`/`aria-autocomplete`/`aria-activedescendant`; the activedescendant id matches the `.cpk-item.on` option's `id`.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx eslint src/features/shared/components/shell/CommandPalette.tsx && npx tsc --noEmit` -> clean

## Handoff
none.
Write results/FUX-05.md (<=10 lines); TL alone updates TRACKER.md.
