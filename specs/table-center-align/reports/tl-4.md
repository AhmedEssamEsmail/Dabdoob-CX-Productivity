# tl-4 report — FIX round for reports/ux-1.md

All blocking findings fixed. ux-3 treated as actionable per PM intent call
(user wants ALL column headers centered).

## Leaves (spec/fix-ux-1.md)
| Leaf | Finding | Files changed | Result |
|---|---|---|---|
| ux1-01 | ux-1 MED: `.trk-num` missed by numeric centering | src/app/cx-kit.css, tests/css/table-center-align.test.ts | done — `.trk-num` added to `:is()` list; td/th element guard unchanged so `.input.trk-num` (operations.css:76) unaffected |
| ux1-02 | ux-2 MED: aging chip td start-aligned | src/features/cx-queue/components/aging-page.tsx | done — `cx-num` on the cx-chip td (:303) |
| ux1-03 | ux-3 LOW->fix: `.sch-sticky` corner header | src/app/styles/queue.css, tests/css/table-center-align.test.ts | done — `text-align: start !important` moved from base `.sch-sticky` to `tbody .sch-sticky`; thead corner now centers, tbody labels still forced start |

Note: ux1-03 deliberately did NOT merely delete `!important` — `.sch-grid-table
td` (0,2,1) would have outranked `.sch-sticky` (0,2,0) and wrongly centered
tbody row labels. Existing test asserting `!important` on the base rule was
updated to the tbody-scoped form.

## Deferred (LOW per FIX policy)
- ux-4: aging empty-state `colSpan={9}` vs 8 rendered headers (pre-existing).
- ux-5: three `thead th` missing `scope="col"` (carried from qa-1/qa-2).

## Gates (fix checkpoint, logs/)
- `npx tsc --noEmit` -> exit 0 (fix-ux1-tsc.log)
- `npx vitest run tests/css/table-center-align.test.ts` -> 14/14 (fix-ux1-vitest.log)
- `npx eslint aging-page.tsx table-center-align.test.ts` -> 0 errors (fix-ux1-eslint.log)
- Scoped diff verified: logs/fix-ux1-diff.log (assignment hunks only; rest is baseline build work)

Full gates (eslint ., full vitest, e2e, build) = PM-run. Ready for ux re-review.
