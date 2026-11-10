# AUDIT-REPORT — ux-ui-audit-v2 (consolidated)

Consolidates `reports/audit-{shared-tokens,shared-shell,hub,quality,queue,people,productivity,desk-ops,perf}.md` per `docs/UX-UI Improvement v2`. Finding format is the doc's OUTPUT FORMAT. Cross-area dedup: each consolidated finding lists its source areas (`[shared-tokens]`, `[shared-shell]`, `[hub]`, `[quality]`, `[queue]`, `[people]`, `[productivity]`, `[desk-ops]`, `[perf]`). Severity re-checked against rendered shots where available; code-proven defects kept regardless of shots.

Coverage: all ~40 routes and all `src/features/**` areas audited; shots exist for most routes at 1440/768/390 (`shots/` + `shots/INDEX.md`). Known gaps: `/my-status` could not be captured (seed admin redirects to `/status-validation`); `/ecosystem` interactive paths, dark mode, RTL rendering, and several behind-interaction states are code-derived (VERIFY flags carried from source reports).

Counts (consolidated): **1 CRITICAL · 19 HIGH · ~60 MEDIUM · ~45 LOW** (source reports: 1 C, ~20 H, ~75 M, ~90 L before dedup).

---

## CRITICAL / HIGH FINDINGS (full blocks)

```
SEVERITY: Critical
ELEMENT: /tph-grid route — wrong app context, ~all page-specific CSS dead
LOCATION: src/app/tph-grid/page.tsx + registry.ts (no "tph-grid" path; only "tph") + AppShell.tsx:133 (PAGES.find ?? PAGES[0])
CATEGORY: Layout / Architecture
ISSUE: /tph-grid is a real Next page but has no registry entry, so the shell
  resolves to "my-day" → data-app="hub". Every productivity.css rule is scoped
  [data-app="productivity"] and never matches: tabs render as plain buttons,
  KPI cards become flat text, the 7-day chart renders as a numbered <ol>,
  grid/tables/dialogs lose all styling. Breadcrumb "Hub / My day", rail
  highlights "My day", title "Dabdoob CX". Verified vs tph--1440.png (styled).
ROOT CAUSE: Legacy URL kept via route re-export without a registry alias;
  unknown-path fallback is "hub context", not 404/redirect.
IMPACT: Any user on /tph-grid (old bookmarks/links) gets a visually broken
  console — unstyled widgets, wrong chrome and nav state.
RECOMMENDED FIX: Prefer `redirect('/tph')` in tph-grid/page.tsx (one canonical
  URL also fixes ?tab= links); alternatively register "tph-grid" in the
  registry via its generator. Add a build-time check that every
  src/app/**/page.tsx path exists in PAGES (prevents this class of bug).
CENTRALIZATION OPPORTUNITY: No (config/registry fix + guard).
SOURCES: [productivity]
```

```
SEVERITY: High
ELEMENT: Unregistered routes /admin/config + /admin/roster — wrong shell identity
LOCATION: AppShell.tsx:132-137 + registry.ts (no admin/config|roster entries);
  src/app/admin/{config,roster}/page.tsx
CATEGORY: Layout / Navigation / Accessibility
ISSUE: PAGES lookup misses → falls back to PAGES[0] (my-day): breadcrumb reads
  "Hub / My day", rail aria-current="page" sits on "My day", app context/title
  resolve to my-day while Roster/Configuration renders. VERIFIED in
  shots/admin__roster--1440.png. Same silent lie for ANY future unregistered
  route. Same root cause as the Critical /tph-grid finding.
ROOT CAUSE: Routes exist that were never added to the PAGES registry; unknown
  paths default to hub context.
IMPACT: Wrong location feedback for AT users (aria-current on the wrong
  destination) on two live admin screens; silent failure mode app-wide.
RECOMMENDED FIX: Register both in PAGES (roles:[admin]) or resolve sub-paths
  to parents: `path === p.path || path.startsWith(p.path + '/')`. Covered by
  the same registry-guard check as the Critical fix.
CENTRALIZATION OPPORTUNITY: No.
SOURCES: [hub] (same mechanism as [productivity] Critical)
```

```
SEVERITY: High
ELEMENT: /tph Overview — KPIs, "Needs attention" and "Team % of cap" rendered TWICE
LOCATION: tph-grid-page.tsx summary (2173-2218) vs Ga→Xa (723-828); rendered tph--1440.png
CATEGORY: Layout / Design System
ISSUE: Pre-tab summary (5 .stat cards, mixbar, "Needs attention" card, spark
  strip) and the Overview tab repeat Team-%-of-cap (3×), Team TPH, Cases
  coverage, Agents on grid, Over cap, Call time and a second "Needs attention"
  heading with the same items — two divergent implementations (k[] vs attn[],
  only Xa's has action buttons).
ROOT CAUSE: Two port generations coexist: legacy Qs summary kept as `summary`
  prop while the new tabbed Overview re-implemented the same blocks.
IMPACT: Same numbers twice with different styling — reads as a bug; doubles
  vertical scroll; drift already present.
RECOMMENDED FIX: Drop the `summary` block (Qs + stat strip); Xa's attention
  list is the better one. Extract <AttentionList> + <KpiStrip> so they can't
  re-diverge.
CENTRALIZATION OPPORTUNITY: Yes — one AttentionList/KpiStrip; ~150 lines.
SOURCES: [productivity]
```

```
SEVERITY: High
ELEMENT: Hardcoded two-column grids via inline style — mobile collision + horizontal scroll
LOCATION: my-status-page.tsx:230 (`1.5fr 1fr`), tph-grid-page.tsx:2048 (`1.4fr 1fr`); rendered tph-grid--390.png (442px > 390 viewport)
CATEGORY: Responsive / Layout
ISSUE: .grid only gains columns via grid-2..5 classes that collapse at 820px
  (refresh.css:183-187); inline gridTemplateColumns overrides the collapse.
  At 390px both pages keep two squeezed columns: mixbar/attention cards
  collide with clipped hour digits on /tph-grid (1.4.10 fail — horizontal
  scroll); flags column crushed to ~55% on /my-status (code-derived — shots
  unavailable, see coverage note).
ROOT CAUSE: Layout written as inline style, unreachable by responsive rules.
IMPACT: Broken mobile layout on both pages; clipping + h-scroll.
RECOMMENDED FIX: Replace with a responsive class (.cols-32/.cols-64 or
  auto-fit minmax()) that collapses to 1fr under 820px.
CENTRALIZATION OPPORTUNITY: Yes — one shared ratio-column utility.
SOURCES: [productivity]
```

```
SEVERITY: High
ELEMENT: Paint grid — ARIA grid with ~1000 tab stops, button semantics stripped, read-only cells unreachable
LOCATION: tph-grid-page.tsx Es (953-1011); productivity.css:84-102
CATEGORY: Accessibility
ISSUE: Every slot is <Button role="gridcell"> in role="grid": no roving
  tabindex, no arrow-key nav (APG grid) — keyboard users tab through
  agents×slots (~20×50) to leave. role="gridcell" on <button> removes button
  semantics for SRs. `disabled={!d.canEdit}` removes every cell from tab
  order in read-only mode — keyboard users can't reach any cell's
  aria-label. onPointerDown preventDefault means mouse painting never
  focuses cells.
ROOT CAUSE: role="grid" adopted as naming pattern without the APG interaction
  model; disabled used to mean read-only.
IMPACT: WCAG 2.1.1-usability failure on the page's core widget; read-only
  keyboard/SR users lose the grid entirely (Caps tab is the only fallback).
RECOMMENDED FIX: Roving tabindex + Arrow/Home/End; keep cells focusable
  (aria-readonly on the grid, not disabled); real gridcell semantics or drop
  role="grid" for a labelled group.
CENTRALIZATION OPPORTUNITY: Yes — shared <PaintGrid> primitive (scheduler's
  hour grid has the same shape).
SOURCES: [productivity]
```

```
SEVERITY: High
ELEMENT: Cases-entry inputs save on every keystroke (controlled by server data)
LOCATION: tph-grid-page.tsx As (1189-1200): <Input value={cell?.tl ?? ''} onChange={save}>
CATEGORY: Interaction / Data integrity
ISSUE: Each keystroke POSTs /api/tph/cases: typing "12" saves "1" then "12";
  value bound to server state → between request and refetch the field can
  snap back and swallow the next digit. No debounce, no blur-commit, no
  pending indicator.
ROOT CAUSE: Legacy instant-save port; controlled by fetched data.
IMPACT: Wrong case counts can persist (first digit lands first); fast typists
  race the reload. Cases tab is a primary TL path.
RECOMMENDED FIX: Local draft state per cell; commit on blur/Enter (or ~400ms
  debounce); isSaving marker on the row.
CENTRALIZATION OPPORTUNITY: Yes — <AutoSaveInput> pattern reusable in
  trackers/scheduler inline edits.
SOURCES: [productivity]
```

```
SEVERITY: High
ELEMENT: Unbounded lists — 652-row worklist (~38,800 px page), no virtualization or paging
LOCATION: status-validation-page.tsx:506-557 (pending), my-status-page.tsx:239-302 (flags), tph "Each agent's day"; shots status-validation--1440 = 1440×38814
CATEGORY: Performance / Layout
ISSUE: .worklist maps every pending flag to a DOM row — 652 buttons (~650 tab
  stops) and a ~39k-pixel document. Default view renders all; agent filter
  exists but isn't the default.
ROOT CAUSE: Port rendered the full array; no cap/virtualization/pagination.
IMPACT: DOM weight + paint cost; unusable scroll; impractical keyboard
  traversal; LCP/INP risk on the review screen.
RECOMMENDED FIX: Virtualize (content-visibility:auto on .pv-item as one-rule
  mitigation) or page/"show 50 more"; default to nearest-due N.
CENTRALIZATION OPPORTUNITY: Yes — shared <VirtualList>/<PagedList> or
  .cv-auto utility; kpi-logs dk-list has the same growth path.
SOURCES: [productivity]
```

```
SEVERITY: High
ELEMENT: Three coexisting style generations / class vocabularies
LOCATION: cx-kit.css (whole), refresh.css (whole), legacy class names —
  reproduced inside [people] (tbl vs cx-table, field vs cx-field, pill vs
  cx-chip/pw-badge), [quality] (.note/.field* inside qa-shared, .seg vs Seg,
  page-head vs dq-head), [productivity] (raw .seg/.input/.tabs beside
  primitives), [queue] (raw .card/.pill/.empty/.stat/.tbl ~15 sites),
  [desk-ops] (.dk-seg/.md-reject/.dk-sm/.input re-added to primitives)
CATEGORY: Architecture / Design System
ISSUE: Three overlapping vocabularies are simultaneously live and
  load-ordered: (a) legacy bare classes (.btn/.field/.input/.note/.tabs/.tbl),
  (b) the .cx-* kit, (c) refresh utilities (.card/.stat/.delta/.pill/.seg/
  .workitem/.md/.agenda/.login-*). Same-semantic pairs render DIFFERENTLY:
  .note vs .cx-note, .empty vs .cx-empty, .card vs .cx-panel, .tabs vs .cx-tab
  vs Tabs.tsx, .seg vs .cx-seg vs .pw-seg, .tbl vs .cx-table vs .trk-table,
  .pill/.tag vs .cx-chip, .agechip d0-d3 vs 7-step [data-age] ramp.
ROOT CAUSE: Each port wave reskinned in place and kept old names "in the
  contract" rather than migrating markup; nothing enforces component usage.
IMPACT: Same widget looks different across pages; every restyle is 2-3× work;
  new code must guess the canonical family. Largest consistency debt in the
  audit — feeds ~15 downstream findings.
RECOMMENDED FIX: Declare one family canonical per widget (recommend .cx-*),
  alias or delete losers, codemod call sites area by area; eslint
  no-restricted-syntax on raw cx-table/cx-panel/card markup or a codemod.
CENTRALIZATION OPPORTUNITY: Yes — ~11 widget pairs to collapse; est. 30-40%
  reduction in live CSS selector count.
SOURCES: [shared-tokens] (canonical); instances confirmed in all feature areas
```

```
SEVERITY: High
ELEMENT: Six of 18 shared primitives have ZERO importers
LOCATION: ui/{Card,Table,Tabs,Modal,Empty}.tsx (TableWrap used once);
  callers hand-write cx-table (21 files), .card/card-pad (36), .cx-note (13),
  .empty-family (~40), .pill (28), raw .btn (13)
CATEGORY: Architecture / Design System
ISSUE: Primitives are 5-line className wrappers with no added behaviour, so
  porters copied markup instead; nothing enforces usage. Only form controls
  (Button 44, Input 31, Select 28, Textarea 19) and Chip/Seg/Toggle/Field are
  genuinely adopted.
ROOT CAUSE: No API worth adopting + no lint gate.
IMPACT: The "design system" is not the system — restyling a surface means
  editing N raw-class call sites; type-level refactors impossible.
RECOMMENDED FIX: Either delete the unused wrappers (honest baseline) or give
  them real APIs (<Table sortable>, <Empty icon action>) and convert call
  sites per area. Strategic decision needed BEFORE the vocabulary codemod.
CENTRALIZATION OPPORTUNITY: Yes — eslint rule or codemod; ~120 call sites.
SOURCES: [shared-tokens]
```

```
SEVERITY: High
ELEMENT: Tabs component — invisible selected state (latent WCAG trap)
LOCATION: ui/Tabs.tsx:72-76 vs cx-kit.css:161-185; .cx-tab contract (458-479) dead
CATEGORY: Design System / Accessibility
ISSUE: Tabs renders cx-btn cx-btn--quiet + cx-btn--primary when active, but
  .cx-btn--primary (161) precedes .cx-btn--quiet (174) at equal specificity →
  quiet wins: transparent bg, muted text. Selected tab is visually identical
  to unselected; only aria-selected differs. Component also ignores the
  .cx-tab CSS contract (itself dead, 0 users). Currently unused → latent trap.
ROOT CAUSE: Variant classes rely on fragile source order; markup predates the
  .cx-tab contract.
IMPACT: Any adopter ships a WCAG-broken tab control (1.4.1/4.1.2-adjacent).
  Meanwhile [people] grew TWO live tab systems (pw-tabs buttons + .tabs
  href="#" anchors — role=tab without tabpanel/aria-controls/arrow keys) and
  [productivity] found a THIRD working impl (tph-tabs, APG-correct); [queue]/
  [quality]/[hub] add .seg-based view-switchers. ~5 tab implementations total.
RECOMMENDED FIX: Fix ONE contract — promote tph-tabs' APG implementation into
  shared <Tabs> (roving tabindex, arrow keys, RTL-aware, scroll-snap); render
  .cx-tab + aria-selected; delete .tabs/.pw-tabs/cx-tab CSS losers.
CENTRALIZATION OPPORTUNITY: Yes — 5→1; fixes [people], [productivity],
  [shared-tokens] together.
SOURCES: [shared-tokens], [people], [productivity]
```

```
SEVERITY: High
ELEMENT: Rail search button — accessible name destroyed in collapsed rail
LOCATION: AppShell.tsx:513-537 (.rail-search) + refresh.css:98-100
CATEGORY: Accessibility (WCAG 4.1.2)
ISSUE: Button name comes from text content; in .rail-off the label and kbd go
  display:none and the svg is aria-hidden → the button has NO accessible name
  in collapsed rail — the primary ⌘K entry point announces as an unnamed
  button. The aria-label pattern exists (.nav-group-label, AppShell.tsx:552)
  but wasn't applied here.
ROOT CAUSE: display:none instead of the .nav-text visually-hidden technique.
IMPACT: Every rail-off screen-reader session loses palette discoverability.
RECOMMENDED FIX: `aria-label={D('Search or jump to…')}` on .rail-search (and
  optionally title); or swap display:none for the .nav-text technique.
CENTRALIZATION OPPORTUNITY: No (1 line).
SOURCES: [shared-shell]
```

```
SEVERITY: High
ELEMENT: Shell buttons carry 2-3 competing button vocabularies at once
LOCATION: ViewAs.tsx:117-119 (`cx-btn btn va-switch`), AppShell.tsx:504/615
  (cx-btn + .nav-toggle/.rail-collapse), raw .btn at AppShell:332,
  ViewAs:46/201, Popups:129-137, OneOnOneAlerts:214-226,
  ErrorBoundary:34; same stacking in [people] (`pw-del-btn`, `btn-quiet` on
  Button) and [desk-ops] (.md-reject, .dk-sm, className="input" on primitives)
CATEGORY: Design System / Architecture
ISSUE: <Button> always emits cx-btn; shell callers append .btn/.nav-toggle/
  .rail-collapse/.va-open/.va-person/.va-switch — standalone contracts that
  re-declare padding/min-height/borders/colors. Same specificity → load order
  decides per property (the exact mechanism that broke Tabs). Five other shell
  buttons bypass the primitive entirely (raw .btn).
ROOT CAUSE: Legacy .btn contract kept "for parity"; stacked rather than
  migrated.
IMPACT: Visual drift already visible (va-switch shows dashed .btn chrome on a
  cx-btn base); restyle must chase ~8 selector contracts; same fragility class
  as the Tabs break.
RECOMMENDED FIX: Extend Button with the needed variants/sizes (quiet, icon,
  danger-quiet — also fixes [people]'s dead .pw-del-btn) and delete the
  per-class contracts; or drop cx-btn from these callers — one system per
  element.
CENTRALIZATION OPPORTUNITY: Yes — one Button API; ~15 call sites.
SOURCES: [shared-shell], [people], [desk-ops]
```

```
SEVERITY: High
ELEMENT: Deployer-facing error copy on My day (env vars + Apps Script names)
LOCATION: myday-google.ts:59-61, my-day-page.tsx:46,1058-1060; surfaced in
  Today/Tomorrow/Mail/Files/Follow-ups via Gr() :147; [productivity] adds
  kpi-logs "Request failed" + same my-day copy as a Medium
CATEGORY: UX copy / Error states
ISSUE: Internal configuration names (GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY, "Apps Script editor", "debugMyDay") render as red error
  text repeated in up to five cards on the home page — VERIFIED
  shots/home--390.png. Non-admins can neither understand nor act on it; it
  discloses infra detail.
ROOT CAUSE: `configured:false` falls through the same md-err channel as
  runtime failures — no copy layer between infra errors and user surfaces.
IMPACT: Primary landing page presents as "broken" with cryptic tooling refs
  whenever Google creds are absent; trust loss on the app's front door.
RECOMMENDED FIX: Map the configured:false envelope to ONE user-facing state
  ("Calendar, mail and Drive aren't connected — the CX admin can finish setup
  in Admin"); keep technical detail for admin role/logs. Same mapper for
  generic "Request failed" errors ([productivity]).
CENTRALIZATION OPPORTUNITY: Yes — a "feature not connected" state component
  + one error-copy mapper, reused wherever an integration is absent.
SOURCES: [hub], [productivity]
```

```
SEVERITY: High
ELEMENT: Up-next banner (.upnext section) — container rule missing from all loaded stylesheets
LOCATION: hub-shared.tsx:647-666 (Nf), rendered /overview for tl/admin;
  children styled in hub.css:194-201; container rule exists only in dead
  globals.css
CATEGORY: Design System / Layout
ISSUE: .upnext CONTAINER rule (grid auto|1fr|auto, surface bg, border, 4px
  accent stripe, [data-live] accent, :focus-visible ring) was dropped in the
  S12 port — only children ported. The section renders as bare text: huge
  "22:00", "Up next", title, meta stacked — no card, no accent edge, no grid.
  VERIFIED shots/overview--1440.png. Missing :focus-visible also means the
  If() jump (hub-shared:60-66) scrolls to an unfocused-looking target.
ROOT CAUSE: Port recovered .upnext-* children but dropped the parent selector
  (it lived in globals.css, no longer imported).
IMPACT: Promoted "your next thing" callout reads as body text — users miss
  it; visible regression on a primary page.
RECOMMENDED FIX: Re-add the container rule in hub.css (grid + surface +
  border-inline-start accent + border-radius + margin-block-end),
  [data-live] accent, :focus-visible ring, 600px single-column fallback.
CENTRALIZATION OPPORTUNITY: No (restore what was lost; ~12 lines).
SOURCES: [hub]
```

```
SEVERITY: High
ELEMENT: Age ladder (.cx-ladder) — page-level horizontal overflow at 390px
LOCATION: hub-shared.tsx:475-501 (Wf), cx-kit.css:656-659; /overview "Open
  tickets by age", Mu board, TL ladder; [queue] uses the same ladder
CATEGORY: Responsive / Accessibility (1.4.10 reflow)
ISSUE: .cx-ladder{display:flex;gap:2px} never wraps; every .cx-ladder__seg
  enforces min-inline-size:2.75rem. 13 age bands → row can't shrink below
  ~600px; nothing between it and the page scrolls. MEASURED:
  shots/overview--390.png is 637×4949 — document scrollWidth 637px at 390px
  viewport (home/ecosystem--390 are 390, overview--768 is 768 → overflow under
  ~640px). Whole page requires 2D scrolling on phones; same defect expected
  on /queue (ladder consumer — queue shard flagged to verify).
ROOT CAUSE: Fixed min segment width × unbounded band count + no scroll
  container; reflow only tested ≥768px.
IMPACT: Primary hub dashboard horizontally scrolls on every phone; table
  column alignment reference lost.
RECOMMENDED FIX: `.cc-chart{overflow-x:auto}` or `.cx-ladder{overflow-x:auto}`;
  optionally drop min-inline-size to ~2rem under @media(max-width:600px).
  One CSS fix covers all ladder consumers.
CENTRALIZATION OPPORTUNITY: Yes.
SOURCES: [hub], [queue]
```

```
SEVERITY: High
ELEMENT: ~350 lines of helpers duplicated verbatim inside quality-analytics-page.tsx
LOCATION: quality-analytics-page.tsx:36-241, :95-107, :1700-1890, :1871-1890
  vs qa-shared.tsx (QA_* maps, QaLink, DrillSection:1357, Count:1056-1158)
CATEGORY: Architecture / Design System
ISSUE: The file imports from './qa-shared' then redefines ~17 of its symbols
  locally (CONF/CONF_T, TREND_G, qaMargin, qaPctl, qaVerdictStatus, WHY_V,
  BASIS_L, ATTN, qaPeriodLabel, qaDowName, qaCountBand, qaVsText,
  QaLinkBtn≈QaLink, BasisSeg≈:1335, Drill≈DrillSection ~170 lines,
  Count stack ~105 lines — differing only in useEffect vs useLayoutEffect).
ROOT CAUSE: Analytics closure ported verbatim with embedded helpers; the
  qa-shared/qa-shared2 merge deduped the other nine closures but not this one.
IMPACT: ~17% of this 2,014-line file is dead weight; two Drill/Count/BasisSeg
  implementations already drifting; every shared fix must be ported twice.
RECOMMENDED FIX: Delete local copies; import QaLink/BasisSeg/DrillSection/
  Count and QA_* vocabulary from './qa-shared'. Keep only unique pieces
  (SparkChart, ColsChart, Coverage, Spread).
CENTRALIZATION OPPORTUNITY: Yes — import sweep; file −~350 ln → ~1650.
SOURCES: [quality]
```

```
SEVERITY: High
ELEMENT: StatusPill / ScorePill / pillCls — fourth status-badge implementation
LOCATION: disputes-page.tsx:23-36, ctls-page.tsx:26-39 (verbatim copies) vs
  qa-shared.tsx:233-254 (StatusChip/ScoreChip → .cx-chip); plus [people]'s two
  local Chip() defs + PwBadge, and shell/ui.tsx third Chip (baseline)
CATEGORY: Design System / Architecture
ISSUE: disputes/ctls define an identical pillCls/StatusPill/ScorePill triple
  re-implementing StatusChip/ScoreChip on refresh .pill. Same status
  semantics render two different visuals on sibling routes: .cx-chip on
  /audit-queue, /quality-scores, /quality-analytics, /my-audits, /kb-gaps vs
  .pill dot+ tint on /disputes and /ctls — VERIFIED in shots (dot pills vs
  square chips on the same statuses). `status?: string` untyped → typos
  silently render neutral chips.
ROOT CAUSE: Per-closure porting kept legacy .pill markup; chip consolidation
  never completed (baseline: .pill vs .cx-chip pair).
IMPACT: Users read two badge dialects for identical states; restyle needs two
  sweeps; ~60+ duplicated lines; attribute drift already present.
RECOMMENDED FIX: Delete pillCls/StatusPill/ScorePill → StatusChip/ScoreChip;
  [people] locals + unused PwBadge → same; one <Chip> with typed status union
  ('neutral'|'info'|'ok'|'warn'|'bad') — the single chip decision covers
  [shared-tokens], [quality], [people], [desk-ops] Badge, [queue] Badge.
CENTRALIZATION OPPORTUNITY: Yes — 4+ implementations → 1.
SOURCES: [quality], [people], [shared-tokens], [desk-ops], [queue]
```

```
SEVERITY: High
ELEMENT: Mail-desk SLA table — "flags" cell breaks out of the table grid
LOCATION: mail-desk-page.tsx:244 (<td className="md-flags">) + desk.css:72
  (.md-flags{display:flex}); rendered mail-desk--1440.png, --390.png
CATEGORY: Layout / Alignment / Responsive
ISSUE: display:flex on a <td> removes its table-cell participation. The "Open
  past due" badge detaches from its column alignment and sits pushed against
  the card's right edge at 1440px; at 390px the badge is clipped mid-pill at
  the card edge (reachable only via .dk-scroll h-scroll). Its column header
  is empty (sr-only "Flags") — sighted users see an unlabeled, misaligned/
  clipped element carrying the row's most actionable info.
ROOT CAUSE: Flex layout applied directly to a table cell instead of an inner
  wrapper; header cell left textually empty.
IMPACT: Visible layout failure on the page's only data table; status badges
  break/clip.
RECOMMENDED FIX: Remove display:flex from the td (wrap badges in inner div);
  give the th visible text or keep sr-only but let the cell rejoin the grid.
  Re-shot at 390. Related: .dk-table needs min-width + .dk-scroll needs
  tabindex/role (see Medium summary).
CENTRALIZATION OPPORTUNITY: No (one-rule fix; scroll-wrap pattern is shared —
  see TableScroll in Medium summary).
SOURCES: [queue], [desk-ops]
```

```
SEVERITY: High
ELEMENT: Two page-shell systems inside the people area (+ cross-area page-head sprawl)
LOCATION: pw.tsx:132-155 (PwShell = .page.pw-page + .page-head/.page-purpose)
  vs cx-queue shared Head/LoadError (dq-page chrome) used by
  agents-page:578-625 + my-actions-page:134-136; same pattern re-implemented
  in [quality] audit-queue/qa-forms (3 header variants), [queue]
  shared.tsx Head vs mail-desk Shell vs unused PageHead, [productivity]
  status-validation local Page + hand-written .page-head ×3, [hub] Vf()
  unused while overview/admin hand-write .page-head/.page-sub
CATEGORY: Layout / Architecture / Design System
ISSUE: 5 of 7 people routes use PwShell; /agents + /my-actions use the queue
  dq-page chrome — VERIFIED: notes/meetings--1440 vs agents/my-actions--1440
  show different page-head geometry within one nav section. People also
  imports its chrome vocabulary (Head, LoadError, LinesSkeleton, useSe,
  fetchJson, useHashParams, dayAt) from cx-queue via a 6-line re-export shim —
  a queue refactor silently re-styles people pages. Across the app the page
  header exists in ≥4 class contracts (.page-head/.page-sub refresh,
  .dq-head/.page-purpose cx-kit, PwShell, local Page) with PageHead primitive
  re-exported but unused.
ROOT CAUSE: Two+ port waves; PageHead added centrally but never adopted.
IMPACT: Header rhythm drifts per page/section; cross-area coupling; fixes to
  one shell don't reach siblings; off-scale 1.4rem margin straggler lives in
  two of the contracts.
RECOMMENDED FIX: Promote ONE <PageShell title sub aside> (PwShell API is the
  richest) into shared/components; migrate all dq-page/Page/local-P copies;
  retire the cx-queue→cx-people import edge; delete the duplicate 1.4rem rule.
CENTRALIZATION OPPORTUNITY: Yes — one component removes 4+ implementations
  and ~200 lines/page-family.
SOURCES: [people] (High), [quality], [queue], [productivity], [hub] (Mediums)
```

```
SEVERITY: High
ELEMENT: CarriedReview duplicated verbatim (action-outcome review editor)
LOCATION: one-on-ones-page.tsx:1600-1699 vs meetings-page.tsx:489-575
CATEGORY: Architecture / Centralization
ISSUE: ~85 lines duplicated: identical REVIEW_OUTCOMES, OUTCOME_LABELS,
  patch() logic incl. carried→+7d default, identical .pw-carry/.pw-seg/
  aria-label markup. Only diff is a stale variable name.
ROOT CAUSE: Copy-paste port of the same closure widget into two pages.
IMPACT: Bug fixes and a11y changes must be made twice; already drifting; a
  third review surface invites a third copy.
RECOMMENDED FIX: Extract <CarriedReview actions value onChange disabled/> to
  pw.tsx (or people/widgets.tsx) next to PwCombo/PwDialog.
CENTRALIZATION OPPORTUNITY: Yes — 1 component, ~85 lines removed, single a11y
  contract.
SOURCES: [people]
```

```
SEVERITY: High
ELEMENT: Monolithic page components — no memo boundary anywhere
LOCATION: one-on-ones-page.tsx (2,771 ln, 54 useState, ~9 separable modules),
  ecosystem-page.tsx (2,663), tph-grid-page.tsx (2,244),
  audit-queue-page.tsx (2,125, 45 useState), quality-analytics-page.tsx
  (2,014); 40 .tsx files exceed the doc's 300-line limit; repo-wide
  React.memo=0, useMemo/useCallback=73 vs useState=620
CATEGORY: Architecture / re-renders
ISSUE: Single components own 16-54 pieces of state; any keystroke/filter/
  dialog toggle re-renders the full 1-3k-line tree including every row/cell.
  No memo boundary between a state change and the deepest table row. [people]
  flags the same files under the >300-line/component rule ("~9 separable
  modules" in one-on-ones alone).
ROOT CAUSE: Verbatim closure ports kept each legacy page as one function.
IMPACT: Input latency on dense pages (tph grid, audit queue) scales with tree
  size; INP budget at risk; review/audit cost per change is high.
RECOMMENDED FIX: Split each >800-line page into data/loader + pure
  presentational sub-trees; wrap row/cell renderers in React.memo; move
  derived collections into useMemo. Prioritize audit-queue + tph-grid +
  one-on-ones + quality-analytics + ecosystem.
CENTRALIZATION OPPORTUNITY: Yes — shared DataTable/list-region memo pattern
  in shared/components/ui; ~9 files.
SOURCES: [perf], [people]
```

```
SEVERITY: High
ELEMENT: `.btn-line.pw-del-btn` — dead selector, danger affordance never applies
LOCATION: people.css:227 `.btn-line.pw-del-btn{color:bad-fg}` + :45 `.btn-line`
  vs one-on-ones-page.tsx:2257,2633 <Button className="pw-del-btn">
CATEGORY: Design System / Interaction
ISSUE: ui/Button emits only cx-btn classes; .btn-line is never on the element,
  so the intended bad-fg tint on admin "Delete" buttons is dead — destructive
  actions on a primary admin flow render neutral. Neighbours .btn-danger
  (:225) and .btn-small (:44,:140) are dead for the same reason.
ROOT CAUSE: Legacy .btn-family overrides ported without checking which class
  the new Button primitive emits.
IMPACT: Destructive actions lose their visual signal; CSS reviewers assume
  the tint exists.
RECOMMENDED FIX: Retarget to .pw-del-btn alone (or add a `danger`-aware quiet
  Button variant — shared with the button-vocabulary fix); delete unreachable
  selectors.
CENTRALIZATION OPPORTUNITY: Yes — Button variant.
SOURCES: [people]
```

```
SEVERITY: High
ELEMENT: Duplicated page scaffolding — 4 cx-desk pages carry ~150-line verbatim clones (~600 lines)
LOCATION: kb-tracker-page.tsx:36-205, kpi-logs-page.tsx:33-127,
  mail-desk-page.tsx:79-206, tl-performance-page.tsx:75-238 (Skeleton/Failed/
  Shell/Badge/ErrMsg/useLoaded/useRun/DAYS+MONTHS+utc3+B+V date helpers/
  Count); same idiom again in cx-queue shared.tsx, cx-productivity
  status-validation local Page + kpi-logs kit, cx-people PwErr/PwSkel/PwLate
CATEGORY: Architecture / Design System
ISSUE: The same 7 helpers + date-format trio are verbatim clones in every
  desk page; copies have DIVERGED — tl-performance's Count has
  prefers-reduced-motion + arDigits Arabic support, kb-tracker's has neither
  (animates under reduced-motion, Western digits in ar mode). Mail-item badge
  logic copy-pasted between mail-desk SlaTr and tl-performance MailItem.
  shared/platform/time.ts already exports Kuwait date helpers — re-implemented
  locally. See also consolidated PERF findings below (fetchJson ×4,
  useSe-loaders ×4, /api/options caches ×5, StatusChip ×3, skeleton/error
  sets ×3 — ~1,000+ duplicated lines across *-shared modules, est. 25-35%).
ROOT CAUSE: Each legacy port copied the bundle boilerplate; no shared
  desk-level module was ever extracted; canonical shared/lib added later,
  never adopted.
IMPACT: Fixes must be made 4× (and were already missed once — kb-tracker Count
  is the older revision); divergent behaviour (useSe caches across mounts,
  useLoaded doesn't); cross-feature coupling (people→queue bundle).
RECOMMENDED FIX: Extract dk-shared.tsx / promote to shared/components/ui:
  <PageShell>, <Skeleton>/<Failed>/<ErrMsg>, <Badge>→shared Chip, useLoaded,
  useRun, single Count (canonical = tl-performance RM-guarded copy) + Kuwait
  date helpers delegating to shared/platform/time.ts. Keep call sites via
  *-shared re-export barrels. Delete the 3 extra fetchJson defs (keep
  shared/lib/fetch-json.ts + FetchError + postJson convenience) and merge the
  5 /api/options inflight Maps into one useOptions(listKey).
CENTRALIZATION OPPORTUNITY: Yes — ~600→~150 lines in cx-desk; ~1,000 lines
  repo-wide across *-shared modules; kills the divergence class.
SOURCES: [desk-ops] (High), [perf] (High ×3: options×5, fetchJson×4,
  loaders/skeletons/chips), [queue], [productivity], [people] (Mediums)
```

```
SEVERITY: High
ELEMENT: /kb-gaps page — horizontal overflow at every viewport [cross-area: cx-quality]
LOCATION: route /kb-gaps → cx-quality/components/kb-gaps-page.tsx;
  shots/kb-gaps--{390,768,1440}.png measured 1202 / 1205 / 1452 px wide
CATEGORY: Responsive / Layout
ISSUE: Page renders ~1200-1450px wide regardless of viewport: at 390 users
  must scroll ~810px to reach the STATUS/"Mark added to KB" column; even at
  1440 the page is 12px over and the "9 not yet in the KB" counter is clipped.
  Cause: unbroken percent-encoded Freshdesk URLs (300+ chars) in GAP cells
  expand the table — cells lack overflow-wrap/min-width containment.
ROOT CAUSE: Long unbroken URL strings inside table cells without
  overflow-wrap:anywhere / table-layout:fixed / scroll wrapper.
IMPACT: WCAG 1.4.10 reflow fail at mobile; primary action column unreachable
  without h-scroll even on desktop.
RECOMMENDED FIX: Scrollable table wrapper + overflow-wrap:anywhere (or
  word-break) on URL text; truncate displayed URL (path tail or link icon).
  Owner: quality fix shard; use the shared TableScroll pattern.
CENTRALIZATION OPPORTUNITY: Partial — the scroll-wrap is shared
  (.dk-scroll/.trk-table-wrap/.cc-chart → TableScroll).
SOURCES: [desk-ops] (route-level), [quality]
```

```
SEVERITY: High
ELEMENT: /admin page — mobile overflow + 16.8Kpx unstructured page [cross-area: cx-hub]
LOCATION: route /admin → cx-hub/components/admin-page.tsx; shots/admin--390.png
  (490px wide = 100px overflow, 244,165px tall), admin--1440.png (16,811px tall)
CATEGORY: Responsive / Layout / Architecture
ISSUE: (a) 490px wide inside 390 viewport → 100px horizontal overflow (1.4.10
  fail; some form control/table in settings sections exceeds viewport).
  (b) ~16,800px tall at 1440 — dozens of settings sections, no in-page nav,
  anchors, accordions or grouping; finding a setting is a multi-screen
  scroll. admin__config shows the same flat-scroll disease (~13,100px).
ROOT CAUSE: Single flat page ported 1:1 from the legacy Admin dump; some wide
  control unbounded.
IMPACT: Broken on mobile; poor discoverability on the highest-privilege page.
RECOMMENDED FIX: (a) constrain the overflowing control (min-width:0 +
  overflow-wrap on widest section); (b) sticky section index or
  accordion/Tab grouping (Roster, Dropdowns, Jobs, Email…). Shared
  <SettingsSection id title> + in-page TOC reusable by /admin/config.
CENTRALIZATION OPPORTUNITY: Yes — SettingsSection + TOC pattern.
SOURCES: [desk-ops] (route-level), [hub]
```

```
SEVERITY: High
ELEMENT: three.js scene (Scene3D + 7 jsm modules) — eager first-load chunk
LOCATION: ecosystem-page.tsx:12-20, route src/app/ecosystem/page.tsx
CATEGORY: Performance / bundle
ISSUE: `import * as THREE` + Sky/Water/EffectComposer/RenderPass/
  UnrealBloomPass/OutputPass/OrbitControls are static top-level imports of a
  'use client' module; route imports statically. Repo-wide next/dynamic/
  React.lazy count = 0 → the whole three.js tree (~2.1MB source on disk;
  ~600KB+ min, ~160KB+ gz est.) ships in /ecosystem's first-load chunk,
  parsed/evaluated before first paint on a page that also mounts a WebGL
  loop + two setInterval pollers.
ROOT CAUSE: Verbatim legacy port kept the monolith; no code-split boundary.
IMPACT: Largest single-route JS payload; parse/eval blocks INP on low-end
  devices for one admin-only route.
RECOMMENDED FIX: Extract Scene3D canvas subtree into ecosystem-scene.tsx;
  `next/dynamic(() => import('./ecosystem-scene'), { ssr:false })` from a
  small client wrapper → async chunk fetched only when the route opens.
CENTRALIZATION OPPORTUNITY: No.
SOURCES: [perf]
```

```
SEVERITY: High
ELEMENT: Entire page tree — client-only rendering + post-hydration fetching waterfall
LOCATION: all src/features/**/components/*-page.tsx; layout.tsx:17
  (export const instant = false)
CATEGORY: Architecture / performance
ISSUE: 98.1% of .tsx lines (36,366/37,073) under 'use client'; route page.tsx
  are 7-line re-exports. Every page: HTML shell → JS hydrate → useEffect →
  fetchJson(cache:'no-store') → paint data (3-stage waterfall). Zero server
  components read data; __CC_BOOT__ inline bootstrap is the only payload
  optimization.
ROOT CAUSE: Legacy GAS parity port — SPA architecture carried over 1:1; RSC
  data loading never adopted.
IMPACT: LCP gated by full JS hydration + uncached REST round-trip on all
  ~40 routes; doubles time-to-data vs streaming server data.
RECOMMENDED FIX: For read-heavy pages (overview, quality-scores, analytics)
  hoist the initial useSe fetch into the route's server component and pass
  initialData into the client feature component (keeps verbatim components,
  removes one round-trip). Long-term: cacheComponents for cacheable GETs.
CENTRALIZATION OPPORTUNITY: Yes — shared usePageData(key, loader, initial?)
  contract covering the 4 loader variants (see scaffolding block).
SOURCES: [perf]
```

---

## MEDIUM / LOW FINDINGS — summarized per area (full detail in source reports)

### [shared-tokens] baseline (reports/audit-shared-tokens.md)
- **Medium:** globals.css (~90KB) + legacy-apps.css (189KB) dead unimported sheets with stale "source of truth"/"loads last" headers (~282KB dead source); cx-seg/cx-toggle/cx-switch invisible disabled state (no span-level :disabled); Field missing aria-invalid propagation (1-line fix, styled invalid border never shows via primitive); --cx-ink-3 borderline contrast ~4.2-4.5:1 on real text (table THs, kickers, hints — VERIFY measured); off-scale typography/spacing literals (.6563/.68/.72/.8438rem, weight 650, ~25 decls) + duplicate .page-head rules (1.4rem vs --space-5); untokenized z-index scale (5/6/30/40/45/60); inconsistent breakpoints (1180 vs 1200, 900, 820/821, 560/600/480); 100vh without dvh fallback (28 occurrences — mobile rail/login/page-fill clip); --page-max:none → unbounded ultrawide stretch; form controls 13px → iOS focus zoom; two simultaneous entrance-animation systems (page-in + cx-enter); Chip×3 + untyped status; dialog selector sprawl (5 contracts, .cx-dialog* + Modal.tsx dead); small-button quadruplication (.btn-small/.cx-btn--small identical, .cx-btn--sm 1.9rem); RTL physical-property leftovers (.agenda, .stat tone stripe, .trk-misfit).
- **Low:** .delta up/down semantic inversion; .cx-toggle display conflict; phantom --cx-muted var; duplicate table font-size rule; .toasts rail margin; .cx-need pop shadow; Seg `required` spread onto div; SiteChrome /auth prefix edge case; Modal/Tabs API gaps (no labelledby/light-dismiss, no tabIndex on panels); dead .toasts/.brand-mark/.nav-ext selectors; --qg-* phantom tokens in .nav-ind.
- Positives to keep: pointer:coarse target bump, forced-colors ring, reduced-motion zeroing, [data-status]/[data-age] token triples, focus-visible on all interactive classes, Field label+describedby wiring.

### [shared-shell]
- **Medium:** .nav-group-label ~17px target <24px AA floor (join --cx-target list); notification bell = 7px dot only, aria-label never changes, dead click when empty; document.title static per app — all 40 routes share ~8 titles (WCAG 2.4.2); half the shell ignores D() i18n (ViewAs banner, reminders, 1:1 alerts, error screens, topbar tooltips stay English in ar/RTL mode); palette focus always restores to .rail-search not the invoker (2.4.3); toasts fixed 4s expiry, no pause/dismiss/close, untyped tone; dialog.popup has no visible ::backdrop scrim (vs palette's --scrim .5 — two overlay systems); va-banner-error ~4.0:1 contrast on amber (VERIFY); topbar crumb duplicates in-page h1 on all routes + muted current + phantom --cx-topbar-height/.cx-dock offset; oo-alerts aria-label on plain div (needs role=region), assertive live on 'soon' alerts, no mute control ever, stale countdown, hardcoded English; ~15 off-scale literals in shell chrome.
- **Low:** palette unranked fuzzy match + hard 20-item slice + group-role/footer-hint gaps; dead shell CSS + phantom tokens; rail-off .brand-sub remnant + double active-nav highlight; mobile polish (kbd hint on touch, .icon-btn 32px vs 44px convention, decorative avatar); latent traps (LoadError dead-button path, PageHead hardcoded id, nav-ind re-measure every render, toast setTimeout uncleaned, BootSplash z-50 literal).
- Positives: skip link, aria-current/expanded, combobox+activedescendant palette, native-dialog ViewAs, deliberate focus-restore attempt, BootSplash pre-paint + reduced-motion.

### [hub]
- **Medium:** admin-config/roster second code generation — raw fetch, unchecked res.ok, load errors render as empty states, save failures invisible, `required` never enforced (not in <form>); same pages' a11y gaps (nested <main> inside AppShell's <main>, th without scope, unlabeled inline-edit Inputs, .card-title divs vs h2 — also in my-day/people-holidays); .md-status-blocked pill ≈4.25:1 measured (edge token as text bg); /ecosystem no <main>/skip link + colour-only node state at rest; inline <style> OV_CSS + scattered inline props bypassing hub.css; vocabulary splits (Vf header unused, .page-sub vs .page-purpose, .seg+.on vs .pw-seg aria-pressed — third seg impl); /admin "Not built yet." placeholder + unbounded settings list (~16.8K px, mobile blow-up VERIFY); hub.css instances of baseline debts (100vh sidebar, 560/600px breakpoints, ~15 px literals, dead [data-accent-preview] dark block).
- **Low:** .md-err role="alert" inconsistency; inert button-role ladder segs with cursor:pointer; hardcoded data-tone="ok"; fixed heading ids (oldest-h, md-mail, upnext-h); dead href="#" in WaitingCard; `#/path` hash links (HashShim-dependent, nested paths silently dead); ecosystem 2,663-line minified mega-file + status palette declared twice; /agents h1 "Agents" vs registry "Agent performance"; analytics--390 x-axis label crowding (queue-owned).
- Positives: hub-shared is a real shared layer; count-up rAF + IntersectionObserver done properly; eco3 has real buttons/aria-labels/Escape/reduced-motion.

### [quality]
- **Medium:** .workitem button 15-line inline style duplicating refresh.css:409-412 + off-scale literals, kills :hover, selected state in JS; To-do filter raw .seg buttons not Seg primitive (two seg impls on one page); page-head ×3 variants (audit-queue section.cxp.dq-page, qa-forms manual, QaPage→PageHead); .tbl tables ×3 beside .cx-table ×20 (no .cx-tablewrap → mobile squeeze, kb-gaps overflow is the High above); .qa-q <tr> display:flex inside .tbl — header/cell columns can't align (code-derived); WeekCoverage day cells title-only tooltips unreachable by keyboard (analytics Coverage does it right); focus loss on Start audit (disabled button → body) and on Cancel; .note vs .cx-note + .field* vs .cx-field* double vocabulary inside qa-shared/audit form; `#/quality-*` hash links + link-styled-as-button.
- **Low:** dead hooks (.qa-form__facts/.qa-pass__note/.qa-health/.qa-cov-wrap/.qa-unmatched/.qa-access-log, [data-skipped] styled nowhere, .qa-sampling generic skin); skeleton under LoadError on /qa-forms; strip meta truncates dates on long names; calibration 4-colour series limit; window.confirm ×2 + ungated smooth scroll; StatusChip raw-key fallback; empty TrendChart figure + sparse qs-hero.
- Positives: QaPage busy+labelledby, SortTh aria-sort, ListSelect full label contract, Count reduced-motion+sr-only, AuditForm fieldset/legend/aria-live, DrillSection focus-to-heading, tabIndex+aria-label coverage cells, data-status token triples.

### [queue]
- **Medium:** "Age mix" column fixed 9rem inline width + .dq-agebar 9rem — table compresses instead of scrolling at 390 (names wrap 4-5 lines, ~35% width); mixbar age segments render count labels on sliver segments at 390 (overlapping digits); "Other teams" divider th scope="colgroup" wrong (needs rowgroup/two tbodys); duplicated data/feedback plumbing (two fetchJson, useSe vs useLoaded, useRun, mail-desk hand-rolled Skeleton/Failed/Badge/ErrMsg vs shared equivalents — consolidated into the scaffolding High); queue.css ~20 off-scale literals + ad-hoc breakpoints (1180 vs 1200 collision live here) + lone !important; mail-desk mobile table crams unbreakable strings (mid-token email breaks, 10-line rows); --cx-ink-3 borderline on all 9 table headers + .sub lines + card hints (baseline token fix covers).
- **Low:** selected filter = solid ink pill (heaviest selected treatment, bypasses aria-pressed hooks); "All ages" reset styled as non-interactive .pill on a <button>; misc (raw #/aging href, inline width style, dead .cxp class, window.confirm, STATUS_* undefined→empty Badge); queue.css stragglers (scoped .sr-only dupe, .hm-dialog = 6th dialog contract, physical props, .6em≈8px sup); .delta/.stat-stripe/.dq-groupbreak/double-animation baseline cross-refs active here.
- Positives: aria-pressed+keyboard mixbar, role=img AgeBar, labelled search, disabled Export, role=status refresh feedback, reduced-motion gating, hm-grid-scroll tabIndex+role=region.

### [people]
- **Medium:** three tab implementations in-area (.pw-tabs buttons, .tabs href="#" anchors role=tab without tabpanel/arrow keys — consolidated into the Tabs High); RTL gantt defects — physical `left:%` positioning detaches bars/markers/today-line from day columns in ar mode + physical radius/shadow on .pw-evidence/.pw-booked/.pw-bar-fill; ~40 static inline-style hacks (off-scale 14/18px margins, gridColumn:'1 / -1', var(--line)/var(--age-3) raw primitive tokens bypassing --cx-*); ~45 dead/dup people.css lines (~15%: .pw-empty, .pw-badge, .btn-small×2, .btn-line, .oo-ribbon/.oo-score/.oo-facts/.oo-inline/.btn-danger, .pw-seg dup of cx-kit, skeleton/main/dialog re-declares, !important); gantt milestone/off-day data title-only on <i> marks, legend aria-hidden (keyboard/SR unreachable); undersized gantt targets (.pw-bar 22px, .pw-g-label bare text <24px); notes textarea autofocus steals focus on load (visible ring in shots); Chip×2 local defs + PwBadge (folds into chip High); .pw-h3 referenced never defined + meetings h3s via pw-h2+redundant fontSize; meetings--390 button/input collision (pw-inline wrap); pw-meter a11y wiring inconsistent (1:1 projects list missing role/aria); .nt-tag-inline invisible-until-hover editable field.
- **Low:** req asterisk not aria-hidden (1 site); <a href={undefined}> non-link anchor; PwDialog closes on `false` returns; pw-count always warn-toned; colSpan={15} magic; arbitrary avatar sizes; nav "Agent performance" vs h1 "Agents"; rel="noopener" w/o noreferrer; two ad-hoc pub-sub stores.
- Positives: PwCombo/PwDialog/FilterBar/ActionRows are genuinely good — promote to shared widgets; CountUp/AnimSpan reduced-motion+IO gates; useOoTip focusable svg; pw-seg groups all labelled.

### [productivity]
- **Medium:** two Seg radiogroups share name="tph-brush" → one merged radio group (arrow-key nav jumps between visual groups); sparkline/bar widgets keyboard-focusable with no visible focus ring + hover-only values (.pv-spark circles, .spark/.mixbar bars — 4 chart impls); stateful UI not in URL/history (tph date in ref, status-validation view/agentFilter, analytics week — reload loses context, Back misbehaves); page-shell+infra re-implemented per page (local Page, kpi-logs kit, hand-written .page-head — consolidated into shells High); WI_ROW inline override + dual selected-state mechanisms; 5 tab impls / 3+ seg impls + raw .input (consolidated into Tabs/vocabulary Highs); .md master-detail right column empty until selection (no placeholder, no no-results row); destructive "Remove" without confirm/undo (kpi-logs HR records) + dev-facing error copy ("Request failed", env vars — consolidated into error-copy High); status-validation row text clipped at 26rem column edge.
- **Low:** CHANNEL_LABELS.wa="waiting address" suspect (VERIFY vs source); inline-style sprawl (~15 sites, .card-title margin:0 ×10); agents-by-hour matrix hardcodes 09-21 + 09:30 label; dead dispute forms (~160 lines shipped to every visitor) + Va(d.table) computed twice + setTimeout reload hack; misc (exported generic `Page` name, B() hand-rolled date fmt vs Intl, .page-purpose vs .page-sub, cursor:crosshair on disabled cells, AgentDialog no light-dismiss, pv-lane axis coupling).
- Not verified: /my-status shots are actually status-validation content (seed redirect) — its grid/flags findings are code-only; CHANNEL_LABELS.wa needs source-data confirmation.

### [desk-ops]
- **Medium:** mail-desk SLA table crushed not scrolling at 390 (.dk-table width:100% no min-width → .dk-scroll never engages; subject wraps mid-word, flags clipped — complements the md-flags High); .dk-scroll horizontally-scrollable regions not keyboard-focusable (no tabindex/role — WCAG 2.1.1; .trk-table-wrap does it right); rating slider fill always green regardless of zone (below/meets still render ok-edge — colour asserts "ok" while value asserts "below"); "Leave out" submit button floats into form grid column 4 (visible defect kpi-logs--1440); unconfirmed destructive "Remove" on KPI-log entries (HR records, no confirm/undo — pair with productivity's same finding); mail-desk confirm div role="alertdialog" without dialog semantics (focus never enters, no Escape, no describedby); design-system bypass cluster (variant="danger" unused for Reject, .dk-sm 5th small-button size vs size="sm", className="input"/"select" re-added to primitives → dual-classed controls); dead+split styles (dead .dk-seg/.dk-badge = 4th seg impl, .trk-form defined twice, .trk-table styling split refresh.css global vs operations.css scoped); operations.css ~40 raw px declarations vs token scale + 900/480px breakpoints + 100vh + desk.css var(--space-6) ×2; login "Forgot password?" dead interactive-looking span (not link/button/focusable — dead end on the only public path) + brand <img> renders nothing in shots (VERIFY live) + hardcoded "v2.4"; Count reduced-motion divergence (kb-tracker copy lacks guard — folded into scaffolding High).
- **Low:** ?tl= selection not persisted to URL; trackers cluster (noopener w/o noreferrer, title only >40 chars while CSS truncates at 260px, skeleton no aria-busy, Xn remount wipes in-progress draft, 894-line minified file); cross-area route nits (aging--390 literal "null" CONTACT, heatmap clipped input text, ctls--390 12,431px tall); --cx-ink-3 on login chrome (baseline instance); kb-tracker redundant void reload() after save.
- Positives: .trk-table-wrap correct scroll pattern, native <dialog> in trackers, labelled radios, trk-kind :focus-within + is-off styling, login autoComplete/role=alert, permission-empty state.

### [perf]
- **Medium:** AppShell render path — useLayoutEffect no-dep-array does querySelector+offset reads after EVERY render (forced sync layout); two adjust-during-render setState blocks → double render per navigation; PAGES.filter ×2 per render; boot payload stored 3×; dead CSS 282KB unimported (globals.css+legacy-apps.css — same as tokens Medium, perf-quantified); zero @layer rules across 12 stylesheets — :root .cls (0,2,0) ties with [data-app] sheets decided by emergent import order (silent flip risk); server bootstrap waterfall — getAppBootstrap serially awaits currentUser→viewAsState→currentEmail before Promise.all (1-2 extra DB round-trips on every route's TTFB); five unrelated polling loops (Popups 60s+2.5s initial fires even though __CC_BOOT__ delivered popups; two 1s countdown tickers); perf test baseline is a stub — all 14 assertions compare hardcoded constants, cannot regress (PLAN's perf budget currently unenforced).
- **Low:** raster <img> not next/image (rail logo 37KB every page; BootSplash suppressions deliberate); Google Fonts via media=print+onload script hack (next/font would self-host); Frag wrapper + redirect placeholder div (cosmetic).
- Measured: 349 files/83,617 LOC; 98.1% client-component; 40 .tsx >300 lines; fetchJson×4, useSe×4, options caches×5, StatusChip×3, *-shared modules 4,006 LOC (~25-35% dup); imported CSS ~250KB source; three.js 2.1MB on disk; 128 eslint-disable.

---

## A. Layout & Alignment Summary
- Components reviewed: ~60 component files across 9 area reports + ~3,700 lines live CSS + dead sheets; all ~40 routes shot-covered at ≥2 viewports except /my-status (redirect artifact) and behind-interaction states.
- Misaligned/overlapping: .md-flags td displaced+clipped (High); .upnext unstyled container (High); meetings--390 button/input collision; admin--390 100px h-overflow; kb-gaps h-overflow all viewports; overview--390 637px page overflow (.cx-ladder); tph-grid--390 442px inline-grid collision; kpi-logs "Leave out" floating into grid col; qa-q flex-tr header/cell misalignment (code); double active-nav highlight; shell "N issues" badge overlaps content at 390 (shell-owned).
- Spacing violations: off-scale literals concentrated in refresh.css/cx-kit.css (~25), hub.css (~15), queue.css (~20), operations.css (~40), people inline styles (~40 sites), shell chrome (~15), productivity inline (~15) — one shared sweep covers all.
- Empty/broken regions: status-validation .md detail column blank until selection; /tph duplicate overview blocks; ecosystem bare-render missing landmarks.

## B. Design-System Violations
- Critical: productivity.css entirely dead on /tph-grid (registry/scope miss).
- High: three style generations app-wide (~11 widget pairs render differently); 6/18 primitives unused while ~120 raw call sites bypass them; Tabs broken + ~5 tab impls; stacked button vocabularies on shell/people/desk controls; StatusPill/pill×4 badge impls; page-shell ×4+ implementations; chip/tab/seg/dialog vocabulary splits in every feature area.
- Medium (by theme): token gaps — z-index scale, breakpoints, --page-max, --text-2xs, --cx-ink-3 contrast, iOS 13px inputs, 100vh→dvh, RTL physical props (refresh.css + gantt); hardcoded styling — ~130 inline-style sites + WI_ROW/md-flags/qa-q; dead CSS — ~282KB unimported sheets + ~45 people.css lines + dead selectors across sheets; state/interaction — toasts 4s/no-dismiss, window.confirm×3, alertdialog misuse ×2, dead forgot-password, autofocus steal, unconfirmed deletes ×2.
- Low: per-area cosmetic nits as listed in each summary (dead hooks, magic colSpan, raw-key fallbacks, label mismatches).

## C. Shared-Components Opportunity Report
- **Components to centralize (ranked by leverage):**
  1. `<PageShell title sub aside>` — replaces PwShell, dq-page Head, mail-desk Shell, local Page, Vf, hand-written .page-head (≥6 impls, all 40 routes).
  2. `<Tabs>` (APG) — replaces .cx-tab/.tabs/.pw-tabs/tph-tabs/seg-view-switchers (~5 impls).
  3. `<Chip status>` typed union — replaces cx-chip/pill/pw-badge/tag/StatusPill/ScorePill/Badge (~6 impls).
  4. `<Button>` extended variants (quiet/icon/danger-quiet) — kills .btn/.nav-toggle/.rail-collapse/.va-*/.pw-del-btn/.md-reject/.dk-sm stacking (~15 sites + CSS contracts).
  5. `dk-shared`/`usePageData` + `<Skeleton>/<Failed>/<ErrMsg>` + `useRun`/`useLoaded` — replaces 4× scaffolding, 4× fetchJson, 4× loaders, 3× skeleton sets, 5× options caches (~1,600 lines).
  6. `<Dialog>`/`useDialogModal` — one scrim+focus contract for popup/palette/pickers/confirm (~5 dialog classes + Modal.tsx).
  7. `<TableScroll>` (min-width+tabindex+fade) — .dk-scroll + .trk-table-wrap + .cc-chart + queue table + kb-gaps.
  8. `<PaintGrid>`/`<AutoSaveInput>`/`<VirtualList>` — tph-grid + scheduler + flags/kpi-logs lists.
  9. `<CarriedReview>`, `<AttentionList>/<KpiStrip>`, `<CoverageCell>`, `<Meter>`, `<ConfirmInline>/<ConfirmButton>`, `<SettingsSection>`+TOC, "feature not connected" state, chart toolkit (.pv-spark/.spark/.mixbar/.tph-trend → 1), qaDateTime formatter (8× idiom), `useOptions(listKey)`, `useSearchParamState`, `usePoll`.
- **Styles/tokens to extract:** --z-* scale; --bp-* breakpoints; --page-max; --text-2xs (if micro-text intentional); canonical class family per widget (.cx-* recommended) + codemod; @layer manifest (tokens, kit, refresh, apps).
- **Hooks/utilities:** usePageData(initialData), useOptions, useSearchParamState, usePoll, prefersReducedMotion-gated scroll, focus-restore utility, error-copy mapper.
- **Pages using duplicated implementations:** all 40 routes (shell); cx-desk ×4 pages; cx-quality analytics/disputes/ctls/audit-queue/qa-forms; cx-people one-on-ones/meetings/coaching/my-actions/agents; cx-productivity all 4 components + 4 cross-feature routes; cx-hub admin pair + overview/my-day.

## D. Technical-Debt Analysis
- Duplicate code: ~25-35% of component code is second/third implementations (scaffolding ~1,600 lines, analytics helpers ~350, CarriedReview ~85, pill/triple copies, page-shells, tabs/segs); ~35-45% of audited CSS is dead or a duplicate widget family; 282KB dead unimported sheets.
- Estimated refactor effort: vocabulary codemod + primitive adoption = L (multi-area, visual-diff risk on divergent pairs); scaffolding/hooks consolidation = M (mechanical); CSS sweeps (tokens, literals, dead rules) = M; page splits (one-on-ones, tph-grid, ecosystem, audit-queue, quality-analytics) = L each, strategic.
- Highest-risk areas: (1) :root/[data-app] specificity + load-order contract — silent visual flips (Tabs proved the fragility); (2) registry↔data-app coupling — unregistered routes silently unstyle/mislabel (2 live bugs); (3) paint-grid keyboard model + cases-input commit flow (behaviour changes need e2e); (4) ecosystem-page.tsx 2,663-line minified port; (5) admin/kb-gaps overflow fixes owned cross-area.

## E. Architecture Scorecard (/10 — averaged across the 8 area reports; perf excluded, it scored perf sub-dimensions only)
| Dimension | Avg | Notes |
|---|---|---|
| UI Consistency | 5.4 | vocabulary soup everywhere; shots look cohesive per-area |
| Layout Quality | 6.5 | solid grids/rails; broken upnext, inline grids, table-cell flex, overflows |
| Design System Compliance | 4.5 | tokens exist and are good; usage bypasses them constantly |
| Component Reusability | 4.6 | real shared layers exist (qa-shared, hub-shared, pw) but adoption unenforced |
| Responsiveness | 5.9 | good 820px collapse + coarse targets; 390px failures on ladder/admin/kb-gaps/tph-grid/queue |
| Accessibility | 5.8 | strong fundamentals (labels, describedby, focus rings, reduced-motion) undermined by name loss, grid semantics, focus drops, contrast edges |
| Performance | 6.4 | gated animations/polls done right; client-only waterfall, no memo boundaries, eager three.js, unbounded lists |
| Maintainability | 4.0 | verbatim minified ports, duplicated everything, dead CSS, misleading headers |
| Scalability | 4.8 | shared modules exist; pattern is "copy the closure" not "reuse the module" |

Perf sub-scores (audit-perf): Bundle discipline 4 · Render efficiency 3 · Fetch architecture 4 · Dead-code hygiene 5 · CSS layering 5 · Measurement/gates 2.

## F. Top 20 Priority Fixes (ranked by impact × effort × debt reduction)
1. **Registry guard + fix** — register/redirect /tph-grid, /admin/config, /admin/roster + build-time PAGES coverage check. (C+H, trivial — kills the worst user-facing bug and its silent-failure class.)
2. **One canonical class family per widget** (.cx-* recommended) + codemod + eslint gate — collapses ~11 divergent pairs feeding ~15 findings. (H, L effort — biggest single debt win.)
3. **Restore .upnext container rule** in hub.css. (H, ~12 lines — visible regression on primary page.)
4. **.cx-ladder overflow-x:auto** (+ optional mobile min-size). (H, ~4 lines — fixes 1.4.10 on hub + queue.)
5. **User-facing "not connected" error state + copy mapper** — replaces env-var/Apps-Script walls on My day + "Request failed". (H, small.)
6. **Consolidate async plumbing** — one fetchJson, one usePageData(+initialData), one useOptions, shared Skeleton/LoadError/Chip/Count; adopt across cx-desk×4, cx-queue, cx-quality, cx-productivity, cx-people. (H×4 merged, M — ~1,600 lines, kills divergence class.)
7. **quality-analytics import sweep** — delete ~350 lines of local helpers → qa-shared. (H, mechanical.)
8. **StatusPill/ScorePill/pillCls + local Chips → one typed <Chip>** across disputes/ctls/people/shell/queue/desk. (H, small.)
9. **<PageShell> promotion + migration** — all dq-page/Page/PwShell/local-head copies → one component. (H, M.)
10. **Extract <CarriedReview>** (one-on-ones/meetings). (H, small.)
11. **Fix <Tabs> contract → promote tph-tabs APG impl**; delete .tabs/.pw-tabs losers. (H+M, medium — unblocks people/productivity tab fixes.)
12. **Extend <Button> variants** (danger-quiet, icon) + strip stacked .btn/.va-*/.nav-*/.md-reject/.dk-sm contracts; fixes dead .pw-del-btn. (H, small sweep.)
13. **Responsive grid class** (.cols-32/.cols-64) replacing inline 1.5fr/1.4fr grids. (H, small.)
14. **Paint-grid keyboard model** — roving tabindex, arrows, aria-readonly cells. (H, medium — needs e2e.)
15. **Cases-input draft+commit** (blur/debounce) + **virtualize/cap flags worklist**. (H×2, small-medium.)
16. **A11y quick wins batch** — rail-search aria-label, bell count in label, document.title=page·app, nav-group-label target, Field aria-invalid, seg/toggle/switch disabled styles, --cx-ink-3 measure+fix, dialog ::backdrop scrim, toast error persistence+typed tones, palette focus-restore, D() shell sweep. (H+M, mostly 1-2 line each — highest a11y-per-line ratio in the audit.)
17. **Broken-layout batch** — .md-flags td flex→inner div, kb-gaps overflow-wrap+scroll wrap, admin 390 overflow + SettingsSection/TOC, mail-desk table min-width, meetings--390 wrap rule, status-validation row clipping + .md placeholder. (H+M, small each.)
18. **Dynamic-import three.js scene** on /ecosystem. (H, small — ~160KB gz off one route.)
19. **Token/geometry sweeps** — z-index scale, --bp-*, 100dvh, off-scale literals (~130 sites → one sweep per sheet), dead-CSS deletions (people.css ~45 lines, dead selectors, trk-table move to operations.css, .trk-form merge), @layer manifest. (M, sweeps.)
20. **Monolith splits + memo pass** — one-on-ones (2,771), ecosystem (2,663), tph-grid (2,244), audit-queue (2,125), quality-analytics (post-dedupe ~1,650); React.memo on row/cell renderers; registry↔stylesheet guard test. (H-value, L effort — schedule as dedicated shards.)

---

## Fix list

| Rank | Finding id | Area(s) | Severity | Suggested fix | Effort | Theme |
|---|---|---|---|---|---|---|
| 1 | PV-C1 / HUB-H1 | productivity, hub | Critical+High | Register/redirect /tph-grid, /admin/config, /admin/roster in PAGES + build-time coverage check | S | components |
| 2 | ST-H2 (+all areas) | shared-tokens + all | High | Canonical class family per widget (.cx-*) + codemod + eslint gate | L | tokens/components |
| 3 | HUB-H3 | hub | High | Restore .upnext container rule in hub.css | S | components |
| 4 | HUB-H4 | hub, queue | High | .cx-ladder/.cc-chart overflow-x:auto + mobile min-size | S | responsive |
| 5 | HUB-H2 (+PV-M) | hub, productivity | High | "Not connected" state component + error-copy mapper | S | components |
| 6 | DO-H1 / PERF-H4/H5/H6 | desk-ops, perf, queue, productivity, people | High | Consolidate fetchJson/usePageData/useOptions/Skeleton/LoadError/Chip/Count into shared | M | components |
| 7 | QL-H1 | quality | High | quality-analytics: delete ~350 ln local helpers → qa-shared imports | M | components |
| 8 | QL-H2 (+PP, ST, DO, QU) | quality, people, shared-tokens, desk-ops, queue | High | One typed <Chip>; delete StatusPill/ScorePill/pillCls/local Chips/PwBadge | S | components |
| 9 | PP-H1 (+QL,QU,PV,HUB) | people + quality, queue, productivity, hub | High | Promote one <PageShell>; migrate all page-head copies | M | components |
| 10 | PP-H2 | people | High | Extract <CarriedReview> to shared people widget | S | components |
| 11 | ST-H3 (+PP,PV) | shared-tokens, people, productivity | High | Fix <Tabs> on tph-tabs APG impl; delete .tabs/.pw-tabs losers | M | components/a11y |
| 12 | SH-H2 (+PP,DO) | shared-shell, people, desk-ops | High | Extend Button variants; strip stacked button contracts; fix .pw-del-btn | S | components |
| 13 | PV-H2 | productivity | High | Responsive .cols-* class replaces inline 1.5fr/1.4fr grids | S | responsive |
| 14 | PV-H3 | productivity | High | Paint grid: roving tabindex + arrows + aria-readonly cells | M | a11y |
| 15 | PV-H5/H6 | productivity | High | Cases-input draft+commit; virtualize/cap 652-row worklist | M | perf/components |
| 16 | SH-H1 + a11y batch | shared-shell, shared-tokens, hub, quality | High+Med | rail-search label, bell count, title=page·app, nav-group target, aria-invalid, disabled segs, ink-3, scrim, toasts, palette focus, D() sweep | S | a11y |
| 17 | QU-H1 + layout batch | queue, desk-ops, hub, quality, people, productivity | High+Med | .md-flags inner div, kb-gaps wrap, admin overflow+TOC, dk-table min-width, meetings wrap, .md placeholder, row clipping | S | responsive/components |
| 18 | PERF-H1 | perf | High | next/dynamic three.js scene on /ecosystem | S | perf |
| 19 | ST-M sweep + dead CSS | shared-tokens, people, desk-ops, queue, hub | Medium | z-index/breakpoint/space token sweeps, 100dvh, literal codemods, dead-CSS deletes, @layer manifest | M | tokens |
| 20 | PERF-H3/PP-H3 (+QL,PV) | perf, people, quality, productivity | High | Split >800-line pages; React.memo rows; registry↔stylesheet guard | L | components/perf |

Runner-ups (next tranche): PERF-H2 server initialData; PERF-H7 AppShell layout-effect dep + memo; PERF-H9 @layer; PERF-H10 bootstrap Promise.all; PERF-H11 usePoll + skip redundant popups poll; PERF-H12 real perf budgets; PV state→URL params; DO slider zone colours + dk-scroll tabindex + alertdialog fix + confirm-on-Remove; PP RTL gantt + targets + autofocus; QL focus-management + CoverageCell + qaDateTime; token contrast VERIFY pass in browser.

## Not verified (carried from source reports)
- Rendered contrast measurements pending browser check: --cx-ink-3 (~4.2-4.5:1 est.), va-banner-error (~4.0:1 est.), .md-status-blocked (≈4.25:1 computed), login --cx-ink-3 instances.
- /my-status route shots are status-validation content (seed redirect) — its findings are code-only.
- Behind-interaction states unshot: open AuditForm (.qa-q alignment), paint-grid editing, view-as banner, palette open, oo-alerts, approver mail-desk paths, dark mode, RTL rendering, 320px reflow.
- admin--390 244K-px page height per-row cause (overflow-wrap on JSON values suspected); login brand <img> absence (asset exists — likely capture timing); CHANNEL_LABELS.wa label.
- three.js gz size is an estimate — verify with build manifest in Phase F.
- Capture hygiene: "1 Issue ×" badge in shots is the Next dev overlay, not app UI; harness should disable devIndicators.
