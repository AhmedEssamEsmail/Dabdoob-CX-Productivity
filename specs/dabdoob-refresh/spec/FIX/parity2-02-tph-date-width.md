# P2-02: /tph — constrain `#tph-date` input width inside `.tph-day`
Kind: mini
ID: P2-02
Parent: FIX-PARITY2
Owner: dev
Depends: none
Criteria: reports/ux-parity-2.md ux-p2-2 (LOW — treated blocking per task)
Skills: none
Budget: files=1; actions=2; changed_lines=4; minutes=3

## Goal
`#tph-date` renders `.cx-input` (`width:100%`, cx-kit.css:263-267) inside
the flex-wrap `.tph-day` row, so Previous day / date / Next day stack
onto 3 rows. Same defect class as fixed M8 on /agents: give the date
`Input` the mock's ~9.5rem width stop so the picker sits on one row.

## Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | `Ja` (~L385-404): the `Input id="tph-date"` only

## Context
- `specs/dabdoob-refresh/reports/ux-parity-2.md` open-findings row ux-p2-2 | exact fix prescribed there
- `src/features/cx-people/components/agents-page.tsx:598,608` | fixed M8 pattern: `style={{ width: '9.5rem' }}` on `sc-from`/`sc-to` date Inputs
- `tph-grid-page.tsx:385-404` | `Ja`: `.tph-day` row = Previous day `Button` → `label.sr-only` → `Input id="tph-date" type="date"` → Next day `Button`
- `src/app/cx-kit.css:263-267` | `.cx-input { width:100% }` — the cause; do NOT edit the stylesheet (inline `style` wins, same approach as PX-09)
- `src/features/shared/components/ui/Input.tsx:8-12` | `Input` spreads `...rest` onto `<input>` — `style` passes through

## Contract
- `tph-date` `Input` gets `style={{ width: '9.5rem' }}`. No other prop or
  markup changes: keep `id`, `type`, `value`, `max`, `onChange`
  byte-identical; keep the `sr-only` label and both `Button`s untouched.
- No CSS file edits, no wrapper divs.

## Actions
1. Add `style={{ width: '9.5rem' }}` to the `id="tph-date"` `Input` in `Ja`.
2. `npx eslint` the file + `npx tsc --noEmit` clean.

## Done when
- `/tph` `.tph-day` shows Previous day / date / Next day on one row at
  1440px (date input ~9.5rem).
- `npx tsc --noEmit` + `npx eslint` on the file clean.

## Verify
- Run: `npx eslint src/features/cx-productivity/components/tph-grid-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "9.5rem" src/features/cx-productivity/components/tph-grid-page.tsx` -> 1 hit on the `tph-date` Input

## Handoff
none.
Write results/P2-02.md (<=10 lines); TL alone updates TRACKER.md.
