# S06-03: coverage probes — New Tickets Daily windows + qe cache parity
Kind: mini
ID: S06-03
Parent: S06
Owner: data-engineer
Depends: none
Criteria: PLAN #1 (owed subset evidence for touch_archive, qa_engine_source,
qa_queue before final verdicts)
Skills: none
Budget: files=2; actions=4; changed_lines=180; minutes=10

## Goal
Read-only evidence pack `specs/migration-remaining/decisions-coverage.md`:
(1) per `New Tickets Daily` sheet, its `Performed At` min/max vs the
fd_activities coverage window -> verdict `subset` | `gap:<from>,<to>`;
(2) qa_queue `Ticket Detail Cache` ticket-id set vs `qe_fd_cache` + `tickets`
-> verdict `subset` | `orphans:<n>`.

## Files
- Create: `migration/probe-coverage-gaps.ts` | one read-only script
- Create: `specs/migration-remaining/decisions-coverage.md` | verdicts + numbers

## Context
- `specs/migration-remaining/source-inventory.md:139-175` | the three flagged
  stores: touch_archive `1qch1vaZP2xaiQQ3k0FFhWLGJ4gVL0i7Zx_vbX3jG_-A`
  (430,056-grid), qa_engine_source `1VtBT8kIIhK7PxKYJJQlnhxNtmz17ewhkWtpUt8jiB4s`
  (165,461-grid) — both `Performed At, Ticket ID, Performer…` shape; qa_queue
  `1ArWBreAPYAmFX4qnWd1jw3OQ2s8MLvJpqp5024gWjYY` `Ticket Detail Cache` 25,295
- `src/features/shared/jobs/mirrors.ts:62-72` | fd_activities ts_ms derivation
  (MM-dd-yyyy + activity_local_tz) — reuse to parse `Performed At`
- `supabase/migrations/004_mirror_tables.sql:12-20` +
  `014_migration_hardening.sql:194-200` | fd_activities + qe_fd_cache cols
- `migration/migrate-all.ts:15-32` | env + supabase client pattern

## Contract
Column-bounded reads only — never full-tab pulls of the 430k sheets: fetch
`'New Tickets Daily'!A2:A` (Performed At col) in <=4 chunks via values.get
page ranges; remote side `select('ts_ms')` min/max aggregates on
fd_activities (PostgREST order+limit 1 twice). For the cache check read only
the ticket-id column + `qe_fd_cache`/`tickets` id columns (paged .range).
Parse timestamps with the mirrors.ts tz rule; a `Performed At` outside
fd_activities' [min,max] means `gap:` with the observed range. All verdicts
from live numbers, no guesses.
Out of scope: any writes; backfill (S06-09); doc final-states (S06-12).

## Actions
1. Write `migration/probe-coverage-gaps.ts`: sheets read + supabase reads +
   the three checks + verdict lines.
2. Run -> `specs/migration-remaining/logs/coverage-gaps.log`; keep `exit=` +
   `tail -c 3000`.
3. Write `decisions-coverage.md`: three verdicts with the numbers behind them.
4. Write `results/S06-03.md` (<=10 lines: verdicts + log pointer).

## Done when
- `decisions-coverage.md` has one verdict + numbers for each of: NTD
  touch_archive, NTD qa_engine_source, qa_queue Ticket Detail Cache.
- Log shows 0 sheet writes; reads bounded to single columns.

## Verify
- Run: `npx tsx migration/probe-coverage-gaps.ts > specs/migration-remaining/logs/coverage-gaps.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/coverage-gaps.log` -> exit=0, three verdict lines.

## Handoff
S06-09 reads the NTD verdicts (gap ranges or subset). S06-12 cites this doc
for the three stores' final states. Write `results/S06-03.md`; TL updates
TRACKER.md.
