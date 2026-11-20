# PLAN — roster-hide-left-people

## Bug
People & holidays page: the "Show people who left" toggle appears non-functional —
22 people with Status `Resigned`/`Moved` render even with the toggle off.

## Root cause (verified against prod data, 2026-11-20)
- UI filter is correct: `people.filter(S => y || S.active)` in
  `src/features/cx-hub/components/people-holidays-page.tsx:344`.
- 22 `roster` rows have `active=true` while `employment_status` is
  `Resigned`/`Moved`. All are `source='manual'` (legacy Oct-5 import).
- `dqSyncRoster_` (`src/features/cx-hub/lib/roster.ts:367-377`) skips
  `source !== 'hct'` rows and patches only `freshdesk_id`/`freshdesk_name`/
  `maqsam_name` — never `active`/`employment_status`, so manual rows keep
  stale employment facts forever.
- All 22 emails exist in the live HCT (`dq_hct` snapshot) with status
  `Resigned`/`Moved`; today's sync saw them and skipped the fields.
- Stale `active=true` also inflates headcount consumers (isCxAgent_,
  qaActiveEmails_, the "N people have no Based in" banner).

## Fix
1. `dqSyncRoster_` manual-row branch: also patch `active` and
   `employment_status` from the HCT row, honouring the same KEEP_MANUAL
   semantics as the hct branch (blank incoming `employment_status` keeps the
   manual value; `active` mirrors `dqHctActive_` exactly as hct rows do).
   This repairs the 22 rows on the next sync — no hand-written SQL needed.
2. After deploy, run "Sync roster from HCT now" once on prod (admin button —
   user action, not automated).

## Success criteria
1. With the toggle OFF, people whose `active` is false (incl. the 22
   Resigned/Moved rows) do not render in the People table.
2. With the toggle ON, they render as today (with ", left" sub-label).
3. `dqSyncRoster_` updates `active`/`employment_status` on `source='manual'`
   rows that match an HCT email; a blank HCT status does NOT clobber a manual
   `employment_status` value.
4. Manual rows absent from the HCT are untouched (existing `incoming` check
   already only deactivates `source='hct'` rows — unchanged).
5. After one prod sync: `roster` has 0 rows with `active=true` and
   `employment_status` in {Resigned, Moved, Left, Terminated}.

## Non-goals
- Changing the toggle UI or filter semantics (correct as-is).
- Deactivating manual rows that are absent from the HCT (deliberate: manual
  adds may legitimately not be in the sheet).
- The `resigned`/`moved` string set — we mirror `dqHctActive_`, not a list.

## Risk flags
`data` (sync writes roster columns for a new row class) — data gate.
`ui` flag NOT set (no UI change). `deploy` — prod sync run is a user action.

## Gates
- `npx vitest run tests/golden/hub-people-holidays.test.ts` (roster goldens)
- `npx vitest run` scoped to changed file's suite if exists; `npx tsc --noEmit`
  or repo typecheck script.

## Key pointers
- `src/features/cx-hub/lib/roster.ts:359-416` — sync merge (manual branch 367-377)
- `src/features/cx-hub/lib/roster.ts:47-49` — `DQ_SYNC_KEEP_MANUAL`
- `src/features/cx-hub/lib/roster.ts:177-181` — `dqHctActive_`
- `tests/golden/hub-people-holidays.test.ts` — golden coverage for the page
- `src/features/cx-hub/components/people-holidays-page.tsx:344,386` — filter+toggle
