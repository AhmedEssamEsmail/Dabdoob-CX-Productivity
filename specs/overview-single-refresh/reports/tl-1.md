# tl-1 report — overview-single-refresh (FIX mode, source: reports/debug-1.md)

## Outcome: FIXED, gates green

Two blocking findings, two mini leaves (`spec/fix-dbg-1.md`), both owner `dev`, run serially (dbg1-02 depends on dbg1-01).

| Leaf | Finding | Status | Evidence |
|---|---|---|---|
| dbg1-01 | dbg-2: `Eo` lacked deps passthrough | done | results/dbg1-01.md; `Eo(fn, deps?)` → `usePageData(..., { deps })` |
| dbg1-02 | dbg-1: duplicate `Hf` in `Queues now` head | done | results/dbg1-02.md |

## Changed files (DELTA scope for reviewer)
- `src/features/cx-hub/components/hub-shared.tsx` — `Eo` signature only.
- `src/features/cx-hub/components/overview-page.tsx` — `Mu({ tick })` uses `Eo(Of.queueHealth, [tick])`; in-section `<Hf>` deleted; `qTick` state; header `onDone` bumps tick; both `<Mu tick={qTick} />` mounts.
- `tests/overview-single-refresh.test.ts` — regression test (pre-existing from debugger; now passing 2/2).

Not touched: `use-page-data.ts` (already supported `deps`), RefreshButton, CSS, `/queue`, `/aging`.

## Gates (round 1, all PASS — logs in `logs/`)
- `npx vitest run tests/overview-single-refresh.test.ts` → 2/2 (was 2 failing).
- `npx tsc --noEmit` → clean. `npx eslint` on touched files → clean.
- `npx vitest run` → 117 files / 1479 tests pass.

## Notes
- Not run: `npm run build`, e2e (`e2e/toolbar-stability.spec.ts`), `test:security` — runtime/e2e verification of criterion #3 (top button reloads queue health) left to QA/UX gates per PLAN.
- No re-sharding, no reviewers spawned, no blocked items. Baseline dirty files (ui-shell-polish PNGs, other spec dirs) untouched.
