# S02-05: upsertOn flips + dedupe_key transforms — queue-quality.ts
Kind: mini
ID: S02-05
Parent: S02
Owner: dev
Depends: S02-02, S02-03, S02-04
Criteria: PLAN #5 (mapping idempotency, logs/sched part)
Skills: none
Budget: files=1; actions=7; changed_lines=140; minutes=8

## Goal
Flip the 4 remaining insert-only mappings in `queue-quality.ts` and add any
`dedupe_key` ROW_TRANSFORMS the S02-02/03 results flagged — file-level tail of
S02-04's edit.

## Files
- Edit: `src/features/shared/migration/mappings/queue-quality.ts` | mappings (~lines 143-152, 249, 262, 410-411) + `ROW_TRANSFORMS` block (~line 473)

## Context
- `results/S02-02.md` + `results/S02-03.md` | authoritative keys + which
  tables need a `dedupe_key` transform
- `src/features/shared/migration/mappings/queue-quality.ts:494-496` | the
  refresh_log `'mig-'+ctx.index` transform — the exact pattern for dedupe_key

## Contract
Add `upsertOn: '<key>'` to these 4 mappings with keys copied verbatim from the
results files: refresh_log, sched_plan, qa_access_log, qe_builds.
For every table (across ALL families — including people-core tables such as
mail_log/follow_up_done if flagged) whose results entry says
`transform:dedupe_key`, add to `ROW_TRANSFORMS` a sheet-keyed entry:
`row.dedupe_key = 'mig-' + ctx.index` (guarded `if (row.dedupe_key ===
undefined || row.dedupe_key === null || row.dedupe_key === '')`), keyed by the
mapping's `sheet` name — same convention as the refresh_log transform.
Add DECISIONS lines only for tables that got the dedupe_key fallback.
Do not touch any other region.
Out of scope: other files, remote apply.

## Actions
1. refresh_log: add `upsertOn` with its results-file key.
2. sched_plan: add `upsertOn` with its results-file key.
3. qa_access_log: add `upsertOn` with its results-file key.
4. qe_builds: add `upsertOn` with its results-file key.
5. Add `dedupe_key` ROW_TRANSFORMS entries for every flagged table (per
   results files; 0-n entries, keyed by sheet name).
6. Append DECISIONS notes for dedupe_key tables only.
7. Typecheck.

## Done when
- 4 mappings carry their results-file keys.
- Every `transform:dedupe_key` flag has a matching ROW_TRANSFORMS entry.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s02-05-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
queue-quality.ts fully flipped. Write `results/S02-05.md` listing which tables
got dedupe_key transforms (S02-07 needs to know its flips are keyed right);
TL updates TRACKER.md.
