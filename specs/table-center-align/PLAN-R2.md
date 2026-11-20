# PLAN R2: table-center-align — label/chip cells + three misses
Type: feature (ui)   Status: draft
Date: 2026-11-19   Project root: C:\Users\AHMED\KPIs\CX-Hub
Supersedes nothing; extends PLAN.md after user screenshots.

## Goal
Center `<td>` cells that carry label/chip content (`.cx-chip` and every wrapper: StatusChip, ReadChip, DecisionChip, ScoreChip), and close three misses the user pointed at: a numeral column on `/quality-scores`, the "Channels" column of the Agents table on `/quality-analytics`, and an over-wide week-period filter.

## Success criteria
1. `cx-kit.css`: `.cx-table td:has(.cx-chip)` (and bare-`table` sibling if the convention needs it) renders `text-align:center` at specificity ≥ the base (0,2,1) — covers Confidence, Why (chip+text inside `ul.qa-whylist` li), StatusChip/ReadChip/DecisionChip cells everywhere, no markup churn.
2. `quality-scores-page.tsx:376`: the Agents/`Loses most to` td is `cx-num` only when it renders the agent count (`m` false); label mode stays text/start.
3. `quality-analytics-page.tsx` Agents table "Channels" td (L407): gets `cx-num` — its content is `"Chats 75% (4)"`-style percentage rows → centered by the existing numeral rule.
4. Week filter select (`quality-analytics-page.tsx:1250`, `className="qa-narrow"`): `.qa-narrow` on a `.cx-select` must shrink to content — add `inline-size:auto`/`width:auto` while keeping the `max-inline-size:12rem` cap. `.qa-narrow` is also used on an `Input` (audit-queue-detail:1184) and a `.cx-field` div (disputes:83) — scope the width fix to selects only so those are untouched.
5. Row labels (`tbody th`, `qa-cov__name`, `tph-hg :first-child`) and text-only cells stay start; numeric inputs (`.input.trk-num`, `.hm-num .input`) unchanged.
6. Gates: `tsc --noEmit`, `eslint` touched files, `vitest run` — extend `tests/css/table-center-align.test.ts` with assertions for the `td:has(.cx-chip)` rule, the `cx-num` on channels/agents td, and the select narrowing.
7. Commit only this run's files; never push. Result files under `specs/table-center-align/results/` only.

## Scope / Non-goals
In: cx-kit.css one rule (+test), quality.css `.qa-narrow` select-scoped width, 2 tsx one-line class additions.
Out: other filter/select widening changes, chip component changes, any tbody th row-label changes, e2e/pixel work, pushes.

## Risk flags (y/n)
arch n · db n · data n · auth n · external-api n · ui y · perf n · deps n · tests n (in-leaf) · docs n · deploy n
Gates: QA (always) · Security: skip (CSS/className only) · UX/UI: run — `td:has(.cx-chip)` is broad by design; reviewer must check for cells where a chip sits inside deliberately-left paragraph text.

## Gate commands
typecheck `npx tsc --noEmit` · lint `npx eslint .` · unit `npx vitest run` · e2e `npm run test:e2e`

## Conventions
- Same as PLAN.md: no deps, no lockfile, verbatim-port style, spec-local results only (NEVER repo-root results/), stage only task files, foreign dirty-tree edits preserved (ctls-page.tsx, quality-analytics-page.tsx, qa-shared.tsx, engine-live.ts, roster.ts, quality.css all have foreign/user edits — diff per-hunk).
- `td:has()` requires no markup — verify specificity: `:root .cx-table td:has(.cx-chip)` = (0,3,1) wins over base (0,2,1).

## Key pointers
- src/app/cx-kit.css:638-665 — table rules + numeric selector family from round 1
- src/app/styles/quality.css:83 — `.qa-narrow { max-inline-size:12rem }`
- src/features/cx-quality/components/quality-analytics-page.tsx:292,330,403 — Confidence `td>Chip`; :198-207 Why `td>ul.qa-whylist` (chips inside); :407-417 Channels td; :1250-1261 period Select.qa-narrow
- src/features/cx-quality/components/quality-scores-page.tsx:376 — dual-mode td (count vs reason label)
- src/features/shared/components/ui/Chip.tsx:20 — renders `.cx-chip`; all chip wrappers route through it
- tests/css/table-center-align.test.ts — extend with new assertions
