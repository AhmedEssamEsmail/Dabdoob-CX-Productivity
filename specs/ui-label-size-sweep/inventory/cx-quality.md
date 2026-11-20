# Inventory: cx-quality — ui-label-size-sweep Phase 1 FIND

Area: `src/features/cx-quality/**` · Rubric: L + G1–G4 (specs/ui-label-size-sweep/PLAN.md)
Reviewer: FIND agent · Date: 2026-11-20 · Scope: 14 tsx components; `lib/*.ts` (8 files) = non-UI, out of scope per plan.

## Geometry evidence (from CSS, cited in rows)

- `.cx-input/.cx-select/.cx-textarea` default `width:100%`, `min-height:var(--cx-target)` — `src/app/cx-kit.css:275-291`.
- Default `md` button = `.cx-btn` min-height `--cx-target`; `size="sm"` → `.cx-btn--sm` (1.9rem, text-xs) — `cx-kit.css:138-160,215-216`; `Button.tsx` maps `size` at `src/features/shared/components/ui/Button.tsx:25`.
- Precedents already applied (NOT findings): `#qa-when{inline-size:auto}` quality.css:10; `#qa-comment{max-inline-size:60ch}` quality.css:26 + `rows={2}` qa-shared.tsx:1014; `.qa-form__foot` footer `size="sm"` qa-shared.tsx:1053-1078; `.qa-score` compact quality.css:17-19; `Pass`→`Skip` audit-queue-page.tsx:477-486.
- `.qa-ctl .qa-ctlform textarea{min-block-size:7rem;resize:vertical}` quality.css:58 — forces both ctls textareas to ~5 lines regardless of `rows`.
- `.qa-grid` / `.qa-request` / `.qa-pass` / `.qa-bq` grids constrain fields to `minmax(≥14rem,1fr)` columns (quality.css:89-96,146-148,192-197) — fields inside them are NOT full-panel-width → reviewed, no G3.
- `.qa-narrow{max-inline-size:12rem}` quality.css:84 exists as the narrow-field utility (used by disputes `ns-*` input, analytics period select).

## Per-file coverage checklist

| File | Lines | Buttons/CTAs | Textareas | Fields | Hero blocks | Findings |
|---|---|---|---|---|---|---|
| components/audit-queue-coverage.tsx | 273 | 2 quiet steppers (114,120) + AuditEntry labels | none | none | none | 0 |
| components/audit-queue-detail.tsx | 1508 | 20 (all reviewed) | none | 27 cx-field/inputs | none | 7 |
| components/audit-queue-page.tsx | 592 | 4 (244,302,466,477) | none | `#qa-desk` select (constrained `.qa-viewing__pick`) | none | 1 |
| components/calibration-page.tsx | 426 | 2 (261,345) | none | `#cal-t` in `.qa-grid` (constrained) | none | 1 |
| components/ctls-page.tsx | 558 | 3 (289,337,483) + Seg groups | 2 (261,276) | `#ctl-ref` full-width | none | 3 |
| components/disputes-page.tsx | 324 | 1 submit (115) + Seg outcomes | 1 (104) | `ns-*` already `.qa-narrow` | none | 2 |
| components/kb-gaps-page.tsx | 224 | 2 (140,200) | 1 (128) | `.qa-grid` constrained | none | 2 |
| components/my-auditor-kpis-page.tsx | 185 | none | none | `#mak-m` in `.cx-filters` toolbar | none | 0 |
| components/my-audits-page.tsx | 195 | 3 (86,93,112) | 1 (107) | in `.qa-ctlbox` | `.qa-avg` text-xl (fine) | 3 |
| components/qa-forms-page.tsx | 467 | 8 (211,282,304,312,336,343,366,444) | none | `.qa-bq`/`.qa-grid` constrained, `.qa-w` narrow | none | 2 |
| components/qa-shared.tsx | 1557 | 9 (283,491,498,540,838,894,1053,1071,1429) | `#qa-comment` (fixed) | `#qa-when` (fixed), `.qa-q` selects (inline-size:auto) | `.qa-score` (fixed) | 1 |
| components/quality-analytics-charts.tsx | 582 | none | none | `#qa-cols-agent` (`max-inline-size:18rem`) | none | 0 |
| components/quality-analytics-page.tsx | 1366 | 5 quiet/disclosure (235,580,739,1055,1291) | none | `.qa-narrow` period select | `.cx-totals` dashboard stats (not in forms → G4 n/a) | 0 |
| components/quality-scores-page.tsx | 686 | 2 (510 Show, 653 How-scores-work) | none | `.qs-custom` date inputs (inline flex) | `.qs-hero`/`.qs-big` — dashboard headline, not inside a form → G4 n/a | 0 |
| lib/*.ts ×8 | — | — | — | — | — | N/A (non-UI) |

Reviewed-and-clean specifics: single-submit CTAs (`Submit CTL` 289, `Record the decision` disputes:115, `Log the gap` kb:140, `Assign calibration` cal:261, `Request audit`/`Add to the queue`/`Save weights`/`Add and start audit` in detail) kept at md — lone CTAs are consistent with themselves per G2's "consistency with surrounding controls" rule. `Add choice`/`Cancel` (qa-shared:491-500) left md: matches sibling input height (`--cx-target`). `QaLink`/`.qa-sort`/steppers/`Close`/`Show all N`/`Try again` — styled or consistent controls, no defect.

## Findings table

`file:line | class | current | evidence | severity | confidence | suggested fix`

| file:line | class | current | evidence | severity | confidence | suggested fix |
|---|---|---|---|---|---|---|
| ctls-page.tsx:261 | G1 | `<Textarea id="ctl-reason">` no `rows`, full column width | `.cx-textarea` width:100%; `quality.css:58` forces `min-block-size:7rem` (~5 lines) on `.qa-ctl .qa-ctlform textarea` — a conditional dispute box | M | propose | `rows={2}` + scope the 7rem rule (e.g. `#ctl-reason,#ctl-notes{min-block-size:auto}`) ± `max-inline-size:60ch` per `#qa-comment` precedent. Needs tsx+css pair, hence propose |
| ctls-page.tsx:276 | G1 | `<Textarea id="ctl-notes">` no `rows`, same 7rem forced height | same as above; coaching notes fits 2–3 lines | M | propose | same pair-fix as ctl-reason |
| disputes-page.tsx:104 | G1 | `<Textarea id={dn-*}>` no `rows`, width:100% of `.qa-ctlform` (≤44rem) inside `.qa-card--strip .qa-detail` | cx-kit.css:281; the 7rem rule does NOT apply here (no `.qa-ctl` ancestor) | M | autofix | `rows={2}` + scoped `[data-app="quality"] .qa-card--strip .qa-detail textarea{max-inline-size:60ch}` |
| kb-gaps-page.tsx:128 | G1 | `<Textarea id="kb-d">` no `rows`; `.cx-field--wide` spans the full `.qa-grid` panel width | cx-kit.css:281 + quality.css:92 (`cx-field--wide` = `grid-column:1/-1`) | M | autofix | `rows={2}` + `[data-app="quality"] #kb-d{max-inline-size:60ch}` (mirror `#qa-comment`) |
| my-audits-page.tsx:107 | G1 | `<Textarea id={nh-*}>` no `rows`, full `.qa-ctlbox` width inside card detail | cx-kit.css:281 | M | autofix | `rows={2}` + scoped `[data-app="quality"] .qa-ctlbox textarea{max-inline-size:60ch}` |
| qa-forms-page.tsx:336-349 | G2 | `.qa-form__foot` Save-as-new-version + Cancel at default `md` | identical footer class the precedent compacted to `size="sm"` (qa-shared.tsx:1053-1078) | M | autofix | `size="sm"` on both footer buttons |
| audit-queue-detail.tsx:120-125 | G2 | PassForm `.qa-actions` `Confirm skip`/`Remove` + `Cancel` at md | compact `.qa-pass` grid row form inside a table passrow (quality.css:145-150); precedent footer is sm | M | autofix | `size="sm"` on both |
| audit-queue-detail.tsx:301-310 | G2 | WaiveForm `.qa-actions` `Confirm waive` + `Cancel` at md | same `.qa-pass` compact row context | M | autofix | `size="sm"` on both |
| my-audits-page.tsx:86-100 | G2 | `.qa-actions` `Confirm, it was done with…` (primary) + `Deny` (quiet) at md | same primary+quiet pair pattern as the compacted audit-form footer; sits in compact `.qa-ctlbox` | M | autofix | `size="sm"` on both |
| my-audits-page.tsx:112-122 | G2 | `Send denial` at md | sibling of the pair above inside the same card; must match | M | autofix | `size="sm"` |
| audit-queue-page.tsx:466-486 | G2 | row `.qa-actions` `Start audit` + `Skip` at default md | compact `.cx-table` row; CTL rows already use `size="sm"` (ctls-page.tsx:337,483) — cross-page row-CTA inconsistency | M | propose | `size="sm"` on both (decide once for all table-row CTAs) |
| audit-queue-detail.tsx:384-397 | G2 | requested-row `Start audit` + `Waive` at md | same table-row context | M | propose | `size="sm"` on both |
| audit-queue-detail.tsx:694-705 | G2 | non-ticket row `Start audit` + `Remove` at md | same | M | propose | `size="sm"` on both |
| audit-queue-detail.tsx:903-914 | G2 | off-queue row `Start audit` + `Remove` at md | same | M | propose | `size="sm"` on both |
| audit-queue-detail.tsx:1464-1477 | G2 | AccessPanel per-row `Remove Audit Access`/`Grant audit access` at md (`.qa-access-act` 11rem full-width cell, quality.css:154-155) | lone md CTA per compact table row | L | propose | `size="sm"` on both |
| kb-gaps-page.tsx:200-205 | G2 | `Mark added to KB` lone md inside `.cx-table` row | rubric's "lone md CTA in a compact table row" case | M | propose | `size="sm"` |
| qa-forms-page.tsx:444 | G2 | `Edit` lone md inside `.cx-table` row | same | M | propose | `size="sm"` |
| calibration-page.tsx:345-352 | G2 | `Audit` primary lone md inside `.cx-list__row` compact row | same pattern | L | propose | `size="sm"` |
| qa-shared.tsx:894-900 | G2 | `Answer this section`/`Skip section (N/A)` quiet md | inline toggle beside `font-size:sm` muted text in `.qa-sec__opt` (quality.css:22) | L | propose | `size="sm"` |
| ctls-page.tsx:192-202 | G3 | `#ctl-ref` "Ticket number or audit ID" input spans the full form column | content ≤12 chars (`inputMode` not set; placeholder `e.g. 701234 or QA-…`); `#qa-when` precedent | M | propose | scoped `[data-app="quality"] #ctl-ref{inline-size:auto;max-inline-size:100%}` (exact `#qa-when` pattern; wider min e.g. `min-inline-size:16rem` if desired) |
| audit-queue-detail.tsx:1426-1431 | G3 | `#qa-access-find` search input spans the full details-panel width | `.cx-field` inside `.qa-details-panel` — no grid constraint (cx-kit.css:247-253,281) | L | propose | `className="qa-narrow"` or scoped `max-inline-size` |
| disputes-page.tsx:43-47 | L | Seg options `Uphold: void the audit` / `Uphold: re-score` / `Reject` | "Uphold"/"Reject" omit the object — decider may read "Uphold" as upholding the audit, not the dispute | L | propose | name the object: `Uphold the dispute: void the audit` / `…: re-score` / `Reject the dispute` |
| my-audits-page.tsx:93-100 | L | `Deny` toggle | terse; agent denies the coaching *happened* (not the audit). Paired with `Confirm, it was done with X` so partially clear | L | propose | `Deny: it did not happen` or `It did not happen` |

## Notes for PM / Phase 2

- **23 findings**: 2 L (both propose), 5 G1, 14 G2, 2 G3, 0 G4. Autofix set: 4 G1 + 5 G2 = 9 rows; the rest are propose.
- **Foreign in-flight risk**: plan flags `quality-analytics-page.tsx` and `quality.css` `.qa-whylist` as dirty. No findings touch quality-analytics-page.tsx. Several G1/G3 fixes propose *additions* to `src/app/styles/quality.css` — run `git diff HEAD -- src/app/styles/quality.css` before editing; if `.qa-whylist` hunks are foreign, keep additions in a disjoint location and record them.
- **ctls G1 pair** is `propose` not `autofix` only because shrinking them needs both `rows={2}` AND relaxing the shared `min-block-size:7rem` rule (quality.css:58) — a design call, not a pure token addition.
- G2 `propose` rows: changing every `.cx-table`-row CTA to `sm` is a single convention decision; recommend one mini-shard doing all of them together for visual consistency rather than per-file drift.
- `QA_STATUS.passed='Passed on'` (qa-shared.tsx:215) and other `passed` vocabulary reviewed — explicitly out of scope per plan Non-goals.
- No G4: the only hero-styled stat (`.qs-hero`/`.qs-big`, quality-scores-page.tsx:557-565) is a dashboard headline, not inside a form; `.qa-score` and `.qa-avg` are already compact.
