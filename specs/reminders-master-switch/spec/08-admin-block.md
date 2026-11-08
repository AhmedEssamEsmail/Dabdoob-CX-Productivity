# RMS-08: Reminders master-switch block on the Hub Admin page
Kind: mini
ID: RMS-08
Parent: reminders-master-switch
Owner: dev
Depends: RMS-01
Criteria: PLAN #2
Skills: none
Budget: files=1; actions=2; changed_lines=60; minutes=10

## Goal
The Hub Admin page shows a dedicated "Reminders" block between Connected apps
and Settings: current on/off state plus a one-click toggle that persists via
`Ln.saveConfigSetting('reminders_enabled', <bool>)`.

## Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | new `Rb` component (before `AdminPage`, ~line 371) + one render line inside `AdminPage` (between `<Im />` and the Settings block, ~line 402)

## Context
- `src/features/cx-hub/components/admin-page.tsx:372-422` | `AdminPage`: `r` = `ConfigRow[] | null` (from `Ln.getConfigRows()`), `a` = its setter, `o`/`c` = load error — the block reads `r` and calls `a(rows)` after saving
- `src/features/cx-hub/components/admin-page.tsx:159-180` | existing boolean instant-toggle button pattern in `Dm` (disabled-while-saving, `Ti` toast, `Ln.saveConfigSetting` returns the fresh row list)
- `src/features/cx-hub/components/admin-page.tsx:383-418` | `block`/`block-title`/`block-text` markup + `Button` (`btn btn-quiet btn-small`) already imported at line 10
- `src/features/cx-hub/components/hub-shared.tsx:108` | `Ln.saveConfigSetting(key, value)` client signature

## Contract
`function Rb({ rows, onSaved }: { rows: ConfigRow[] | null; onSaved: (r: ConfigRow[]) => void })`:
find `rows?.find((x) => x.key === 'reminders_enabled')`; `on` defaults to
`true` when the row is absent/loading. Render
`<div className="block"><h2 className="block-title">Reminders</h2>` + a
`block-text` paragraph (one sentence: master switch, stops all reminder
popups, in-app alerts and reminder emails for everyone) + status line
(`Reminders are on|off`) + one `Button` (`Saving…` while busy,
`Turn off|Turn on` otherwise) calling
`Ln.saveConfigSetting('reminders_enabled', !on)` then `onSaved(rows)` +
`Ti` toast, error -> `Ti(msg,'error')`. `key` prop not needed; name `Rb`.
Out of scope: Settings list internals (`Dm` keeps its own seeded copy — a
stale `reminders_enabled` row inside Settings until reload is accepted),
loading/error states beyond the existing pattern.

## Actions
1. Add the `Rb` component (with a local `busy` useState) before `AdminPage`.
2. Render `<Rb rows={r} onSaved={a} />` between `<Im />` and the Settings `<div className="block">`.

## Done when
- Block shows current state and toggles persist (button label flips after save)
- `npx tsc --noEmit` and `npx eslint src/features/cx-hub/components/admin-page.tsx` clean

## Verify
- Run: `npx tsc --noEmit` -> no errors

## Handoff
Criterion #2 done; the toggle exercises the same saveConfigSetting path as
Settings. Write results/RMS-08.md.
