# RMS-01: `reminders_enabled` config default + `remindersOn()` helper
Kind: mini
ID: RMS-01
Parent: reminders-master-switch
Owner: dev
Depends: none
Criteria: PLAN #1
Skills: none
Budget: files=2; actions=2; changed_lines=30; minutes=8

## Goal
Publish the master switch: one new boolean config key `reminders_enabled`
(default true) in `CONFIG_DEFAULTS`, plus an exported async helper
`remindersOn(): Promise<boolean>` that every later gate leaf calls.

## Files
- Edit: `src/features/shared/platform/settings.ts` | CONFIG_DEFAULTS map (~line 33) + new helper after `getConfig` (~line 176)
- Edit: `tests/platform/settings.test.ts` | `describe('seeded settings coverage')` block (~line 65)

## Context
- `src/features/shared/platform/settings.ts:22-34` | CONFIG_DEFAULTS; add the key after `one_on_one_inapp_start`, before `app_url_hub`
- `src/features/shared/platform/settings.ts:173-176` | `getConfig` — helper goes right below it
- `src/features/cx-people/lib/one-on-one-reminders.ts:34-37` | `pwOoOn_` — the exact truthiness pattern to copy (`!(v === false || String(v).toLowerCase() === 'false')`)
- `tests/platform/settings.test.ts:65-79` | seeded-coverage describe where the new assertions belong

## Contract
`reminders_enabled: { value: true, description: '<one line: master switch; when false all reminders (popups, in-app 1:1 alerts, reminder emails) stop for everyone.>' }`.
`export async function remindersOn(): Promise<boolean>` — `getConfig('reminders_enabled', true)` then the `pwOoOn_` truthiness rule. No other export changes; no validation needed beyond the existing boolean kind.
Out of scope: any consumer/gate, any UI, seeding (seedSettings picks it up automatically via ALL_SETTINGS).

## Actions
1. Add the `reminders_enabled` entry to CONFIG_DEFAULTS and export `remindersOn()` below `getConfig`, copying the `pwOoOn_` truthiness pattern.
2. In settings.test.ts add assertions: `CONFIG_DEFAULTS.reminders_enabled.value === true`, `configKind(CONFIG_DEFAULTS.reminders_enabled.value) === 'boolean'`, `ALL_SETTINGS.reminders_enabled` defined.

## Done when
- `remindersOn()` is exported from settings.ts and resolves true for a missing key
- settings.test.ts assertions for the new key pass

## Verify
- Run: `npx vitest run tests/platform/settings.test.ts` -> all tests pass

## Handoff
`remindersOn` + `bustConfigCache` (already exported) are the contract every
RMS-02..RMS-08 leaf imports. Write results/RMS-01.md (<=10 lines).
