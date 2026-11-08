# RMS-F07: accessible name/state for the Rb toggle (ux-3)

Kind: mini
ID: RMS-F07
Parent: reminders-master-switch
Owner: dev
Depends: RMS-F06 (same file + same JSX region — strictly serial)
Criteria: PLAN #2 (Reminders block)
Skills: none
Budget: files=1; actions=1; changed_lines=10; minutes=5

## Goal
The Reminders master-switch button has an unambiguous accessible name and
exposes its pressed state, instead of the generic "Turn off"/"Turn on" that is
indistinguishable from the page's many other toggles.

## Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | `Rb` component only (lines ~372-404)

## Context
- `specs/reminders-master-switch/reports/ux-1.md` finding ux-3 | root cause
- `src/features/cx-hub/components/admin-page.tsx:164` | sibling pattern:
  `aria-label={`Set ${h.key} to ${!h.value}`}` on boolean setting buttons

## Contract
Keep the existing visible text ("Turn off"/"Turn on"/"Saving…"). Add
`aria-label={`Turn reminders ${on ? 'off' : 'on'}`}` and `aria-pressed={on}`
to the `Rb` toggle button. (Equivalent per report: visible text "Turn
reminders off" + `aria-pressed`, or `aria-describedby` pointing at the status
`<p>` — pick ONE consistent approach.) No other behavioural change.
Out of scope: the loading gate (RMS-F06 owns it — build on whatever `disabled`
expression is present), `Dm`, `Pm`, any other file.

## Actions
1. Add the aria attributes above to the `Rb` button (and a status-`<p>` id +
   `aria-describedby` only if that approach is chosen instead of
   `aria-pressed`).

## Done when
- The toggle's accessible name is "Turn reminders off"/"Turn reminders on"
  and its state is conveyed via `aria-pressed` (or `aria-describedby`).
- `npx tsc --noEmit` clean for this file.

## Verify
- Run: `npx tsc --noEmit` -> exit 0

## Handoff
none
Write results/RMS-F07.md (<=10 lines); TL alone updates TRACKER.md.
