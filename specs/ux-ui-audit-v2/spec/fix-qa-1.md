# FIX leaves: ux-ui-audit-v2 qa-1 round 1 (reports/qa-1.md)

Attribution note: `tph-grid-views.tsx`, `tph-grid-matrix.tsx`, `tph-grid-shared.ts` are
UNTRACKED files — S13-04's split product with checkpointed S13-07 `memo()` edits on top
(mtimes 21:10/21:15, last writes concurrent with the qa-1 audit). No HEAD version exists;
there is nothing to revert to. This leaf types the `any` prop annotations left by the
checkpointed memo pass IN PLACE — do NOT undo the `memo()` wrappers or any other
uncommitted foreign edits.

## qa1-01: replace `any` prop types in tph-grid memo components
Kind: mini
ID: qa1-01
Parent: qa-1 (HIGH, reports/qa-1.md)
Owner: dev
Depends: none
Status: ready
Criteria: PLAN gate `npx eslint .` — 0 errors
Skills: none
Budget: files=2; actions=5; changed_lines=40; minutes=8

### Goal
`npx eslint .` is red with 14 `@typescript-eslint/no-explicit-any` errors in the two
tph-grid split components (qa-1 saw 5; the checkpointed memo pass added more). Replace
every `any` with the matching exported `tph-grid-shared.ts` type — type-only change,
zero runtime/markup change.

### Files
- Edit: `src/features/cx-productivity/components/tph-grid-matrix.tsx` | :38 `row: any`, :48 `(cell: any)` in `HgAgentRow`
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | :643, :792-793, :902, :937, :945, :960-961, :995, :1118, :1217, :1222 — memo props + map callbacks

### Context
- `src/features/cx-productivity/components/tph-grid-shared.ts:32-65` | all needed types already exported: `TphTask`, `TphChannel`, `TphTableRow`, `TphAgentRow`, `TphDayTotal`, `TphCaseCell`, `TphData`
- Callers (verified): views:771 `task={t}` from `d.tasks`; :886 `hourRow={o}` from `d.cases`, `channels={d.channels}`; :945/:1062/:1088-1097 rows/cells from filtered `d.table`; :1208 `day={o}` from `d.dayTotals`; :1241 `item={n}` from `d.eligible`
- matrix.tsx:118-153 | `agentRows` useMemo builds the row shape HgAgentRow consumes

### Contract
Type each site as follows (import types from `./tph-grid-shared`; views.tsx already imports some — extend, don't duplicate):
- views `TaskItem` `task` → `TphTask`
- views `CaseHourRow` `hourRow` → `TphData['cases'][number]`; `channels` → `TphChannel[]`
- views `CapAgent` `agent`, `CapCard` map cb `(agent)`, `CapTableAgentRow` `cell` → `TphAgentRow`
- views `CapCard` `row`, `CapTableAgentRow` `row`, `CapTableEmptyRow` `row` → `TphTableRow`
- views `AgentDayCard` `day` → `TphDayTotal`
- views `EligibleChannel` `item` → `TphData['eligible'][number]`; map cb `(a)` → that type's `agents[number]`
- matrix `HgAgentRow` `row`/`cell`: the shape is derived inside the `agentRows` useMemo — define a small local interface (e.g. `HgRow`/`HgCell`, cell as the `{hour,empty}` union) or annotate the useMemo return type so `row` and `cell` are typed without `any`.
If a site genuinely doesn't fit the shared type, narrow to the minimal structural object type — never `unknown`-cast chains or eslint-disable.
Out of scope: `memo()` wrappers (foreign S13-07 checkpoint work — keep), tph-grid-shared.ts, tph-grid-page.tsx, runtime/markup changes, loser-classnames warnings.

### Actions
1. Type `HgAgentRow` in matrix.tsx (:38, :48) per Contract.
2. Type `TaskItem` + `CaseHourRow` props in views.tsx (:643, :792-793).
3. Type `CapAgent`/`CapCard`/`CapTableAgentRow`/`CapTableEmptyRow` props + callback in views.tsx (:902, :937, :945, :960-961, :995).
4. Type `AgentDayCard` + `EligibleChannel` props + callback in views.tsx (:1118, :1217, :1222).
5. Targeted verify + results file.

### Done when
- `npx eslint src/features/cx-productivity/components/tph-grid-views.tsx src/features/cx-productivity/components/tph-grid-matrix.tsx` -> 0 `no-explicit-any` errors (only loser-classnames warnings may remain).
- `npx tsc --noEmit` -> exit 0.
- No edits outside the two listed files; `memo()` wrappers intact.

### Verify
- Run: `npx eslint src/features/cx-productivity/components/tph-grid-views.tsx src/features/cx-productivity/components/tph-grid-matrix.tsx` -> 0 errors.
- Run: `npx tsc --noEmit` -> clean.

### Handoff
Restores the PLAN eslint gate at tl-5 integration. Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.
