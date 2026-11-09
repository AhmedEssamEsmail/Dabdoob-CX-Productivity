# FIX-02b: Remove Vercel job-data-tick cron; docstring + ARCHITECTURE.md -> pg_cron */15
Kind: mini
ID: FIX-02b
Parent: -
Owner: dev
Depends: none
Criteria: qa-1 finding qa-2 (PM decision 2026-11-09); PLAN #9
Skills: none
Budget: files=3; actions=3; changed_lines=25; minutes=5

## Goal
job-data-tick is scheduled solely by the new pg_cron migration (FIX-02a):
remove its Vercel cron entry (avoids double-runs at 05:00 UTC) and make the
route docstring + ARCHITECTURE.md cron table tell the truth.

## Files
- Edit: `vercel.json` | delete the `job-data-tick` crons entry (currently lines 220-223)
- Edit: `src/app/api/cron/job-data-tick/route.ts` | docstring block only (lines 1-5)
- Edit: `docs/ARCHITECTURE.md` | cron table row (~line 38) + the "pg_cron installed but not scheduled" paragraph (~lines 56-58)

## Context
- `vercel.json:220-223` | `{ "path": "/api/cron/job-data-tick", "schedule": "0 5 * * *" }` — remove exactly this object; keep all other crons byte-identical.
- `docs/ARCHITECTURE.md:33-58` | cron table + pg_cron note that becomes stale.

## Contract
- vercel.json stays valid JSON; the 4 reminder crons + every other entry untouched.
- route.ts docstring: still "every 15 min" but now attribute scheduling to
  Supabase pg_cron (migration), explicitly "not Vercel". No code changes.
- ARCHITECTURE.md: job-data-tick row -> `*/15 * * * *` via pg_cron+pg_net;
  paragraph -> pg_cron now schedules job-data-tick only (rest of the 012 draft
  still blocked). Keep the table's UTC note accurate.
Out of scope: the migration itself (FIX-02a), other cron rows, any other file.

## Actions
1. Delete the job-data-tick object from vercel.json `crons`.
2. Rewrite the route.ts docstring scheduling line.
3. Update the two ARCHITECTURE.md spots.

## Done when
- `vercel.json` parses; `grep job-data-tick vercel.json` returns nothing.
- Docstring + ARCHITECTURE.md describe */15 via pg_cron consistently.

## Verify
- Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"` -> exit 0; `grep -c job-data-tick vercel.json` -> 0.

## Handoff
Docs/code consistent with the FIX-02a migration. Write results/FIX-02b.md
(<=10 lines); TL alone updates TRACKER.md.
