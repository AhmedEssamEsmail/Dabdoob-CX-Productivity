# tl-3 — ctl-strip-overflow (FIX round 3 / PLAN "Round 2" scope)

Input: PLAN.md "Round 2 (2026-11-09): Submit-a-CTL card too wide" — the only
in-scope work this round; FIX-01/FIX-02 findings already verified.

## Dispatched
| Leaf | Owner | Status | Changed files |
|---|---|---|---|
| FIX-03 (cap Submit-a-CTL card at 72rem) | dev | verified | src/app/styles/quality.css (:49); tests/ui/qa-strip-overflow.pw.ts (submitCard fixture + 1600px test) |

Scoped diff confirmed: one new rule
`[data-app="quality"] .card:has(.qa-ctl) { max-inline-size:72rem }` placed
after the `.qa-ctl` media-query block — exactly the PLAN-prescribed fix.
`.qa-ctl` exists only inside the Submit-a-CTL card (ctls-page.tsx:142,346),
so list/SLA cards stay full width. Test file: new `submitCard` fixture +
optional `fixture(withSubmit)` param (existing tests untouched) + one
1600px test asserting card ≈1152px, form+aside side-by-side, no document
h-scroll, list card wider than submit card. Actual churn ~46 lines vs 60.

## Integration gates (round 3)
- `npx tsc --noEmit` — PASS (exit 0, clean; gate-tsc3.log).
- `npx eslint tests/ui/qa-strip-overflow.pw.ts` — PASS (exit 0; scoped to
  the only changed code file per PLAN; gate-eslint3.log).
- `cd tests/ui && npx playwright test qa-strip-overflow.pw.ts
  --project=chromium` — PASS 3/3 (exit 0; gate-pw3.log): 1400px + 320px
  cases still green; new 1600px case proves the 72rem cap, side-by-side
  grid, no h-scroll, and unchanged full-width list card.

## Findings coverage
- plan-round-2 (Submit-a-CTL card too wide on wide monitors) -> FIXED +
  verified by rendered test.
- ux-2/ux-3/ux-4 LOW -> still deferred, unchanged (pre-existing; TRACKER).
- Round-2 success criteria met: ≈72rem at ≥1600px; <64rem unaffected
  (cap is a max, single-column rule untouched).

## DELTA for reviewer (since ux-2/qa-2)
Changed: `src/app/styles/quality.css` line 49 (one rule);
`tests/ui/qa-strip-overflow.pw.ts` `submitCard` fixture :49-58,
`fixture(withSubmit)` :60-71, new test :140-164.
Evidence: results/FIX-03.md, gate-tsc3.log, gate-eslint3.log, gate-pw3.log.

No blocked / needs-split items. No shards requested forbidden owners.
Live `/quality` render not re-verified (fixture-rendered Chromium with the
real CSS cascade, same as prior rounds) — flag for the UX/UI gate.
