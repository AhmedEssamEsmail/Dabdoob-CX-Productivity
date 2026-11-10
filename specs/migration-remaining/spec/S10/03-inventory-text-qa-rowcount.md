# S10-03: source-inventory §5 — 'Form Responses 1' 3,037 -> 4,038 data rows
Kind: mini
ID: S10-03
Parent: S10
Owner: data-engineer
Depends: none (serialised before S10-07 on the same file)
Criteria: finding data-3 (reports/data-1.md) — MED
Skills: none
Budget: files=1; actions=2; changed_lines=5; minutes=5

## Goal
The canonical inventory records text QA `Form Responses 1` as "3,037 data
rows" but its own probes say grid=4,039 / rows=4,038 — a 1,001-row error in
the document reviewers reconcile against.

## Files
- Edit: `specs/migration-remaining/source-inventory.md` | §5 line ~102-103

## Context
- `specs/migration-remaining/source-inventory.md:100-108` | §5 block — the
  'Final state' line already says "probe: 4,038 rows read", proving the
  3,037 figure stale
- `specs/migration-remaining/logs/qa-probe.log` | `rows=4038` evidence

## Contract
Change the data-row figure to 4,038 data rows (grid 4,039). Do not touch any
other section/figure — S10-07 edits other lines of this same file afterwards.
Out of scope: everything else in the file; other docs.

## Actions
1. Edit §5: `3,037 data rows` -> `4,038 data rows` (keep the column list).
2. Re-read the edited line + neighbouring 'Final state' line for consistency.

## Done when
- §5 states 4,038 data rows and no other line changed.

## Verify
- Run: `grep -n "4,038\|3,037" specs/migration-remaining/source-inventory.md` -> 4,038 present at §5, no 3,037 left

## Handoff
Unblocks S10-07 (same file).
Write results/S10-03.md (<=10 lines); TL alone updates TRACKER.md.
