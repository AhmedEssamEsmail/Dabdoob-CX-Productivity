# tl-2 — ctl-strip-overflow (FIX round 2)

Input: reports/ux-1.md (FAIL; 1 MED blocking + 3 LOW deferred per FIX rules).

## Dispatched
| Leaf | Owner | Status | Changed files |
|---|---|---|---|
| FIX-02 (.qa-name can shrink/ellipsis) | dev | verified | src/app/styles/quality.css (:226-227); tests/ui/qa-strip-overflow.pw.ts (+1 test) |

Scoped diff confirmed: `.qa-name` gained `min-width:0;overflow:hidden;
text-overflow:ellipsis;flex:0 1 auto` and was removed from the `flex:none`
group (`.pill`/`.cx-chip`/`.qa-acts` unchanged) — matches the reviewer's exact
fix. `nowrap` kept. Test file: one new 320x700 case reusing `fixture()`;
1400px test untouched. Actual churn ~32 lines vs 40 budget.
Note: worker wrote results file to repo-root `results/`; TL moved it to
`specs/ctl-strip-overflow/results/FIX-02.md`.

## Integration gates (round 2)
- `npx tsc --noEmit` — PASS (exit 0, clean).
- `npx eslint tests/ui/qa-strip-overflow.pw.ts` — PASS (exit 0; scoped to
  changed code file per PLAN).
- `cd tests/ui && npx playwright test qa-strip-overflow.pw.ts --project=chromium`
  — PASS 2/2 (exit 0): 1400px case still green; new 320px case proves no
  document h-scroll, strip edges inside `.qa-list`, `.qa-name` ellipsis
  engaged (`scrollWidth > clientWidth`).

## Findings coverage
- ux-1 MED -> FIXED + verified (residual overflow at <=~360px closed; the
  reviewer's font-metric estimate is now covered by a rendered 320px test).
- ux-2, ux-3, ux-4 LOW -> deferred (pre-existing in e41f9f1, not introduced
  by this fix; tracked in TRACKER for PM).

## DELTA for reviewer (since ux-1)
Changed: `src/app/styles/quality.css` lines 226-227;
`tests/ui/qa-strip-overflow.pw.ts` new test at :97-126.
Evidence: results/FIX-02.md, gate-tsc2.log, gate-eslint2.log, gate-pw2.log.

No blocked / needs-split items. No shards requested forbidden owners.
