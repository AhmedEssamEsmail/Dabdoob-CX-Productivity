# Spec index: qa-live-sheets-freeze (Wave 2 — Amendment 4)
Kind: index
Size gate: PASS

Wave-1 specs (S01/S02/S03/S07/S08/S09/S11, fix-*) are DONE and untouched. This
index is wave 2 only: finish the literal freeze — de-sheet every grandfathered
`deferred` reader, close the leftover LOWs, then flip the guard to strict.

| ID | Kind | Spec path | Owner | Depends | Criteria (Amend.4) | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| W2-SC | package | W2-SC.md | - | none | #1 scorecard de-sheet + #2 behaviour form | not dispatchable |
| W2-HM | package | W2-HM.md | - | none | #3 heatmap de-sheet | not dispatchable |
| W2-TLQ | package | W2-TLQ.md | - | none | #4 tlqueue cuts | not dispatchable |
| W2-ADM | package | W2-ADM.md | - | none | #5 admin readers + engine flags (sec-2/sec-3) | not dispatchable |
| W2-FIX | package | W2-FIX.md | - | none | #7 LOW batch (data-4 docstring, reconcile catch/chunk) | not dispatchable |
| W2-STRICT | package | W2-STRICT.md | - | all de-sheeting leaves | #6 strict flip | not dispatchable |

Dispatchable now (no deps): W2-SC-01, W2-HM-01, W2-TLQ-01, W2-ADM-01/02/03,
W2-FIX-01/02 — 8 leaves, max 4-5 workers (same-file writers already serialized
inside packages). Serial chains: W2-SC-01→02→03→04 (scorecard-server.ts +
agents-page.tsx), W2-HM-01→02 (route contract). W2-STRICT-01 goes LAST, after
W2-SC-02, W2-HM-01, W2-TLQ-01 and all W2-ADM leaves (every `deferred:` carrier
in src/ must be gone).

BLOCKED scope stays out (DECISION open questions): FCR live source (stored
verdicts preserved instead — W2-SC-02), FD_AUX upstream, freshchat message
pairs, cx-quality/** edits beyond the two approved reconcile fixes (W2-FIX-02).

NEEDS_USER: none — Amendment 4 resolved all wave-2 questions (FCR preserve,
WA/country `*` fallback, migrate.ts limited touch explicitly approved).

Size gate evidence: 13 `Kind: mini` leaves; largest = W2-SC-02 (3 files /
8 actions / ~320 lines / 10 min) and W2-HM-01 (3/8/~400/10); every leaf <=4
files, <=8 actions, <=420 est. lines, <=10 min, <=5 context pointers; manual
review vs LIMITS.md — PASS.
