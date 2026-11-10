# S10-05: run-2 headline honesty + migration-report run-2 section refresh
Kind: mini
ID: S10-05
Parent: S10
Owner: data-engineer
Depends: none (serialised before S10-06 on migration-run-2.md)
Criteria: finding data-5 (reports/data-1.md) — LOW
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=8

## Goal
Two stale doc statements contradict the evidence: the run-2 headline claims
"96/96 mappings read clean" while dry-run-2.log shows 87/96 read + 9
pre-existing absent-tab READ FAILEDs; migration-report's run-2 section says
"121 tables" (now 124) and "17 non-task tabs reshard:-flagged" (closed by
S06-12).

## Files
- Edit: `specs/megaplan/audits/migration-run-2.md` | §1 headline ~line 16
- Edit: `specs/megaplan/migration-report.md` | run-2 section ~lines 374-392

## Context
- `specs/megaplan/audits/migration-run-2.md:14-26` | headline + metrics table
  (the table's '0 hard failures (9 pre-existing READ FAILED)' line is already
  honest — headline is the contradiction)
- `specs/megaplan/migration-report.md:374-392` | run-2 block quoting
  "Validator now covers 121 tables" + "17 non-task tabs reshard:-flagged"
- `specs/migration-remaining/logs/dry-run-2.log` + `logs/tl4-validate.log` /
  `logs/tl5-validate.log` | 87/96 + 9 READ FAILEDs; validator 124 tables
- `specs/migration-remaining/TRACKER.md` S06 rows | final tab states: 9 land
  via new mappings/v1_task_occurrences, 8 rejected (decisions-v1-ops.md);
  Aug-2026 workbook blocked on share

## Contract
- Headline: reword to "87/96 read + 9 pre-existing absent-tab failures"
  (numbers per dry-run-2.log; keep the rest of the sentence's claims intact).
- Report run-2 section: "121 tables" -> "124 tables" and replace the
  reshard:-flagged claim with the S06/S07 final states (9 mapped +
  v1_task_occurrences, 8 rejected; Aug-2026 blocked on workbook share).
- Historical-section text stays as history; only these stale claims change.
Out of scope: §4 of migration-run-2.md (S10-06 appends there), other files.

## Actions
1. migration-run-2.md: fix the headline figure (87/96 + 9 absent-tab READ
   FAILEDs).
2. migration-report.md: 124 tables; S06/S07 final tab states replace the
   stale reshard flag.
3. grep both files to confirm no remaining stale claim.

## Done when
- `grep -n "96/96\|121 tables\|reshard:" specs/megaplan/audits/migration-run-2.md specs/megaplan/migration-report.md` -> only already-honest mentions remain (metrics table, historical refs).

## Verify
- Run: `grep -n "87/96\|124 tables" specs/megaplan/audits/migration-run-2.md specs/megaplan/migration-report.md` -> both present

## Handoff
Unblocks S10-06 (same migration-run-2.md file).
Write results/S10-05.md (<=10 lines); TL alone updates TRACKER.md.
