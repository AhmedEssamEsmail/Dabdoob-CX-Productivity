# S05-02: validator inventory extension
Kind: mini
ID: S05-02
Parent: S05
Owner: dev
Depends: S05-01
Criteria: PLAN #6 (validate.ts --md covers the new mappings)
Skills: none
Budget: files=1; actions=4; changed_lines=60; minutes=8

## Goal
Extend `migration/validate.ts` so `dq_hct` and `fc_messages` appear as proper
inventory rows and the new store keys resolve — mapped rows come free via the
mappings-dir dynamic import once S05-01 lands.

## Files
- Edit: `migration/validate.ts` | KNOWN_STORES (~lines 90-98) + EXPECTED_TABLES (~lines 135-264) regions only

## Context
- `migration/validate.ts:55,86-99,135-264` | MAPPINGS_DIR auto-import +
  the two registries to extend
- `results/S03-01.md`, `results/S04-01.md` | the new tables' shapes
- `src/features/shared/platform/settings.ts:68-72` | store key names/ids

## Contract
KNOWN_STORES += `hct` (`1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw`),
`v1_ops` (`1hul-T8Tc2h1nmk_9wM9bj8HmWM-_2ZeVIu_kOYpicyA`), `fc_messages`
(`1ZxDxS13pu0xXS3aPBfXxajtodwKIndaF0NOjZv6xacM`), `daily_report`
(`1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4`), `fd_activity`
(`1Fc6VCk8bLmy8ZUMCeBDPHvu7dMWDtONn6CRd9H_aHzM`) — notes: "shared, verified
sheet-access.md". Also fix the stale `note: '…not shared'` strings on
tickets/live/data_2026 (all shared since 2026-11-06).
EXPECTED_TABLES += `dq_hct: { module:'core', store:'hct', guess:['Sheet1'] }`
and move `fc_messages`/`freshchat`/`fd_activities` semantics: keep them
`module:'vendor'` but set `fc_messages` to `store:'fc_messages',
guess:['<tab names from inventory>']` with `backed:true` — it is now
sheet-backed. Do NOT touch parsing/IO logic.
Out of scope: behaviour changes; other files; EXPECTED_TABLES entries beyond
those named.

## Actions
1. Add the 5 KNOWN_STORES entries + refresh the 3 stale notes.
2. Add dq_hct to EXPECTED_TABLES (module core, store hct, guess Sheet1).
3. Flip fc_messages to sheet-backed with its store + guesses.
4. Run validator `--md` to a log; confirm the new tables appear.

## Done when
- `npx tsx migration/validate.ts --md` lists dq_hct + fc_messages rows.
- Only registry literals changed in the diff.

## Verify
- Run: `npx tsx migration/validate.ts --md > specs/migration-remaining/logs/validate-md.log 2>&1; echo "exit=$?"; grep -n "dq_hct\|fc_messages" specs/migration-remaining/logs/validate-md.log | head -10` -> exit=0, both rows present.

## Handoff
Validator covers all new mappings for S05-03's ledger run. Write
`results/S05-02.md`; TL updates TRACKER.md.
