# tl-3 — qa-active-toggle FIX round (reports/ux-2.md)

## Scope
Source report: `reports/ux-2.md` (FAIL; 0B/0H/1M/2L). Routed per Owner(dev):

- **ux-6 (MED, blocking)** -> `ux2-01` (spec/fix-ux-2.md#ux2-01) — DONE.
  `qa-queue-active` Seg `onChange` no longer calls `p(null)`; a dirty open
  audit gates the toggle behind `ConfirmInline` (qa-shared copy); clean/absent
  path stays `setActMode` + `c()` so the `_`-lookup collapses only rows that
  actually left the filtered set.
- **ux-7 (LOW)** — deferred per FIX rules (aria-label rename across 3 Segs).
- **ux-8 (LOW)** — deferred per FIX rules (optional `actMode` lift; log-only).

## Changed files (assignment-local)
- `src/features/cx-quality/components/audit-queue-page.tsx` (+48/-~10): `formDirty`/`pendingAct` state, gated `onChange` (no `p(null)`), `ConfirmInline` in aside, `onDirtyChange` -> `AuditEntry`, reset on `y()` re-open, dead `getBoot` import removed.
- `src/features/cx-quality/components/qa-shared.tsx` (+~25): `AuditForm` optional `onDirtyChange`; dirty predicate hoisted to `useMemo` reused by `I()`; effect fires on transitions + `false` on unmount (covers all `p(null)`/collapse paths — a page `useEffect` reset was blocked by `react-hooks/set-state-in-effect`).
- `src/features/cx-quality/components/audit-queue-coverage.tsx` (+3): `AuditEntry` forwards `onDirtyChange`.
- `tests/perf/audit-queue-memo.test.tsx` (+186): `ConfirmInline` mock, `findType` helper, stub globals, 3 regression tests (clean-survives, dirty-confirm, dirty-cancel).

Total +255/-20, all inside the 4 named leaf files.

## Integration gates (round 4)
- `npx tsc --noEmit` — PASS (logs/gate-tsc-r3.log).
- `npx vitest run tests/perf/audit-queue-memo.test.tsx tests/perf/qa-queue-active.test.ts` — 14/14 PASS (logs/gate-vitest-r3.log).
- `npx eslint` on leaf files — PASS (worker-run, results/ux2-01.md).
- Full unit/build/e2e/security — DEFERRED to PM gate (foreign in-flight streams still dirty the tree).

## Blocked / needs user
None. No reviewer/shard violations; report asks for none.
