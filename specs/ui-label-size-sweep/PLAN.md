# PLAN: ui-label-size-sweep
Type: feature (2-phase audit + fix)   Status: draft
Date: 2026-11-20   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Find and fix, across all of `src/features/`, the same two defect classes
the user reported on the audit-queue screen (fixed in
`specs/qa-audit-footer-compact/`):

- **Class L — misleading CTA labels.** A button/link label whose verb the
  user can misread as a different domain outcome. Precedent: a queue-row
  button labelled "Pass" actually *skipped* the item (waived the audit),
  which auditors read as "pass the audit score" → renamed to "Skip".
- **Class G — oversized controls.** A form control rendered visibly
  larger than its context warrants. Precedents: `#qa-comment` textarea
  (full-width, default rows) → `rows={2}` + `max-inline-size:60ch`;
  audit-form footer buttons default `md` → `size="sm"`; `#qa-when`
  full-width date input → `inline-size:auto`; `.qa-score` hero number →
  compact (earlier spec `qa-audit-form-ui`).

## Phases
- **Phase 1 — FIND (read-only).** 3 parallel inventory agents, one per
  area group, each writing `inventory/<area>.md`. Consolidated by PM into
  `FINDINGS.md`.
- **Phase 2 — FIX.** spec-architect shards confirmed findings into
  mini-shards by file/area; tech-lead BUILD; PM gates.

## Finding rubric (inventory agents must follow exactly)
Report one row per finding: `file:line | class (L|G1..G4) | current |
evidence | severity H/M/L | confidence: autofix|propose | suggested fix`.

- **L**: label lies about the outcome in its context (verb collides with
  another domain meaning, or says nothing about consequence). Autofix only
  when a clearly better short verb exists AND no flow ambiguity (e.g.
  Pass→Skip); otherwise `propose`.
- **G1**: `<Textarea>`/`<textarea>` missing `rows`, or unconstrained
  full-width where a couple of lines suffice. (~29 instances exist.)
- **G2**: a footer/row action button at default `md` that is inconsistent
  with its siblings/context (e.g. lone md CTA in a compact table row or a
  footer mixing sizes). Rule is *consistency with surrounding controls*,
  not "all md → sm".
- **G3**: `.cx-field` input/select spanning full panel width for
  intrinsically short content (dates, times, codes, small numbers) —
  `#qa-when` precedent (`inline-size:auto;max-inline-size:100%`).
- **G4**: oversized summary/score/stat blocks styled like hero numbers
  inside forms (`.qa-score` precedent).
- Skip: shared `ui/` primitives themselves (they are the toolkit), dead
  code, third-party. Judge severity by user-facing impact.

## Success criteria
1. `FINDINGS.md` covers every `src/features/**` page component (39 files):
   all `<Button>`/CTA labels reviewed vs rubric L; all ~29 textarea
   instances vs G1; form footers/fields vs G2–G4. Coverage checklist per
   area included.
2. Every `autofix` finding is fixed in Phase 2 (smallest scoped change;
   verbatim-port style; `Button size="sm"`/scoped CSS tokens only).
3. `propose` findings listed in the final report, NOT applied.
4. No foreign dirty-tree work touched or reverted (see Conventions).
5. Gates: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` green
   (pre-existing foreign failures documented, not fixed). New regression
   assertions added per fix where cheap (precedent:
   `tests/quality/qa-audit-footer-compact.test.tsx`).

## Scope / Non-goals
In: `src/features/**` tsx components + scoped additions to feature CSS
files following the `#qa-comment` precedent.
Out: backend/logic/server files; the `passed` domain-vocabulary rename;
shared UI primitive redesign; files dirty with foreign in-flight work
(defer + report instead of editing); `propose` findings; e2e infra
flakes.

## Risk flags (y/n)
ui: y · tests: n (dev owners add cheap assertions inline) · others n.
Review gates: QA (always) · UX/UI: run · Security/Data/Perf: skip (labels & styles only)

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e` (flaky infra — login/500 fails are not regressions)

## Conventions
- Verbatim-legacy port: keep `/* legacy symbol */` headers, minified
  names, surrounding style; no refactors while fixing.
- Forbidden: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`, commits.
- FOREIGN IN-FLIGHT WORK: tree holds sibling edits (`quality.css`
  `.qa-whylist`, `quality-analytics-page.tsx`, `hub.css`, `overview-page`,
  `aggregates.ts`, `jobs.ts`, hub tests, `specs/auto-checkins/`,
  `results-ac01-*.log`). Before editing any file run `git diff HEAD -- <file>`;
  foreign hunks → leave file alone, record as deferred in the result.
- Results under `specs/ui-label-size-sweep/results/`; reports under
  `reports/`; never repo root. Redirect to `/dev/null`, not `nul`.
- DoD: page contract at 375/1024 px.

## Research notes
- Origin fix: `specs/qa-audit-footer-compact/` (PLAN, debug-1, tl-1/2) —
  exact pattern to mirror: tiny scoped diff + one assertion per fix.
- Earlier compact pass: `specs/qa-audit-form-ui/PLAN.md`.
- Button geometry: `cx-kit.css` `.cx-btn` (`--cx-target` min-height) /
  `.cx-btn--sm` (1.9rem); `.cx-textarea` width:100%.
- Textarea inventory (29 uses/18 files) already enumerated —
  `inventory/` agents get it in their task text.

## Key pointers
- `src/features/cx-quality/components/qa-shared.tsx`:1008-1076 — the
  reference fix (rows + 60ch + size="sm" footer).
- `src/features/cx-quality/components/audit-queue-page.tsx`:477-486 —
  Pass→Skip reference.
- `src/features/shared/components/ui/Button.tsx` — size prop; `Textarea.tsx` — rows passthrough.
