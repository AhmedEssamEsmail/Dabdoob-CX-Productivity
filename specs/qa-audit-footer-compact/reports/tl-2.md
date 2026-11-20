# tl-2: qa-audit-footer-compact FIX round 2 (reports/qa-1.md)

QA round-1 FAIL (3 findings). Routing: qa-1 HIGH -> leaf `qa1-01` (fix-qa-1.md, preflight PASS); qa-2 MED -> blocked/needs-user; qa-3 LOW -> deferred.

## Changed files (this round)
- `src/features/cx-quality/components/qa-shared.tsx` — `#qa-comment` `rows={3}` -> `rows={2}`
- `src/app/styles/quality.css` — new scoped rule `[data-app="quality"] .qa-form #qa-comment { max-inline-size:60ch }` (line 26); baseline `.qa-whylist li` edit untouched
- `tests/quality/qa-audit-footer-compact.test.tsx` — rows assertion tightened `toBeLessThanOrEqual(3)` -> `toBe(2)` (regression locked)

## Leaves
| Leaf | Status | Evidence |
|---|---|---|
| qa1-01 | done | results/qa1-01.md |

## Integration gates (this round)
- `npx vitest run tests/quality/qa-audit-footer-compact.test.tsx`: **6/6 PASS** (reports/vitest-fix2.log)
- `npx tsc --noEmit`: PASS clean (reports/tsc2.log)
- `npx eslint` on touched files: PASS exit 0 (reports/eslint2.log)
- Full `vitest`/`playwright` not re-run; known reds unchanged: `table-center-align` fails on the baseline `.qa-whylist li` dirty edit (qa-2), e2e env/login-infra fails per tl-1.

## Blocked / deferred
- **qa-2 (MED) — NEEDS_USER/PM**: `.qa-whylist li` dirty edit in `quality.css` predates this shard and belongs to a sibling spec's in-flight change. Reverting is forbidden; it must be reconciled in its owning spec (or its css test updated there). Flagging for PM routing.
- qa-3 (LOW): stray untracked logs — deferred.

## Reviewer DELTA scope (round 2)
The 3 files above only; net vs tl-1 = 3 ins / 1 del.
