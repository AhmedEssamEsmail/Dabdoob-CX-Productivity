# tl report - table-center-align - FIX round 2 (qa-1.md)

## Verdict
Blocking finding qa-1 (HIGH) fixed. qa-2 (LOW) deferred per FIX policy.

## Leaves
| Leaf | Finding | Owner | Status | Evidence |
|---|---|---|---|---|
| qa1-01 | qa-1: .sch-table tbody row-label th lost start | dev | done | results/qa1-01.md |

## Changed files (reviewer DELTA scope)
- `src/app/styles/queue.css` — line 162: `.sch-table th, td` rule replaced by
  `[data-app="queue"] .sch-table tbody :is(th, td) { text-align: start; padding: ... }`;
  thead th remain centered via line 161; `.sch-grid-table` untouched.
- `tests/css/table-center-align.test.ts` — added regex guard asserting the
  `.sch-table tbody` start rule covers `th` (13 tests total).

## Gates (checkpoint)
- `npx tsc --noEmit` -> exit 0 (logs/fix-qa1-tsc.log)
- `npx vitest run tests/css/table-center-align.test.ts` -> 13/13 pass
- `npx eslint` on touched files -> 0 errors (css-ignored warning only)
- Full repo gates = PM-run at final review.

## Deferred
- qa-2 (LOW): add `scope="col"` to thead th in heatmap-page.tsx:802-807,
  aging-page.tsx:214, queue-page.tsx:294.

## Notes
- Worker wrote results file to repo-root `results/`; TL relocated it to
  `specs/table-center-align/results/qa1-01.md`.
- No reviewer/architect/debugger shards requested or spawned.
