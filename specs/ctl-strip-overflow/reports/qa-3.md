# qa report - ctl-strip-overflow - round 3 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/1L

## Checks run
- `git diff -- src/app/styles/quality.css` -> 3 hunks total vs e41f9f1:
  round-1 `.qa-list minmax(0,1fr)`, round-2 `.qa-name` ellipsis/`flex:0 1 auto`
  (both previously verified), and round-3 `:49`
  `[data-app="quality"] .card:has(.qa-ctl) { max-inline-size:72rem }` —
  exactly the PLAN-prescribed selector/value, placed after the `.qa-ctl`
  media-query block.
- `npx tsc --noEmit` -> exit 0, empty log (PASS).
- `npx eslint tests/ui/qa-strip-overflow.pw.ts` -> exit 0, empty log (PASS;
  scoped to the only changed code file per PLAN).
- `cd tests/ui && npx playwright test --config playwright.config.ts
  qa-strip-overflow.pw.ts --project=chromium` -> exit 0, **3/3 passed**
  (1400px + 320px still green; new 1600px case green).

## Findings verification (round-3 scope = PLAN "Round 2")
| Finding | Status | Evidence |
|---------|--------|----------|
| plan-round-2 (Submit-a-CTL card spans full page on wide monitors) | FIXED | quality.css:49 cap rule; rendered proof in new test: `submitW`≈1152px (72rem), `asideL>formL` (side-by-side), `scrollWidth<=clientWidth`, `listW>submitW` (list/SLA cards stay full width) |
| qa-2 findings | none open | — |
| ux-2/ux-3/ux-4 LOW | deferred, unchanged | pre-existing per ux-1; TRACKER |

## Changed-file regression check
- `.qa-ctl` exists in exactly one place: `ctls-page.tsx:142`, rendered inside
  the `section.card` "Submit a CTL" (`ctls-page.tsx:346`); list card (:365)
  and SLA card (:449) contain no `.qa-ctl` -> `:has()` caps only the submit
  card, as intended.
- `<64rem` unaffected: `max-inline-size` is a cap only; the single-column
  `.qa-ctl` rule and media query untouched.
- `:has()` precedent confirmed in production CSS (cx-kit.css :352, :420,
  :1448, :1452). `72rem` literal is the PLAN-prescribed value (line 39).
- Test quality: new case is behavioral, loads the real `src/app` CSS cascade,
  asserts rendered geometry; without the rule the card would be ~viewport
  width and both `submitW`≈1152 and `listW>submitW` assertions fail.
- Scope: only quality.css (+1 rule) and the spec's test file in shard.
  No deps/TODO/debug leftovers; no forbidden files touched.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| qa-1 | LOW | src/app/legacy-apps.css:264-269 | Stale dead-code duplicate of the pre-fix `.qa-ctl` block (no `72rem` cap). Zero imports across `src/` — cosmetic drift only. | Delete `legacy-apps.css` or sync the cap rule (out of shard scope). | dev |

## Not verified / assumptions
- Live `/quality` render not re-run; evidence is fixture-rendered Chromium
  with the real CSS cascade (theme.css + cx-kit.css + refresh.css +
  styles/*), same basis as qa-1/qa-2. Firefox/WebKit not run.
- 1152px assertion assumes 16px root font-size; passed in rendered test.
