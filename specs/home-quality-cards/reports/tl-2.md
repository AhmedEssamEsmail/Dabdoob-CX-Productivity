# TL report 2: home-quality-cards (FIX qa-1)

## Leaves
| Leaf | Owner | Status | Files changed | Evidence |
|---|---|---|---|---|
| qa1-01 | dev | verified | `src/features/cx-hub/lib/aggregates.ts` | `results/qa1-01.md`; `weekStartsOn`/`weekStart` moved inside the existing quality `try`, preserving the formula |

`spec/fix-qa-1.md#qa1-01` preflight: structural PASS; semantic review PASS
(1 file, 2 actions, ~15 lines, 5 min). No re-sharding, blockers, or user needs.

## Findings routed
- qa-1 (MED): fixed and verified. Malformed `qa_engine_settings` now enters the
  existing catch path, leaving `out.quality = null` instead of rejecting
  `getHomePage`.
- qa-2 (LOW): deferred per FIX policy; no test-coverage worker dispatched.

## Integration gates
- `npx tsc --noEmit` — PASS, exit 0.
- `npx eslint src/features/cx-hub/lib/aggregates.ts` — PASS, exit 0.
- `npx eslint .` — FAIL, same pre-existing committed error:
  `tests/golden/queue-aggregates.test.ts:123` `@typescript-eslint/no-explicit-any`;
  6 unrelated warnings remain.
- `npx vitest run` — 1536/1538 pass. Same two foreign failures:
  `tests/freeze/sheets-freeze-scan.test.ts` (committed `scripts/ops/qa-*.ts`
  readers) and `tests/css/table-center-align.test.ts` (dirty
  `src/app/styles/quality.css` from the in-flight qa-audit-footer-compact work).
- `npx vitest run tests/hub-home-quality.test.ts` — PASS, 5/5.

## Notes for PM
- Delta review scope: only the moved settings/week-start computation in
  `src/features/cx-hub/lib/aggregates.ts` plus this spec's coordination files.
- Worker initially overwrote tracked repo-root `results/qa1-01.md`; TL restored
  that baseline file from HEAD and copied the worker evidence to
  `specs/home-quality-cards/results/qa1-01.md`.
- No reviewer/debugger/devops agents were spawned; PM owns the next QA delta.
- Baseline dirty files from qa-audit-footer-compact remain untouched.
