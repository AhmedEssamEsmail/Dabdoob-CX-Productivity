# S02-04: upsertOn flips — queue-quality.ts (agg/snapshot part)
Kind: mini
ID: S02-04
Parent: S02
Owner: dev
Depends: S02-01
Criteria: PLAN #5 (mapping idempotency, queue/agg part)
Skills: none
Budget: files=1; actions=7; changed_lines=120; minutes=8

## Goal
Flip 7 insert-only mappings in `queue-quality.ts` to `upsertOn` using exactly
the keys S02-01 recorded in `results/S02-01.md` — nothing else.

## Files
- Edit: `src/features/shared/migration/mappings/queue-quality.ts` | the 7 mapping literals listed below (region ~lines 85-141)

## Context
- `results/S02-01.md` | authoritative table→upsertOn key list (required)
- `src/features/shared/migration/mappings/queue-quality.ts:85-141` | the
  mapping literals to edit
- `src/features/shared/migration/engine.ts:210-217` | how upsertOn dedupes

## Contract
Add `upsertOn: '<key>'` to exactly these 7 mappings, with the key string copied
verbatim from S02-01's results file: aging_open_tickets, agg_queue_now,
agg_inflow_weekly, agg_inflow_monthly, agg_agent_perf, agg_agent_daily,
agg_snapshots_today. If S02-01 recorded `dedupe_key` for a table, set
`upsertOn: 'dedupe_key'` and flag it in your results (S02-05 owns the
transforms). Do not touch any other mapping, transform, comment block, or
export in the file.
Out of scope: transforms, DECISIONS, other files, remote apply.

## Actions
1. aging_open_tickets: add `upsertOn: '<key>'` inside its mapping literal
   (key verbatim from `results/S02-01.md`; keep existing `require`).
2. agg_queue_now: same upsertOn addition in its mapping literal.
3. agg_inflow_weekly: same.
4. agg_inflow_monthly: same.
5. agg_agent_perf: same.
6. agg_agent_daily: same.
7. agg_snapshots_today: same.

## Done when
- All 7 mappings carry the S02-01 key; no other edit in the file.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s02-04-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
File freed for S02-05 (remaining queue-quality flips). Write
`results/S02-04.md` (<=10 lines); TL updates TRACKER.md.
