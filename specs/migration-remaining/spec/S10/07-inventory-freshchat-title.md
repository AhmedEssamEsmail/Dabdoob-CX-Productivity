# S10-07: source-inventory — Sep-2026 title fix + Freshchat colA-vs-read note
Kind: mini
ID: S10-07
Parent: S10
Owner: data-engineer
Depends: S10-03 (same file, serialised after)
Criteria: finding data-7 (reports/data-1.md) — LOW
Skills: none
Budget: files=1; actions=2; changed_lines=10; minutes=5

## Goal
Two label drifts in the canonical inventory: §3 calls the oct workbook
"Productivity (Oct-2026)" / "Title says Oct" while sc-probe.log shows
`title="Productivity (Sep-2026)"`; §6 records Freshchat "1,741 data rows"
vs the backfill's `read=1742` (col-A vs raw-extent metric, unreconciled ±1).

## Files
- Edit: `specs/migration-remaining/source-inventory.md` | §3 ~lines 52-55 (header + 'Title says Oct'), §6 ~line 112 (1,741 figure)

## Context
- `specs/migration-remaining/source-inventory.md:52-55,110-114` | the two
  spots (S10-03 only touches §5 — this leaf must not)
- `specs/migration-remaining/logs/sc-probe.log` | `title="Productivity
  (Sep-2026)"`
- `specs/migration-remaining/logs/fc-dry.log` | `read=1742`

## Contract
- §3: correct the title to "Productivity (Sep-2026)" and the 'Title says
  Oct' claim to 'Title says Sep' — the month-resolution statement
  (maps to 2026-09) stays correct and unchanged.
- §6: keep 1,741 as the col-A data-row figure but add a short parenthetical
  noting the metric difference vs backfill `read=1,742` (raw extent incl.
  trailing col-A-empty row, ±1 unreconciled).
Out of scope: §5 (S10-03), every other section/doc.

## Actions
1. §3 header + 'Title says Oct' -> Sep wording (title + claim).
2. §6 Freshchat line: append the colA-vs-read ±1 note.

## Done when
- `grep -n "Oct-2026\|Title says" specs/migration-remaining/source-inventory.md` -> §3 shows Sep-2026; `grep -n "1,74"` -> the ±1 note present.

## Verify
- Run: `grep -n "Sep-2026\|read=1,742\|1742" specs/migration-remaining/source-inventory.md` -> both corrections present

## Handoff
None.
Write results/S10-07.md (<=10 lines); TL alone updates TRACKER.md.
