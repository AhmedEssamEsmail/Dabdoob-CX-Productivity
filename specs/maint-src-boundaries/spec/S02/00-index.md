# Spec index: S02 — grid-slots relocation
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S02-01 | mini | S02/01-move-grid-slots.md | dev | none | #2 copy + repoint consumers | 3/2/125/10 |
| S02-02 | mini | S02/02-delete-old.md | dev | S02-01 | #2 delete shared copy | 1/1/112/5 |

Ready work: S02-01, then S02-02. S03-30 marks the new file (depends on S02-01);
S07-01 needs the old file gone (depends on S02-02).
Size gate evidence: the copy is a verbatim relocation; ≤3 files per leaf.
