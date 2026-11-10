# Area audit — productivity

Scope: `src/features/cx-productivity/components/*` (pv-shared, my-status-page, status-validation-page, productivity-analytics-page, tph-grid-page), `src/app/styles/productivity.css`, and the routes `/productivity-analytics` `/tph` `/tph-grid` `/kpi-logs` `/status-validation` `/my-status` `/my-day` `/trackers` `/scheduler`.
Route→component map (page.tsx files): `/kpi-logs` → cx-desk `kpi-logs-page` + desk.css; `/my-day` → cx-hub `my-day-page` + hub.css; `/trackers` → cx-operations `trackers-page` + operations.css; `/scheduler` → cx-queue `scheduler-page` + queue.css; `/tph` re-exports `/tph-grid` page. The four cross-feature components were audited at route level only (their feature dirs belong to other shards).
Rendered evidence: `shots/{tph,tph-grid,status-validation,my-status,productivity-analytics,kpi-logs,my-day,trackers,scheduler}--{1440,768,390}.png` + crops in `specs/ux-ui-audit-v2/logs/`.
Baseline: `reports/audit-shared-tokens.md` (three style generations, raw-class call sites, dead primitives, borderline `--cx-ink-3`, tab/seg duplication — all inherited here).

---

## FINDINGS

```
SEVERITY: Critical
ELEMENT: /tph-grid route — wrong app context, ~all page-specific CSS dead
LOCATION: src/app/tph-grid/page.tsx + src/features/shared/components/shell/registry.ts (no "tph-grid" path; only "tph", line ~206) + AppShell.tsx:133
CATEGORY: Layout / Architecture
ISSUE: /tph-grid has a real Next page but no registry entry, so
  `PAGES.find(...) ?? PAGES[0]` resolves to "my-day" → ctxApp="hub" →
  data-app="hub". Every productivity.css rule is scoped
  `[data-app="productivity"]` and never matches: .tph-tabs render as plain
  buttons, .tph-kpi/.tph-attn/.tph-trend/.pv-* lose all styling (KPI cards
  become flat text lines, the 7-day chart renders as a numbered <ol>, the
  paint grid/tables/dialog/trend hits lose their contracts). Breadcrumb shows
  "Hub / My day", the rail highlights "My day", document.title is "Dabdoob CX".
  Shots: tph-grid--1440.png vs tph--1440.png (same component, styled).
ROOT CAUSE: The registry was keyed to the canonical `tph` path; the legacy
  `tph-grid` URL was kept via route re-export without a registry alias, and
  AppShell's unknown-path fallback is "hub context", not a 404/redirect.
IMPACT: Any user landing on /tph-grid (old bookmarks, existing links, the
  comment in tph/page.tsx says "the old URL keeps working too") gets a
  visually broken console — unstyled widgets, wrong chrome, wrong nav state.
RECOMMENDED FIX: Either register `"path":"tph-grid","group":"productivity"`
  in the registry (generated file — fix its generator), or make
  /tph-grid/page.tsx a `redirect('/tph')`. Prefer the redirect; one canonical
  URL also fixes the ?tab= links.
CENTRALIZATION OPPORTUNITY: No (config/registry fix).
```

```
SEVERITY: High
ELEMENT: /tph Overview — KPIs, "Needs attention" and "Team % of cap" rendered TWICE on one screen
LOCATION: tph-grid-page.tsx `summary` (2173-2218: stat strip + Qs) vs Ga→Xa (723-828: tph-kpis + tph-attn section + Qa/Za trends); rendered: tph--1440.png
CATEGORY: Layout / Design System
ISSUE: The page renders a pre-tab summary (5 .stat cards, mixbar card,
  "Needs attention" card, spark strip) and then the Overview tab repeats
  Team-%-of-cap (lead kpi + trend figures), Team TPH, Cases coverage,
  Agents on grid, Over cap, Call time and a second "Needs attention" heading
  with the same items. Two h2s say "Needs attention"; "Team % of cap"
  appears three times.
ROOT CAUSE: Two generations coexist: Qs (legacy mid-section) was kept as
  `summary` prop while the new tabbed Overview (Xa) re-implemented the same
  blocks with different class contracts (.stat/.mixbar vs .tph-kpi/.tph-attn).
IMPACT: Users see the same numbers twice with different styling — reads as a
  bug, doubles the vertical scroll, and duplicates the attention logic
  (k[] vs attn[] — already divergent: Xa's has action buttons, Qs's doesn't).
RECOMMENDED FIX: Keep one implementation — recommend dropping the `summary`
  block (Qs + stat strip) since Xa's version has the actionable attention
  list; if the stat strip is wanted pre-tabs, drop Xa's kpi grid.
CENTRALIZATION OPPORTUNITY: Yes — one <AttentionList items> + one
  <KpiStrip>; kills ~150 duplicated lines and the drift risk.
```

```
SEVERITY: High
ELEMENT: Hardcoded two-column grids via inline style — mobile collision + horizontal scroll
LOCATION: my-status-page.tsx:230 (`gridTemplateColumns:'1.5fr 1fr'`), tph-grid-page.tsx:2048 (`'1.4fr 1fr'`); rendered: tph-grid--390.png
CATEGORY: Responsive / Layout
ISSUE: `.grid` only gains columns via grid-2..5 classes that collapse at
  820px (refresh.css:183-187). Inline `gridTemplateColumns` overrides the
  collapse, so both pages keep two squeezed columns at 390px: on /tph-grid
  the mixbar card and attention card collide (hour digits clipped, page
  width measured 442px > 390px viewport → horizontal scroll, WCAG 1.4.10);
  on /my-status the flags column crushes to ~55%.
ROOT CAUSE: Layout written as inline style, unreachable by the responsive
  media rules.
IMPACT: Broken mobile layout on both pages; readability + clipping.
RECOMMENDED FIX: Replace inline ratios with a responsive class
  (e.g. .dq-cols, `grid-template-columns:1fr` under 820px, ratio above).
CENTRALIZATION OPPORTUNITY: Yes — one `.cols-32`/`cols-64` utility or
  auto-fit minmax() pattern reused by all card+rail pages.
```

```
SEVERITY: High
ELEMENT: Paint grid — ARIA grid with up to ~1000 tab stops, button-semantics stripped, read-only cells unreachable
LOCATION: tph-grid-page.tsx Es (953-1011); productivity.css:84-102
CATEGORY: Accessibility
ISSUE: (a) Every slot is `<Button role="gridcell">` inside role="grid":
  no roving tabindex, no arrow-key navigation (APG grid pattern) — keyboard
  users tab through agents×slots (20×~50) to leave the widget.
  (b) role="gridcell" on a <button> removes its button semantics — SRs
  announce a cell, not an editable control.
  (c) `disabled={!d.canEdit}` removes every cell from the tab order in
  read-only mode, so keyboard users can't reach any cell's aria-label
  (agent/time/channel); the paint grid is information-invisible to them.
  (d) onPointerDown preventDefault means mouse painting never focuses cells.
ROOT CAUSE: role="grid" adopted as a naming pattern without the APG
  interaction model; disabled used to mean read-only.
IMPACT: WCAG 2.1.1-usability failure on the page's core widget; read-only
  keyboard/SR users lose the grid entirely (theCaps tab is the only
  fallback).
RECOMMENDED FIX: Roving tabindex + Arrow/Home/End navigation; keep cells
  focusable (aria-readonly="true" on the grid, not disabled); use real
  `gridcell` semantics or drop role="grid" in favour of a labelled group.
CENTRALIZATION OPPORTUNITY: Yes — a shared <PaintGrid> primitive would fix
  it once (scheduler's hour grid has the same shape).
```

```
SEVERITY: High
ELEMENT: Cases-entry inputs save on every keystroke (controlled by server data)
LOCATION: tph-grid-page.tsx As (1189-1200): `<Input … value={cell?.tl ?? ''} onChange={save}>`
CATEGORY: Interaction / Data integrity
ISSUE: Each keystroke POSTs /api/tph/cases: typing "12" saves "1" then "12";
  the input's value is bound to server state (cell.tl), so between the
  request and the refetch the field can snap back and swallow the next
  digit. No debounce, no blur-commit, no pending indicator per cell.
ROOT CAUSE: Legacy instant-save port; controlled by fetched data rather
  than local state.
IMPACT: Wrong case counts can be persisted (first digit lands first), and
  fast typists race the reload; the Cases tab is a primary TL path.
RECOMMENDED FIX: Local draft state per cell; commit on blur/Enter (or
  debounce ~400ms); keep an isSaving marker on the row.
CENTRALIZATION OPPORTUNITY: Yes — an <AutoSaveInput> pattern (draft + commit
  + status) is reusable in trackers/scheduler inline edits.
```

```
SEVERITY: High
ELEMENT: Unbounded lists — 652-row worklist (~38,800 px page), no virtualization or paging
LOCATION: status-validation-page.tsx:506-557 (pending), my-status-page.tsx:239-302 (flags), tph "Each agent's day"; rendered: status-validation--1440.png = 1440×38814, --390 = 390×39146
CATEGORY: Performance / Layout
ISSUE: `.worklist` maps every pending flag to a DOM row — 652 buttons
  (~650 tab stops) and a ~39k-pixel document. Agent filter exists but the
  default view renders all. my-status maps all flags the same way.
ROOT CAUSE: Port rendered the full array; no cap/virtualization/pagination.
IMPACT: DOM weight + paint cost (perf shard confirms), unusable scroll,
  keyboard traversal impractical.
RECOMMENDED FIX: Virtualize (content-visibility:auto on .pv-item is a
  one-rule mitigation) or page/"show 50 more"; default the list to the
  nearest-due N.
CENTRALIZATION OPPORTUNITY: Yes — shared <VirtualList>/<PagedList> or a
  .cv-auto utility; kpi-logs dk-list has the same growth path.
```

```
SEVERITY: Medium
ELEMENT: Two `Seg` radiogroups share name="tph-brush" → one merged radio group
LOCATION: tph-grid-page.tsx:895,915
CATEGORY: Accessibility / Design System
ISSUE: Channel/activity brush Seg and the ±calls brush Seg both emit
  name="tph-brush" — the browser merges them into ONE radio group across two
  role="radiogroup" containers with different aria-labels; arrow-key
  navigation jumps between the two visual groups.
ROOT CAUSE: "one brush at a time" modelled by shared state + shared name
  instead of one control.
IMPACT: SR users hear a confusing group split; keyboard arrow order is
  surprising. Works by accident visually.
RECOMMENDED FIX: Give the calls Seg its own name (and keep coordinated
  state), or render all options in one radiogroup with a visual divider.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: Sparkline/bar widgets — keyboard-focusable points with no visible focus; hover-only values
LOCATION: pv-shared.tsx Xe circles (313-323, tabIndex=0 + tooltip); productivity.css `.pv-spark` has no circle:focus-visible; my-status-page.tsx:338-342 and tph-grid-page.tsx:2128-2135 `.spark` bars (title-only)
CATEGORY: Accessibility
ISSUE: Xe <circle tabIndex=0> is the only keyboard access to weekly values
  but nothing renders a focus ring on SVG points (2.4.7). `.spark`/`.mixbar`
  bars expose values only on :hover title — keyboard-only users get nothing;
  SR gets only the container aria-label.
ROOT CAUSE: Tooltip/focus styled for mouse; svg focus not in the stylesheet.
IMPACT: Keyboard users can't discover per-point values visibly.
RECOMMENDED FIX: `.pv-spark circle:focus-visible{outline…}` (or stroke
  change); add visually-hidden value text (already present via aria-label
  on svg — mirror it) or make .spark bars focusable with the same tooltip.
CENTRALIZATION OPPORTUNITY: Yes — chart primitives (.pv-spark/.spark/
  .mixbar/.tph-trend, 4 impls) → one chart toolkit with built-in a11y.
```

```
SEVERITY: Medium
ELEMENT: Stateful UI not in URL / not in history
LOCATION: tph-grid-page.tsx (date: go() mutates a ref, never the URL — refresh loses the day; tab: replaceState → Back can't undo tabs), status-validation-page.tsx:439-445 (view/selected/agentFilter in useState), productivity-analytics-page.tsx:88-96 (week in useState; shift() relies on `setTimeout(reload,0)` ordering)
CATEGORY: Navigation & State / Interaction
ISSUE: Primary view state (selected day, tab already OK via ?tab=,
  open/reviewed/disputed view, selected flag, agent filter, analytics week)
  is not deep-linkable and is lost on reload; tab switches bypass history.
ROOT CAUSE: Parity port of hash-app state model.
IMPACT: TLs can't link a teammate to "this flag/day/week"; Back button
  misbehaves; reload loses context mid-review.
RECOMMENDED FIX: Sync tab/date/view/flag to search params (the project
  already reads them via pageParams()); keep replaceState only if history
  spam is a real concern — pushState is more correct.
CENTRALIZATION OPPORTUNITY: Yes — a useSearchParamState hook would fix all
  four pages at once.
```

```
SEVERITY: Medium
ELEMENT: Page-shell + infra re-implemented per page instead of shared shell/ui
LOCATION: status-validation-page.tsx:75-107 (local `Page` duplicating PageHead/dq-page/LoadError/LinesSkeleton); kpi-logs-page.tsx:42-103 (Skeleton/Failed/Shell/Badge/ErrMsg + useLoaded/useRun vs shell ui LinesSkeleton/LoadError/PageHead/Chip and pv-shared useSe); my-status/status-validation/tph each define ROUTE + hand-write <header className="page-head">
CATEGORY: Architecture / Design System
ISSUE: At least 4 page-shell implementations and 3 fetch-hook
  implementations (useSe, useLoaded, plus scheduler/trackers' own) for
  identical loading/error/head patterns.
ROOT CAUSE: Verbatim ports kept each legacy bundle's module helpers.
IMPACT: Shell changes (e.g. breadcrumb, aria-busy, skeleton style) must be
  edited N times — already diverged (.page-sub vs .page-purpose, dk-skel vs
  LinesSkeleton).
RECOMMENDED FIX: One <PageShell title sub aside> + one useFetch — wire all
  pages to it.
CENTRALIZATION OPPORTUNITY: Yes — ~200 lines removable per page pair.
```

```
SEVERITY: Medium
ELEMENT: Workitem row styling overridden by inline WI_ROW; selected state duplicated
LOCATION: status-validation-page.tsx:412-423 (WI_ROW object), 521-529 (inline selected bg)
CATEGORY: Design System
ISSUE: `.pv-item` in productivity.css:8-11 already defines the row
  (padding, border, cursor, hover, [aria-pressed] accent stripe); the code
  additionally spreads an inline style object zeroing border/radius/bg and
  sets `background: var(--cx-accent-soft)` when selected — two selected
  mechanisms (CSS stripe vs inline fill) that will drift; inline overrides
  defeat future token changes.
ROOT CAUSE: Row needed list-divider look; porter inlined it instead of a
  modifier class.
IMPACT: Selected styling divergent from the .pv-item contract; token/theme
  edits won't reach these rows.
RECOMMENDED FIX: A `.pv-item--row` modifier in productivity.css (border-bottom
  instead of card border); drop WI_ROW and let aria-pressed style selection.
CENTRALIZATION OPPORTUNITY: Yes.
```

```
SEVERITY: Medium
ELEMENT: Fourth/fifth seg + tab implementations; raw `.input`
LOCATION: status-validation-page.tsx:463-481 (`.seg` button group, aria-pressed) vs `Seg` primitive (radio) used 3 sections later (:237); my-day-page.tsx:1021-1034 (same raw .seg); raw `<input className="input">` at :497 vs Input primitive; tabs: tph-tab (APG-correct), sch-tab, .seg, refresh .tabs, cx-tab, Tabs.tsx
CATEGORY: Design System / Architecture
ISSUE: The same view-switcher is built three ways on adjacent routes —
  button+.on/aria-pressed, Seg radios, and dedicated tablists; the raw
  input skips the adopted Input primitive. Seg.radio can't express
  "views" (not a choice — a navigation), so pages re-invent it.
ROOT CAUSE: Baseline Tabs.tsx is broken (see audit-shared-tokens) so every
  page grew its own.
IMPACT: Inconsistent semantics/focus/active styles; the best implementation
  (tph-tabs: aria-selected, roving tabindex, Home/End, RTL-aware, scroll-snap)
  is the least reusable.
RECOMMENDED FIX: Promote tph-tabs' implementation into shared <Tabs>; keep
  .seg only for true button groups; swap raw .input for <Input>.
CENTRALIZATION OPPORTUNITY: Yes — 5 tab impls → 1 (tph pattern), 3 seg
  impls → Seg-with-mode or Buttons-group.
```

```
SEVERITY: Medium
ELEMENT: Master-detail `.md` — right column empty until a flag is picked
LOCATION: status-validation-page.tsx:493 (.md), refresh.css:444-451 (minmax(20rem,26rem) 1fr); rendered: status-validation--1440.png
CATEGORY: Layout
ISSUE: With no selection the detail column renders nothing — ~2/3 of the
  viewport is blank beside a 26rem list; no "pick a flag" placeholder.
  Also: filtering to 0 matches shows a bare empty card (no empty-state).
ROOT CAUSE: Detail panel conditional with no placeholder branch.
IMPACT: Dead space on the primary review screen; discoverability suffers.
RECOMMENDED FIX: Render an .empty "Select a flag to review it" panel in the
  detail column; add a no-results row under the filtered list.
CENTRALIZATION OPPORTUNITY: No (one Empty primitive call).
```

```
SEVERITY: Medium
ELEMENT: Destructive "Remove" without confirm/undo; dev-facing error copy
LOCATION: kpi-logs-page.tsx:182-203 (Remove → DELETE + toast); my-day rendered error "Google is not connected: set GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY…" (repeated in 4 cards, my-day--390.png); productivity-analytics "Request failed" (productivity-analytics--1440.png)
CATEGORY: Interaction / Content
ISSUE: Soft-delete entries vanish on one click (no confirm, no undo);
  API error strings expose env vars/dev instructions to end users; generic
  "Request failed" tells the user nothing actionable (WIG: errors need a
  fix/next step — only "Try again" exists).
ROOT CAUSE: API messages surfaced verbatim; destructive affordances kept
  from the admin-grade legacy tool.
IMPACT: Accidental deletes; confusing copy on a seeded-env outage.
RECOMMENDED FIX: Confirm-once (or undo toast) for Remove; map API errors to
  user copy ("couldn't reach Google — ask your admin to reconnect it").
CENTRALIZATION OPPORTUNITY: Yes — a <ConfirmButton>/<UndoToast> pattern +
  one error-copy mapper.
```

```
SEVERITY: Medium
ELEMENT: 652 flags → filter chips clipped; `.wi-side` content clipped at row edge
LOCATION: status-validation-page.tsx:547-553; rendered: logs/status-validation-top.png, -mid.png
CATEGORY: Layout
ISSUE: The row's muted interval text truncates mid-glyph at the card edge
  and the trailing chip sits flush against it — shots show "…auto-accepts
  today  )53" style remnants clipped at the 26rem column boundary.
ROOT CAUSE: wi-main min-width + wi-side absolute-ish flex inside a fixed
  26rem column with overflow hidden (.md .card).
IMPACT: Date/time info unreadable for some rows.
RECOMMENDED FIX: Give wi-main min-inline-size:0 + ellipsis on the date
  span; let the chip wrap under on narrow columns.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: CHANNEL_LABELS.wa = 'waiting address'
LOCATION: pv-shared.tsx:52-56
CATEGORY: Content
ISSUE: Channel key `wa` is labeled "waiting address" in CasesLine; in the
  Freshchat source vocabulary `wa` almost certainly means WhatsApp — VERIFY
  against real data before fixing (kept verbatim from legacy).
RECOMMENDED FIX: Confirm source label; rename if wrong.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Inline-style sprawl + off-class literals
LOCATION: `style={{margin:0}}` on ~10 h2.card-title across the four pages; my-status:336 `.8rem 0`, :354 `.55rem` gap, :338 `3rem`; tph-grid:395 `width:'9.5rem'`, :2117 `padding:'2rem'`, :2126 `borderTop:'1px solid var(--line)'`, :2183 `fontSize:'1rem'`; status-validation:197 `boxShadow:'none',marginBlockEnd:'1rem'`
CATEGORY: Design System / Typography
ISSUE: Component-level one-off styles that belong in the stylesheet;
  .card-title margin reset repeated by hand ~10 times.
RECOMMENDED FIX: `.card-title{margin:0}` globally (or hN.card-title reset);
  move the rest into classes/tokens.
CENTRALIZATION OPPORTUNITY: Yes — one CSS line removes ~10 inline styles.
```

```
SEVERITY: Low
ELEMENT: Agents-by-hour matrix hardcodes 09–21 + first-slot 09:30 label
LOCATION: tph-grid-page.tsx:1424-1425 (`x >= 9 && x <= 21`, hourLabel 09:30)
CATEGORY: Layout / Data
ISSUE: Hours outside 9-21 never appear in the matrix even if agents worked
  them; "09:30" first-cell label assumes slotMin=30 shift start.
RECOMMENDED FIX: Derive the window from d.hours.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Dead/parity code + duplicated computation
LOCATION: my-status-page.tsx:75-119 DisputeRaise + status-validation-page.tsx:286-371 DisputeForm ("mechanism disabled upstream" per comments — unreachable); Va(d.table) computed twice (2154 + 1935); analytics shift() setTimeout hack (90-96); Es registers window pointerup on mount (882-886, fine but manual)
CATEGORY: Architecture / Maintainability
ISSUE: Unreachable dispute forms shipped to every visitor; summary math
  runs twice per render; a racy reload idiom.
RECOMMENDED FIX: Delete or flag-gate the dispute UI; pass `sum` down or
  compute once; fetch analytics keyed on week instead of setTimeout.
CENTRALIZATION OPPORTUNITY: No (deletion/cleanup).
```

```
SEVERITY: Low
ELEMENT: Misc consistency nits
LOCATION: status-validation-page.tsx `export function Page` (exported generic name colliding with route-page convention); kpi-logs B() hand-rolled UTC+3 date fmt + DAYS/MONTHS arrays vs Intl in pv-shared (:33-40); `.page-purpose` (cx-kit:1174) vs `.page-sub` (refresh:21) both used for the header subtitle; `role="gridcell"` cells use cursor:crosshair even when disabled; AgentDialog has no backdrop-click close (Esc/close only); tph-hg's 9-21 matrix uses `title` tooltips on names/cells but cells ARE buttons (ok); pv-lane axis margins hardcode the lane's column widths (productivity.css:28 → brittle if 6.5rem/8rem change).
CATEGORY: Maintainability / Design System
ISSUE: Small divergences and brittle couplings.
RECOMMENDED FIX: Per item (rename local Page→ReviewShell; Intl fmt; pick
  one subtitle class; add light-dismiss to dialog or document no-dismiss).
CENTRALIZATION OPPORTUNITY: Mixed.
```

---

## A. Layout & Alignment Summary
- Components reviewed: 5 cx-productivity components (~4.0K lines) + pv-shared + productivity.css (222 lines) + 4 cross-feature route components (~3.5K lines, route-level) + 9 routes × 2-3 viewports of shots.
- Broken/unstyled route: /tph-grid (whole-page CSS scope miss — finding 1).
- Duplicate blocks on one screen: /tph overview (stat strip + attention + %-of-cap ×2) — finding 2.
- Misaligned/clipped: status-validation row text clipped at 26rem column; tph-grid 390px grid collision (442px wide); trackers table cell truncation handled via title-attrs (acceptable); rail "issues" badge overlays mobile content (cross-shell, also on trackers/my-day shots).
- Empty-column: .md detail side blank on status-validation.
- Spacing violations: inline `.55rem`/`.8rem`/`2rem`/`3rem` literals vs scale.

## B. Design-System Violations (severity)
- Critical: entire productivity.css dead on /tph-grid (scope/registry).
- High: fixed-ratio inline grids defeating responsive collapse; ARIA-grid contract broken (paint grid); server-controlled instant-save inputs; unvirtualized worklist.
- Medium: duplicate PageShell/Skeleton/Failed/Badge/fetch-hook impls; WI_ROW inline override + dual selected-state; raw .seg/.input beside adopted primitives; 5 tab impls / 3+ seg impls (with shared-tokens baseline); .md dead column; destructive w/o confirm + dev copy; chip clipping.
- Low: channel label suspect; inline-style sprawl (≈15 sites); hardcoded hour window; dead dispute UI + duplicate Va(); Page naming; B() vs Intl; page-purpose vs page-sub; pv-lane axis coupling; no light-dismiss.

## C. Shared-Components Opportunity Report
- Centralize components: <Tabs> ← tph-tabs (best impl: roving tabindex/RTL/scroll-snap); <PageShell>+useFetch (4 impls → 1); <PaintGrid> (tph cells + scheduler hour cells); <VirtualList>/content-visibility rows; <AttentionList>/<KpiStrip> (Xa vs Qs); chart toolkit (.pv-spark/.spark/.mixbar/.tph-trend → one, with focus + text-alt built in); <AutoSaveInput>; <ConfirmButton>/<UndoToast>; .pv-item--row modifier; shared empty-state for filtered lists.
- Tokenize/style: `.card-title{margin:0}` reset; `.cols-*` responsive ratio classes; one subtitle class (page-sub or page-purpose).
- Hooks: useSearchParamState (date/tab/view/week/filter); single fetch hook.
- Duplicated implementations live in: tph-grid-page.tsx (Va×2, Xa vs Qs attention/KPIs), status-validation/my-status (Page shells, flag cards), kpi-logs (whole local kit), my-day/trackers/scheduler (seg + tabs + skeleton variants).

## D. Technical-Debt Analysis
- Duplicate code: ~25-35% of the area's JSX (page shells, list rows, tablists, seg groups, attention/KPI blocks, dispute forms ~160 dead lines). productivity.css itself is clean and tokenized — its problem is reachability (Critical #1) not quality.
- Estimated refactor effort: M — mechanical component swaps; the risky parts are the grid keyboard model and the cases-input commit flow (behaviour changes, need e2e).
- Highest-risk areas: tph-grid-page.tsx (2244 lines, 15+ responsibilities — the doc's >300-line rule flags it hard); registry↔data-app coupling (any route path rename silently unstyles a page — add a check).

## E. Architecture Scorecard (/10, this area)
- UI Consistency: 4 — /tph vs /tph-grid are literally different-looking pages; widget vocabularies split mid-page.
- Layout Quality: 5 — solid page shells/cards; killed by the unstyled route, duplicate overview and mobile collisions.
- Design System Compliance: 4 — good token usage inside productivity.css; constant bypass in JSX (inline styles, raw classes, WI_ROW).
- Component Reusability: 3 — best primitives (tph-tabs, pv-item) are route-local; shared ones ignored for headers/skeletons.
- Responsiveness: 5 — most pages stack well (trackers/kpi-logs/my-day clean at 390); inline grids + unstyled route + clipped rows drag it down.
- Accessibility: 5 — genuinely good in places (APG tablist, aria-labels on cells, describedby errors, role=status/alert, focus-visible rules) but the paint-grid keyboard model, missing focus rings on charts, disabled-cell info loss, merged radiogroups.
- Performance: 4 — 652-row DOM + 39k px pages; double Va(); per-keystroke POSTs.
- Maintainability: 3 — verbatim-port helper sprawl (ae/ce/WI_ROW/$e), dead dispute code, one 2.2K-line file.
- Scalability: 3 — every page re-solves shell/fetch/tabs; new widgets are born local.

## F. Top 20 Priority Fixes (this area; merged into global Top 20 by PM)
1. Register `tph-grid` (or redirect to `/tph`) — restores all styling + correct chrome. (Critical, trivial)
2. Delete the duplicate pre-tab summary on /tph (Qs + stat strip) — one overview. (H, small)
3. Replace inline `1.5fr/1.4fr` grids with a responsive class. (H, small)
4. Paint grid: roving tabindex + arrows + focusable read-only cells. (H, medium)
5. Cases inputs: local draft + blur/debounce commit. (H, small-medium)
6. Virtualize/cap the flags worklist + "show more". (H, small-medium)
7. Give the calls brush its own radio name. (M, 1 line)
8. Focus rings for sparkline points + text alternatives for .spark/.mixbar bars. (M, small)
9. Sync tab/date/view/flag/week to URL params (one hook). (M, medium)
10. One <PageShell>+useFetch across all four+ pages. (M, medium)
11. `.pv-item--row` modifier; delete WI_ROW + inline selected bg. (M, small)
12. Promote tph-tabs to shared <Tabs>; retire .seg-buttons-for-navigation; swap raw .input → <Input>. (M, medium)
13. .md detail placeholder + no-results row. (M, trivial)
14. Confirm/undo for kpi-logs Remove; sanitize API error copy. (M, small)
15. Un-clip status-validation rows (min-inline-size:0 + ellipsis/wrap). (M, trivial)
16. `.card-title` margin reset → delete ~10 `style={{margin:0}}`. (L, trivial)
17. Agents-by-hour window from data (drop 9-21 hardcode). (L, small)
18. Delete or feature-flag dead dispute forms; dedupe Va(); drop setTimeout reload. (L, small)
19. Verify CHANNEL_LABELS.wa; pick one subtitle class; rename local Page; Intl for kpi-logs dates. (L, trivial batch)
20. Regression guard: assert every src/app/**/page.tsx path exists in the registry (build-time check) — prevents finding-1 class of bug. (H-value, small)

## Not verified / assumptions
- `/my-status` could not be captured: the seed admin is redirected to /status-validation (notice banner in my-status--*.png — the shots are status-validation content; INDEX.md lists them "ok" but they're not the requested route). my-status findings are code-only; its flagged-lists/1.5fr grid issues should be re-shot as an agent user.
- Dark mode: no dark shots captured; productivity.css has explicit dark variants for --tph-* (lines 68-70) and the rest is token-driven — assumed OK.
- Contrast: not re-measured; relies on --cx-* tokens (baseline's --cx-ink-3 VERIFY applies to .pv-lane__label/.tph-src/.cx-faint micro-text here too).
- RTL: dir=rtl supported by boot; tph-tabs is RTL-aware; mixbar/agenda physical-left issues are in refresh.css (baseline), not re-audited per page.
- Reduced-motion: scrollIntoView checks it (Ya); sweep animations gated globally (baseline).
- CHANNEL_LABELS.wa and any data-dependent labels need source-data confirmation.
- Cross-feature components (kpi-logs/my-day/trackers/scheduler) audited for the routes' shots + targeted code; their feature-dir internals belong to desk-ops/hub/queue/operations shards.
