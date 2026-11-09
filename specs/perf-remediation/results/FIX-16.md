# FIX-16 result
Status: done
Files: edited src/features/cx-queue/lib/jobs.ts (dqTicketsReadOr_ + .or on tickets read); created tests/jobs/queue-tickets-read.test.ts
Checks: vitest tests/jobs/queue-tickets-read.test.ts + tests/golden/queue-aggregates.test.ts -> 33/33 pass; npx tsc --noEmit -> 0 errors
Notes: .or = status.in.(raw/lower/upper open statuses from opts.open) OR created_at.gte OR resolved_at.gte; bound = bizTz today-1d 00:00 (superset of isToday counters). Open statuses quoted in in.(); empty open list omits status.in term.
Handoff: FIX-19 may proceed (same file, different function).
