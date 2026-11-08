# S07-03: Lookup indexes — tickets, refresh_log, queue_submissions
Kind: mini
ID: S07-03
Parent: S07
Owner: supabase-expert
Depends: S07-02
Criteria: PLAN #7 (index group B)
Skills: none
Budget: files=1; actions=5; changed_lines=35; minutes=5

## Goal
One migration file creating the five remaining audit-listed indexes —
tickets(176k/72MB is the hot table), refresh_log and queue_submissions.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`; record the actual filename in results

## Context
- PLAN criterion #7 index list (authoritative): tickets(status), tickets(group_name), tickets(created_at), refresh_log(job,finished_at), queue_submissions(slot_date)
- `src/features/cx-queue/lib/jobs.ts:94-97,160-164` | tickets reads filtered by status/channel/created_at — the indexed columns
- `src/features/cx-productivity/lib/tph/page.ts:140` | refresh_log tail order by started_at; job+finished_at serves the dqLastRun-style lookups
- `supabase/migrations/014_migration_hardening.sql:25-58` | naming/comment convention

## Contract
- `tickets(status)`; `tickets(group_name)`; `tickets(created_at)`; `refresh_log(job,finished_at)`; `queue_submissions(slot_date)`.
- `CREATE INDEX IF NOT EXISTS`; `CONCURRENTLY` on the 176k-row tickets table per the expert skill's rules (note: CONCURRENTLY cannot run inside a transaction block — follow the skill's guidance for migration structure).
- Idempotent; remote apply user-approved, not this leaf.
Out of scope: everything not listed.

## Actions
1. CREATE INDEX on `tickets(status)` (CONCURRENTLY per contract).
2. CREATE INDEX on `tickets(group_name)` (CONCURRENTLY).
3. CREATE INDEX on `tickets(created_at)` (CONCURRENTLY).
4. CREATE INDEX on `refresh_log(job,finished_at)`.
5. CREATE INDEX on `queue_submissions(slot_date)`.

## Done when
- Migration file contains exactly these five indexes, idempotent.
- `supabase migration lint` (or skill-equivalent check) passes.

## Verify
- Run: `supabase migration list` -> the new file is registered.

## Handoff
Migration catalog frees for S10-01 (chained). Write results/S07-03.md
(<=10 lines) with the filename; TL alone updates TRACKER.md.
