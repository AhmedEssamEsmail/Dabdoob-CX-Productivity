# S05-04: final report — run ledger + source-inventory final states
Kind: mini
ID: S05-04
Parent: S05
Owner: tech-writer
Depends: S05-03 (+ PM approval-gated live runs)
Criteria: PLAN #1 (final inventory), #6 (report + audit doc)
Skills: none
Budget: files=3; actions=4; changed_lines=250; minutes=10

## Goal
Write the post-run documentation: `specs/megaplan/audits/migration-run-2.md`
(per-store read/write/skip counts), update `specs/megaplan/
migration-report.md` to post-run state, and finalize `specs/
migration-remaining/source-inventory.md` so every store shows its end state
(migrated/covered/rejected) with evidence.

## Files
- Create: `specs/megaplan/audits/migration-run-2.md` | the run-2 ledger
- Edit: `specs/megaplan/migration-report.md` | post-run state section only
- Edit: `specs/migration-remaining/source-inventory.md` | verdict→final-state lines + evidence columns only

## Context
- `specs/megaplan/audits/migration-run.md` | the WP-51 ledger format to mirror
- `specs/migration-remaining/source-inventory.md` | S01-01 verdicts (base doc)
- `results/*.md` from S02-S05 + `specs/migration-remaining/logs/*.log` | all
  evidence inputs (dry counts, live-run counts recorded by PM runs)
- `specs/migration-remaining/PLAN.md:17-47` | the 7 criteria to close out

## Contract
migration-run-2.md: same columns as run-1 (read/migrated/skipped/result) per
new mapping + each --write backfill result + the dedupe apply + the PLAN #5
targeted re-run row (expect 0 new rows). migration-report.md: append/update
the post-run section only — do not rewrite history. source-inventory.md:
each store's verdict line becomes a final state with the count evidence;
`reshard:` items stay flagged, never silently dropped. If live runs have NOT
happened yet, write the ledger with the dry-run/--probe counts and mark the
live-count cells `PENDING-APPROVAL` — honest partial, not fake numbers.
Out of scope: code, source edits beyond the three files, gate sign-offs
(PM owns those).

## Actions
1. Collect counts from results/*.md + logs (bounded tails only).
2. Write migration-run-2.md in run-1's format.
3. Append the post-run section to migration-report.md.
4. Finalize source-inventory.md states + write `results/S05-04.md`.

## Done when
- All 3 docs reflect current state; every store has a final verdict+evidence.
- No criterion lacks a pointer to its evidence (counts or PENDING-APPROVAL).

## Verify
- Run: `grep -n "migrated\|covered\|rejected" specs/migration-remaining/source-inventory.md | wc -l` -> >= 11 store lines.

## Handoff
Closes PLAN #1/#6; PM reviews the audit docs at the QA/Data/Security gates.
Write `results/S05-04.md`; TL updates TRACKER.md.
