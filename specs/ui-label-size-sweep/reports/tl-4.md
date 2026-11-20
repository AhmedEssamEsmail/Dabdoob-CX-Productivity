# tl-4 — FIX round for reports/qa-2.md (finding qa-2-1, MED)

## Finding routed
- qa-2-1 (MED): PLAN criterion 5 unmet — zero regression assertions for the
  24 S04–S06 fixes; pinned labels + `size="sm"` + `pw-textarea--short`
  unguarded. Fix spec `spec/fix-qa-2.md`, two mini leaves (preflight PASS).

## Leaves
| Leaf | Owner | Files | Status |
|---|---|---|---|
| qa2-01 | test-engineer | `tests/quality/ui-label-sweep.test.tsx` (389 ln) | verified — 6/6 tests |
| qa2-02 | test-engineer | `tests/quality/ui-label-sweep-myday-tasks.test.tsx` (342 ln) | verified — 2/2 tests |

Both run in parallel (disjoint new files); no src edits; harness mirrors
`tests/quality/qa-audit-footer-compact.test.tsx` (no-DOM stub + module
seams). qa2-02 actual churn 342 ln vs 300 estimate — inside limits.

## Coverage vs finding
5 pinned labels + aria-label all asserted: disputes Seg options (3 strings +
conditional escalate), `'Deny: it did not happen'`, `'Mark done'`,
mail-desk `Approve`/`Reject`/`Send reply only`, `If` aria-label template.
`size="sm"` reps: deny toggle, all 3 mail-desk actions (S05). S06 rep:
`pw-textarea--short` + `rows={2}` on tl-tasks note textarea.
Revert-safety: exact descriptor equality — flipping a pinned value fails.

## Integration gates (round 4)
- `npx tsc --noEmit` -> exit 0 (logs/tl4-tsc.log)
- `npx vitest run tests/quality/ui-label-sweep*.test.tsx` -> 8/8 pass
  (logs/tl4-vitest.log)
- `npx eslint` on both new files -> exit 0 (logs/tl4-eslint.log)

No blocked items, no reviewer shards requested. Ready for PM's qa-3 delta
re-review (scope: the two new test files).
