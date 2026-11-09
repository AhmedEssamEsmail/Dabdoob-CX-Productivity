# FIX-01: Constrain .qa-list grid track so strip rows cannot overflow
Kind: mini
ID: FIX-01
Parent: debug-1
Owner: dev
Depends: none
Criteria: PLAN #1, #2, #3, #4
Skills: none
Budget: files=1; actions=2; changed_lines=5; minutes=10

## Goal
Make the shared `.qa-list` grid use one constrained column so every
`qa-card--strip` row fits inside the card and `.qa-meta` truncates with
ellipsis instead of pushing the document into horizontal scroll.

## Files
- Edit: `src/app/styles/quality.css` | the `.qa-list` rule only (~line 217)

## Context
- `specs/ctl-strip-overflow/reports/debug-1.md` | root cause, probes, exact fix (row dbg-1)
- `src/app/styles/hub.css:15-16` | existing `minmax(0,1fr)` precedent
- `tests/ui/qa-strip-overflow.pw.ts` | failing regression test; do NOT edit

## Contract
`[data-app="quality"] .qa-list` must become
`display:grid;grid-template-columns:minmax(0,1fr);gap:var(--cx-space-2)`.
One-line change; `min-width:0` on grid items verified unnecessary by the
debugger's probes. No markup, component, or other stylesheet changes.
Out of scope: latent same-pattern grids listed in debug-1
(quality.css ~lines 32,41,43,51,53,65,118,166,191,233); the test file;
anything not named in Files.

## Actions
1. Add `grid-template-columns:minmax(0,1fr)` to the `.qa-list` rule.
2. Run the regression test below to confirm it now passes.

## Done when
- `qa-strip-overflow.pw.ts` passes under chromium: no document h-scroll,
  strip right edges inside `.qa-list`, `.qa-acts` on-screen, `.qa-meta` clipped.
- Only the `.qa-list` rule in quality.css changed (scoped diff).

## Verify
- Run: `cd tests/ui && npx playwright test --config playwright.config.ts qa-strip-overflow.pw.ts --project=chromium` -> exit 0

## Handoff
none
Write results/FIX-01.md (<=10 lines); TL alone updates TRACKER.md.
