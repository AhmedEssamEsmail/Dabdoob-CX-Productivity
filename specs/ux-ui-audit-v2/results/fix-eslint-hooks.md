# fix-eslint-hooks — react-hooks lint errors in canonical hooks
Status: done (shard's 2 target errors fixed; 2 unrelated pre-existing errors remain elsewhere — see blocker)
Files: edited src/features/shared/lib/use-options.ts, src/features/shared/lib/use-poll.ts
Checks: `npx eslint` on both files -> clean; `npx vitest run` -> 67 files / 1194 tests green; `npx tsc --noEmit` -> clean (exit 0).
Design: use-poll moves `fnRef.current = fn` into a leading useEffect. use-options drops nonce+sync setState-in-effect: state is keyed by listKey, render derives fresh state on key change (cache hit instant, miss keeps prior options while loading), effect/reload only fetch async; stale-cache + inflight dedupe preserved via loadOptions.
Blocker/handoff: `npx eslint .` still reports 2 errors OUTSIDE shard scope — src/features/cx-hub/components/ecosystem-scene.tsx:2469 and src/features/cx-quality/components/audit-queue-page.tsx:308 ("Cannot access refs during render"). Needs a new leaf.
