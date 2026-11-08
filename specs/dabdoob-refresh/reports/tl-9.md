# tl-9 — FIX round 6 (ux-parity-2 re-gate findings)

Source: `reports/ux-parity-2.md` — verdict FAIL; open findings ux-p2-1 (MED)
+ ux-p2-2 (LOW, both blocking per task). Both on `/tph`, both in
`src/features/cx-productivity/components/tph-grid-page.tsx` → leaves
dispatched **serially** (same-file rule), one root cause per leaf.

## Leaves

| Leaf | Finding | Owner | Status | Change |
|---|---|---|---|---|
| P2-01 (`spec/FIX/parity2-01-tph-qs-order.md`) | ux-p2-1 | dev | done | `<Qs>` cap-chart + needs-attention pair moved into `summary` fragment after `.grid grid-5` stats (now tph-grid-page.tsx:2215); standalone pre-`Ga` mount removed — DOM = head → tabs → note → stats → cards → panels |
| P2-02 (`spec/FIX/parity2-02-tph-date-width.md`) | ux-p2-2 | dev | done | `style={{ width: '9.5rem' }}` on `id="tph-date"` `Input` in `Ja` (L395), mirroring agents-page.tsx:598 — `.tph-day` row no longer stacks 3 rows |

## Changed files (reviewer DELTA scope)
- `src/features/cx-productivity/components/tph-grid-page.tsx` only (+3/-2 lines net).

## Preflight
`check_shards.py` 2/2 PASS (structural) + semantic vs LIMITS.

## Integration gates (checkpoint-fix6)
- `npx tsc --noEmit` — clean
- `npx eslint . --quiet` — 0 errors
- `npx vitest run` — 1124/1124 pass (54 files)

## Notes / incidents
- P2-01 worker wrote `results/P2-01.md` at project root instead of
  `specs/dabdoob-refresh/results/`; TL relocated it. P2-02 prompt pinned
  the absolute results path — landed correctly.
- Visual /tph DOM-order re-verification needs the next ux-parity gate
  (PM runs it; TL does not run review gates).

Blocked / needs-split / deferred: none. All report findings routed to done.
