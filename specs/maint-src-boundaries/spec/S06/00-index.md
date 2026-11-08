# Spec index: S06 — real tests replacing fixture-only suites
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S06-01 | mini | S06/01-auth-test.md | test-engineer | S03-01 | #6 auth helpers real test | 1/2/140/10 |
| S06-02 | mini | S06/02-qa-dispatcher-test.md | test-engineer | S03-01 | #6 dispatcher POST half | 1/2/110/10 |
| S06-04 | mini | S06/04-qa-dispatcher-get.md | test-engineer | S06-02 | #6 dispatcher GET + error map | 1/2/80/10 |
| S06-03 | mini | S06/03-security-spec.md | test-engineer | S03-01 | #6 authz 401/403 half | 1/2/100/10 |
| S06-05 | mini | S06/05-security-viewas.md | test-engineer | S06-03 | #6 view-as + happy path | 1/2/70/10 |

Ready work: S06-01..03 after S03-01 (vitest alias); same-file halves serial (S06-04 after S06-02, S06-05 after S06-03).
Size gate evidence: one rewritten suite per leaf, single file each.
