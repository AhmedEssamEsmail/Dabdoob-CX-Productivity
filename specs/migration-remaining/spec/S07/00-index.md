# Spec index: S07 round-2 reshard leftovers
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S07-01 | mini | S07/01-engine-header-keys.md | dev | none | engine col_/dup key scheme | 1/4/60/8 |
| S07-02 | mini | S07/02-fd-aux-mapping.md | dev | S07-01 | FD_AUX->aux_spans | 2/5/160/10 |
| S07-03 | mini | S07/03-ctl-agent-email.md | dev | S07-01, S07-02 | qa_ctls.agent_email | 1/4/60/8 |
| S07-04 | mini | S07/04-qe-orphan-backfill.md | data-engineer | S06-03 | orphans:1523 decide | 2/5/200/10 |
| S07-05 | mini | S07/05-validate-parity.md | dev | S07-01 | validate.ts parity | 1/6/140/10 |
| S07-06 | mini | S07/06-docs-closeout.md | tech-writer | S07-02..05 | flag final states | 2/4/80/8 |

Ready: S07-01, S07-04 (parallel, disjoint files). Serial: S07-01 ->
S07-02 -> S07-03 (ops-tabs.ts same-file serialization); S07-05 after
S07-01 (validate.ts only, runs parallel to the ops-tabs chain); S07-06 last.
PM gates: `migrate-all --dry --tables aux_spans` then live `--tables
aux_spans,qa_ctls` (S06-04 file must be applied first);
`backfill-qe-cache-orphans.ts --write` on the S07-04 chosen set.
Size gate evidence: leaves <=2 files, <=6 actions, <=200 lines, <=10 min;
one outcome each; S07-03/S07-04 are bounded either/or contracts (map-or-
verdict / import-or-reject). TRACKER Re-sharding rows 1-3 = this package;
TL fills "Children replacing remaining scope" = S07-01..S07-06.
