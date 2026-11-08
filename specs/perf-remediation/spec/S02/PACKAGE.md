# S02: buildJobEnv lazy table loading (per-job lists)
Kind: package
ID: S02
Dispatch: NEVER

## Goal and contract
PLAN criterion #2: `buildJobEnv` no longer preloads all 12 PROD_TABLES
(`env.ts:229-290`). The per-job-list design is chosen over async prodRows
(the JobEnv/ProdIo contract is synchronous). Each job function declares the
prod tables it reads via `env.prefetchTables([...])` (already the seam used
for tickets/agg tables). `prodRows`/`cachedLive` on a never-loaded table
return [] AND record `tableErrors[name] = 'not prefetched'` so a missing
declaration is visible in run output instead of a silent empty read.
`prefetchTables` special-cases `prod_intervals` with the `intervalBound`
window (today-45d; `ensureIntervals` still widens). `opts.roster === false`
skips the roster/config-adjacent read for jobs that never use env.dir,
env.roster or env.headcount. Unfetched table names per engine fn are
enumerated inside each child leaf — the dev does not rediscover them.
Non-goals: making prodRows async; changing engine pure fns.

## Children
Index: `S02/00-index.md`
- env lazy core: S02-01 | job-fn lists: productivity S02-02, tph S02-03,
  backfill S02-04, quarterly S02-05 | non-prod env users audit S02-06

## Completion
All children done; `job-tph-hourly` issues <=3 table reads besides none
beyond its declared list; no job run logs 'not prefetched' tableErrors.
