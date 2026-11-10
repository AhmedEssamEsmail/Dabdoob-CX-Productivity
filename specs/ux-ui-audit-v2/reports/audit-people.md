# Area audit — people (cx-people + people routes + people.css)

Scope: `src/features/cx-people/components/*`, `lib/` (data layer, skimmed), `src/app/styles/people.css`, routes rendering cx-people: `/agents` (agents-page), `/tl-tasks` (tl-tasks-page), `/coaching`, `/meetings`, `/notes`, `/my-actions`, `/one-on-ones`.
Rendered shots (all under `specs/ux-ui-audit-v2/shots/`): agents/coaching/meetings/notes/my-actions/one-on-ones/people-holidays/checkins/my-audits/my-auditor-kpis/tl-tasks at 1440 + 390 (+768).

**Route-ownership boundary (correction to PLAN mapping):** `/people-holidays` → `cx-hub`+`hub.css`; `/checkins` → `cx-queue`+`queue.css`; `/my-audits`, `/my-auditor-kpis` → `cx-quality`+`quality.css`. These were shot-verified as reachable and coherent, but their findings belong to the hub/queue/quality reports — only people-owned surfaces are scored here. Conversely `/agents` and `/tl-tasks` DO render cx-people+people.css and are covered here although PLAN assigned them to other shards.

Baseline compared against: `reports/audit-shared-tokens.md` (3 style generations, dead primitives, .delta inversion, chip/dialog duplication, breakpoint/z/100vh debts — all apply and are not re-litigated here; only people-area instances are listed).

---

## FINDINGS

```
SEVERITY: High
ELEMENT: Two page-shell systems inside the people area
LOCATION: pw.tsx:132-155 (PwShell = .page.pw-page + .page-head/.page-purpose)
  vs components/shared.tsx (re-exports cx-queue Head/LoadError/LinesSkeleton)
  used by agents-page.tsx:578-625 + my-actions-page.tsx:134-136
  (section.cxp.dq-page + .page-sub)
CATEGORY: Layout / Architecture / Design System
ISSUE: 5 of 7 people routes use PwShell (title left, purpose text floated on
  the same row); /agents + /my-actions use the queue dq-page chrome (purpose
  as a sub-line under the title). Verified in shots: notes--1440, meetings--1440
  vs agents--1440, my-actions--1440 — the page-head geometry visibly differs
  within one nav section. The people feature also imports its entire chrome
  vocabulary (Head, LoadError, LinesSkeleton, useSe, fetchJson, useHashParams,
  dayAt) from cx-queue/components/shared — cross-area coupling through a
  6-line re-export shim.
ROOT CAUSE: Two port waves: pw-* pages got a dedicated shell; agents/my-actions
  were ported onto the queue "dq" chrome and never unified.
IMPACT: Same-section pages have different header rhythm (verified rendered);
  people depends on queue internals — a queue refactor silently re-styles
  people pages.
RECOMMENDED FIX: Promote one shared page-shell (PwShell API is the richer one:
  aside slot + narrow variant) into shared/components, migrate the two dq-page
  call sites, retire components/shared.tsx.
CENTRALIZATION OPPORTUNITY: Yes — one <PageShell> for all areas; removes the
  cx-queue→cx-people import edge.
```

```
SEVERITY: High
ELEMENT: CarriedReview duplicated verbatim (action-outcome review editor)
LOCATION: one-on-ones-page.tsx:1600-1699 vs meetings-page.tsx:489-575
CATEGORY: Architecture / Centralization
ISSUE: ~85 lines duplicated: identical REVIEW_OUTCOMES list, OUTCOME_LABELS,
  patch() logic incl. carried→+7d default, identical .pw-carry/.pw-seg/
  aria-label markup. The only diff is a stale variable name (a vs action).
ROOT CAUSE: Copy-paste port of the same closure widget into two pages.
IMPACT: Bug fixes and a11y changes must be made twice; already drifting
  (name divergence). Any third review surface (e.g. action follow-ups)
  invites a third copy.
RECOMMENDED FIX: Extract <CarriedReview actions value onChange disabled/> to
  pw.tsx (or a new people/widgets.tsx) next to PwCombo/PwDialog.
CENTRALIZATION OPPORTUNITY: Yes — 1 component, ~85 duplicated lines removed,
  single a11y contract (aria-label per action title).
```

```
SEVERITY: High
ELEMENT: Oversized multi-responsibility page components
LOCATION: one-on-ones-page.tsx (2,771 lines, 24 components + API facade +
  date/num/anim/spark/tooltip/period systems), tl-tasks-page.tsx (1,023),
  meetings-page.tsx (1,007), agents-page.tsx (934)
CATEGORY: Architecture / Maintainability
ISSUE: Doc hard-limit is 300 lines/component. one-on-ones alone contains the
  API facade, count-up + sweep animation systems, a tooltip engine, a
  sparkline renderer, the scorecard/queue/tickets/team context aside, the
  4-step log form, project CRUD, the schedule lists and the records admin —
  ~9 separable modules.
ROOT CAUSE: Verbatim closure ports kept single-file structure.
IMPACT: Review/audit cost per change is high; a11y fixes must be rediscovered
  per file; testing impossible at widget level.
RECOMMENDED FIX: Split per module: oo-context/* (aside blocks), oo-forms/*
  (proj forms), gantt/* (tl-tasks), records/*. Keep the page file as wiring.
CENTRALIZATION OPPORTUNITY: Partially — reusable pieces surface (OoSpark,
  CountUp, useOoTip, FilterBar, ActionRows, CarriedReview).
```

```
SEVERITY: High
ELEMENT: .btn-line.pw-del-btn — dead selector, danger affordance never applies
LOCATION: people.css:227 `.btn-line.pw-del-btn{color:bad-fg}` + :45 `.btn-line`
  vs one-on-ones-page.tsx:2257, 2633 <Button className="pw-del-btn">
CATEGORY: Design System / Interaction
ISSUE: ui/Button emits only `cx-btn` classes (Button.tsx:22-28); `.btn-line`
  is never on the element, so the intended bad-fg tint on the admin "Delete"
  buttons is dead. Button variant="quiet"-like neutral styling is what renders.
  neighbours `.btn-danger` (:225) and `.btn-small` (:44, :140) are dead for
  the same reason — see dead-CSS finding.
ROOT CAUSE: Legacy `.btn`-family overrides ported without checking which
  class the new Button primitive emits.
IMPACT: Destructive actions lose their visual signal on a primary admin flow
  (delete booking/record); CSS reviewers assume the tint exists.
RECOMMENDED FIX: Retarget to `.pw-del-btn` alone (or use variant="danger" /
  a new `cx-btn--danger-quiet` variant); delete the unreachable selectors.
CENTRALIZATION OPPORTUNITY: Yes — a `danger`-aware quiet variant belongs in
  the shared Button.
```

```
SEVERITY: High
ELEMENT: Three style vocabularies mixed inside one page
LOCATION: agents-page.tsx:727 `.tbl` vs :159/:375/:842 `.cx-table`;
  :707 `.cx-switch` vs `.pw-seg` elsewhere; `.field`/`.field-label`/`.input`/
  `.select` legacy markup through one-on-ones/meetings/tl-tasks vs
  `.cx-field`/`.cx-label` in coaching-page.tsx:65-92 + agents admin form;
  `pill` spans vs `cx-chip`/`PwBadge` on the same screens.
CATEGORY: Design System
ISSUE: Baseline High#2 (3 class generations) is fully reproduced inside this
  area: agents' ranking table uses legacy `.tbl` while its own detail tables
  use `.cx-table`; field markup differs per page; chips render as `pill`,
  `cx-chip`, `pw-badge`, `.tag` with different fills for the same semantics.
  `pw-seg` base styles live unscoped in cx-kit.css:326-330 (not people.css).
ROOT CAUSE: Same as baseline — per-page port waves picked different
  vocabularies; nothing canonical was enforced.
IMPACT: Same widget looks different across people pages (tbl vs cx-table
  padding/typography); restyling hits N selectors.
RECOMMENDED FIX: One family per widget (recommend cx-*): codemod .tbl→cx-table,
  .field→cx-field, .pill/.tag→one chip component.
CENTRALIZATION OPPORTUNITY: Yes — merges into baseline #1/#20 codemod.
```

```
SEVERITY: Medium
ELEMENT: Three tab implementations in-area; <a href="#"> role=tab on /agents
LOCATION: people.css:6-9 (.pw-tabs/.pw-tab buttons, one-on-ones-page:2727);
  agents-page.tsx:688-704 `.tabs` <a href="#" role="tab"> + refresh.css .tabs;
  plus dead .cx-tab / ui/Tabs.tsx (baseline).
CATEGORY: Design System / Accessibility
ISSUE: Two live tab patterns for the same nav-section (pw-tabs button tabs vs
  .tabs fake-anchor tabs). agents' tabs are anchors with href="#" +
  preventDefault — link markup doing button work (4.1.2-adjacent); both
  tablists declare role=tab without tabpanel/aria-controls and without
  arrow-key navigation (APG tab pattern). Selected state is conveyed
  visually in both (underline vs .on) — okay — but semantics differ.
ROOT CAUSE: Different port waves; no shared Tabs contract (baseline's Tabs
  primitive is itself broken).
IMPACT: Inconsistent markup for identical UI; keyboard users get Tab-only
  navigation where arrow keys are expected; the href="#" can land a scraped
  link nowhere.
RECOMMENDED FIX: One tab component (fix the baseline .cx-tab contract) with
  role=tab/aria-selected/tabpanel wiring + arrow keys; convert both sites.
CENTRALIZATION OPPORTUNITY: Yes — with baseline finding #2; ~40 lines.
```

```
SEVERITY: Medium
ELEMENT: RTL (lang=ar) defects: physical positioning in gantt + accents
LOCATION: tl-tasks-page.tsx:430/438/446/455/465/469 (style={{left:%}} on
  .pw-g-off/.pw-bar/.pw-late-ext/.pw-mark/.pw-today), people.css:89
  (.pw-bar-fill inset:0 auto 0 0), :62 (.pw-evidence border-radius 0 r r 0),
  :217 (.pw-booked box-shadow inset 3px 0 0)
CATEGORY: Responsive / Accessibility (dir=rtl is a supported mode)
ISSUE: layout.tsx supports dir=rtl for ar. The gantt positions every bar,
  marker, today-line and off-day hatch by physical `left` while the grid
  columns follow the inline direction — in RTL the bars detach from their
  day columns. Accent stripes with physical radius/shadow stay on the wrong
  side or round the wrong corners.
ROOT CAUSE: Percent-positioned overlay layer authored LTR-only; radius
  shorthand not logical.
IMPACT: Arabic-mode users get a misaligned timeline; minor cosmetic defects
  on evidence/booked cards.
RECOMMENDED FIX: Position via `inset-inline-start` (gantt is already inside a
  direction-aware grid; translate the same % value), swap inset/radius to
  logical props like the rest of people.css.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: ~40 static inline-style layout hacks (arbitrary values + raw tokens)
LOCATION: across all 5 large components; e.g. meetings-page:131,198,376,613,
  670,745,818,850; tl-tasks-page:217,292,295,298,308,327,347,577,581,588,663,
  694,714,768,778,842; one-on-ones-page:660,797,1478,1499,1583,1671,1794,
  1799,1846,1856,1963,1977,2103,2553,2563,2596,2609,2643,2650;
  coaching-page:64,103; my-actions-page:59,93; agents-page:342,598,607,757
CATEGORY: Design System / Spacing
ISSUE: Recurring `style={{marginTop:8|10|12|14|16|18|32}}` px literals
  (14/18 are off the 4px token scale), `gridColumn:'1 / -1'`,
  `maxWidth:160|220|260|280|320`, `flexBasis/flex` numbers,
  `borderTop:'1px solid var(--line)'`, `padding:'8px 0'`,
  `borderBottom:'1px solid var(--line)'`, `listStyle:'none'` ×2,
  `marginTop:-8` negative-margin hack (one-on-ones:797), `border:0` on
  fieldsets (×2), `fontSize:'var(--cx-text-lg)'` to fake an h3 (meetings ×4),
  and primitive-token references `var(--line)`, `var(--age-3)`,
  `var(--signal)`, `var(--band, var(--ink))` that bypass the --cx-* alias
  layer the CSS actually consumes.
ROOT CAUSE: Ported px-faithful markup; no utility classes for the common
  one-off tweaks.
IMPACT: Spacing rhythm drift (the doc's spacing audit target); token-layer
  split-brain (raw vs --cx- aliases); per-site overrides that can't be
  restyled centrally.
RECOMMENDED FIX: Introduce the missing utilities (pw-h3 class, .form-grid
  already exists for gridColumn, a .worklist reset class instead of inline
  listStyle) and codemod static styles to classes/tokens; keep inline styles
  only for computed values (bar widths/positions).
CENTRALIZATION OPPORTUNITY: Yes — ~30 declarations → utilities/tokens.
```

```
SEVERITY: Medium
ELEMENT: Dead + duplicated CSS inside people.css (~15% of the file)
LOCATION: people.css:20 (.pw-empty), :34-37 (.pw-badge — PwBadge exported but
  0 callers), :44 & :140 (.btn-small duplicated verbatim inside the same
  file), :45 (.btn-line — dead per Button finding), :164-175 + :176-192
  (.oo-ribbon/.oo-ribbon-part, .oo-score/.oo-big/.oo-score-side — 0 users),
  :179-181 (.oo-facts — 0), :225-226 (.btn-danger — 0), :231 (.oo-inline — 0),
  :52-56 (.pw-seg hover/active/reduced-motion — duplicates cx-kit:329-330
  verbatim), :129-132 vs :294 (two skeleton rules for the same shimmer),
  :291 (.main>* page-in — verbatim dup of cx-kit:1123), :292-293 (dialog-in
  dup of cx-kit:1340+), :251 (.oo-period-note !important hack).
CATEGORY: Architecture / Design System
ISSUE: Roughly 45 of 294 lines are dead (0 cx-people callers, scoped to
  data-app="people" so unreachable elsewhere) or verbatim re-declares of
  cx-kit globals.
ROOT CAUSE: port kept legacy selectors "just in case"; family-global rules
  were copied into the scoped sheet.
IMPACT: Auditors restyle dead selectors; two skeleton/main/dialog rules can
  drift; the !important is a specificity landmine.
RECOMMENDED FIX: Delete dead selectors; drop the duplicated globals
  (cx-kit already covers .main/.skeleton/dialog/popup/.pw-seg); resolve the
  !important by selector order.
CENTRALIZATION OPPORTUNITY: No (deletion).
```

```
SEVERITY: Medium
ELEMENT: Gantt milestone/off-day data available only as title tooltips
LOCATION: tl-tasks-page.tsx:424-432 (.pw-g-off title="Day off/Public
  holiday"), :448-468 (.pw-mark title=note/file+date), :565-591 (legend
  aria-hidden="true")
CATEGORY: Accessibility
ISSUE: Every .pw-mark/.pw-g-off is an <i> with info only in `title`: not
  keyboard-focusable, not in any accessible name, and the legend explaining
  the symbols is aria-hidden. The task bar itself has a full aria-label
  (:404) — good — but milestone dates/labels, holiday reasons and the legend
  are unreachable for keyboard + SR users (1.1.1/2.1.1-adjacent).
ROOT CAUSE: Decorative-element markup reused for informational markers.
IMPACT: Planned-milestone dates and day-off reasons are invisible without a
  pointer.
RECOMMENDED FIX: Put milestone/off-day info in the row's accessible name or a
  sr-only description list inside .pw-g-row; un-hide the legend and give the
  marks a text alternative (or keep aria-hidden + mirror content in SR text).
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: Undersized pointer targets in gantt rows
LOCATION: people.css:87 (.pw-bar height:22px), :83 (.pw-g-label button
  padding:0 — text-height ~15-18px target)
CATEGORY: Accessibility (2.5.8 target size 24px)
ISSUE: Gantt task bars are 22px tall and the row-title buttons are bare text
  buttons with no padding — both under 24x24 CSS px. The spacing exception is
  arguable for bars (stacked 30px apart, marks interleaved) and does not
  apply to the label button (inline but not inside a sentence). VERIFY on
  rendered hit areas.
ROOT CAUSE: Density-first port before the 24px floor.
IMPACT: Precise tapping needed on the densest interactive surface in the
  area (mobile gantt).
RECOMMENDED FIX: Raise .pw-bar to 24px (or add 1px row padding), give
  .pw-g-label button min-block-size:24px + hit padding.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: Notes capture box steals focus on page load
LOCATION: notes-page.tsx:41-43 (useEffect → boxRef.current?.focus())
CATEGORY: Accessibility / Interaction
ISSUE: The textarea is focused on mount — confirmed by the visible focus ring
  in notes--1440.png / notes--390.png. SR and keyboard users land mid-form,
  skipping the page title and purpose; on iOS it also triggers the <16px
  input zoom (baseline #13).
ROOT CAUSE: Legacy "capture-first" behaviour ported verbatim.
IMPACT: Disorienting entry on a nav-level page; a11y context loss.
RECOMMENDED FIX: Remove the autofocus (or gate it on a hash/#new deep link);
  the save-hint already advertises the shortcut.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: Chip duplication continues in-area: two local Chip() defs
LOCATION: coaching-page.tsx:19-25 (Chip → .pill + data-status),
  my-actions-page.tsx:31-33 (Chip → .pill, no data-status), plus PwBadge
  (pw.tsx:89, .pw-badge) and shared ui/Chip + shell Chip (baseline).
CATEGORY: Architecture / Design System
ISSUE: The same status-span widget exists 4+ ways in this area with divergent
  attributes; status?: string is untyped → a bad status silently renders a
  neutral pill (also used raw as `pill ${tone}` in ~10 call sites).
ROOT CAUSE: Each page redefined the legacy chip instead of sharing.
IMPACT: Attribute drift already visible (data-status on one impl only);
  restyle touches N sites.
RECOMMENDED FIX: Fold into baseline Chip consolidation — one <Chip> with a
  typed status union; delete the locals + unused PwBadge.
CENTRALIZATION OPPORTUNITY: Yes — with baseline #7.
```

```
SEVERITY: Medium
ELEMENT: .pw-h3 referenced but never defined; h3s styled by inline hack
LOCATION: one-on-ones-page.tsx:1794 `className="pw-h3"` (no .pw-h3 rule
  exists — verified by grep); meetings-page.tsx:458,626,705,742
  `className="pw-h2" style={{fontSize:'var(--cx-text-lg)'}}` (pw-h2 IS
  text-lg at people.css:11 — the inline style is a no-op re-declare)
CATEGORY: Design System / Typography
ISSUE: A missing heading level compensated two different ways: a dead class
  name, and an h2-class + redundant fontSize override. Heading sizes are
  right by accident, not by contract.
ROOT CAUSE: Legacy .pw-h3 never ported to people.css.
IMPACT: Dead selector misleads; the meetings h3s get margin/font from a class
  named for h2.
RECOMMENDED FIX: Add `.pw-h3` (or use cx-section__title) and switch both
  hacks to it; delete the no-op fontSize overrides.
CENTRALIZATION OPPORTUNITY: Yes — one class.
```

```
SEVERITY: Medium
ELEMENT: Overlay/collision on mobile: "Open the meeting" button on the
  next-meeting input; "N issue" shell badge covers content
LOCATION: meetings-page.tsx:425-450 (pw-inline: two wide datetime fields +
  button) — rendered overlap visible in meetings--390.png; floating issue
  badge overlaps tl-tasks--390.png / notes--390.png / meetings--390.png
  content (shell-owned, recorded for dedup with shared-shell report)
CATEGORY: Responsive / Alignment
ISSUE: At 390px the pw-inline row's second datetime input wraps under the
  button but they share the same line — the button renders on top of the
  input's right edge. Separately, the fixed-position "1 issue"/"2 issues"
  badge sits over page content at 390px on every people route.
ROOT CAUSE: pw-inline uses align-items:flex-end + flex-wrap without a
  dedicated wrap rule for the button; badge is shell chrome without
  bottom-spacing allowance.
IMPACT: Button visually overlaps a field; badge obscures list content near
  the bottom of long pages.
RECOMMENDED FIX: Give the submit button its own wrap/row at narrow widths
  (.pw-inline>button{flex-basis:100%} under 720px or media rule); badge fix
  belongs to shared-shell.
CENTRALIZATION OPPORTUNITY: Partial — a shared "form action row" wrap rule.
```

```
SEVERITY: Medium
ELEMENT: pw-meter missing a11y wiring in the 1:1 projects list
LOCATION: one-on-ones-page.tsx:1234 (.pw-meter + .cc-sweep-bar, no role/aria)
  vs tl-tasks-page.tsx:966 (same widget with role="img" aria-label)
CATEGORY: Accessibility
ISSUE: Same progress-meter markup, one accessible and one not — the % is
  still in adjacent text (:1232 oo-proj-pct) so impact is low, but the
  contract is inconsistent.
ROOT CAUSE: A11y wiring added on one page, not lifted into the shared class.
RECOMMENDED FIX: role="img" + aria-label everywhere (or progressbar role);
  ideally a <Meter value> shared component.
CENTRALIZATION OPPORTUNITY: Yes — a tiny Meter primitive for the three meter
  families (pw-meter + load meters).
```

```
SEVERITY: Medium
ELEMENT: Invisible editable field (.nt-tag-inline)
LOCATION: people.css:283-284 `.nt-tag-inline:not(:focus):not(:hover)
  {border-color:transparent;background:transparent}` — notes-page.tsx:167-176
CATEGORY: UX / Accessibility
ISSUE: The per-note tag input is borderless/backgroundless until hover or
  focus — it renders as plain placeholder text "Add a tag" on a card that
  already contains real text, so affordance is discoverable only by accident.
ROOT CAUSE: "Clean list" styling ported verbatim.
IMPACT: Users can't tell the field is editable; focus appearance is abrupt.
RECOMMENDED FIX: Keep a subtle border or add a hint icon; at minimum keep
  the placeholder styled as an affordance (dashed underline).
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Required asterisk not hidden from AT + assorted smalls
LOCATION: one-on-ones-page.tsx:1535 `<span className="req"> *</span>`
  (PwCombo:318 does it correctly with aria-hidden); oo-tickets <a
  href={undefined}> (:176) renders a non-link anchor when no ticket URL;
  PwDialog:444-447 `r !== undefined → onClose()` closes also on `false`
  returns; pw-count badge is always warn-toned (:9) even when the count is
  neutral info; agents-page:800 colSpan={15} magic number vs dynamic column
  count; :757 avatar arbitrary 1.7rem/.65rem; nav label "Agent performance"
  vs h1 "Agents" (agents--1440.png); `rel="noopener"` without noreferrer
  (tl-tasks:725); two ad-hoc pub-sub stores (pw.tsx storeValues +
  tl-tasks filterMem) for the same job.
CATEGORY: Accessibility / Design System / Maintainability
ISSUE: Small defects as listed.
ROOT CAUSE: Accretion across port.
RECOMMENDED FIX: aria-hidden the asterisk; render a <span> when href is
  missing; close on truthy only; parameterize pw-count tone; compute colSpan;
  use an avatar size class; align nav label/h1; mirror noopener usage; keep
  one store helper.
CENTRALIZATION OPPORTUNITY: Mixed.
```

```
SEVERITY: Low
ELEMENT: Baseline positives observed in this area (keep)
LOCATION: pw.tsx PwCombo (label+hint+describedby+alerted errors+Escape),
  PwDialog (labelled, required reason for destructive delete, onCancel),
  PwLate/PwErr (role=alert), CountUp+AnimSpan (aria-hidden animated + sr-only
  final, reduced-motion + IntersectionObserver gates), useOoTip (focusable
  svg + aria-label + aria-hidden tip), every pw-seg group has
  role=group+aria-label + aria-pressed, dates localized (Kuwait helpers),
  tables use proper scope/thead, .pw-tab/.pw-chip min-height:var(--cx-target)
  (44px), notes delete uses inline confirm not window.confirm, autosave on
  blur (meetings), Enter-inserts-row + multi-line paste split (ActionRows).
CATEGORY: —
ISSUE: Genuinely good patterns other areas should copy.
RECOMMENDED FIX: —
CENTRALIZATION OPPORTUNITY: These ARE the candidates to promote:
  PwCombo/PwDialog/FilterBar/ActionRows/CarriedReview/CountUp/OoSpark belong
  in a shared widgets module (they are people-scoped today).
```

---

## A. Layout & Alignment Summary
- Components reviewed: 9 component files (~7.2K lines JSX) + people.css (294 lines) + pw.tsx shared layer (540 lines); 10 routes shot-verified at 1440/390 (+768).
- Misaligned elements: 1 rendered (meetings--390 button/input collision); 1 structural (two page-head geometries in one section).
- Overlapping elements: shell "N issues" badge over content at 390px (shell-owned); none inside people markup.
- Spacing violations: ~30 inline px-margin/gap literals, incl. off-scale 14/18px and one -8px negative margin; `.pw-section` used consistently otherwise.

## B. Design-System Violations (severity)
- High: dead `.btn-line.pw-del-btn` affordance; `.tbl` vs `.cx-table` in one page; `.field` vs `.cx-field` across pages; pill/cx-chip/pw-badge/tag coexist; two page-shell systems.
- Medium: third in-area tab system (`.tabs` anchors); `.pw-h3` dead class + h2-class hacks; ~40 static inline-style hacks + raw primitive tokens (`var(--line)`, `var(--age-3)`, `var(--signal)`, `var(--ink)`) bypassing `--cx-*`; ~45 dead/dup CSS lines; `pw-seg` base unscoped in cx-kit while hover rules are people-scoped; `!important` (people.css:251).
- Low: `req` asterisk not aria-hidden (1 site); magic colSpan; arbitrary avatar sizes; nav/h1 label mismatch.

## C. Shared-Components Opportunity Report
- Centralize: `CarriedReview` (2 copies now, near-verbatim), `PageShell` (PwShell→shared), `Chip` (merge 4 impls into baseline consolidation), `Tabs` (fix baseline contract; replace pw-tabs + .tabs), `FilterBar` (promote — already used cross-filter needs), `ActionRows` (multi-row action editor — reusable for 1:1s), `PwCombo` (Other… combo), `PwDialog` (reason-gated destructive confirm), `Meter` (progress), `CountUp`/`OoSpark`/`useOoTip` (chart micro-kit).
- Tokenize/utility: `.pw-h3` heading class; worklist-reset class; form action-row wrap rule; logical-prop conversion for gantt positioning.
- Hooks to extract: `useBusy`/`useFitBusy` (merge — two copies of busy+error+fit), `useOoEnter`/`useCountUp` (shared entrance kit), `usePersistedFilter` + `useStore` (unify the two pub-sub stores).
- Duplicated implementations live in: one-on-ones-page vs meetings-page (CarriedReview), coaching vs my-actions (Chip), tl-tasks vs one-on-ones (pw-meter), people.css vs cx-kit (skeleton/main/dialog/pw-seg).

## D. Technical-Debt Analysis
- Duplicate code: ~6-8% of component JSX is near-verbatim duplication (CarriedReview 85ln, Chip×2, meter/timeline patterns); ~15% of people.css dead or redundant; shared.tsx is a re-export shim adding a cross-area edge.
- Oversize files: 4 files >900 lines; one-on-ones-page is ~9 modules in one file — the largest single debt item.
- Estimated refactor effort: M — mostly mechanical (component extracts, class codemod, CSS deletes); risky part is the tab consolidation (needs the baseline .cx-tab fix first) and gantt RTL conversion (needs visual diff in ar).
- Highest-risk areas: one-on-ones-page.tsx (size × business criticality — the log form drives pay-relevant records); gantt positioning math (shared by RTL fix + target-size fix).

## E. Architecture Scorecard (/10, this area only)
- UI Consistency: 6 — coherent pw-* look across 5 routes, but two shells + vocabulary mixing drag it down.
- Layout Quality: 7 — solid grid/panel system, clean reflow at 390px; one mobile collision + dual page-heads.
- Design System Compliance: 4 — tokens used well inside people.css; markup bypasses them with inline styles and raw primitive vars; dead selectors lie about affordances.
- Component Reusability: 5 — good local primitives (PwCombo, PwDialog, FilterBar, ActionRows) but nothing promoted and key widgets duplicated.
- Responsiveness: 7 — 390px reflows verified; gantt scrolls horizontally as designed; RTL gantt breaks.
- Accessibility: 6 — strong labeling/alerts/focus-tooltip patterns; tab semantics, title-only gantt marks, autofocus steal, undersized targets, missing a11y on one meter.
- Performance: 7 — IntersectionObserver-gated animations, reduced-motion gates, deferred fetches; large client bundles per page, inline-style churn, sweep animations on long lists.
- Maintainability: 4 — 2,771-line file, duplicated widgets, dead CSS, misleading class names.
- Scalability: 5 — pw-* conventions scale, but every new widget lands page-local.

## F. Top 20 Priority Fixes (this area; merged into global Top 20 by PM)
1. Extract `CarriedReview` to a shared people widget (deletes the largest verbatim dup). (H, small)
2. Unify page shell: migrate agents/my-actions off dq-page+queue shared onto one PwShell-family primitive in shared/. (H, medium)
3. Fix `.pw-del-btn` danger styling (retarget selector or add a danger-quiet Button variant); delete dead `.btn-line/.btn-danger/.btn-small` rules. (H, trivial)
4. Split one-on-ones-page.tsx into modules (context aside, log form, records, projects, spark/tip kit). (H, high effort)
5. Consolidate tabs: one shared Tabs (fix .cx-tab) replacing .pw-tabs + `.tabs` anchors; add aria-controls/panels + arrow keys. (M-H, medium — depends on baseline #2)
6. Codemod `.tbl→.cx-table`, `.field→cx-field`, `.pill/.tag→one Chip` across the area. (H, sweep)
7. Delete dead/dup people.css selectors (~45 lines: oo-ribbon, oo-score/oo-big, oo-facts, oo-inline, pw-empty, pw-badge, btn-*, .main/.skeleton/dialog re-declares, pw-seg dup). (M, trivial)
8. Add `.pw-h3` (or cx-section__title) and remove fontSize-override h3 hacks + dead class. (M, trivial)
9. Extract static inline styles to utilities/tokens; keep inline only for computed geometry; drop `var(--line)`-style raw-token refs for `--cx-*`. (M, sweep)
10. RTL gantt: convert `left:%` to `inset-inline-start`; logical radius/inset on .pw-evidence/.pw-booked/.pw-bar-fill. (M, small + ar visual diff)
11. Gantt marks: give .pw-mark/.pw-g-off accessible text; un-hide legend (or sr-mirror). (M, small)
12. Raise gantt targets to ≥24px (.pw-bar, .pw-g-label button). (M, small)
13. Remove notes autofocus (or deep-link-gate it). (M, 1 line)
14. Merge useFitBusy into useBusy (add fit channel) — one busy hook. (M, small)
15. Promote PwCombo/PwDialog/FilterBar/ActionRows/Meter/CountUp+useOoTip to a shared widgets module for reuse (hard-cases, trackers need the same patterns). (M, medium)
16. Fix meetings--390 wrap collision (action-row wrap rule). (M, small)
17. pw-meter a11y parity (role/aria in ProjectRow). (M, 2 lines)
18. nt-tag-inline: keep a visible affordance. (M, small)
19. aria-hidden the stray `req` asterisk; colSpan→computed; render non-link when ticket URL missing; pw-count tone by kind. (L, trivial)
20. Unify the two pub-sub stores + `rel="noopener"`/`noreferrer` consistency; align /agents nav label vs h1. (L, trivial)

Not verified / assumptions: 2.5.8 hit-area measurements (code-derived: 22px bar height declared — target check needs a pointer probe); exact overlap geometry in meetings--390 (single-shot evidence); RTL rendering not shot-verified (no ar-locale capture); keyboard traversal of pw-tabs/pw-seg (code-reviewed only); contrast values inherited from baseline tokens (not re-measured); focus-restore in PwDialog (native dialog semantics relied upon); /checkins, /people-holidays, /my-aud* detail left to owning shards (shots confirmed reachable).
