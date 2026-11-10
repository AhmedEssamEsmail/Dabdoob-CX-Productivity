# S07-04: qa_queue Ticket Detail Cache orphans — decide + bounded backfill
Kind: mini
ID: S07-04
Parent: S07
Owner: data-engineer
Depends: S06-03
Criteria: reshard row 2 (orphans:1523 land in qe_fd_cache or get a final reject verdict)
Skills: none
Budget: files=2; actions=5; changed_lines=200; minutes=10

## Goal
Decide the landing target for the 13,650 `Ticket Detail Cache` ids absent
from qe_fd_cache (1,523 of them also absent from tickets) and record the
verdict with evidence: create `migration/backfill-qe-cache-orphans.ts`
(`--dry` default recomputes the sets, samples row content, prints
would_write; `--write` upserts qe_fd_cache — PM-gated) and append the
verdict to decisions-coverage.md.

## Files
- Create: `migration/backfill-qe-cache-orphans.ts` | one CLI script (dry default, --write flag)
- Edit: `specs/migration-remaining/decisions-coverage.md` | append the verdict + evidence under section 3

## Context
- `specs/migration-remaining/decisions-coverage.md` section 3 | S06-03 counts (25,295 / 11,645 / 176,616 -> 13,650 + 1,523) — reuse method, recompute the sets
- `src/features/shared/migration/mappings/queue-quality.ts:437-453` | exact 13-column qe_fd_cache shape + sheetToDb header names to replicate
- `src/features/cx-quality/lib/engine.ts:11,35` | QE_OLD_DATA_SS_ID `1ArWBreAPYAmFX4qnWd1jw3OQ2s8MLvJpqp5024gWjYY` + the tab name constant
- `migration/probe-coverage-gaps.ts` | sibling's paged single-column read pattern (sheets + supabase id sets)

## Contract
Reads stay bounded: paged single-column pulls of the sheet `ID` col on
qa_queue `1ArWBreAPYAmFX4qnWd1jw3OQ2s8MLvJpqp5024gWjYY` tab
`Ticket Detail Cache`, `qe_fd_cache.id`, `tickets.ticket_id` (S06-03's
pattern; no full-table dumps). Sets: MISSING = sheet ids not in
qe_fd_cache; ORPHAN = MISSING also not in tickets (expect ~13,650/~1,523 —
log drift vs section 3). `--dry` prints both counts + a bounded content
sample of each set (subject/status/created_at fill-rate + date window, a
few rows) + would_write per set. `--write` upserts the import-worthy
set(s) into qe_fd_cache using the mapping's 13 verbatim columns
(onConflict `id`, 500-row batches, `cached_at` = now).
Verdict rule the leaf applies and records in the doc: `import:
qe_fd_cache` for whichever sets carry real detail content;
`rejected: stale V1 cache remnants` for sets whose sampled rows are
empty/garbage (deleted-ticket residue). Either outcome closes the flag;
the doc gets the counts, sample evidence and the chosen sets.
Out of scope: other qa_queue tabs (the store-level rejected verdict
stands); the quality store's same-named tab (existing mapping covers it);
live `--write` (PM gate); schema changes.

## Actions
1. Read section 3 + the queue-quality mapping; fix the column list, header names and read pattern.
2. Create the script: env bootstrap, flag parse, paged id-set reads, MISSING/ORPHAN set math.
3. Add the --dry evidence block (counts, fill-rate sample, date window, would_write) and the --write upsert path behind the flag.
4. Run `--dry` into the log; pick the verdict per the contract rule from the sampled evidence.
5. Append the verdict + counts + log reference to decisions-coverage.md section 3; write results file.

## Done when
- `--dry` exits 0 printing MISSING/ORPHAN counts, content sample and per-set would_write.
- decisions-coverage.md section 3 carries a final verdict (import set(s) or reject reason) citing the dry counts.

## Verify
- Run: `npx tsx migration/backfill-qe-cache-orphans.ts --dry > specs/migration-remaining/logs/s07-04-qe-orphans.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/s07-04-qe-orphans.log` -> exit=0 with both counts + sample + would_write

## Handoff
PM gate: `--write` upserts the import-worthy set(s) into qe_fd_cache
(idempotent on `id`). Write results/S07-04.md (<=10 lines); TL updates
TRACKER.md.
