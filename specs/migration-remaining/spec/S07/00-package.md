# S07: round-2 reshard leftovers — engine header fidelity, qe_cache orphans, validator parity
Kind: package
ID: S07
Dispatch: NEVER

## Goal and contract
Close the three `needs-split` rows TRACKER.md's Re-sharding table records
after the S06 round-2 gates (reports/tl-2.md §needs-split):
1. **Engine header fidelity** — `readSheet` (engine.ts:141-156) drops
   header-less columns (FD_AUX E..G blocks `aux_spans`) and lets duplicate
   headers overwrite each other (`CTL & Quality` 'Agent Email' →
   qa_ctls.agent_email omitted). Fix the key scheme once, then let mapping
   leaves consume it.
2. **qa_queue `Ticket Detail Cache` orphans** — 13,650 ids absent from
   qe_fd_cache, 1,523 also absent from tickets (decisions-coverage.md §3);
   needs a decide + bounded backfill-or-reject outcome.
3. **Validator parity** — validate.ts never executes ROW_TRANSFORMS and its
   KNOWN_STORES lacks `oct_workbook`, so transform-keyed mappings report
   false `skipped` counts and call_transcripts SRC-FAILs against `core`.
Sources stay strictly read-only in every leaf. Non-goals: reopening any
done S01–S06 leaf; `--write` runs, live `migrate-all --tables`, or DDL
application (all PM approval gates); the audit_id→qa_audits SQL recovery
itself (S07-03 either records the cheap mapping fix or hands the SQL
verdict back to TL).

## Children
Index: `S07/00-index.md`

Coverage map (needs-split row -> leaf ids):
- Row 1a (FD_AUX→aux_spans blocked on unlabeled cols E..G) -> S07-01 engine
  key scheme; S07-02 mapping + probe; S07-06 docs.
- Row 1b (qa_ctls.agent_email duplicate-header) -> S07-01 mechanism; S07-03
  decide+apply (first-occurrence map or audit_id→qa_audits verdict);
  S07-06 docs.
- Row 2 (qe_cache orphans:1523) -> S07-04 decide/backfill CLI;
  S07-06 docs.
- Row 3 (validate.ts transform/store gap) -> S07-05 validator parity;
  S07-06 docs.

## Completion
All child leaves done; every retained `reshard:` flag in
source-inventory.md has a final state with evidence (S07-06); integration =
`migrate-all --dry --tables aux_spans` reads the FD_AUX rows and a targeted
`validate.ts --md` shows the artifacts gone. PM gates: live
`migrate-all --tables aux_spans,qa_ctls` after the S06-04 migration file is
applied; `backfill-qe-cache-orphans.ts --write` for the S07-04-chosen set.
This file is planner context, not an assignment.
