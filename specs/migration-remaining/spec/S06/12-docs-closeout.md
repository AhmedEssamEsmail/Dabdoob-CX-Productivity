# S06-12: docs closeout — reshard items reach final states
Kind: mini
ID: S06-12
Parent: S06
Owner: tech-writer
Depends: S06-03, S06-05, S06-06, S06-07, S06-08, S06-09, S06-10, S06-11
Criteria: PLAN #1 (every reshard-flagged dataset gets a final state), #6
(run ledger covers the new mappings/scripts)
Skills: none
Budget: files=2; actions=4; changed_lines=220; minutes=10

## Goal
Update `specs/migration-remaining/source-inventory.md` so every `reshard:` /
"still owed" flag becomes a final state (migrated/covered/rejected/blocked)
with evidence, and append the S06 rows to
`specs/megaplan/audits/migration-run-2.md` (live-count cells
PENDING-APPROVAL where gated).

## Files
- Edit: `specs/migration-remaining/source-inventory.md` | the flagged sections only (§2 v1_ops, §3 oct, §6 daily_report, §9-10 NTD, §11 qa_queue cache line, access-gap note)
- Edit: `specs/megaplan/audits/migration-run-2.md` | append S06 mapping/script rows in the existing ledger format

## Context
- `specs/migration-remaining/source-inventory.md` | the base doc + flags
- `specs/migration-remaining/decisions-v1-ops.md`, `decisions-ops-tabs.md`,
  `decisions-coverage.md` | the verdict docs (S06-01/02/03)
- `results/S06-*.md` + `specs/migration-remaining/logs/*.log` | per-leaf
  evidence (dry counts, probe verdicts, wiring tsc)
- `specs/megaplan/audits/migration-run-2.md` | the ledger format to extend

## Contract
Final-state rules mirror S05-04's: each flagged dataset gets one state +
evidence pointer; gated live counts stay `PENDING-APPROVAL`, never fake;
the Aug-2026 store ends `blocked: share pending` or `migrated` per S06-11's
verdict; a dataset whose leaf recorded RESHARD_NEEDED keeps an explicit
`reshard:` flag — never silently dropped. Ledger rows: one per new mapping
table + the fd-history backfill + the sc-refresh month add, in run-2's
columns.
Out of scope: code; TRACKER.md (TL); gate sign-offs; rewriting finalized
sections unrelated to the flags.

## Actions
1. Collect verdicts + counts from the decision docs, results files, logs
   (bounded tails only).
2. Update each flagged source-inventory section's state line.
3. Append S06 rows to migration-run-2.md.
4. Write `results/S06-12.md` (<=10 lines: states closed + open gates).

## Done when
- `grep -c "reshard:"` on source-inventory.md decreases to only entries
  with a fresh RESHARD_NEEDED reason; every former flag has a state +
  evidence pointer.

## Verify
- Run: `grep -n "reshard:\|migrated\|covered\|rejected\|blocked" specs/migration-remaining/source-inventory.md | wc -l` -> all 11 stores + every tab flag covered.

## Handoff
Closes the S01-01 reshard scope for PLAN #1/#6; PM reviews at the QA/Data
gates alongside the pending approvals. Write `results/S06-12.md`; TL
updates TRACKER.md.
