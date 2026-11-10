# S02-06: upsertOn flips — people-core.ts (1o1/meeting/kpi part)
Kind: mini
ID: S02-06
Parent: S02
Owner: dev
Depends: S02-03
Criteria: PLAN #5 (mapping idempotency, people part A)
Skills: none
Budget: files=1; actions=6; changed_lines=110; minutes=8

## Goal
Flip 6 insert-only mappings in `people-core.ts` to `upsertOn` using exactly
the keys S02-03 recorded.

## Files
- Edit: `src/features/shared/migration/mappings/people-core.ts` | mapping literals (~lines 156-193, 303-311)

## Context
- `results/S02-03.md` | authoritative table→upsertOn key list (required)
- `src/features/shared/migration/mappings/people-core.ts:156-193,303-311` |
  the mapping literals
- `src/features/shared/migration/engine.ts:210-217` | upsertOn dedupe

## Contract
Add `upsertOn: '<key>'` to exactly these 6 mappings, keys verbatim from
S02-03's results: one_on_one_topics, one_on_one_private_notes,
meeting_series_members, meeting_attendees, kpi_behaviour_log, kpi_leave_log.
If S02-03 recorded `dedupe_key`, set `upsertOn: 'dedupe_key'` and flag it
(transforms are S02-05's job — note which table needs one). Keep existing
`require`; touch nothing else.
Out of scope: transforms, DECISIONS, other files, remote apply.

## Actions
1. one_on_one_topics: add `upsertOn` inside its mapping literal (key
   verbatim from `results/S02-03.md`).
2. one_on_one_private_notes: same.
3. meeting_series_members: same.
4. meeting_attendees: same.
5. kpi_behaviour_log: same.
6. kpi_leave_log: same.

## Done when
- All 6 mappings carry the S02-03 key; no other edit in the file.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s02-06-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
File freed for S02-07 (remaining people-core flips). Write
`results/S02-06.md` (<=10 lines); TL updates TRACKER.md.
