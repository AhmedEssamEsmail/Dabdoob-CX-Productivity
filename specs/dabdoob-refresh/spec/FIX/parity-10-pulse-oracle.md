# PX-10: golden oracle — allow additive `pulse` key on getHomePage (D-PULSE)
Kind: mini
ID: PX-10
Parent: FIX-PARITY
Owner: test-engineer
Depends: PX-06
Criteria: reports/ux-parity.md M2 follow-up — hub-overview golden test fails on the intentional new `pulse` payload key
Skills: none
Budget: files=1; actions=4; changed_lines=40; minutes=6

## Goal
`tests/golden/hub-overview.test.ts` fails 6 tests: the port's
`getHomePage` now returns an additive `pulse` key (PX-06 Team-pulse
payload) the frozen `_archive` `Aggregates.js` oracle can never emit.
Mirror the S01-05 D-BRAND seam: normalise the PORT result in the test
file only (strip `ok.pulse` before `expectSame`) with a `D-PULSE`
documented-divergence comment, and add a light shape check so the new
key stays covered.

## Files
- Edit: `tests/golden/hub-overview.test.ts` | the four `getHomePage` `expectSame` call sites (~L128, L150, L156, L162): strip `pulse` from the port envelope; add one pulse shape assertion

## Context
- `tests/golden/helpers-oracle.ts:107-110` | `expectSame(portRes, legacyRes, label)` diffs `legacyRes` vs `portRes` — first arg is the PORT result; `json()` (~L67) deep-clones
- `tests/golden/desk-fakes.ts:336` | `D-BRAND` precedent: documented-divergence comment naming the legacy line that cannot match
- `src/features/cx-hub/lib/aggregates.ts` `getHomePage` | `out.pulse = { quality, productivity, fcr, adherence }`, each `number|null` (adherence always `null` — no source)
- The 6 failures all read `oracle mismatch at $.ok: keys [...] != [...,pulse,...]` — key-list diff only, no value diffs observed

## Contract
- Divergence is handled ONLY in this test file — do not touch
  `helpers-oracle.ts`, `diffPath`, or other golden suites.
- Mechanism: a tiny local helper (e.g. `const dropPulse_ = (r) => { const c = json(r); if (c.ok) delete c.ok.pulse; return c }`) applied to the PORT argument of the four `getHomePage` `expectSame` calls.
- `// D-PULSE:` comment: additive key required by mock 02 Team-pulse (PX-06); `_archive` Aggregates.js has no pulse emitter — same seam as D-BRAND.
- Add ONE assertion (in the `it.each` user loop or a new `it`): port `ok.pulse` is an object whose `quality`/`productivity`/`fcr`/`adherence` are each `number|null` — keeps the new key covered without pinning values.
- No changes to fixtures, seeds, or production code.

## Actions
1. Add the `dropPulse_` helper + `D-PULSE` comment near the top of the getHomePage describe (imports of `json` already exist or add it).
2. Wrap the four `expectSame(await portCall(() => getHomePage()), …)` port args with `dropPulse_(…)`.
3. Add the `pulse` shape assertion.
4. `npx vitest run tests/golden/hub-overview.test.ts` -> all green; `npx eslint` the file clean.

## Done when
- `npx vitest run tests/golden/hub-overview.test.ts` passes (previously 6 failures on `pulse` key diff).
- `D-PULSE` comment present; `pulse` shape asserted (number|null ×4).

## Verify
- Run: `npx vitest run tests/golden/hub-overview.test.ts` -> pass
- Run: `grep -n "D-PULSE\|dropPulse_\|pulse" tests/golden/hub-overview.test.ts` -> comment + helper + assertion present

## Handoff
none.
Write results/PX-10.md under specs\dabdoob-refresh\results\ (NOT repo root); TL alone updates TRACKER.md.
