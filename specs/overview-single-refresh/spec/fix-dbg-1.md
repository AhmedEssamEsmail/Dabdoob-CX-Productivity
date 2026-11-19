# FIX spec: overview-single-refresh (source report: reports/debug-1.md)

## dbg1-01: Let `Eo` pass refresh deps through to `usePageData`
Kind: mini
ID: dbg1-01
Parent: fix-dbg-1
Owner: dev
Depends: none
Criteria: PLAN #3 (top refresh must reload queue health — prerequisite)
Skills: none
Budget: files=1; actions=2; changed_lines=10; minutes=5

### Goal
Extend `Eo` in hub-shared.tsx so callers may pass an optional `deps` array that
`usePageData` uses to re-fire its loader (dbg-2).

### Files
- Edit: `src/features/cx-hub/components/hub-shared.tsx` | `Eo` signature only (lines 146-148)

### Context
- `src/features/shared/lib/use-page-data.ts:26-27,59,79` | `opts.deps` already re-fires the loader
- `src/features/cx-hub/components/hub-shared.tsx:145-148` | current `Eo`

### Contract
New signature: `export function Eo<T>(fn: () => Promise<T>, deps?: unknown[])`
returning `usePageData<T>(null, fn, { cacheKey: fn.name ? fn : null, deps })`.
Omitting `deps` keeps identical behaviour for all existing callers.
Out of scope: `usePageData` internals; any call site other than `Eo`.

### Actions
1. Change the `Eo` signature and its `usePageData` call per Contract.
2. Typecheck the touched file (`npx tsc --noEmit`).

### Done when
- `Eo` accepts an optional second `deps` argument and forwards it as `opts.deps`.
- No existing `Eo(<fn>)` call site needs changes; `npx tsc --noEmit` passes.

### Verify
- Run: `npx tsc --noEmit > specs\overview-single-refresh\logs\dbg1-01-tsc.log 2>&1; type specs\overview-single-refresh\logs\dbg1-01-tsc.log` -> exit 0, no errors.

### Handoff
`Eo(fn, deps)` becomes available for leaf dbg1-02 (`Mu`).
Write results/dbg1-01.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-02: Remove the duplicate `Queues now` refresh button; wire header refresh to `Mu`
Kind: mini
ID: dbg1-02
Parent: fix-dbg-1
Owner: dev
Depends: dbg1-01
Criteria: PLAN #1, #2, #3
Skills: none
Budget: files=1; actions=5; changed_lines=30; minutes=10

### Goal
`/overview` renders exactly one `<Hf` (page header). Deleting `Mu`'s button must
not leave queue health stale: the header button's successful refresh re-fires
`Mu`'s queue-health loader (dbg-1).

### Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | `Mu` + `OverviewPage` only (lines ~245-281, ~399-455, ~615-644)

### Context
- `overview-page.tsx:280` | duplicate `<Hf onDone={t} />` inside `.cx-section__hint`
- `overview-page.tsx:246` | `const { data: n, error: e, reload: t } = Eo(Of.queueHealth)`
- `overview-page.tsx:451` | header `Hf` whose `onDone` calls only `i` (home reload)
- `overview-page.tsx:616,643` | `<Mu />` mounts for admin and tl layouts
- `src/features/shared/components/ui/RefreshButton.tsx:35-59` | `onDone` fires only on success

### Contract
`Mu` becomes `function Mu({ tick }: { tick: number })` and calls
`Eo(Of.queueHealth, [tick])`. `OverviewPage` holds `const [qTick, setQTick] = useState(0)`;
header `Hf` `onDone` becomes `() => { i(); setQTick(v => v + 1) }`; both mounts render
`<Mu tick={qTick} />`. The `Queues now` hint keeps `{xg({ iso: n.dataAsOf })}` with no `Hf`.
Out of scope: `/queue`, `/aging`, `Hf`/`RefreshButton`, CSS, any other section of the file.

### Actions
1. Change `Mu` signature and `Eo` call per Contract (keep `reload: t` for the error retry at :251).
2. Delete `<Hf onDone={t} />` at :280, keeping the `xg` freshness hint.
3. Add `qTick` state in `OverviewPage`; update header `onDone` at :451 per Contract.
4. Pass `tick={qTick}` at both `<Mu />` mounts (:616, :643).
5. Run `npx vitest run tests/overview-single-refresh.test.ts` -> both tests pass.

### Done when
- `grep '<Hf' src/features/cx-hub/components/overview-page.tsx` returns exactly one match (header).
- `tests/overview-single-refresh.test.ts` passes (2/2).
- `npx tsc --noEmit` shows no errors in this file.

### Verify
- Run: `npx vitest run tests/overview-single-refresh.test.ts` -> 2 passed, 0 failed.

### Handoff
Fix complete pending TL integration gates (typecheck/lint/unit).
Write results/dbg1-02.md (<=10 lines); TL alone updates TRACKER.md.
