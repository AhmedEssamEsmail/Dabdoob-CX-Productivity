# RMS-F05: one source of truth for Admin config rows (ux-1)

Kind: mini
ID: RMS-F05
Parent: reminders-master-switch
Owner: dev
Depends: none
Criteria: PLAN #2 (Reminders block shows the current state)
Skills: none
Budget: files=1; actions=2; changed_lines=30; minutes=8

## Goal
`Dm` (Settings list) and `Rb` (Reminders block) read and write the SAME
`ConfigRow[]` held by `AdminPage` (`r`/`a`), so a save or boolean toggle in
either block is reflected in the other immediately.

## Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | `Dm` component (lines ~112-199) + its call site (line ~449)

## Context
- `specs/reminders-master-switch/reports/ux-1.md` finding ux-1 | root cause
- `src/features/cx-hub/components/admin-page.tsx:372-404` | `Rb` already takes
  `{rows, onSaved}` and calls `onSaved(updated)` after save — mirror that shape

## Contract
`Dm` becomes `{ rows: ConfigRow[]; onSaved: (rows: ConfigRow[]) => void }`,
exactly like `Rb`. It keeps its LOCAL `useState` for search text (`i`), the
key being edited (`r`) and the saving key (`o`); it must NOT keep a rows copy
(no `useState(initial)` for row data). Both save paths inside `Dm` — the `Pm`
`onSaved` callback and the boolean "Set to …" toggle `.then` — call
`onSaved(updatedRows)` instead of the removed setter. `AdminPage` renders
`<Dm rows={r} onSaved={a} />` (still inside the existing `r ?` guard).
Out of scope: `Rb`, `Pm`, `Im`, `Tm`, any other file, adding tests, styling.

## Actions
1. Change `Dm`'s props to `{rows, onSaved}`, drop the `useState(n)` rows copy,
   and route both `t(u)` call sites through `onSaved(u)` (rename `e` usages to
   `rows`).
2. Update the call site to `<Dm rows={r} onSaved={a} />`.

## Done when
- Toggling `reminders_enabled` in `Dm` updates `Rb`'s status/button; saving via
  `Rb` updates the value `Dm` renders (single owner `r` in `AdminPage`).
- `npx tsc --noEmit` clean for this file.

## Verify
- Run: `npx tsc --noEmit` -> exit 0

## Handoff
none
Write results/RMS-F05.md (<=10 lines); TL alone updates TRACKER.md.
