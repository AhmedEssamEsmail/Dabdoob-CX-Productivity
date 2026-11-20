# FIX report — roster-hide-left-people (round 1)

## Root cause
`dqSyncRoster_` manual-source branch (`cur.source !== 'hct'`) patched only
`freshdesk_id`/`freshdesk_name`/`maqsam_name`. 22 legacy `source='manual'`
rows kept `active=true` while HCT said Resigned/Moved — the People table's
`y || S.active` filter (people-holidays-page.tsx:344) had nothing to hide,
so "Show people who left" looked dead.

## Changed files
- `src/features/cx-hub/lib/roster.ts` (manual-row branch, ~367-396): patch set
  now includes `employment_status` + `active` with the same
  `DQ_SYNC_KEEP_MANUAL` blank-guard as the hct branch; `active`/`employment_status`
  diffs are reported in `changes` like hct rows.
- `tests/golden/hub-people-holidays.test.ts`: new regression test — manual row
  resigned in HCT flips inactive+status; blank HCT status keeps manual
  employment_status while active flips; manual row absent from HCT untouched;
  `changes` note surfaces the flip.

## Data repair (user-approved remote write, applied 2026-11-20)
`UPDATE roster SET active=false` on the 22 rows with `active=true` and
non-empty non-'current' `employment_status`. Verified: 22 updated,
0 inconsistent remaining, roster now 28 active / 22 inactive.

## Gates run
- `npx vitest run` — 118 files / 1494 tests PASS
- `npx tsc --noEmit` — clean
- `npx eslint` on changed files — clean

## Follow-up needed from user
None for correctness of the fix. After this deploys, future manual-row
Resigned/Moved flips happen automatically on each HCT sync.
