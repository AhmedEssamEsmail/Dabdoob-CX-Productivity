# tl-1 — holform-overlap-sweep (FIX, input reports/debug-1.md)

Verdict: COMPLETE — all 13 blocking findings fixed and verified; regression test green.

## Sharding
`fix-debug-1.md` — 4 mini leaves, all Owner=dev, disjoint files, run in parallel
(structural preflight PASS + semantic review vs LIMITS.md):

| Leaf | Files | Sites (findings) | Status |
|---|---|---|---|
| dbg1-01 | src/app/refresh.css | .dq-holform (dbg-1), .dq-editor (dbg-2), .aging-page-head .page-actions (dbg-12) | verified — results/dbg1-01.md |
| dbg1-02 | src/app/styles/people.css | .pw-new-action (dbg-3), .pw-inline (dbg-7), .oo-proj-grid (dbg-8) | verified — results/dbg1-02.md |
| dbg1-03 | quality.css, queue.css, operations.css, productivity.css | .qa-bq (dbg-4), .sch-edit-row (dbg-5), .tph-taskform (dbg-6), .trk-dep-row (dbg-13) | verified — results/dbg1-03.md |
| dbg1-04 | src/app/cx-kit.css, src/app/styles/desk.css | .cx-queuerow (dbg-9), .cx-filters (dbg-11), .dk-otd__grid (dbg-10) | verified — results/dbg1-04.md |

## Changed files (scoped diff: 8 files, +13/−1 lines)
12 new guard rules `<scope> <row> :is(input:not([type=checkbox]):not([type=radio]),select,textarea){box-sizing:border-box;min-inline-size:0;max-inline-size:100%}`
matching each file's prefix convention (`:root` / `[data-app="…"]`), plus
desk.css:79 existing `.dk-otd__grid`/`.dk-kb-form` control rule extended with the
same declarations (dbg-10 exact fix; also hardens `.dk-kb-form`, flagged optional
in the report). No selectors, tracks, breakpoints or markup touched.

## Integration gates (from project root; logs in specs/holform-overlap-sweep/logs/)
- `npx vitest run tests/css-form-guards.test.ts` — PASS 22/22 (13 sites + 9 anchors)
- `npx tsc --noEmit` — PASS (exit 0, clean)
- `npx eslint .` — PASS (0 errors; 5 pre-existing warnings in admin-page.tsx, tests/perf — unrelated)
- `npx vitest run` — 1415/1416; **1 unrelated pre-existing failure**:
  `tests/quality/qe-fd-cache.test.ts > logs cache failures to refresh_log instead of throwing`
  (asserts a `refresh_log` mock entry; CSS-only diff cannot affect it — predates this
  fix, likely tied to the qe_fd_cache feature spec, flagged for the PM).
- e2e / build: not run (not required; CSS-only change, unit guard test proves the invariant).

## Notes for reviewer (DELTA scope)
DELTA = the 8 CSS files above (+13/−1). Test file `tests/css-form-guards.test.ts`
was pre-existing (written by debugger) and is unchanged. UX/UI gate still owned by PM.
No shard requested a forbidden owner/gate. Baseline dirty tree recorded in TRACKER.md.
