# TL report 5 — FIX mode: reports/change-delta-card.md (user-directed delta card change)

All 3 REQ rows routed to `spec/fix-chg-1.md` leaves; preflight PASS (structural + semantic).

| Leaf | Owner | Status | Changed files / evidence |
|---|---|---|---|
| chg1-01 | dev | verified | `src/features/cx-hub/lib/aggregates.ts` +1 line (`prevMonth: prev`); tsc 0; results/chg1-01.md |
| chg1-02 | dev | verified | `src/features/cx-hub/components/overview-page.tsx` +9/-3 — card now "Last month" big value + `.delta.up/.down/.flat` pill, `–` when null; results/chg1-02.md |
| chg1-03 | test-engineer | verified | `tests/hub-home-quality.test.ts` — `Quality` type + `prevMonth` asserts (admin 60, tl 70); results/chg1-03.md |

## Integration gates (round 5, log: logs/gates-chg1.log)
- `npx vitest run tests/hub-home-quality.test.ts` → 7/7 PASS (exit 0)
- `npx tsc --noEmit` → exit 0
- `npx eslint` on the 3 touched files → exit 0

## Reviewer DELTA scope
`aggregates.ts` (prevMonth), `overview-page.tsx` (2nd stat card + inline type), `tests/hub-home-quality.test.ts` (assertions). No CSS changes — reused existing `.delta` classes in refresh.css.

No reviewer-role requests in findings; none spawned. No blockers; no NEEDS_USER items.
