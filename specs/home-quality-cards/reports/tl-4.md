# TL report 4 — FIX reports/low-findings.md (deferred LOWs, all blocking)

## Outcome
All 3 blocking findings fixed and verified. Leaves in `spec/fix-low-1.md`;
preflight `check_shards.py` PASS x3 (structure + semantic ok per LIMITS).

## Leaves
| Leaf | Owner | Finding | Status | Evidence |
|---|---|---|---|---|
| low1-01 | dev | low-1/ux-2: Open CTLs `0` when quality null | verified | results/low1-01.md; `q.openCtls == null ? '–' : Hi(...)` |
| low1-02 | dev | low-2/ux-3: `.stat-d` jargon copy | verified | results/low1-02.md; "score points vs last month", "current week" |
| low1-03 | test-engineer | low-3/qa-2: missing catch-path + weekStartsOn=1 tests | verified | results/low1-03.md; 2 new `it` cases |

low1-01 and low1-02 share overview-page.tsx -> dispatched serially; low1-03 ran
in parallel (disjoint file). No RESHARD_NEEDED, no blockers, no stale workers.

## Changed files (reviewer DELTA scope)
- `src/features/cx-hub/components/overview-page.tsx` (+8/-4, lines 499-512)
- `tests/hub-home-quality.test.ts` (+27, two `it` cases)
- `specs/home-quality-cards/spec/fix-low-1.md` (new fix-leaf spec)

## Integration gates (round 4, logs/gates-low1.log)
- `npx vitest run tests/hub-home-quality.test.ts` -> PASS 7/7
- `npx tsc --noEmit` -> PASS (exit 0)
- `npx eslint src/features/cx-hub/components/overview-page.tsx tests/hub-home-quality.test.ts` -> PASS (exit 0)

Note: baseline dirty tree (qa-audit-footer-compact agent, quality.css etc.)
untouched; not ours.
