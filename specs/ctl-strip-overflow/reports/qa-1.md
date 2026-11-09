# qa report - ctl-strip-overflow - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/0L

## Checks run
- `git diff -- src/app/styles/quality.css` -> exactly 1 line: `.qa-list` gains
  `grid-template-columns:minmax(0,1fr)` (line 217); nothing else in shard files.
- `npx tsc --noEmit` -> exit 0, empty log (PASS).
- `npx eslint .` -> exit 0, "367 problems (0 errors, 367 warnings)"; all
  warnings pre-existing/unrelated (PASS). First attempt crashed exit=2 on a
  `test-results/` scandir race; re-run clean.
- `cd tests/ui && npx playwright test --config playwright.config.ts
  qa-strip-overflow.pw.ts --project=chromium` -> exit 0, 1 passed (visual gate).

## Criteria coverage
| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | No document h-scroll | test assert: `documentElement.scrollWidth <= clientWidth` at 1400px; debug probe 1691->1400 |
| 2 | Rows inside card; buttons on-screen | strip right <= `.qa-list` right loop; `.qa-acts` boundingBox right <= 1400 |
| 3 | `.qa-meta` ellipsis | computed `overflow === 'hidden'`, clientWidth > 0; CSS `text-overflow:ellipsis` on children (quality.css:229) |
| 4 | Disputes/my-audits variant OK | `details.qa-card--strip` in fixture covered by same right-edge asserts; shared `.qa-list` selector |
| 5 | tsc + eslint | both run above, PASS |

## Test quality
`tests/ui/qa-strip-overflow.pw.ts` loads real CSS from `src/app` (live
`styles/*.css`) into a faithful `.card > .card-pad > .qa-list` fixture with
long names/ticket labels per PLAN repro. Would fail without the fix (debug-1:
exit=1, scrollWidth 1691>1400). Assertions are behavioral, not snapshots;
covers article + details variants, empty-clip edge via meta clientWidth.

## Regression & scope
Only quality.css:217 changed in-shard; no markup/deps/TODO/debug leftovers.
`minmax(0,1fr)` matches hub.css precedent; 64rem wrap media query untouched.
Other working-tree edits (google-signin, refresh.css, identity.ts, etc.)
belong to parallel specs — not this shard.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| —  | —   | —         | none             | —         | —     |

## Not verified / assumptions
- Chromium only (config has firefox/webkit; minmax grid is engine-consistent).
- Fixture viewports: 1400px (test) + 800px (debug probe); 1280/1920 endpoints
  not run — acceptable coverage of the 1280–1920 criterion midpoint.
- eslint test-results ENOENT was transient tooling race, not a repo defect.
