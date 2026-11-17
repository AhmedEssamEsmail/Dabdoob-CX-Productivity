# tl report - e2e-contract-green - round 3 (FIX: ux-1)

Source: `reports/ux-1.md` (FAIL, 1 MED + 2 LOW on S03/S04 toolbar work).

## Routed
- ux-1 MED -> leaf `spec/fix-ux-1.md#ux1-01` (dev, preflight PASS).
- ux-2 LOW (locale-sized min-inline-size), ux-3 LOW (roster-add-btn scoping
  convention) -> DEFERRED per FIX rules; recorded in TRACKER.

## Changed files (DELTA scope for re-review)
- `src/features/cx-people/components/agents-page.tsx` — pin `useEffect` only:
  one-time `wheel`/`touchmove`/`keydown`/`pointerdown` window listeners
  (`{once:true}`, passive where applicable) cancel the rAF loop; cleanup
  removes all four + cancels rAF. `didPinTop`/800ms/`scrollTo(0,0)` unchanged.
  New diff lines vs prior state: ~10 (rest of the pin block was S04's prior
  uncommitted baseline).
- `specs/e2e-contract-green/spec/fix-ux-1.md` (new leaf), TRACKER.md, results/ux1-01.md.

## Gates
- `npx tsc --noEmit` clean (logs/ux1-tsc.log).
- `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "agents contract"`
  -> 2 passed @375px + @1024px (logs/ux1-pw.log). Toolbar pin still effective.

## Notes for PM
- ux-1 reviewer's side-note: cleaner shared root fix = `Tabs.tsx:58`
  scrollIntoView skipping window scroll on mount — deliberately out of this
  leaf's scope (shared code). Candidate future shard; PM's call.
- Prior NEEDS_USER items unchanged (calendar event deletion; dev-server note).
- No reviewer shards requested/spawned; re-review of DELTA belongs to PM gates.
