# Area audit — quality (cx-quality feature + 6 routes)

Scope: `src/features/cx-quality/*` (10 page components + `qa-shared.tsx` + 8 lib files), routes `/quality-scores`, `/quality-analytics`, `/qa-forms`, `/calibration`, `/disputes`, `/audit-queue`, `src/app/styles/quality.css` (241 ln).
Rendered shots: all 6 routes captured at 1440/768/390 (`specs/ux-ui-audit-v2/shots/<route>--*.png`, INDEX ok); inspected 1440+390 for every route, 768 for audit-queue. The 4 unrouted components (`ctls-page`, `my-audits-page`, `my-auditor-kpis-page`, `kb-gaps-page`) are audited from code — their shots belong to other area shards.
Baseline: `reports/audit-shared-tokens.md` — this area is a textbook consumer of its "three vocabularies" finding: quality markup mixes `.cx-*`, refresh (`.card`/`.pill`/`.seg`/`.tbl`/`.note`/`.empty`) and field-legacy classes in the same components.

---

## FINDINGS

```
SEVERITY: High
ELEMENT: ~350 lines of helpers duplicated verbatim inside quality-analytics-page.tsx
LOCATION: quality-analytics-page.tsx:36-241 (label maps + Count machinery),
  :95-107 (QaLinkBtn), :1700-1890 (Drill), :1871-1890 (BasisSeg)
CATEGORY: Architecture / Design System
ISSUE: The file imports Chip/P/QaPage/ScoreChip/qaBand/qaPct/useSe/qaBasisNote
  from './qa-shared' — then redefines the same module's symbols locally:
  CONF/CONF_T (≈QA_CONF/QA_CONF_TONE), TREND_G (≈QA_TREND_ARROW), qaMargin,
  qaPctl (≈qaCi), qaVerdictStatus (≈qaVerdictTone), WHY_V/REASON_L/qaReasons
  (≈QA_REASON_*/qaReasonMix), BASIS_L (≈QA_BASIS_LABELS), ATTN (≈QA_FLAG_LABELS),
  qaPeriodLabel, qaDowName (≈qaDayName), qaCountBand (≈qaCovTone), qaPeriodShort
  (≈qaWeekKeyLabel), qaVsText (≈qaDeltaSentence), qaMonthShort (≈qaMonthLabel),
  QaLinkBtn (≈QaLink verbatim), BasisSeg (:1871 ≈ qa-shared:1335 verbatim),
  Drill (:1700 ≈ qa-shared DrillSection:1357 — same id qa-drill-h, same 3
  tables, ~170 lines), and the entire Count animation stack (:136-241 ≈
  qa-shared:1056-1158 — CS/AR_DIGITS/Nt/rn/CountPair/Count, ~105 lines,
  differing only in useEffect vs useLayoutEffect and prefersReducedMotion
  import).
ROOT CAUSE: The analytics closure was ported verbatim with its own embedded
  helpers; the qa-shared/qa-shared2 merge (qa-shared.tsx:5) deduped the other
  nine closures but this file was never switched over.
IMPACT: ~17% of this 2014-line file is dead weight; two Drill/Count/BasisSeg
  implementations will drift (one already does: local Nt() checks a different
  reduced-motion source); every shared-module fix must be ported twice.
RECOMMENDED FIX: Delete the local copies; import QaLink/BasisSeg/DrillSection/
  Count and the QA_* vocabulary from './qa-shared'. Keep only the unique
  pieces (SparkChart, ColsChart, Coverage, Spread).
CENTRALIZATION OPPORTUNITY: Yes
  - Suggested fix: import sweep, no new component needed.
  - Files affected: quality-analytics-page.tsx (−~350 ln → ~1650).
  - Duplication reduction: biggest single-file win in the area.
```

```
SEVERITY: High
ELEMENT: StatusPill / ScorePill / pillCls — fourth status-badge implementation
LOCATION: disputes-page.tsx:23-36; ctls-page.tsx:26-39 (verbatim copies of
  each other) vs qa-shared.tsx:233-254 (StatusChip/ScoreChip → .cx-chip)
CATEGORY: Design System / Architecture
ISSUE: disputes and ctls define an identical pillCls()/StatusPill()/ScorePill()
  triple that re-implements StatusChip/ScoreChip on the refresh `.pill` class.
  Same status semantics now render two different visuals across sibling
  routes: .cx-chip on /audit-queue, /quality-scores, /quality-analytics,
  /my-audits, /kb-gaps vs .pill (dot + tint) on /disputes and /ctls. Verified
  in shots: disputes--1440 shows ●-dot pills; audit-queue--1440 shows square
  chips — on the same statuses.
ROOT CAUSE: Per-closure porting kept the legacy .pill markup instead of
  adopting the shared chip (baseline: `.pill`/`.tag` vs `.cx-chip` pair).
IMPACT: Users read two badge dialects for identical states; restyling status
  badges requires two sweeps; ~60 duplicated lines.
RECOMMENDED FIX: Delete pillCls/StatusPill/ScorePill from both files, use
  StatusChip/ScoreChip from qa-shared. If the pill look is wanted, add a
  `kind="pill"` variant to ONE chip component — not page-local copies.
CENTRALIZATION OPPORTUNITY: Yes — 3 implementations → 1; also resolves the
  disputes/ctls vs qa-shared StatusChip name collision.
```

```
SEVERITY: Medium
ELEMENT: .workitem button — 15-line inline style object duplicating the class
LOCATION: audit-queue-page.tsx:1722-1744
CATEGORY: Design System / Hardcoded styling
ISSUE: Each worklist row is `<button className="workitem" style={{...}}>` with
  inline display:flex, gap:.9rem, inlineSize:100%, padding:.8rem 1.25rem,
  border:0, borderBottom 1px var(--cx-line), borderRadius:0, background
  (accent-soft when selected / transparent), font:inherit, color:inherit,
  textAlign:start, cursor — restating refresh.css:409-412 verbatim plus a
  button-reset, plus off-scale literals (.9rem/.8rem/1.25rem). The inline
  background overrides `.workitem:hover` (refresh:414) so hover feedback is
  dead; the selected tint is hand-mixed instead of a class hook.
ROOT CAUSE: A <button> needed the <a>-oriented .workitem skin; the porter
  pasted the reset+skin inline rather than extending the class.
IMPACT: Hardcoded styling the doc explicitly flags; hover dead; the selected
  state lives in JS not CSS; border-bottom logic duplicated per-item.
RECOMMENDED FIX: Add `button.workitem` (reset) + `.workitem[aria-pressed=true]
  {background:var(--cx-accent-soft)}` to refresh.css (or quality.css if
  quality-only), delete the style object.
CENTRALIZATION OPPORTUNITY: Yes — 1 rule block; also fixes dead hover.
```

```
SEVERITY: Medium
ELEMENT: To do / In progress / Done filter — raw .seg buttons, not the Seg primitive
LOCATION: audit-queue-page.tsx:1621-1639 (`.seg` + `.on` + aria-pressed) vs
  Seg used on the same app via BasisSeg, qa-grain, qs-level, ctl-outcome…
CATEGORY: Design System
ISSUE: The desk's status filter hand-rolls the refresh `.seg`+`button.on`
  markup inside `role="group" aria-label`, while every other segmented control
  in the feature uses the `Seg` primitive (.cx-seg radio inputs). Two
  segmented-control implementations on one page; different keyboard semantics
  (aria-pressed buttons vs radiogroup) and different visuals (both defined:
  refresh:312 vs cx-kit:332).
ROOT CAUSE: mock-06 worklist markup ported raw; Seg primitive adoption was
  partial.
IMPACT: Same widget, two behaviours/styles; .seg has no disabled-option or
  name contract; adds to the baseline's seg/cx-seg/pw-seg sprawl.
RECOMMENDED FIX: Render `<Seg name="aq-seg" value={seg} onChange=setSeg
  options=[…]>` with the counts in the option labels.
CENTRALIZATION OPPORTUNITY: Yes — with the baseline's one-seg decision.
```

```
SEVERITY: Medium
ELEMENT: Page head re-implemented twice (3 variants of one pattern)
LOCATION: audit-queue-page.tsx:1606-1662 (`section.cxp.dq-page` +
  `header.page-head` + `h1#page-title.page-title` + `p.page-sub` +
  `.page-actions`); qa-forms-page.tsx:362-372 (same section + PageHead +
  manual error/skeleton); vs QaPage→PageHead (`dq-head`/`page-purpose`/
  `dq-head__aside`) used by the other 8 components
CATEGORY: Architecture / Design System
ISSUE: QaPage already renders exactly this shell (title/sub/aside/skeleton/
  error). audit-queue re-creates it on the refresh `.page-head`/`.page-sub`/
  `.page-actions` vocabulary to get an actions slot — which PageHead's
  `aside` prop already provides (ui.tsx:225). qa-forms also re-creates
  QaPage's body logic, imperfectly (see skeleton-under-error finding). So the
  app has two page-header class pairs — `.page-head`/`.page-sub` (refresh:17-24)
  vs `.dq-head`/`.page-purpose` (cx-kit:1157-1174) — and three ways to write a
  page header inside one feature.
ROOT CAUSE: Actions-slot need met by copying markup rather than the aside slot.
IMPACT: Audit Desk's header has different margin/class contract than all
  siblings; fixes to QaPage (busy/aria) don't reach it.
RECOMMENDED FIX: audit-queue → `<section cxp dq-page>` +
  `<PageHead title sub aside={segButtons + importBtn}>` or QaPage with aside;
  qa-forms → QaPage with children.
CENTRALIZATION OPPORTUNITY: Yes — PageHead already centralizes this.
```

```
SEVERITY: Medium
ELEMENT: `.tbl` tables (3 sites) beside `.cx-table` (~20 sites)
LOCATION: qa-shared.tsx:886 (AuditForm question table), calibration-page.tsx:371
  (Results), kb-gaps-page.tsx:147 (Gaps) — all inside `.card` with NO
  `.cx-tablewrap`; every other quality table is `.cx-table` inside
  `.cx-panel.cx-tablewrap` (overflow-x auto)
CATEGORY: Design System / Responsive
ISSUE: Three tables use the legacy `.tbl` (refresh:286) while the rest of the
  feature uses `.cx-table`. Consequences: (a) different cell density/typography
  vs sibling tables; (b) `.tbl` is fluid width inside an unwrapped `.card`, so
  6-7 column tables squeeze/wrap on mobile instead of scrolling (kb-gaps has
  7 cols: Logged/Type/Gap/Ticket/Auditor/Same day/Status); (c) num-cell
  convention splits: `.tbl td.num` vs `.cx-num` elsewhere (qa-shared:934-935
  uses `className="num"`).
ROOT CAUSE: Two table vocabularies from the port (baseline `.tbl` vs
  `.cx-table` pair); the port sites kept `.tbl`.
IMPACT: Inconsistent table chrome across the same app; cramped wrapped cells
  on 390px for Results/Gaps (audit form's own table is the worst — see next
  finding).
RECOMMENDED FIX: Migrate the three tables to `.cx-table` inside
  `.cx-panel.cx-tablewrap`; use `.cx-num`.
CENTRALIZATION OPPORTUNITY: Yes — part of the baseline's one-table decision.
```

```
SEVERITY: Medium
ELEMENT: `.qa-q` — <tr> rendered display:flex inside the .tbl question table
LOCATION: qa-shared.tsx:886-970 vs quality.css:22
CATEGORY: Layout / Alignment
ISSUE: The audit form's question rows are `<tr className="qa-q">` with
  `.qa-q{display:flex}` (quality.css:22). Flex rows stop participating in
  table column sizing, so the thead's Question/Weight/Answer cells and the
  tbody's three cells size independently — headers cannot align above their
  columns. Also `border-block-start` on a flexed tr replaces row borders; the
  `.qa-q[data-answer]`/`:first-of-type` rules still work but table semantics
  are a layout hack. Not verifiable in shots (no open-audit state captured);
  code-derived.
ROOT CAUSE: Row wanted "label left, controls right" flex behaviour inside a
  legacy .tbl; port kept both.
IMPACT: Weight/Answer header labels sit at table-computed x positions while
  the cells sit at flex positions — misaligned columns on the app's most-used
  form; also fragile (td→flex-item blockification).
RECOMMENDED FIX: Drop the table for this block (a labelled list + Seg column)
  or keep real table layout (`display:table-row` + td widths/text-align).
CENTRALIZATION OPPORTUNITY: No (with the .tbl→.cx-table migration).
```

```
SEVERITY: Medium
ELEMENT: WeekCoverage day cells — title-only tooltips, unreachable by keyboard
LOCATION: audit-queue-page.tsx:986-994 vs analytics Coverage 1474-1485
CATEGORY: Accessibility
ISSUE: `.qa-cov__cell` on the Audit Desk week grid carries `title="name, day
  date: x of N audited"` but no tabIndex/aria-label — the per-cell context is
  hover-only. quality.css:138-139 even ships `[tabindex]` focus-visible +
  cursor:help rules for exactly this pattern, unused here. The analytics
  Coverage table DOES set tabIndex+aria-label+focus tip on reason cells — the
  same pattern is accessible in one place and not the other.
ROOT CAUSE: Two parallel coverage grids; the focusable-tip variant was only
  applied to the newer one.
IMPACT: Keyboard/touch users can't read per-day quota context on the desk
  (1.4.13/2.1.1-adjacent; info is partially redundant with row totals → MED
  not HIGH).
RECOMMENDED FIX: Give non-future cells tabIndex={0}+aria-label like analytics
  (or extract one CoverageCell with the focus+tip wiring).
CENTRALIZATION OPPORTUNITY: Yes — one qa-cov cell pattern, not two.
```

```
SEVERITY: Medium
ELEMENT: Focus loss on Start audit (table path) and on Cancel
LOCATION: audit-queue-page.tsx:1561-1573 + :2006-2023; qa-shared.tsx:789-800
  (Cancel → onCancel → p(null), audit-queue:1841-1846)
CATEGORY: Accessibility / Interaction
ISSUE: (a) "Start audit" in the Today/Requested/NonTicket/OffQueue tables:
  the clicked button becomes `disabled` once `l` is set → focus drops to
  <body>; only scrollIntoView('#qa-audit-open') runs, no focus move. (b) Audit
  form Cancel/Back unmounts the form containing the focused button → focus
  drops to body; only scrolls to '#qq-h'. Contrast inside the same codebase:
  drill-open DOES `qa-drill-h.focus()` (scores:460, analytics:1908-1910) — the
  pattern exists, it's just not used here.
ROOT CAUSE: scrollIntoView used as a focus proxy; no heading/input target
  focused after the mount.
IMPACT: Keyboard users restart tab order from page top on the desk's two
  primary flows (2.4.3-adjacent); sighted keyboard users also lose place.
RECOMMENDED FIX: After `p({queueId…})`, focus the form's first labelled
  control (#qa-when) or give the form a tabIndex={-1} heading like qa-drill-h;
  onCancel → focus the originating row's action cell.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: .note vs .cx-note and .field* vs .cx-field* — double vocabulary inside
  shared module + audit form
LOCATION: qa-shared.tsx:846/854 (.cx-note warn) vs :1034 (.note footer);
  ListSelect qa-shared.tsx:449-513 (.field/.field-label/.req/.field-hint/
  .field-error/.other-row) vs .cx-field/.cx-label/.cx-error used everywhere else
  in the feature
CATEGORY: Design System
ISSUE: Within one file — and one rendered form — warning callouts use
  `.cx-note[data-status]` (stripe style) while the footer info callout uses
  refresh `.note` (full tint box): two visually different notes on the same
  screen. ListSelect builds its field shell from the legacy `.field*` family
  (defined at cx-kit:229-308 as legacy aliases) while the rest of the feature
  uses `.cx-field`/`.cx-label`/`.cx-error`.
ROOT CAUSE: Baseline's three-vocabulary debt; port kept per-widget legacy
  classes where a reskinned cx-* twin exists.
IMPACT: Same-semantic elements styled differently on one form; styling a
  "note" or "field" globally misses these sites.
RECOMMENDED FIX: AuditForm footer → `.cx-note`; ListSelect field shell →
  `.cx-field`/`.cx-label`/`.cx-faint` hint/`.cx-error` (visual parity check:
  legacy .field* aliases resolve to the same tokens).
CENTRALIZATION OPPORTUNITY: Yes — with the baseline family-collapse decision.
```

```
SEVERITY: Medium
ELEMENT: Legacy hash links instead of resolved route links
LOCATION: quality-scores-page.tsx:642 `<a href="#/quality-analytics">`;
  quality-analytics-page.tsx:1958 `<a className="cx-btn cx-btn--quiet"
  href="#/quality-scores">`
CATEGORY: Architecture / Interaction
ISSUE: Both cross-links use `#/<path>` and depend on the client-side HashShim
  (hashchange → router.replace) rather than `/<path>` via resolveLink/
  pageHref/next Link. Works (shim is mounted in SiteChrome), but: no router
  prefetch, an extra replace hop and history entry quirk, and it silently
  breaks the day HashShim's coverage changes. The analytics one is also a
  link styled as a button (cx-btn) — navigation styled as an action.
ROOT CAUSE: Verbatim port of legacy `#/` hrefs.
IMPACT: Navigation works today but is the wrong primitive + fragile contract.
RECOMMENDED FIX: `href={pageHref('quality-analytics')}` / `resolveLink` (or
  next/link) with the plain-link styling siblings use; drop the cx-btn classes.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Dead class hooks/attrs + unused refs (no CSS rule exists)
LOCATION: `.qa-form__facts` (qa-shared:831), `.qa-pass__note`
  (audit-queue:143,325), `.qa-health` (analytics:303), `.qa-cov-wrap`
  (analytics:1429), `.qa-unmatched` (audit-queue:1683), `.qa-access-log`
  (audit-queue:1485), `.qa-sec[data-skipped]` (qa-shared:866 — attribute set,
  zero rules), unused `p` ref (qa-shared:1375 & analytics:1720);
  `details.qa-sampling` class reused for unrelated panels (audit-queue:2062,
  1330, 1390)
CATEGORY: Maintainability / Design System
ISSUE: Seven hooks ship in markup with no styles — they render fine via the
  sibling class but mislead anyone styling or searching them; [data-skipped]
  looks like it should dim the skipped optional section and doesn't;
  `.qa-sampling` is the generic details-panel skin on non-sampling panels.
ROOT CAUSE: Port kept intended-but-unmigrated hooks; class names reused as
  generic skins.
IMPACT: Dead CSS-adjacent markup; false affordance on [data-skipped].
RECOMMENDED FIX: Add the missing rules or drop the hooks; style
  `.qa-sec[data-skipped]` (opacity/.55 like .qa-low) since the toggle copy
  says "skipped"; rename the details skin to a neutral class (e.g.
  `.qa-details-panel`).
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Skeleton rendered under LoadError on /qa-forms
LOCATION: qa-forms-page.tsx:372-473
CATEGORY: Layout / States
ISSUE: `{a ? <LoadError/> : null}` then `{n ? … : <LinesSkeleton/>}` — on
  error, `n` is null so the rows skeleton shimmers directly under the error
  note. QaPage's guard (`!d && !error`) exists precisely to avoid this.
ROOT CAUSE: Manual re-implementation of QaPage's state logic (see page-head
  finding).
IMPACT: Conflicting loading+error states on failure (cosmetic, LOW).
RECOMMENDED FIX: Use QaPage, or add `&& !a` to the skeleton branch.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Strip-card meta truncates real data on desktop
LOCATION: disputes-page.tsx:169-183 (+ ctls-page:386-409) vs
  quality.css:227-232; rendered in disputes--1440.png
CATEGORY: Layout / Responsive
ISSUE: `.qa-meta` is nowrap + `overflow:hidden` + per-span ellipsis; long
  agent/auditor names consume the row so the audit date and "raised by" tail
  are cut at 1440px (shot: "audited by Hozaifa Kamal… on 202-1…"). The info
  exists only in the (closed) detail; no title/aria-label supplies it.
ROOT CAUSE: One-line strip design + real-world long names.
IMPACT: Dates/requester identity hidden on common data; row still opens for
  full detail → LOW.
RECOMMENDED FIX: Add `title` (or aria-label) with the full meta string to the
  summary, or cap `.qa-name` max-inline-size and let meta keep ~60%.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Calibration trend — 4 series colors for N auditors
LOCATION: calibration-page.tsx:116,156 (`qa-trend__s${g % 4}`) vs
  quality.css:81-84 (only s0–s3 defined)
CATEGORY: Design System
ISSUE: Auditor series cycle accent/warn/info/bad via g%4 — the 5th auditor
  reuses series 0's color; legend lines can't be told apart.
ROOT CAUSE: Palette sized for 4 series.
IMPACT: Ambiguous legend on teams >4 auditors (edge case today).
RECOMMENDED FIX: Add s4–s7 tones or a dash-array differentiator per series.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: window.confirm for destructive/edge flows + ungated smooth scroll
LOCATION: qa-shared.tsx:796 (leave-unsaved-audit), ctls-page.tsx:303 (resend
  already-sent mail), ctls-page.tsx:332 (`scrollIntoView({behavior:'smooth'})`
  not gated on reduced motion)
CATEGORY: Interaction / Accessibility
ISSUE: Two native confirms beside the styled popup/dialog family (baseline:
  5 dialog contracts) — inconsistent chrome, though accessible. The smooth
  scroll ignores prefers-reduced-motion (Count/useEnterAnim check it; this
  doesn't).
ROOT CAUSE: Native browser UX kept from the legacy app.
IMPACT: Visual inconsistency; motion sensitivity edge.
RECOMMENDED FIX: Keep or migrate per the dialog decision (low value either
  way); gate the smooth behavior behind prefersReducedMotion() (already
  imported via shared/shell/i18n elsewhere).
CENTRALIZATION OPPORTUNITY: With the baseline dialog decision.
```

```
SEVERITY: Low
ELEMENT: StatusChip fallback + empty-hero/chart rendering
LOCATION: qa-shared.tsx:236 (`QA_STATUS[s]?.[0] ?? s` → raw snake_case key);
  quality-scores-page.tsx:99-163 (TrendChart with zero series renders
  axes+target+"9 of 9 left out" — shot shows an empty chart area);
  quality-scores--1440.png hero: big dash + sparse dl
CATEGORY: UX / Layout
ISSUE: Unknown statuses surface as raw keys ("dispute_rejected"); the empty
  trend renders a full-height figure of axes with no data rather than an
  `.empty` block (ColsChart already does this right, analytics:871-877);
  qs-hero with null score leaves a mostly empty 2-col card.
ROOT CAUSE: Defensive fallbacks authored for data, not copy/empty-state.
IMPACT: Occasional raw strings; wasted vertical space on the primary scores
  screen when the period has no data.
RECOMMENDED FIX: Humanize fallback (`s.replace(/_/g,' ')`), render `.empty`
  in TrendChart when O===0 (like ColsChart), collapse qs-hero to one column
  when score===null.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Baseline positives to keep (noted for balance)
LOCATION: qa-shared.tsx (QaPage busy+labelledby, SortTh aria-sort, ListSelect
  label+describedby+role=alert+focus-into-Other, Count reduced-motion +
  sr-only final, AuditForm fieldset/legend + aria-live score + per-question
  Seg labels + why-reason labelledby, DrillSection focus-to-heading);
  analytics Coverage tabIndex+aria-label cells; qa-cov sticky name column +
  legend; workitem aria-pressed; qa-note pre-line; data-status/--st-* token
  triples on .qa-score/.dq-totals__item; every table th scope=col (+scope=row
  on qa-cov); details/summary disclosure panels throughout; all forms keep
  values on error and announce via role=alert + toast.
CATEGORY: —
ISSUE: The a11y fundamentals are genuinely good — this area is the model for
  labelled controls, focusable chart hotspots (useTip) and disclosure widgets.
RECOMMENDED FIX: — (hold the pattern while fixing the duplications above).
CENTRALIZATION OPPORTUNITY: No.
```

---

## A. Layout & Alignment Summary
- Components reviewed: 10 page components + qa-shared + quality.css (241 ln) + 6 route shells; rendered output verified on all 6 routes (1440/390, 768 for audit-queue).
- Misaligned elements: 1 structural — `.qa-q{display:flex}` tr can't align under `.tbl` thead (code-derived; no audit-open shot). Otherwise aligned; strip rows, hero, coverage grid render true in shots.
- Overlapping elements: none found; `.qa-score` sticky + `.qa-cov__name` sticky behave.
- Spacing violations: off-scale literals — workitem inline `.9rem/.8rem/1.25rem` (audit-queue:1731-1734); `.qa-facts dt` etc all tokenized (good). `.page-head` 1.4rem margin vs PageHead path (baseline already flags the 1.4rem straggler).

## B. Design-System Violations (severity)
- High: analytics local-helper duplication (~350 ln, bypasses qa-shared); StatusPill/ScorePill pill-vs-chip split on disputes+ctls.
- Medium: workitem inline style (15 props, kills hover); `.seg` raw vs Seg primitive; page-head ×2 vocabularies + QaPage reimplemented twice; `.tbl` ×3 vs `.cx-table` ×20 (+`.num` vs `.cx-num`); `.note`+`.field*` legacy classes inside qa-shared; `#/` hash links + link-styled-as-button.
- Low: dead hooks `.qa-form__facts` `.qa-pass__note` `.qa-health` `.qa-cov-wrap` `.qa-unmatched` `.qa-access-log` + `[data-skipped]`; `.qa-sampling` used as generic details skin; skeleton under error; meta ellipsis without title; 4-colour series limit; window.confirm; ungated smooth scroll; raw-status fallback.

## C. Shared-Components Opportunity Report
- Centralize: StatusPill/ScorePill/pillCls → StatusChip/ScoreChip (disputes, ctls); all analytics locals → qa-shared imports (DrillSection, BasisSeg, QaLink, Count, QA_* maps); `.seg` filter → Seg primitive; audit-queue + qa-forms page shells → QaPage/PageHead(aside); `.tbl` tables → `.cx-table`+`.cx-tablewrap`.
- Tokenize: nothing new beyond baseline (this area is already tokenized — the gap is vocabulary, not values).
- Extract: one `<CoverageCell>` (tabIndex+aria-label+tip) shared by audit-queue WeekCoverage and analytics Coverage; a `qaDateTime`/`qaDate` formatter — the `.slice(0,16).replace('T',' ')` idiom appears 8× (audit-queue:433,689,833,1488,2092, analytics, my-auditor-kpis).
- Hooks: none new (useSe/useQaSort/useTip already shared).
- Pages using duplicated implementations: quality-analytics (helpers), disputes + ctls (pills), audit-queue (workitem/seg/page-head).

## D. Technical-Debt Analysis
- Duplicate code: ≈500 of ~9,000 component lines (~5-6%): ~350 analytics helpers + ~60 pill copies + ~50 shell/inline reimplementations; plus pervasive vocabulary-level duplication the count doesn't capture.
- Estimated refactor effort: S–M — the analytics dedupe is a mechanical import swap (highest value, ~1-2h incl. regression pass); chip migration touches 2 files + visual check; CSS-side fixes are single-rule.
- Highest-risk areas: `.qa-q` flex-tr layout change (visual diff needed on the audit form); Chip swap changes status visuals on 2 routes (intended); analytics dedupe must preserve the local `Drill`'s tiny deltas (it uses `QaLinkBtn` not `QaLink` — identical, safe; Nt() differs — qa-shared's reduceMotion() is the superset).

## E. Architecture Scorecard (/10, quality area)
- UI Consistency: 5 — coherent look in shots, but pill/chip, tbl/cx-table, seg/cx-seg, note/cx-note, page-head/dq-head duals on sibling routes.
- Layout Quality: 7 — solid card/section/strip structures, good empty states (except chart-empty); qs-hero imbalance + .qa-q misalignment.
- Design System Compliance: 5 — tokens respected almost everywhere; one inline-style block, dead hooks, legacy vocab mixing.
- Component Reusability: 5 — qa-shared is a real shared module (AuditForm, ListSelect, useQaSort, DrillSection) but is bypassed by the biggest file and the two pill files.
- Responsiveness: 7 — tablewraps scroll, strips wrap at 64rem, sticky name column, qa-pass mobile sticky; `.tbl` squeeze and off-queue column clipping at 390.
- Accessibility: 6 — labels/describedby/aria-sort/disclosure/focus-into-drill are strong; title-only coverage cells, focus-drop on start/cancel, and the baseline's invisible-disabled-seg affect this area's primary form.
- Performance: 7 — lazy details panels, skeletons, stale-while-revalidate loader; duplicated bundle code and two Count engines.
- Maintainability: 4 — verbatim-port duplication, dead hooks, three vocabularies in shared markup, single-letter locals (`n/a/s/i/c/l`) throughout make review hard.
- Scalability: 5 — shared module exists to grow on; pattern is "copy the closure" instead of "reuse the module".

## F. Top 20 Priority Fixes (this area; merged into global Top 20 by PM)
1. quality-analytics: delete ~350 ln of local helpers, import from qa-shared (DrillSection, BasisSeg, QaLink, Count, QA_* maps). (H, medium effort, biggest dedup)
2. disputes + ctls: drop pillCls/StatusPill/ScorePill → StatusChip/ScoreChip. (H, small; unifies status badges)
3. `.qa-q` flex-tr → real table columns or non-table block, fix header/cell misalignment. (M, verify visually)
4. workitem: move inline style+selected state to `button.workitem`/`.workitem[aria-pressed]` CSS. (M, small; restores hover)
5. To-do seg → `<Seg>` primitive. (M, small)
6. audit-queue + qa-forms → QaPage/PageHead aside pattern; removes third page-head. (M, small)
7. `.tbl` ×3 → `.cx-table` inside `.cx-tablewrap` (audit form, calibration results, kb-gaps). (M, medium)
8. WeekCoverage cells: tabIndex+aria-label like analytics Coverage (extract CoverageCell). (M, small)
9. Focus management: focus #qa-when/form heading after Start audit; focus source row after Cancel. (M, small)
10. `#/quality-*` links → resolved `/` hrefs (+ drop cx-btn on a link). (M, trivial)
11. `.note`→`.cx-note` (AuditForm footer); ListSelect `.field*`→`.cx-field*`. (M, trivial)
12. Dead hooks sweep + `[data-skipped]` styling + rename generic details skin. (L, trivial)
13. qa-forms: don't render skeleton under LoadError. (L, 1-line)
14. Strip meta: title/full-text or cap .qa-name to preserve dates on long names. (L, small)
15. TrendChart empty figure → `.empty` when no points; qs-hero null-score single column. (L, small)
16. Calibration series: more than 4 distinguishable tones (s4+/dash). (L, small)
17. Extract shared `qaDateTime` formatter (8× `.slice(0,16).replace('T',' ')`). (L, trivial)
18. StatusChip unknown-key fallback → humanized text. (L, 1-line)
19. Gate `scrollIntoView({behavior:'smooth'})` on prefersReducedMotion. (L, 1-line)
20. Decide window.confirm vs styled popup with the baseline dialog consolidation. (L, with baseline #12)

Not verified (behind interactions the static shots can't reach): the open AuditForm's `.qa-q` alignment and seg checked-fail styling; ListSelect "Other…" flow; drill-drawer focus move; dark mode (no [data-theme] shots for these routes); Arabic/RTL rendering of quality.css logical-prop usage (sheet uses logical props consistently — likely fine, verify once).
