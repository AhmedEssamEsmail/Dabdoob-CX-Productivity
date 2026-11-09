# FIX-20: status.ilike or-terms in dqTicketsReadOr_
Status: done
Files: src/features/cx-queue/lib/jobs.ts (dqTicketsReadOr_, docstring+body), tests/jobs/queue-tickets-read.test.ts (perf-2 assertion + header)
Checks: vitest run tests/jobs/queue-tickets-read.test.ts tests/golden/queue-aggregates.test.ts -> 34/34 pass; npx tsc --noEmit -> 0 errors
Notes: replaced status.in.(raw/lower/upper) with one status.ilike."*v*" per trimmed/deduped status; strips " * % meta chars; gte terms + empty-statuses guard unchanged; in-memory dqBuildAging_ filter still applies.
Handoff: none
