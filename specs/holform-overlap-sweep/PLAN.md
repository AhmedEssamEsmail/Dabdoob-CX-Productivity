# PLAN: holform-overlap-sweep
Type: bugfix   Status: draft
Date: 2026-11-16   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
On /people-holidays the "Public holidays" add-form (`.dq-holform`) renders the "Add holiday" button on top of the Holiday input instead of after it. Regression from commit f769940 which replaced min-bound grid tracks (`minmax(12rem,…)`, `minmax(10rem,…)`) with `repeat(N, minmax(0,1fr))` on several form rows: tracks can now shrink below the min-content width of the `<input>/<select>` controls they host, the controls overflow their track, and the sibling in the next cell (the solid-background submit button) paints over them. Fix the holiday form so the button sits at the inline-end (far right) of the row with no overlap, and sweep the ENTIRE stylesheet set for the same class of bug — grid/flex rows hosting text controls + buttons where the controls have no `min-inline-size:0` guard — fixing every instance.

## Success criteria
1. On /people-holidays "Public holidays" form: Country, Date, Holiday controls and the "Add holiday" button occupy non-overlapping cells at every width ≥900px (single-column stack below 900px); the button's bounding box does not intersect any input's bounding box and sits at the inline-end edge of the form grid. (Verify via bounding-box math in a browser probe at 1024px and 1440px.)
2. Same no-overlap guarantee for every other control+button grid/flex row found in the codebase sweep — enumerate all `display:grid`/`display:flex` rules that size tracks/columns for `.cx-input/.input/.cx-select/.select/textarea` siblings next to buttons; each must either bound its tracks (minmax min ≥ control min) or scope `min-inline-size:0; max-inline-size:100%` on the controls, matching the existing `.qa-pass`/`.cx-settings-section` convention.
3. `.dq-editor` (inline person editor, same regression) gets the same guard; visual parity at 375/1024px per the 8-question page contract.
4. `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` green; no layout regressions on adjacent panels.

## Scope / Non-goals
In: `src/app/refresh.css` (`.dq-holform`, `.dq-editor`, `.dq-days`), `src/app/styles/people.css` (`.pw-new-action` + any same-pattern rules), all of `src/app/cx-kit.css`, `src/app/theme.css`, `src/app/styles/*.css`, and any inline `style={{}}`/`className` grid layouts in `src/**/*.tsx` that place controls+buttons in shrinkable tracks.
Out: redesigning the forms, changing breakpoints, touching component markup unless a CSS-only fix is impossible, DB/API changes, commits/pushes/deploys.

## Risk flags (y/n)
arch n · db n · data n · auth n · external-api n · ui y · perf n · deps n · tests n · docs n · deploy n
Review gates: QA (always) · Security: skip (CSS-only, no authz/input handling) · Data: skip · Performance: skip · UX/UI: run

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e` (UI/routes — run only if a probe cannot verify otherwise)  security: skip  build: `npm run build` (optional)

## Conventions (<=10 lines: workflow.md + relevant lessons)
- CSS-only fix preferred; match `.qa-pass` convention: scope `box-sizing:border-box; min-inline-size:0; max-inline-size:100%` on `:is(input:not([type=checkbox]):not([type=radio]),select,textarea)` inside the form, OR restore bounded `minmax(Nrem,1fr)` tracks — pick per-site whichever matches neighbours.
- Forbidden: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`. No new deps.
- Definition of done (UI): 8-question page contract at 375/1024px — `specs/ux-ui-audit-v3/PLAN.md` Phase 2, `e2e/page-contract.spec.ts`.
- Keep `dq-*` class names verbatim (documented keeps, refresh.css:482).
- One commit per work package, only when the user asks. Never commit/push/deploy.

## Research notes
- f769940 diff: `.dq-holform` was `minmax(12rem,1fr) minmax(12rem,14rem) minmax(10rem,20rem) auto`; `.qa-pass` was `minmax(12rem,16rem) minmax(12rem,1fr) auto`; `.pw-new-action` had a `minmax(0,150px)` track; `.dq-editor` was `minmax(12rem,18rem) minmax(0,1fr)`.
- `.qa-pass` survives the regression only because of `.qa-pass :is(input,select,textarea){min-inline-size:0;max-inline-size:100%}` (quality.css ~line 141) — this is the canonical guard pattern.
- Screenshot shows the primary `cx-btn` overlapping the right edge of `#hol-name` input.

## Key pointers
- src/app/refresh.css:541-548 — `.dq-editor` / `.dq-editor__actions` / `.dq-days` / `.dq-holform` + 900px collapse; the bug lives here.
- src/app/styles/people.css:57 — `.pw-new-action` `repeat(3,minmax(0,1fr)) auto`, no control guard (720px collapse).
- src/app/styles/quality.css:~140 — `.qa-pass` + its guard rule = the convention to copy.
- src/app/cx-kit.css:246-330 — `.field/.cx-field` (`min-width:0` on field but NOT on the control) and `.input/.select/.cx-input` (`width:100%`, no min-inline-size:0 outside `.qa-pass`/`.cx-settings-section`).
- src/features/cx-hub/components/people-holidays-page.tsx:521-562 — form markup: `Oo` (`.field` wrapper) + two `.cx-field` + submit `Button` + conditional `.cx-error` (has `grid-column:1/-1`).
- src/features/cx-hub/components/hub-shared.tsx:747-815 — `Oo` renders `<div className="field">` (legacy class, fine).
- Verification probes to copy: specs/ux-ui-audit-v3/probe-qa2-*.mjs (Playwright bounding-box/console probes).
