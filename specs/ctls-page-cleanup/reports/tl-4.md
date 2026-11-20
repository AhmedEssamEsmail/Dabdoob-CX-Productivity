# TL report 4 — FIX round: reports/fix-admin-scope.md (F1-F3 blocking)

All 3 blocking findings fixed via `spec/fix-adm-1.md` (preflight PASS both leaves).

## Leaves
- adm1-01 (dev, verified): `src/features/cx-quality/lib/core.ts` — dropped
  `user.role==='admin'` from `qaCtlScopeVisible_` ('mine' = own tl_email for
  all roles; 'all' still returns everything) + doc comment. Updated admin case
  in `tests/quality/qa-ctl-scope.test.ts` (new `adminRow`; mine=own only).
- adm1-02 (dev, verified): `src/features/cx-quality/components/ctls-page.tsx` —
  toolbar guard `n && !n.isAdmin` -> `n` (Seg renders for admins; default
  scope stays 'mine').

## Changed files (reviewer DELTA scope)
- src/features/cx-quality/lib/core.ts (~3 lines in qaCtlScopeVisible_)
- src/features/cx-quality/components/ctls-page.tsx (1 line, toolbar guard)
- tests/quality/qa-ctl-scope.test.ts (admin it-block + adminRow)
- spec/fix-adm-1.md, results/adm1-01.md, results/adm1-02.md, TRACKER.md, this report

## Round-3 gates (logs/*-r3.log)
- `npx tsc --noEmit`: PASS
- `npx vitest run tests/quality/qa-ctl-scope.test.ts`: PASS 4/4
- `npm run lint`: same baseline — 1 pre-existing error
  `tests/golden/queue-aggregates.test.ts:123` + 7 warnings; changed files clean
- `npm run test:security`: PASS 4/4

No shards requested forbidden reviewers. No blocked/needs-split items.
