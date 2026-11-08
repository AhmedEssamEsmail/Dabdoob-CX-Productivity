# RMS-F06: Rb toggle gated on loaded data (ux-2)

Kind: mini
ID: RMS-F06
Parent: reminders-master-switch
Owner: dev
Depends: none
Criteria: PLAN #2 (Reminders block shows the current state)
Skills: none
Budget: files=1; actions=2; changed_lines=12; minutes=5

## Goal
While `rows === null` (config fetch in flight) the Reminders block does NOT
claim "Reminders are on" or offer an enabled toggle on a guessed value; the
toggle stays disabled until the `reminders_enabled` row is known.

## Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | `Rb` component only (lines ~372-404)

## Context
- `specs/reminders-master-switch/reports/ux-1.md` finding ux-2 | root cause
- `src/features/cx-hub/components/admin-page.tsx:451` | sibling Settings block
  already renders "Loading settings…" while `r` is null — match that pattern

## Contract
`Rb`'s props are unchanged. Status line shows "Loading…" (or a skeleton/quiet
equivalent) while `rows === null`; "Reminders are on/off" is rendered only
once the row is known. The button is `disabled={busy || !row}` so it can never
fire on the `true` fallback guess.
Out of scope: `Dm`, `AdminPage`, `Pm`, the aria/accessible-name work (that is
RMS-F07), any other file.

## Actions
1. Render the status `<p>` as Loading… while `rows === null`, else the
   existing on/off text.
2. Change the button's `disabled` to `busy || !row`.

## Done when
- With `rows === null` the block shows a loading state and the button is
  disabled; with a loaded row it behaves exactly as before.
- `npx tsc --noEmit` clean for this file.

## Verify
- Run: `npx tsc --noEmit` -> exit 0

## Handoff
none
Write results/RMS-F06.md (<=10 lines); TL alone updates TRACKER.md.
