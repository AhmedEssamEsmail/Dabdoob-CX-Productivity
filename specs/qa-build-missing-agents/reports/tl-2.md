# tl-2 — qa-build-missing-agents (FIX, reports/data-1.md)

## Outcome
The one blocking finding (data-1, MED) is fixed; the LOW row is deferred by
documented judgement call. Single leaf, no reviewer shards requested/spawned.

## Leaves
| Leaf | Finding | Owner | Status | Evidence |
|---|---|---|---|---|
| data1-01 | data-1: extraTaken keyed by `qeCanonAgent_` (first+last) vs weekTaken/pool full-name keys — requests landed on a phantom key, never consumed the 30-offer/week cap | dev | done | results/data1-01.md; both `qaRequestedTaken_` (server.ts:2210) and `qaRequestedTakenFor_` (pure.ts:328 + doc) now key by `String(q.agent_name \|\| '').trim()`; diff 2 key lines + 1 comment + new test |

## Deferred (judgement call, needs PM/user decision to act)
- data-2 (LOW): log rows re-marked `state='expired'` still count into
  weekTaken (`st !== 'passed'`, engine-live.ts:720). Deferred: parity is
  presumed and zero expired rows exist to verify legacy intent against;
  excluding them is a quota-policy change, not an evident fix. If the
  reviewer/user wants the change, it is a one-line filter + test.

## Changed files (FIX scope)
- `src/features/cx-quality/lib/server.ts` (1 line, `qaRequestedTaken_` key)
- `src/features/cx-quality/lib/pure.ts` (1 line + doc comment, `qaRequestedTakenFor_`)
- `tests/quality/qa-requested-taken-key.test.ts` (new, 3 tests)
Untracked baseline from r1 kept: `tests/quality/qe-touch-scan-cap.test.ts`,
`specs/qa-build-missing-agents/*`. Other dirty-tree files (nav-scroll-top,
table-center-align, e2e/nav-scroll-top.spec.ts) belong to other work — untouched.

## Integration gates (logs in specs/qa-build-missing-agents/logs/)
- `npx tsc --noEmit` — PASS (tl2-tsc.log empty)
- `npx vitest run` — 1501/1502. Sole failure `tests/freeze/sheets-freeze-scan.test.ts`:
  identical pre-existing scripts/ops/qa-*.ts allowlist flags as r1, unrelated to diff.
- `npx eslint .` — 1 error + 7 warnings, identical pre-existing set as r1;
  all three touched files scoped-clean.

## Notes for reviewer (DELTA scope)
- Diff = server.ts:2210, pure.ts:321-328 (key expression + doc), new test file.
- Latent bug: verified 0 request/non-ticket qa_queue rows this week, so no
  visible symptom today; fix prevents over-offering once requests exist.
- Blocked: none. needs-split: none.
