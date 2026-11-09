# FIX-02: Let .qa-name shrink/ellipsis inside strip rows (residual overflow)
Kind: mini
ID: FIX-02
Parent: ux-1
Owner: dev
Depends: none
Criteria: PLAN #1, #2, #3
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=10

## Goal
`.qa-name` inside `qa-card--strip` rows can never shrink (`flex:none`, no
`min-width:0`/`overflow`), so at narrow widths (<=~360px, where the <=64rem
wrap rule is active) a long name overflows the card and document h-scroll
returns. Make the name ellipsis as a last resort after `.qa-meta` clips,
and prove it with a narrow-viewport regression case.

## Files
- Edit: `src/app/styles/quality.css` | `.qa-card--strip .qa-name` rules only (~lines 226-227)
- Edit: `tests/ui/qa-strip-overflow.pw.ts` | add ONE narrow-viewport test for the same overflow behaviour

## Context
- `specs/ctl-strip-overflow/reports/ux-1.md` | finding ux-1 MED, exact fix (row ux-1)
- `src/app/styles/quality.css:226-232` | name rule + `flex:none` group; `.qa-meta`/`qa-note-txt` ellipsis pattern to mirror
- `tests/ui/qa-strip-overflow.pw.ts:61-95` | existing 1400px test and fixture (`strip()`, `fixture()`); reuse, do not rewrite

## Contract
- `.qa-name` keeps `white-space:nowrap` and `font-weight`; gains
  `min-width:0;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto`
  (flexes only after `.qa-meta` has clipped).
- Remove `.qa-name` from the grouped `flex:none` selector on ~line 227;
  `.pill`, `.cx-chip`, `.qa-acts` keep `flex:none`.
- New test: same fixture, viewport ~320x700; asserts no document h-scroll,
  strip right edges inside `.qa-list`, and `.qa-name` computed
  `overflow:hidden` + scrollWidth > clientWidth (ellipsis actually engaged).
- Out of scope: ux-2/ux-3/ux-4 LOW findings; markup (ctls-page.tsx,
  disputes-page.tsx, my-audits-page.tsx); other `.qa-*` rules; the 1400px
  test body.

## Actions
1. Update the `.qa-card--strip .qa-name` rule and remove `.qa-name` from the `flex:none` group selector.
2. Add the narrow-viewport test to `qa-strip-overflow.pw.ts` reusing `fixture()`.
3. Run the spec; both tests pass.

## Done when
- `qa-strip-overflow.pw.ts` passes under chromium including the new ~320px case.
- Only lines ~226-227 of quality.css changed (scoped diff); name still `nowrap`.

## Verify
- Run: `cd tests/ui && npx playwright test --config playwright.config.ts qa-strip-overflow.pw.ts --project=chromium` -> exit 0

## Handoff
none
Write results/FIX-02.md (<=10 lines); TL alone updates TRACKER.md.
