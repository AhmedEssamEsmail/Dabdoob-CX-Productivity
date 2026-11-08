# S09: vercel.json schedules + tph-past-days runtime budget
Kind: package
ID: S09
Dispatch: NEVER

## Goal and contract
PLAN criterion #9: `vercel.json` gains the five missing schedules —
`job-data-tick` (*/15) and the four reminder crons — using the cadences
recorded in `supabase/migrations/012_pg_cron_schedule.sql` (pg_cron stays
unused per PLAN non-goals; Vercel owns scheduling). `job-tph-past-days`
gets an internal budget <=60s so one invocation exits cleanly between day
steps instead of running to the 270s guard (the "self-chunked" alternative
is not taken — record why if the audit disagrees). Invariants: existing
cron entries untouched; route auth (Bearer CRON_SECRET) unchanged.
Non-goals: pg_cron cutover, schedule changes beyond adding these entries,
Vercel Pro upgrade.

## Children
Index: `S09/00-index.md`
- vercel.json +5 crons: S09-01 | tph-past-days 55s budget: S09-02

## Completion
Both done; ARCHITECTURE.md cron table reflects reality via S11-01.
