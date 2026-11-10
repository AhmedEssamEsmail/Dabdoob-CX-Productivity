# tl report - ux-ui-audit-v2 - round 5 (FIX: qa-1 round 1)

Input: `reports/qa-1.md` (FAIL, 0B/1H/0M/1L — both rows blocking per task).

## Findings routed
| Finding | Owner | Leaf | Status |
|---|---|---|---|
| qa-1 HIGH — `npx eslint .` red, no-explicit-any in tph-grid files | dev | qa1-01 (`spec/fix-qa-1.md#qa1-01`) | done |
| qa-2 LOW — `.delta` verdict swap lacks rendered-assertion coverage | test-engineer | none | deferred (LOW per FIX rules) |

## Attribution (per PM instruction)
`tph-grid-views.tsx`, `tph-grid-matrix.tsx`, `tph-grid-shared.ts` are **untracked** — S13-04's
split product with checkpointed S13-07 `memo()` edits on top (mtimes 21:10/21:15, concurrent
with the qa-1 audit; no writer since). No HEAD version exists, so nothing could be reverted —
and nothing was. tl-5 re-check found **14** errors, not qa-1's 5: the checkpointed memo pass
had added more `any` props during/after the audit. The errors are foreign-work leftovers, NOT
attributable to the tl-4 batch. qa1-01 typed the `any` sites **in place** on the current
working tree; `memo()` wrappers and all other uncommitted edits verified intact
(9 wrappers in views, 1 in matrix; zero `eslint-disable`/`ts-ignore` added).

## Changed files (qa1-01, scoped)
- `src/features/cx-productivity/components/tph-grid-views.tsx` — 12 `any` → `TphTask`,
  `TphChannel[]`, `TphData['cases'][number]`, `TphAgentRow` (×3), `TphTableRow` (×3),
  `TphDayTotal`, `TphData['eligible'][number]` + agent element
- `src/features/cx-productivity/components/tph-grid-matrix.tsx` — local `HgRow`/`HgCell`
  types + `useMemo<HgRow[]>` annotation; `row`/`cell` props typed

## Integration gates (tl-5)
- `npx eslint .` -> **PASS 0 errors / 957 warnings** (log `logs/tl5-eslint.log`) — the red
  PLAN gate is restored; warnings = expected loser-classnames backlog
- `npx tsc --noEmit` -> **PASS exit 0** (log `logs/tl5-tsc.log`)
- vitest not re-run: type-only change, zero runtime diff; last full run 1196/1196 (qa-1/tl4)

## Reviewer DELTA scope
Fix diff = the two files above only; evidence `results/qa1-01.md`, TRACKER rows qa1-01 +
gate log tl5. Note for re-shard planning: if S13-07's memo leaf is re-cut, it should rebase
onto these prop types (they cover the components it wrapped).
