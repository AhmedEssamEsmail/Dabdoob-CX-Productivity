# FIX-03: Cap the Submit-a-CTL card at 72rem on wide viewports
Kind: mini
ID: FIX-03
Parent: plan-round2
Owner: dev
Depends: none
Criteria: PLAN Round 2 success (card ≈72rem at ≥1600px; unchanged <64rem)
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=10

## Goal
On wide monitors `--page-max:none` lets the "Submit a CTL" card span the
full page, so the `.qa-ctl` 3fr/2fr grid stretches the form column to
~1100px+ (mockup capped ~72rem). Cap ONLY that card at 72rem; the CTL
list and SLA cards stay full width.

## Files
- Edit: `src/app/styles/quality.css` | add ONE scoped rule next to the `.qa-ctl` block (~lines 44-52)
- Edit: `tests/ui/qa-strip-overflow.pw.ts` | add ONE wide-viewport test + its minimal submit-card fixture

## Context
- `specs/ctl-strip-overflow/PLAN.md` "Round 2" | symptom, intended fix, success
- `src/app/styles/quality.css:41-52` | `.qa-ctl`/`qa-ctlform`/`qa-ctlside` rules; place the new rule here
- `src/features/cx-quality/components/ctls-page.tsx:346-363` | `<section class="card">` wrapping `<CtlForm>` → `.qa-ctl`; `.qa-ctl` exists ONLY here
- `src/app/styles/queue.css:198` | existing `:has()` precedent in project CSS
- `mockups/ctl-compact/mock.css:52` | `.mk-main .cxp { max-width:72rem }` — the parity target

## Contract
- New rule: `[data-app="quality"] .card:has(.qa-ctl) { max-inline-size:72rem }`
  (logical property; tokens/scoping conventions unchanged). No other
  `.card` on `/quality` contains `.qa-ctl`, so the list card keeps full
  width. Do NOT change `--page-max`, `.qa-ctl`, `.qa-ctlform`, or markup.
- New test: fixture adds a second `.card` containing
  `.card-pad > .qa-ctl > (form.qa-ctlform + aside.qa-ctlside)` BEFORE the
  existing list card. At viewport ≥1600px assert: submit card
  `getBoundingClientRect().width` ≈ 1152px (72rem, ±2px), form+aside are
  side-by-side (aside.left > form.left), no document h-scroll, and the
  list card width is unchanged (> submit card width). Reuse `css`/`strip`
  helpers; do not rewrite existing tests.
- Out of scope: strip-row rules (`.qa-list`, `.qa-name`, `.qa-meta` —
  already fixed), disputes/my-audits, ux-2/ux-3/ux-4 deferred LOWs,
  component markup, other stylesheets.

## Actions
1. Add the `.card:has(.qa-ctl)` max-inline-size rule to quality.css.
2. Add the wide-viewport test (with its small fixture) to `qa-strip-overflow.pw.ts`.
3. Run the spec; all tests pass.

## Done when
- `qa-strip-overflow.pw.ts` passes under chromium: existing 1400px + 320px
  cases still green, new ≥1600px case proves the 72rem cap + side-by-side
  grid + no h-scroll + list card full width.
- Scoped diff: only the new rule in quality.css and the new test/fixture
  in the pw file.

## Verify
- Run: `cd tests/ui && npx playwright test --config playwright.config.ts qa-strip-overflow.pw.ts --project=chromium` -> exit 0

## Handoff
none
Write results/FIX-03.md (<=10 lines); TL alone updates TRACKER.md.
