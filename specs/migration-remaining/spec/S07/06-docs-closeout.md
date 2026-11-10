# S07-06: docs closeout — flip the retained reshard flags to final states
Kind: mini
ID: S07-06
Parent: S07
Owner: tech-writer
Depends: S07-02, S07-03, S07-04, S07-05
Criteria: PLAN #1, #6 (every reshard flag ends in a final state with evidence)
Skills: none
Budget: files=2; actions=4; changed_lines=80; minutes=8

## Goal
Update the two docs still carrying `reshard:`/caveat wording for the S07
scope — source-inventory.md's oct section + section 11 + summary tail, and
migration-run-2.md's section 7 — to the final states S07-02..05 produced,
citing their logs/results files. Flag-flip only: no restating S06 history.

## Files
- Edit: `specs/migration-remaining/source-inventory.md` | ~lines 70-71+84-85 (FD_AUX flag), ~198-205 (Ticket Detail Cache flag), ~214-225 (summary tail)
- Edit: `specs/megaplan/audits/migration-run-2.md` | section 7 append — S07 row set + the lifted validate caveat

## Context
- `results/S07-02.md`, `results/S07-03.md`, `results/S07-04.md`, `results/S07-05.md` | the outcomes + evidence paths to cite
- `specs/migration-remaining/decisions-coverage.md` section 3 | the orphan verdict S07-04 recorded
- `specs/migration-remaining/source-inventory.md:60-90,187-225` | current flag wording being replaced

## Contract
FD_AUX: `reshard:` -> migrated->aux_spans (dedupe_key upsert; verbatim
A..G cols via engine col_ keys; dry/live runs PENDING-APPROVAL).
qa_ctls.agent_email: whichever final state S07-03 chose (first-occurrence
map, or the audit_id->qa_audits recovery verdict) — quote its result file.
Ticket Detail Cache: S07-04's verdict + counts (import set -> qe_fd_cache
--write PENDING-APPROVAL, or the recorded reject reason).
Validator: note the round-2 caveat lifted (transforms executed,
oct_workbook registered) citing logs/s07-05-validate.log.
Keep the Aug-2026 `blocked: share pending` flag verbatim — S06-11 is
untouched. Out of scope: other sections; TRACKER.md (TL-owned); PLAN.md;
any verdict S07 leaves did not produce.

## Actions
1. Read the four results files; fix each final state + its evidence path.
2. Rewrite the three source-inventory flag regions.
3. Append the S07 row set + lifted-caveat note to migration-run-2.md section 7.
4. Grep both files for remaining `reshard:` text; only the Aug-2026 blocked flag may remain.

## Done when
- No `reshard:`/blocked wording remains for FD_AUX, agent_email, Ticket Detail Cache or the validator caveat; each has a final state + evidence citation.
- The Aug-2026 `blocked: share pending` flag is preserved verbatim.

## Verify
- Run: `grep -n "reshard:" specs/migration-remaining/source-inventory.md` -> matches only inside historical context lines (if any) — no open flags for the S07 items

## Handoff
Inventory + audit docs reflect S07's final states; package S07 closable
once the PM gates land. Write results/S07-06.md; TL updates TRACKER.md.
