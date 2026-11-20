# PLAN: qa-audit-footer-compact
Type: bugfix   Status: draft
Date: 2026-11-20   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Two user-reported defects on the Quality "Audit Desk" random-sample flow:

1. In the open audit form (`AuditForm`), the "Note for the agent and
   team lead" comment textarea and the "Submit audit" button render too
   large (full-width multi-line box, default `md` buttons) — user wants
   them compact, consistent with the rest of the form's footer.
2. Each random-sample queue row shows two buttons; the second is labelled
   "Pass", which auditors misread as "pass the audit score". Rename it to
   "Skip". Keep the underlying status/data vocabulary (`passed`,
   `passReason`, `passedByName`, the "Passed without an audit" history
   panel, status chips, result toasts) unchanged — only the
   call-to-action labels change. For coherence inside the opened inline
   form, the submit label "Confirm pass" becomes "Confirm skip" and the
   busy label "Passing…" becomes "Skipping…" (the `x` remove branch —
   "Remove"/"Removing…" for non-ticket/off-queue rows — is untouched).

## Success criteria
1. Queue table row action: second button reads "Skip" (was "Pass");
   clicking it still opens the inline reason form (`PassForm`) and the
   `P.passItem` flow, aria-expanded wiring, and focus restore all work
   unchanged.
2. In that inline form the primary submit reads "Confirm skip" and its
   busy state "Skipping…"; non-ticket/off-queue rows still show
   "Remove"/"Removing…".
3. In `AuditForm`, the comment textarea is visibly smaller than today
   (e.g. `rows={2}`–`rows={3}` and/or a constrained `max-inline-size`),
   still labelled, still editable, `resize: vertical` retained.
4. The audit-form footer submit button ("Submit audit" / "Saving…" /
   disabled-label variants) and its sibling "Cancel" render at
   `size="sm"` (`cx-btn--sm`), aligned on one row at 375px and 1024px.
5. No layout regressions elsewhere on the page; `npx tsc --noEmit` and
   `npx eslint .` clean.

## Scope / Non-goals
In: `audit-queue-page.tsx` queue-row Pass button; `audit-queue-detail.tsx`
PassForm sample-branch labels; `qa-shared.tsx` AuditForm comment textarea
+ footer buttons; `quality.css` if a scoped rule is the cleaner fix.
Out: renaming `passed` status/fields/history wording/toasts; `PassForm`
component name; any other page; logic or scoring changes.

## Risk flags (y/n)
ui: y — screens/styles.   All others n.
Review gates: QA (always) · Security: skip (label/CSS only, no auth/input handling) · Data: skip · Performance: skip · UX/UI: run

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`

## Conventions
- Verbatim-legacy port: keep `/* legacy symbol */` header comments and
  minified-style variable names; mimic surrounding style, no refactors.
- Forbidden: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`.
- Buttons: `<Button size="sm">` adds `cx-btn--sm`; do not hand-roll classes.
- Windows: redirect output to `/dev/null`, never `nul` (creates a file).
- Results/reports go under `specs/qa-audit-footer-compact/`, not repo root.
- Definition of done: page contract holds at 375/1024 px (e2e/page-contract.spec.ts).

## Research notes
- Legacy extract confirms identical markup (`.cx-textarea` no rows,
  `cx-btn cx-btn--primary` submit, "Pass"/"Confirm pass" labels) at
  `.devin/work/extract/quality/pages/audit-queue.closure.js` L1662-1692,
  L2715, L277 — this is a deliberate improvement request, not a parity fix.
- Prior compact-UI pass on this form: `specs/qa-audit-form-ui/PLAN.md`
  (shrunk `.qa-score`, `#qa-when`) — same direction.
- No test asserts the "Pass" button label; `tests/perf/audit-queue-memo.test.tsx`
  references the `PassForm` component name only.

## Key pointers
- `src/features/cx-quality/components/audit-queue-page.tsx`:477-486 — "Pass" row button in the random-sample queue table.
- `src/features/cx-quality/components/audit-queue-detail.tsx`:119-122 — PassForm submit/busy labels (`x` flag splits remove vs sample-pass wording).
- `src/features/cx-quality/components/qa-shared.tsx`:1008-1018 — comment `cx-field` + `Textarea`; 1051-1076 — footer `Button`s inside `.qa-form__foot`.
- `src/app/styles/quality.css`:9-26 — `.qa-form` / `.qa-form__foot` / qa-table rules; `cx-kit.css`:139-226 — `.cx-btn` geometry (`--cx-target` min-height), 275-298 — `.cx-textarea` (width:100%, min-height).
