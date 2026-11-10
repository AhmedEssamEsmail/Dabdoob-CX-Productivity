# Area audit — queue (routes /queue, /mail-desk)

Scope: `src/features/cx-queue/*` (queue-page.tsx + shared.tsx in depth; lib/*.ts not UI), routes `/queue` + `/mail-desk`, `src/app/styles/queue.css` (full file — it also serves aging/heatmap/analytics/checkins/scheduler pages audited by other shards).
Boundary note: `/mail-desk` renders `features/cx-desk/components/mail-desk-page.tsx` + `styles/desk.css` — the ROUTE is assigned to this shard, the feature file also falls under desk-ops; findings below cite it once here (route-visible), desk-ops should not re-report. The other cx-queue page components (aging/heatmap/scheduler/checkins/analytics) belong to other shards' routes; cited only where shared.tsx/queue.css drives them.
Rendered shots reviewed: `shots/queue--1440.png`, `queue--768.png`, `queue--390.png`, `mail-desk--1440.png`, `mail-desk--390.png` (all "ok" per INDEX.md).
Baseline: `reports/audit-shared-tokens.md` — cross-referenced, not re-litigated.

---

## FINDINGS

```
SEVERITY: High
ELEMENT: Mail-desk SLA table — "flags" cell breaks out of the table grid
LOCATION: mail-desk-page.tsx:244 (<td className="md-flags">) + desk.css:72
  (.md-flags { display:flex }) ; rendered: mail-desk--1440.png, mail-desk--390.png
CATEGORY: Layout / Alignment / Responsive
ISSUE: display:flex on a <td> removes its table-cell participation. Rendered
  result: the "Open past due" badge detaches from its row's column alignment and
  sits pushed against/over the card's right edge at 1440px; at 390px the badge
  is clipped mid-pill at the card edge (only reachable via .dk-scroll
  horizontal scroll). Its column header is empty (sr-only "Flags"), so sighted
  users see an unlabeled, misaligned/clipped element.
ROOT CAUSE: Flex layout applied directly to a table cell instead of an inner
  wrapper; header cell left textually empty.
IMPACT: Visible layout failure on the page's only data table; the status badges
  (the row's most actionable info) are the element that breaks/clips.
RECOMMENDED FIX: Remove display:flex from the td (wrap badges in an inner div
  .md-flags instead); give the th visible text or keep sr-only but ensure the
  cell re-joins the grid. Re-shot at 390.
CENTRALIZATION OPPORTUNITY: No (one-rule fix), but see F-3 (empty-header cells
  deserve a shared pattern).
```

```
SEVERITY: Medium
ELEMENT: "Age mix" column — fixed 9rem width on mobile table
LOCATION: queue-page.tsx:291 (th style={{ width: '9rem' }}), refresh.css:584
  (.dq-agebar { inline-size: 9rem }); rendered: queue--390.png, queue--768.png
CATEGORY: Responsive / Layout
ISSUE: At 390px the fixed 9rem Age-mix column consumes ~35% of the .tbl width
  (no overflow wrapper — the table compresses instead of scrolling). Queue
  names wrap to 4–5 lines ("Customer Support - Internal"), the .sub status
  line wraps word-per-line, and the eight numeric columns crowd. Compare
  mail-desk which uses .dk-scroll for horizontal overflow.
ROOT CAUSE: Inline-style fixed width + fixed-width .dq-agebar; no narrow-
  viewport variant for the agebar (e.g. collapse to a compact bar or allow
  scroll).
IMPACT: Cramped, hard-to-scan primary table on phone widths; row heights
  balloon (queue--390 shows ~4-line first cell).
RECOMMENDED FIX: Give the table an overflow-x:auto wrapper (.dk-scroll
  equivalent), or shrink .dq-agebar to ~5rem under a mobile breakpoint and drop
  the inline th width in favour of a class.
CENTRALIZATION OPPORTUNITY: Yes — a shared scrollable-table wrapper class used
  by both /queue (.cc-chart div) and /mail-desk (.dk-scroll) tables.
```

```
SEVERITY: Medium
ELEMENT: Mixbar age segments — cramped/illegible counts at small widths
LOCATION: queue-page.tsx:220-243 + refresh.css:356-372 (.mixbar)
  rendered: queue--390.png (segments "7 5 6 3 3 17" slivers)
CATEGORY: Responsive
ISSUE: Twelve flex segments sized by count; at 390px thin slivers still render
  their count label, producing a run of overlapping-looking digits
  (text-overflow only applies to the inner span, segment padding .3rem still
  shows clipped numbers). Legend wraps into 2 ragged columns of .72rem text.
ROOT CAUSE: No minimum-width suppression of the count label; labels render
  whenever count>0 regardless of segment width.
IMPACT: Readability polish on mobile; the chart is still keyboard/ARIA correct
  (role=button + aria-label per segment).
RECOMMENDED FIX: Hide the inner span when the segment is under ~2rem
  (container query or width on the segment via min() in the flex-basis), or
  suppress labels below a count threshold; the aria-label already carries the
  value.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: "Other teams" divider row — wrong scope value
LOCATION: queue-page.tsx:317 (<th scope="colgroup" colSpan={9}>)
CATEGORY: Accessibility
ISSUE: scope="colgroup" declares the cell a column-group header; it is a row-
  group divider inside a single tbody. AT announces "Other teams" as a column
  header for the cells beneath it rather than a section boundary between the
  two queue groups (1.3.1-adjacent).
ROOT CAUSE: scope value reused from thead semantics; HTML row-group headers
  need scope="rowgroup" scoped to separate <tbody> elements.
IMPACT: Screen-reader users get a misleading table model on the page's main
  table.
RECOMMENDED FIX: Split f into two <tbody> elements ("ours" first, others
  second) and mark the divider <th scope="rowgroup">, or drop scope and render
  a plain styled <td colSpan={9}>.
CENTRALIZATION OPPORTUNITY: Yes — a "table group divider row" pattern recurs
  wherever ported tables segment rows (aging/heatmap pages show similar
  groupbreaks via .dq-groupbreak).
```

```
SEVERITY: Medium
ELEMENT: Page-head implemented three ways across the two routes
LOCATION: shared.tsx:36-48 (Head → .dq-head), mail-desk-page.tsx:141-156
  (Shell → .page-head/.page-actions), shell/ui.tsx (PageHead — re-exported at
  shared.tsx:734 but unused by queue pages)
CATEGORY: Architecture / Design System
ISSUE: The queue area's Head and mail-desk's Shell both render
  h1.page-title + p.page-purpose + an actions aside with locally different
  markup (.dq-head/.dq-head__aside vs .page-head/.page-actions) while the
  shared PageHead primitive exists in the same feature's own barrel and is
  re-exported but never used. .dq-head also carries the off-scale
  margin-block-end: 1.4rem (baseline finding, cx-kit.css:1163 — the
  refresh.css:19 page-head uses the same 1.4rem, vs --space-5 elsewhere).
ROOT CAUSE: Verbatim porting kept each bundle's head markup; PageHead added
  centrally but not adopted.
IMPACT: Three headers to keep aligned; spacing token drift already visible
  between routes.
RECOMMENDED FIX: Adopt PageHead (or converge on .dq-head classes) in
  Head/Shell; delete the loser markup and the duplicate 1.4rem rule.
CENTRALIZATION OPPORTUNITY: Yes — one <Head> component; 3 implementations → 1;
  files: shared.tsx, mail-desk-page.tsx, plus every sibling page with the same
  pattern.
```

```
SEVERITY: Medium
ELEMENT: Inline confirm panel — role="alertdialog" without dialog behaviour
LOCATION: mail-desk-page.tsx:330 (<div className="md-confirm"
  role="alertdialog">)
CATEGORY: Accessibility
ISSUE: alertdialog is a modal-dialog role: it promises focus move into the
  dialog, Escape dismissal, and return of focus. This confirm is an inline
  swap of the action row — focus stays on the button just pressed, Escape does
  nothing (no handler; only "Back" click), and no aria-modal/labelledby. The
  name is only aria-label="Confirm the reply" with the detail text living in a
  sibling <p>.
ROOT CAUSE: Legacy markup carried an ARIA role the port didn't implement.
IMPACT: SR users hear "alert dialog" yet focus never enters it; the
  description of what is being sent (decision, recipient, cc) is not part of
  the accessible name (4.1.2 / dialog-pattern mismatch).
RECOMMENDED FIX: Either drop the role (plain .md-confirm region, and move
  focus to the Send button or aria-live the summary), or implement the real
  alertdialog contract (focus trap-lite + Escape → setPending(null) +
  aria-describedby on the <p>).
CENTRALIZATION OPPORTUNITY: Yes — inline "confirm destructive send" is a
  reusable pattern (<ConfirmInline label onConfirm onCancel>).
```

```
SEVERITY: Medium
ELEMENT: Duplicated data/feedback plumbing across queue area
LOCATION: shared.tsx:87-118 (fetchJson + useSe), shared/lib/fetch-json.ts
  (second fetchJson), mail-desk-page.tsx:120-206 (Skeleton, Failed, useLoaded,
  useRun, Badge, ErrMsg) vs shared.tsx LoadError/Xe/StatusChip
CATEGORY: Architecture / Maintainability
ISSUE: Two near-identical fetchJson wrappers (one throws FetchError(url), one
  plain Error); useSe (cache+tick) vs useLoaded (no cache) are two loader
  hooks; useRun is a third busy-state hook; mail-desk hand-rolls Skeleton
  (.dk-skel), Failed (.dk-failed), Badge (.pill wrapper — same job as
  StatusChip/Chip), and ErrMsg (.dk-error) instead of the queue/shared
  equivalents the app already has.
ROOT CAUSE: Per-bundle port kept local helpers; no shared "async page state"
  hook or page-shell components were mandated.
IMPACT: Divergent behaviour (useSe caches across mounts, useLoaded doesn't —
  /mail-desk refetches on every visit, /queue doesn't); same visual widgets
  restyled through different class families (dk-* vs cx-*).
RECOMMENDED FIX: One fetchJson (keep FetchError), one loader hook with
  optional cache, one busy hook; mail-desk adopts Xe/LoadError/Chip.
CENTRALIZATION OPPORTUNITY: Yes — ~6 duplicated helpers → shared/lib +
  shared/ui; est. 60–80 LoC removed per page family.
```

```
SEVERITY: Medium
ELEMENT: queue.css — off-scale literal sweep + ad-hoc breakpoints
LOCATION: queue.css:47(2.125rem), :52(3px), :55(4.375rem), :86(2px),
  :88-89(14px/4px×22px), :97(26.25rem), :114-120(.5rem/.9rem/.35rem/1.1rem),
  :127-134(1180px, 560px), :170-176(2.4rem/2.2rem/2rem/.6em/2px),
  :180(18px padding), :185(65rem), :211(14px/3px radius), :215(14rem),
  :224(40rem)
CATEGORY: Design System / Responsive
ISSUE: ~20 hardcoded geometry/spacing literals bypass the --cx-space-* and
  text scale (the doc's arbitrary-value class). Some are chart geometry
  (hm-bar 4px×22px slivers, sch-tl 65rem SVG min-width — justifiable) but
  paddings/margins/min-widths (.9rem, .35rem, 1.1rem, 2.125rem, 15rem, 9.5rem,
  7rem, 14px, 18px, 26.25rem) are layout spacing that should sit on the scale.
  Breakpoints 1180/560/40rem add to the baseline's already-inconsistent
  breakpoint set (1180 vs 1200 grid split is live here at queue.css:127).
  .hm-gs{padding:0 !important} is the file's lone !important.
ROOT CAUSE: Px-faithful porting of closure-bundle geometry; no token lint.
IMPACT: Rhythm drift inside hm/sch pages; breakpoint drift makes the hm-layout
  collapse disagree with the 1200px grid collapse of refresh.css grids.
RECOMMENDED FIX: Snap spacings to --cx-space-*, replace 1180 with the shared
  grid breakpoint (once baseline picks one), keep documented chart-geometry
  exceptions in a /* px-exact */ block; remove the !important.
CENTRALIZATION OPPORTUNITY: Yes — breakpoint token + literal sweep (~20 decls).
```

```
SEVERITY: Medium
ELEMENT: mail-desk — mobile table crams long unbreakable strings
LOCATION: mail-desk-page.tsx:213-230 + desk.css:44-49 (.dk-scroll/.dk-table)
  rendered: mail-desk--390.png
CATEGORY: Responsive
ISSUE: At 390px the "Mail" cell wraps the Gmail subject word-by-word over 8
  lines and the .dk-fine sender line breaks mid-token
  ("MyFatoor ah refund update, ssudhaka ran@myf atoorah.c om"). Combined with
  the clipped flags badge (finding 1), the row is very tall and ragged.
ROOT CAUSE: Narrow column + long email/token strings with no deliberate
  breaking strategy (overflow-wrap) and no min-width on the subject column.
IMPACT: Readability on the page's primary table; row height ~10 lines.
RECOMMENDED FIX: overflow-wrap:anywhere on .dk-fine (clean breaks at address
  boundaries), min-inline-size on the Mail column (~12rem) letting .dk-scroll
  take the overflow, truncate subject with ellipsis + title attr.
CENTRALIZATION OPPORTUNITY: Partial — long-identifier cells (emails, IDs) are a
  shared table-cell pattern worth one utility class.
```

```
SEVERITY: Medium
ELEMENT: /queue table headers + microcopy use borderline --cx-ink-3
LOCATION: refresh.css:289 (.tbl th), :304 (.tbl .sub), :172 (.card-hint),
  cx-kit.css:1414 (.cx-faint) — consumed by queue-page.tsx:288-303, 328, 341, 357
  rendered: queue--1440.png (QUEUE/OPEN/CHANGE… header row, status subs)
CATEGORY: Accessibility / Design System
ISSUE: Baseline measured --cx-ink-3 ≈ ~4.2–4.5:1 (theme.css:137). The queue
  board leans on it for all 9 table headers, every row's .sub status line,
  both card hints, the "–"/"0" placeholders and "(best effort)" — i.e. more
  real text surface than any other area page.
ROOT CAUSE: Baseline token tuned aesthetically (already reported).
IMPACT: If the rendered mix lands <4.5:1, this page's densest text fails 1.4.3.
RECOMMENDED FIX: Baseline fix (darken mix / use --cx-ink-2 for text) covers
  this page wholesale; verify against queue--1440.
CENTRALIZATION OPPORTUNITY: Yes (token-level, owned by baseline report).
```

```
SEVERITY: Low
ELEMENT: Selected filter state = solid ink pill (mail-desk)
LOCATION: mail-desk-page.tsx:477-492 + desk.css:69-70
  (.md-filter [data-on=true] { background: --cx-ink; color: --cx-surface })
  rendered: mail-desk--1440.png ("Last 7 days, 1" dark pill)
CATEGORY: Design System
ISSUE: The active filter renders as a near-black filled button — the heaviest
  selected treatment in the app. Siblings use underline tabs (.sch-tab.on),
  raised white segment (.pw-seg aria-pressed), or accent tints; a quiet button
  flipped to solid ink reads as a different control kind. It also bypasses
  aria-pressed styling hooks (visual state set by data-on attr instead).
ROOT CAUSE: desk.css authored its own selected convention instead of reusing a
  seg/pill selected style.
IMPACT: Inconsistent selection vocabulary app-wide.
RECOMMENDED FIX: Use .pw-seg/[aria-pressed] semantics (baseline's seg
  consolidation) or accent-tint selected style matching other filters.
CENTRALIZATION OPPORTUNITY: Yes — part of baseline's segmented-control merge.
```

```
SEVERITY: Low
ELEMENT: "All ages" reset control styled as a status pill
LOCATION: queue-page.tsx:213 (<button className="pill warn">)
CATEGORY: Design System / Accessibility
ISSUE: .pill is a 11.5px non-interactive badge (~19-20px tall, no hover/
  cursor/focus styling of its own) used on a <button> — visually a badge, not
  a control; undersized as a target (2.5.8 — likely exempt as inline-in-text,
  but still reads wrong).
ROOT CAUSE: Quickest available chip class reused for a reset affordance.
IMPACT: Affordance ambiguity; a clickable element styled identically to the
  non-clickable "3 queues need help" pill beside it.
RECOMMENDED FIX: A small quiet Button ("Clear filter" / "All ages") or an
  .icon-btn chip-dismiss pattern.
CENTRALIZATION OPPORTUNITY: No (with baseline Chip consolidation, a
  "chip-button" variant would cover it).
```

```
SEVERITY: Low
ELEMENT: Local misc — hash link, inline width, dead class, window.confirm,
  silent pill fallback
LOCATION: queue-page.tsx:350 (raw href="#/aging?unassigned=1" — works via
  HashShim but bypasses resolveLink()/pageHref used elsewhere), :160
  (style={{ width: '11rem' }} on search input), :389 (className "cxp dq-page"
  — bare .cxp is not defined anywhere, only .cxp-fold exists);
  mail-desk-page.tsx:314 (window.confirm for a destructive-ish reset vs the
  app's popup/md-confirm patterns), :460 (STATUS_LABEL/STATUS_TONE lookups can
  yield undefined → empty <Badge> for unknown statuses, same failure mode as
  baseline's untyped status strings)
CATEGORY: Design System / Maintainability / Interaction
ISSUE: Collection of small inconsistencies documented above.
RECOMMENDED FIX: Use resolveLink('#/aging…') for the row link; move the input
  width to a class; drop .cxp; replace window.confirm with the md-confirm
  inline pattern; guard pill label/tone with a fallback ('unknown').
CENTRALIZATION OPPORTUNITY: Mixed (typed status union belongs to baseline's
  Chip work).
```

```
SEVERITY: Low
ELEMENT: queue.css stragglers — scoped .sr-only dupe, 6th dialog class,
  physical-prop remnants
LOCATION: queue.css:122 (.hm-page .sr-only — duplicates the global utility),
  :102-105 (.hm-dialog — yet another dialog contract on top of baseline's 5;
  max-height:calc(100vh - 3rem) inherits baseline's 100vh issue),
  :88 (width:14px), :89 (width/height physical props amid logical-prop file),
  :176 (.sch-cell sup { font-size: .6em } ≈ 8px — below readable floor)
CATEGORY: Design System / Maintainability
ISSUE: Minor dead/duplicate declarations and physical-property leftovers in an
  otherwise logical-property file (noted for the RTL-supported shell).
RECOMMENDED FIX: Delete scoped .sr-only (global exists); fold .hm-dialog into
  the consolidated dialog decision from baseline; use logical props; raise sup
  to ≥.6875rem or drop it.
CENTRALIZATION OPPORTUNITY: Yes (dialog consolidation — baseline item 12).
```

```
SEVERITY: Low
ELEMENT: Baseline cross-refs active on these routes (not re-reported)
LOCATION: .delta up/down inverted semantics (queue-page.tsx:26-28, 343 —
  happens to render correctly here because up=more-open=bad, but relies on the
  confusing class); .stat[data-tone] physical-left stripe RTL issue
  (queue-page.tsx:195); .dq-groupbreak phantom var(--cx-muted) (queue-page.tsx:
  316); double entrance animation (.dq-page>* under cx-kit:1473 + page-in);
  .card/.pill/.empty/.stat/.tbl raw-class usage instead of Card/Pill/Empty/Table
  primitives (baseline finding 1 — this area has ~15 raw call sites).
CATEGORY: —
ISSUE: All owned by audit-shared-tokens.md; listed so consolidation can map
  impact per area.
CENTRALIZATION OPPORTUNITY: (baseline)
```

```
SEVERITY: Low
ELEMENT: Queue-area positives (noted for balance)
LOCATION: queue-page.tsx (aria-pressed + keyboard on mixbar segments; role=img
  + full aria-label on AgeBar; labelled search; disabled Export; empty-filter
  row), shared.tsx (role=status refresh feedback, aria-busy, reduced-motion
  gating on sweep + count-up, Count/CountSpans sr-only finals, ListSelect
  label+describedby+role=alert errors, hm-grid-scroll tabIndex+role=region),
  mail-desk-page.tsx (labels on textarea via htmlFor, aria-labelledby sections,
  empty states, aria-busy skeleton), queue.css (logical props dominant, dark-
  mode var on .hm-total-n, :focus-visible on interactive customs, page-scoped
  --hm-*/--k-* token blocks — a good pattern).
CATEGORY: —
ISSUE: Correct implementations other areas should copy.
```

---

## A. Layout & Alignment Summary
- Components reviewed: QueuePage/Board + 13 shared.tsx exports + MailDeskPage (+Shell/ApprovalCard/SlaTr) + queue.css (228 ln) + desk.css rules consumed by /mail-desk. Feature siblings (aging/heatmap/scheduler/checkins/analytics) out — owned by other shards' routes.
- Misaligned/overlapping: `.md-flags` td displaced + clipped (High); "1 issue" shell badge overlaps card titles at ≤768px (queue--390/768, mail-desk--390 — shared-shell shard's widget, noted).
- Spacing violations: ~20 off-scale literals in queue.css + .dq-head 1.4rem (baseline).

## B. Design-System Violations (severity)
- High: none new beyond the layout defect.
- Medium: triple page-head impl; ink-pill selected convention vs seg/tab; raw-class tables/cards/pills vs primitives (baseline); --cx-ink-3 microcopy dependence (baseline).
- Low: pill-as-button, `.cxp` dead class, scoped .sr-only dupe, .hm-dialog (6th dialog), `!important`, physical-prop remnants, .72rem/.6875rem type (baseline), window.confirm vs app dialogs, raw `#/` href, inline width style.

## C. Shared-Components Opportunity Report
- Centralize: page head (3→1 PageHead); async page plumbing (fetchJson×2→1, loader hook×2→1, busy hook→shared); empty/error/skeleton/badge per-page copies → Xe/LoadError/Chip; scrollable-table wrapper (.dk-scroll ↔ .cc-chart); table group-divider row; inline confirm (<ConfirmInline>); segmented/filter control (baseline).
- Tokenize: breakpoints (1180 vs 1200 collision is in THIS file); --page-max n/a here.
- Hooks to extract: useSe+useLoaded→usePageData(cache?), useRun→useBusyAction.
- Pages using duplicated impls: /queue (raw classes ~15 sites), /mail-desk (dk-* family), sibling queue-app routes via shared.tsx.

## D. Technical-Debt Analysis
- Duplicate code: ~25–35% of the audited UI code is a second implementation of something shared (heads, loaders, chips, skeletons, dialogs, segs); queue.css itself is clean of vocabulary duplication but carries literal-value debt.
- Refactor effort: S–M — mostly mechanical swaps to existing primitives; the risky bit is visual parity on .dq-head→PageHead and md-flags.
- Highest-risk areas: the td{display:flex} table break (fix blind and the column geometry shifts again); useSe module cache semantics (adopting one loader must preserve legacy parity caching).

## E. Architecture Scorecard (/10, this area)
- UI Consistency: 6 — internally coherent queue board; mail-desk dk-*/md-* family diverges.
- Layout Quality: 6 — solid stat/card/table composition; flags-cell break + fixed-width column dock it.
- Design System Compliance: 5 — tokenized queue.css and cx-* adoption good; literal sweep + raw refresh classes + ink-pill convention.
- Component Reusability: 4 — shared.tsx is a real kit for queue pages; mail-desk ignores it; primitives bypassed.
- Responsiveness: 5 — no h-scroll at 390 (good) but squeezed table, clipped badge, cramped mixbar.
- Accessibility: 6 — strong aria coverage (pressed, labels, regions, reduced motion); scope misuse, alertdialog-without-dialog, borderline muted text.
- Performance: 7 — cached loader, stagger-capped sweep, gated count-up; count-up/sweep still cost per-mount (fine).
- Maintainability: 5 — verbatim-port naming (Ie/Ba/Na…) documented but opaque; duplicated plumbing.
- Scalability: 5 — page-scoped token blocks are a good pattern; per-page plumbing keeps forking.

## F. Top priority fixes (this area; merged into global Top 20 by PM)
1. .md-flags: remove display:flex from td (inner div instead) + visible column header — fixes clipped/displaced badges. (H, trivial)
2. Age-mix column: drop inline 9rem + mobile variant or scroll wrapper for the /queue table. (M, small)
3. Converge page heads: Head/Shell→PageHead; delete duplicate 1.4rem rule. (M, small)
4. Merge fetchJson/loader/busy hooks; mail-desk adopts LoadError/Xe/Chip. (M, medium)
5. Mixbar: suppress count labels on sliver segments. (M, small)
6. "Other teams" divider: two tbodys + scope="rowgroup" (or drop scope). (M, small)
7. md-confirm: implement real alertdialog contract or drop the role. (M, small)
8. queue.css literal sweep → --cx-space-*/breakpoint token; remove !important. (M, sweep)
9. Mail table mobile: overflow-wrap:anywhere + min-width subject col. (M, small)
10. "All ages" pill-button → real small button/chip-dismiss. (L, trivial)
11. mail-desk filter: adopt seg/aria-pressed selected style. (L, small)
12. Cleanups: .cxp dead class, scoped .sr-only, .hm-dialog→dialog consolidation, resolveLink for #/aging, STATUS_* fallback, window.confirm→md-confirm. (L, trivial each)

## States checked
/queue: loading (Xe tiles+ladder — code), error (LoadError role=alert — code), empty filter row (code), populated (shots), disabled Export (code), long text/queue names (queue--390 wrap), mobile 390 + tablet 768 (shots), keyboard/focus (code: aria-pressed segs, focus-visible rules, hm-grid-scroll tabIndex), reduced-motion (reduceMotion() gates — code).
/mail-desk: loading skeleton (aria-busy — code), error (role=alert retry — code), empty approvals/filter (code), approver-only aside + dry-run banner (code only — seeded user not approver, VERIFY), confirm dialog (code — not rendered in shots), mobile 390 (shot).
Not verified: dark mode (no shots), 320px reflow (shots are 390), focus-visible rendering, approver/decided-approvals UI paths, RTL rendering, live keyboard trap check on alertdialog, actual --cx-ink-3 contrast (computed ~4.2–4.5:1, browser measure pending baseline's VERIFY).
