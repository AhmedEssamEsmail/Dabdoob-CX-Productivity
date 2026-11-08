# 01-workspace-archive   (shard id: S01)
Owner: dev     Depends: none     Criteria: PLAN #1
Skills: none     (owner invokes these first, nothing else)

## Goal
Archive everything at `C:\Users\AHMED\KPIs\` except `CX-Hub\`, `_archive\`, `.devin\` — move 8 legacy GAS app dirs to `_archive\legacy-apps\`, `.devin\work` to `_archive\devin-work`, delete the 0-byte `nul` file.

## Files
Edit/create ONLY: `C:\Users\AHMED\KPIs\_archive\` (new tree)
Read-only context: none
Forbidden: everything under `CX-Hub\`, `KPIs\.devin\config.local.json`, `KPIs\.devin\mcp_config.local.json` (both stay)

## Steps
1. `New-Item -ItemType Directory -Force 'C:\Users\AHMED\KPIs\_archive\legacy-apps'`
2. Baseline count: `(Get-ChildItem -Recurse -File 'C:\Users\AHMED\KPIs\.devin\work').Count` → record N.
3. Move each dir (plain `Move-Item`, outside git): `Command_Center_V2_deprecated`, `Desk_deprecated`, `FCR_deprecated`, `Operations_deprecated`, `People_deprecated`, `Productivity_Depricated`, `Quality_deprecated`, `Queue_deprecated` → `C:\Users\AHMED\KPIs\_archive\legacy-apps\`.
4. `Move-Item 'C:\Users\AHMED\KPIs\.devin\work' 'C:\Users\AHMED\KPIs\_archive\devin-work'`
5. Delete `nul` (reserved device name — the `\\?\` prefix is required): `Remove-Item -LiteralPath '\\?\C:\Users\AHMED\KPIs\nul' -Force`
6. Do NOT touch `C:\Users\AHMED\KPIs\CX-Hub\.devin\work` (live harness, stays).

## Done when
- `Get-ChildItem -Name 'C:\Users\AHMED\KPIs'` returns exactly: `CX-Hub`, `_archive`, `.devin`
- `(Get-ChildItem -Recurse -File 'C:\Users\AHMED\KPIs\_archive\devin-work').Count` = N from step 2
- `Get-ChildItem -Name 'C:\Users\AHMED\KPIs\_archive\legacy-apps'` returns the 8 dirs; `Test-Path '\\?\C:\Users\AHMED\KPIs\nul'` = False
