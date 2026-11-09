# qa report - ctl-strip-overflow - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/0L

## Checks run
- `git diff -- src/app/styles/quality.css` -> 2 hunks only: `.qa-list` keeps
  round-1 `minmax(0,1fr)`; `.qa-name` gains `min-width:0;overflow:hidden;
  text-overflow:ellipsis;flex:0 1 auto` and is removed from the `flex:none`
  group (:227 keeps `.pill`/`.cx-chip`/`.qa-acts` `flex:none`). Exactly the
  ux-1 prescribed fix; `nowrap` kept.
- `npx tsc --noEmit` -> exit 0, empty log (PASS).
- `npx eslint tests/ui/qa-strip-overflow.pw.ts` -> exit 0, empty log (PASS;
  scoped to the only changed code file per PLAN).
- `cd tests/ui && npx playwright test --config playwright.config.ts
  qa-strip-overflow.pw.ts --project=chromium` -> exit 0, **2/2 passed**:
  1400px case still green; new 320px case green (name ellipsis +
  no document h-scroll).

## Findings verification (since qa-1 / ux-1)
| Finding | Status | Evidence |
|---------|--------|----------|
| ux-1 MED (.qa-name can't shrink -> residual h-scroll <=~360px) | FIXED | quality.css:226 exact prescribed fix; rendered proof: new 320px test asserts `scrollWidth<=clientWidth`, strip rights <= `.qa-list` right, `.qa-name` `overflow:hidden` + `scrollWidth>clientWidth` on >=1 row |
| qa-1 findings | none open | — |
| ux-2/ux-3/ux-4 LOW | deferred, unchanged | pre-existing in e41f9f1/adjacent code per ux-1; tracked in TRACKER; LOW = logged only |

## Changed-file regression check
- `.qa-name` selector is `.qa-card--strip`-scoped; all 3 usages are `<strong>`
  inside strip cards (ctls-page.tsx:384, disputes-page.tsx:168,
  my-audits-page.tsx:57) — covers article + details>summary variants, no
  focusable children so `overflow:hidden` can't clip a ring.
- Shrink ordering intact: `.qa-meta` (`flex:1;min-width:0`) absorbs first;
  `.qa-name` (`flex:0 1 auto`) truncates only as last resort; pills/actions
  stay `flex:none` — buttons never clipped.
- Test quality: new case is behavioral (not snapshot), loads real `src/app`
  CSS cascade, would fail without the fix (pre-fix name was `flex:none`, no
  overflow — strip right would exceed list right at 320px).
- Scope: only quality.css + test file in shard; worker's stray repo-root
  `results/` confirmed moved to `specs/ctl-strip-overflow/results/FIX-02.md`.
  Other working-tree edits (google-signin, auth, perf-remediation) belong to
  parallel specs — not this shard. No deps/TODO/debug leftovers.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| —  | —   | —         | none             | —         | —     |

## Not verified / assumptions
- Live `/quality` render not re-run; evidence is fixture-rendered Chromium
  (real CSS cascade incl. theme/cx-kit). Firefox/WebKit not run — flex/grid
  shrink behavior is engine-consistent.
- ux-2/3/4 LOWs remain open items for PM triage but are pre-existing, not
  introduced by this shard.
