# PX-09: /agents — constrain date-input width inside `.page-actions`
Kind: mini
ID: PX-09
Parent: FIX-PARITY
Owner: dev
Depends: none
Criteria: reports/ux-parity.md M8 (note on MATCH page — fix while cheap)
Skills: none
Budget: files=1; actions=3; changed_lines=8; minutes=4

## Goal
Mock 08's `.page-actions` renders the date range as compact inline
inputs (`style="width:9.5rem"`). The app's `Input` component renders
`.cx-input` (`width:100%`), so the two date pickers each take a full
row and the actions wrap to 3 rows. Constrain the two date inputs to
the mock's 9.5rem so the range sits inline like the mock.

## Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | the `.page-actions` block (~L593-608): `style` on the `sc-from`/`sc-to` `Input type="date"`s only

## Context
- `mockups/pages/08-agents.html:50-53` | `<input class="input"
  type="date" style="width:9.5rem">` twice + Apply + preset buttons
- `agents-page.tsx:593-618` | `.page-actions` row: `Input` (`id="sc-from"`,
  `id="sc-to"`), 'to' span, Apply/30 days/Last month/This month/Refresh
- `src/app/cx-kit.css:263-280` | `.cx-input { width:100% }` — the cause;
  do NOT edit the stylesheet (inline `style` wins, matching the mock's
  own approach)
- `src/features/shared/components/ui/Input.tsx:8-12` | `Input` spreads
  `...rest` onto `<input>` — `style` passes through

## Contract
- `sc-from` and `sc-to` inputs get `style={{ width: '9.5rem' }}` (the
  mock's exact width). No other prop/markup changes: keep `id`, `type`,
  `aria-label`, `value`, `onInput` byte-identical.
- No CSS file edits, no wrapper divs, no change to the 'to' span or the
  buttons.
- Mobile wrap behaviour is unchanged (`.page-actions` already wraps).

## Actions
1. Add `style={{ width: '9.5rem' }}` to the `sc-from` `Input`.
2. Add `style={{ width: '9.5rem' }}` to the `sc-to` `Input`.
3. `npx eslint` the file + `npx tsc --noEmit` clean.

## Done when
- `/agents` page-actions show From/To dates inline at ~9.5rem each with
  the 'to' span and buttons on the same row at 1440px.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx eslint src/features/cx-people/components/agents-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "9.5rem" src/features/cx-people/components/agents-page.tsx` -> 2 hits (sc-from + sc-to)

## Handoff
none.
Write results/PX-09.md (<=10 lines); TL alone updates TRACKER.md.
