# S05-03: read-only verification sweep (dry-run + validator + proof grep)
Kind: mini
ID: S05-03
Parent: S05
Owner: dev
Depends: S02-04, S02-05, S02-06, S02-07, S02-08, S05-01, S05-02
Criteria: PLAN #5 (dry re-run), #6 (validator run), #7 (read-only proof)
Skills: none
Budget: files=1; actions=4; changed_lines=20; minutes=10

## Goal
Run the full read-only verification and capture evidence: `migrate-all --dry`
reads every mapping (old + new), the validator `--md` ledger regenerates, and
the PLAN #7 grep proves no source-write calls exist anywhere. Only a results
file is written.

## Files
- Create: `results/S05-03.md` | the evidence record (<=10 lines)

## Context
- `specs/migration-remaining/PLAN.md:73-78` | the exact gate commands
- `migration/migrate-all.ts` | `--dry` = read+map only, zero writes
- `C:\Users\AHMED\AppData\Roaming\devin\skills\OUTPUT-BUDGET.md` | redirect +
  bounded-tail rules for every heavy command

## Contract
Three evidence commands, all read-only, each redirected to its own log:
1. `npx tsx migration/migrate-all.ts --dry` → must list dq_hct + actions
   (v1_ops) mappings reading their tabs; previously-flipped mappings read
   normally (upsertOn changes nothing read-side). Absent/empty tab errors on
   NEW mappings = report, don't fix.
2. `npx tsx migration/validate.ts --md` → ledger covers all tables incl.
   dq_hct/fc_messages.
3. `git grep -nE "values\.(update|append)|batchUpdate" -- migration/
   src/features/shared/migration/` → only comments/no output (PLAN #7);
   also confirm `spreadsheets.readonly` is the only scope string under
   `migration/` + `src/features/shared/migration/`.
No source edits, no write runs, no remote apply.
Out of scope: the approval-gated real re-run (PM); fixing mappings (report
via RESHARD_NEEDED if a new mapping can't read its tab).

## Actions
1. Run `--dry` → `logs/dry-run-2.log`; grep the new-mapping lines.
2. Run validator `--md` → `logs/validate-2.log`.
3. Run the two proof greps → `logs/readonly-proof.log`.
4. Write `results/S05-03.md`: exit codes + the new-mapping dry lines +
   grep result (<=10 lines).

## Done when
- `--dry` exit=0 and shows dq_hct + v1_ops read lines (or documented FAILs).
- Validator output contains the new tables.
- Proof grep returns only comments; scope string unchanged.

## Verify
- Run: `npx tsx migration/migrate-all.ts --dry > specs/migration-remaining/logs/dry-run-2.log 2>&1; echo "exit=$?"; grep -n "dq_hct\|actions " specs/migration-remaining/logs/dry-run-2.log | head` -> exit=0, new mappings read.

## Handoff
Evidence for the PM's approval-gated live runs; results feed S05-04's report.
Write `results/S05-03.md`; TL updates TRACKER.md.
