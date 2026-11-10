# Area audit — shared-tokens (design-token + primitive baseline)

Scope: `src/features/shared/components/ui/*`, `components/layout/SiteChrome.tsx`, `src/app/globals.css`, `theme.css`, `cx-kit.css`, `refresh.css`, `legacy-apps.css`.
Rendered shots: **none** (`specs/ux-ui-audit-v2/shots/` does not exist — capture phase not run). All findings are code-derived; contrast values computed from hex; items marked VERIFY need a rendered check.
Load order (layout.tsx:2-4): `theme.css → cx-kit.css → refresh.css`. `globals.css` + `legacy-apps.css` are **not imported anywhere** — dead generator artifacts.
This is the baseline every other area report compares against: the class vocabularies and tokens defined here are what feature code actually uses.

---

## FINDINGS

```
SEVERITY: High
ELEMENT: Shared primitive set (Card, Table, Tabs, Modal, Empty, TableWrap)
LOCATION: src/features/shared/components/ui/{Card,Table,Tabs,Modal,Empty}.tsx
CATEGORY: Architecture / Design System
ISSUE: 6 of 18 exported primitives have ZERO importers. Verified: no tsx
  imports Card, Modal, Tabs, Empty, or the Table family; TableWrap is used once.
  Callers instead hand-write the same classes: `className="cx-table"` in 21
  files, `.card`/`card-pad` in 36, `.cx-note` in 13, `.empty`-family markup in
  ~40. Only form controls (Button 44, Input 31, Select 28, Textarea 19) and
  Chip/Seg/Toggle/Field are genuinely adopted.
ROOT CAUSE: Primitives are 5-line className wrappers with no added behaviour, so
  porters copied markup instead; nothing enforces component usage.
IMPACT: The "design system" is not the system — restyling a surface means
  editing N raw-class call sites, not one component. Type-level refactors
  impossible. Audit dedup estimates in other reports should assume raw classes.
RECOMMENDED FIX: Either delete the unused wrappers (honest baseline) or give
  them enough API (e.g. <Table sortable>, <Empty icon action>) to be worth
  adopting, then convert call sites per-area.
CENTRALIZATION OPPORTUNITY: Yes
  - Enforce via eslint `no-restricted-syntax` on raw `cx-table`/`cx-panel`
    classNames, or codemod to components; ~120 call sites affected.
```

```
SEVERITY: High
ELEMENT: Three coexisting style generations / class vocabularies
LOCATION: cx-kit.css (whole file), refresh.css (whole file), legacy class names
CATEGORY: Architecture / Design System
ISSUE: Three overlapping vocabularies are simultaneously live and load-ordered:
  (a) legacy bare classes (.btn, .field, .input, .note, .tabs, .tbl…),
  (b) the .cx-* kit (cx-btn, cx-field, cx-note, cx-table…),
  (c) refresh utilities (.card, .stat, .delta, .pill, .seg, .tabs, .icon-btn,
      .workitem, .md, .agenda, .login-*).
  Same-semantic pairs render DIFFERENTLY: `.note` (refresh.css:54, full tint +
  border) vs `.cx-note` (cx-kit.css:763, stripe-only); `.empty` (67, borderless)
  vs `.cx-empty` (777, dashed panel); `.card` (162) vs `.cx-panel` (485) vs
  `.block` (556); `.tabs` (326, underline links) vs `.cx-tab` (458) vs Tabs.tsx;
  `.seg` (312) vs `.cx-seg` (332) vs `.pw-seg` (326); `.tbl` (286) vs `.cx-table`
  (589) vs `.trk-table` (refresh 635); `.pill`/`.tag` (239-272) vs `.cx-chip`
  (748); `.agechip` d0-d3 only (273) vs `.cx-agechip` + 7-step [data-age] ramp.
ROOT CAUSE: Each port wave reskinned in place and kept the old names "in the
  contract" (documented at cx-kit.css:555, 724) rather than migrating markup.
IMPACT: Same widget looks different across pages; every future restyle is 2-3x
  work; new code must guess which family is canonical. This is the single
  largest consistency debt in the baseline.
RECOMMENDED FIX: Declare one family canonical per widget (recommend .cx-*),
  alias or delete the losers, codemod call sites area by area.
CENTRALIZATION OPPORTUNITY: Yes
  - ~11 widget pairs to collapse; est. 30-40% reduction in live CSS selector
    count; biggest maintainability win in the audit.
```

```
SEVERITY: High
ELEMENT: Tabs component — invisible selected state (latent bug)
LOCATION: ui/Tabs.tsx:72-76 vs cx-kit.css:161-185
CATEGORY: Design System / Accessibility
ISSUE: Tabs renders `cx-btn cx-btn--quiet` + `cx-btn--primary` when active.
  `.cx-btn--primary` (161) is defined BEFORE `.cx-btn--quiet` (174) at equal
  (0,2,0) specificity, so quiet wins: transparent bg, --cx-ink-2 text. The
  selected tab is visually identical to unselected ones; only aria-selected
  differs. Additionally the component ignores the `.cx-tab` CSS contract
  (underline tab style, cx-kit:458-479) — which is itself dead (0 class users).
ROOT CAUSE: Variant classes applied cumulatively rely on fragile source order;
  component markup predates/forks the `.cx-tab` contract.
IMPACT: Any future adopter ships a WCAG-broken tab control (no visible selected
  state, 1.4.1/4.1.2-adjacent). Currently unused → latent trap.
RECOMMENDED FIX: Render `.cx-tab` + `aria-selected` (matching cx-kit:473-479)
  instead of stacking button variants; or delete Tabs.tsx until needed.
CENTRALIZATION OPPORTUNITY: Yes — one `<Tabs>` driving `.cx-tab` replaces the
  three tab systems above.
```

```
SEVERITY: Medium
ELEMENT: globals.css + legacy-apps.css — dead generated sheets in src/app
LOCATION: src/app/globals.css (~90KB minified single line), legacy-apps.css (1424 ln)
CATEGORY: Architecture / Maintainability
ISSUE: Neither file is imported (layout.tsx loads only theme/cx-kit/refresh;
  grep confirms no other importer). Yet globals.css still declares itself
  "Source of truth for all design tokens… Do not hand-edit"; theme.css:5 says
  generated sheets are no longer imported (true), and theme.css:431 keeps a
  `[data-app]` re-pin whose only purpose was beating legacy-apps.css. cx-kit.css:4
  still claims it "Loads LAST" — refresh.css actually does.
ROOT CAUSE: Generator outputs kept next to authored files; headers never
  updated after the cutover to styles/*.css.
IMPACT: ~230KB of misleading CSS that auditors keep re-auditing; stale
  "source of truth" comments cause wrong edits; defensive rules are dead weight.
RECOMMENDED FIX: Move both under scripts/legacy/out/ (or delete — regenerate on
  demand); fix the three stale header comments; drop the [data-app] re-pin if no
  styles/*.css re-declares those tokens.
CENTRALIZATION OPPORTUNITY: No (deletion).
```

```
SEVERITY: Medium
ELEMENT: cx-seg / cx-toggle / cx-switch — invisible disabled state
LOCATION: cx-kit.css:332-431 (+ ui/Seg.tsx, ui/Toggle.tsx)
CATEGORY: Accessibility / Design System
ISSUE: The real <input> is `position:absolute; opacity:0` (358, 367-368) and the
  visual lives on the sibling <span>. No `:disabled` rule exists on the span for
  cx-seg, cx-toggle, or cx-switch — the generic `input:disabled{opacity:.55}`
  (446) hits an already-invisible input. Seg.tsx even accepts `option.disabled`.
ROOT CAUSE: Disabled styling was authored for the (then visible) native control;
  the hide-input restyle never added span-level disabled styles.
IMPACT: Disabled options look fully enabled — users can't tell why clicks do
  nothing (WCAG 1.4.1-adjacent; usability on every filtered Seg).
RECOMMENDED FIX: Add `.cx-seg label:has(input:disabled)`, `.cx-toggle
  :disabled + span`, `.cx-switch :disabled ~ .cx-switch__track` styles
  (opacity .55, cursor:not-allowed).
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: Field primitive — missing aria-invalid propagation
LOCATION: ui/Field.tsx:42-51, cx-kit.css:302-306
CATEGORY: Accessibility
ISSUE: Field wires `htmlFor` + `aria-describedby` (hint/error, role=alert)
  correctly but never sets `aria-invalid="true"` on the cloned control — while
  cx-kit:302 explicitly styles `[aria-invalid="true"]` borders. Callers get red
  error text but no programmatic invalid state unless they hand-add it.
ROOT CAUSE: cloneElement merges describedby only; invalid flag left to callers.
IMPACT: Screen readers announce the error text but not the invalid state
  (3.3.1 partially mitigated by describedby); the styled invalid border never
  shows via the primitive path.
RECOMMENDED FIX: When `error` is set, cloneElement with `aria-invalid: true`.
CENTRALIZATION OPPORTUNITY: Yes — one-line fix propagates to every Field user.
```

```
SEVERITY: Medium
ELEMENT: --cx-ink-3 muted text token — borderline contrast
LOCATION: theme.css:137 (light) — used by table headers (cx-kit:610),
  .cpk-group (138), .card-hint, .stat-d, .nav-group-label, .popup-kicker…
CATEGORY: Accessibility / Design System
ISSUE: `--cx-ink-3: color-mix(oklab, --ink-2 85%, --surface)` resolves to roughly
  #6d7784 → estimated ~4.2-4.5:1 on --surface. It colors real text at .6563-.75rem
  (table THs, kicker/group labels, hints) where 4.5:1 applies. The primitive
  `--ink-3` (#8494a3, 3.1:1) fails outright but is unused live (0 var(--ink-3)
  hits) — and is inverted in dark (#b7c3ce brighter than --ink-2), though only
  dead sheets consume it. VERIFY on rendered output.
ROOT CAUSE: "Faint" tier tuned aesthetically, not measured; derived token drifts
  with accent/surface.
IMPACT: If it lands <4.5:1, every table header + micro-label fails 1.4.3.
RECOMMENDED FIX: Darken mix to ~78% (--ink-2 share) or use --cx-ink-2 for text
  uses; reserve faint tier for icons/decorative only.
CENTRALIZATION OPPORTUNITY: Yes — single token fix covers all consumers.
```

```
SEVERITY: Medium
ELEMENT: Off-scale typography + spacing literals
LOCATION: refresh.css:30(.6875rem), :77, :94, :137(.6563rem), :137-160,
  :203(1.65rem), :222-283(.72rem), :331(.8438rem), :642(.6563rem + weight 650),
  cx-kit.css:940(.68rem), :129, :546…
CATEGORY: Design System / Typography
ISSUE: Pervasive one-off sizes below/between the token scale
  (--text-xs .75rem is the floor): .6563rem (10.5px) cpk-group/nav-group-label,
  .68rem nav-group-label, .72rem across ~10 selectors, .8438rem, 1.3rem,
  1.65rem, .8rem; font-weight 650 (refresh:642) off the 400/500/600/700 scale.
  Spacing literals too: padding .45rem/.65rem, gaps .4rem/.6rem/.9rem, margin
  1.4rem vs --space-5 1.5rem (page-head margin differs between refresh.css:19
  and cx-kit.css:1454 straggler — same class, two margins).
ROOT CAUSE: Refresh layer authored from mockups px-faithful, never snapped to
  the 4px/scale grid.
IMPACT: Visual rhythm drift (exactly what the doc's spacing/typography audits
  flag); micro-text below 12px hurts readability on dense tables.
RECOMMENDED FIX: Snap to scale (.72→.75rem xs, .8438→.875rem md, .6563→.6875 or
  xs), or codify a --text-2xs token if the micro-size is intentional; delete the
  duplicate `.page-head` straggler.
CENTRALIZATION OPPORTUNITY: Yes — token additions + sweep; ~25 declarations.
```

```
SEVERITY: Medium
ELEMENT: Untokenized z-index scale
LOCATION: cx-kit.css:1106(z5), :1190(z6), :1184(z30), :1283(z40), :1462(z45),
  refresh.css:111(z60), cx-kit.css:1133(z60), :1360(z5)
CATEGORY: Design System / Architecture
ISSUE: z-index values 5/6/30/40/45/60 are hardcoded across rail, va-banner,
  viewing-as frame, toasts, oo-alerts, cpk-backdrop, skip link, cc-tip — no
  --z-* tokens, no documented stacking contract.
ROOT CAUSE: Values added ad-hoc per feature.
IMPACT: Overlay ordering is tribal knowledge; new overlays guess and regress
  (e.g. a z-50 toast under a z-60 palette).
RECOMMENDED FIX: Add --z-rail/--z-banner/--z-frame/--z-toast/--z-alert/--z-modal
  tokens in theme.css; swap literals.
CENTRALIZATION OPPORTUNITY: Yes — ~10 declarations → 6 tokens.
```

```
SEVERITY: Medium
ELEMENT: Inconsistent breakpoints
LOCATION: cx-kit.css:731(1180px), :735(900), :739(600), :839/912/1099(820/821),
  refresh.css:180(1200+821), :183(820), :449(900), :621(30rem), :631(900), :633(600)
CATEGORY: Responsive / Design System
ISSUE: Grid collapse uses 1200px in refresh but 1180px in cx-kit; mobile cut is
  820/821 consistently, but 900px is used for both "tablet" layouts and the
  hub/md layout, 560/480(30rem)/600px appear ad-hoc. No --bp-* tokens.
ROOT CAUSE: Per-sheet authoring without a shared breakpoint contract.
IMPACT: Layouts that mix .md + .cx-grid-* columns break at different widths →
  mid-range viewports (1180-1200px) show half-collapsed hybrids.
RECOMMENDED FIX: Standardize {480/600, 820/821, 900, 1180|1200 → one value} as
  documented breakpoints; align the grid breakpoints.
CENTRALIZATION OPPORTUNITY: Yes — token + sweep.
```

```
SEVERITY: Medium
ELEMENT: 100vh usage (no dvh fallbacks)
LOCATION: cx-kit.css:835(.shell min-block-size:100vh), :848(.rail 100vh),
  :1108(max-block-size:100vh), theme.css:88(--fill-h), refresh.css:493
  (.login-wrap min-height:100vh), cx-kit.css:812/1330 dialog max-block-size —
  28 occurrences in the audited files.
CATEGORY: Responsive
ISSUE: Mobile 100vh includes browser chrome → rail/shell/login fill can
  under/overshoot on iOS/Android URL-bar collapse; --fill-h feeds .page-fill.
ROOT CAUSE: Authored pre-dvh.
IMPACT: Layout shift + clipped footers on mobile; visible on /auth/login and
  any .page-fill dashboard.
RECOMMENDED FIX: Use `100dvh` with `100vh` fallback for fill constructs.
CENTRALIZATION OPPORTUNITY: Yes — sweep, one pattern.
```

```
SEVERITY: Medium
ELEMENT: Page width unconstrained on ultra-wide
LOCATION: theme.css:89 (--page-max: none), cx-kit.css:1453 (.page max-width)
CATEGORY: Responsive / Layout
ISSUE: --page-max:none → .page never constrains; only .page-narrow (62rem) is
  opt-in. Tables, .cx-grid-*, forms stretch full width at ≥2560px.
ROOT CAUSE: Dense-ops-console default; no max chosen.
IMPACT: Long line lengths, scattered scan paths on ultra-wide (doc explicitly
  audits ultra-wide).
RECOMMENDED FIX: Set --page-max ≈ 96-110rem or per-app; verify dashboards.
CENTRALIZATION OPPORTUNITY: Yes — single token.
```

```
SEVERITY: Medium
ELEMENT: Form control font-size 13px → iOS focus zoom
LOCATION: cx-kit.css:261-284 (.input/.cx-input/.cx-select/.cx-textarea
  font-size:--cx-text-sm = .8125rem)
CATEGORY: Responsive / Accessibility
ISSUE: iOS Safari auto-zooms focused inputs <16px. All shared controls are
  13px → page zooms on every field focus on iPhone.
ROOT CAUSE: Desktop-density sizing applied globally.
IMPACT: Disorienting zoom + layout shift on mobile form flows.
RECOMMENDED FIX: `@media (pointer:coarse)` bump control font-size to 1rem
  (or ≥16px) — target token already grows to 2.75rem there.
CENTRALIZATION OPPORTUNITY: Yes — one media block.
```

```
SEVERITY: Medium
ELEMENT: Two simultaneous entrance-animation systems
LOCATION: cx-kit.css:1123 (.main > * page-in .2s) + cx-kit.css:1473
  (:is(.page,.dq-page)>* cx-enter stagger, gated on [data-entry])
CATEGORY: Design System / Performance
ISSUE: page children run BOTH: the page div fades via page-in while each child
  runs cx-enter translate/opacity with stagger — two animation systems authored
  for the same "page enters" moment. `.main > *` also animates any later-added
  direct child (toasts/dialog mounts inside main).
ROOT CAUSE: Straggler cx-enter rules re-added (cx-kit:1435 note) on top of the
  existing page-in rule.
IMPACT: Double motion, wasted compositing on every mount; reduced-motion users
  covered only because theme.css zeroes durations globally.
RECOMMENDED FIX: Keep one system (recommend cx-enter under [data-entry]) and
  scope it to page containers, not all .main children.
CENTRALIZATION OPPORTUNITY: Yes.
```

```
SEVERITY: Medium
ELEMENT: Chip implementations ×3 (+ untyped status strings)
LOCATION: ui/Chip.tsx, ui/StatusChip.tsx (pure pass-through), shell/ui.tsx:199
  (third Chip)
CATEGORY: Architecture / Design System
ISSUE: StatusChip is Chip verbatim (adds nothing but a required prop); a third
  Chip lives in shell/ui.tsx used by ~20 shell imports vs 46 barrel imports.
  `status?: string` accepts any string → typos silently render neutral chips.
ROOT CAUSE: Legacy port kept shell-level copies next to the new barrel.
IMPACT: Three import paths for one widget; drift risk (already diverged: shell
  Chip lacks `plain`); misspelled statuses fail silently.
RECOMMENDED FIX: One Chip + `status` union type ('neutral'|'info'|'ok'|'warn'|
  'bad'); delete StatusChip + shell Chip, re-export barrel.
CENTRALIZATION OPPORTUNITY: Yes — 3→1.
```

```
SEVERITY: Medium
ELEMENT: Dialog/popup selector sprawl (+ dead .cx-dialog family)
LOCATION: cx-kit.css:810-826 (.cx-dialog, .cx-dialog__head/__body/__foot —
  0 users), :1322 (dialog.popup, .trk-dialog, .hm-dialog, .pw-dialog),
  ui/Modal.tsx (uses .popup; 0 importers — Popups.tsx writes .popup raw)
CATEGORY: Architecture / Design System
ISSUE: Five dialog class contracts coexist; two are completely dead
  (.cx-dialog* CSS ~17 lines, Modal.tsx). Live popups bypass the Modal
  primitive entirely (shell/Popups.tsx, ViewAs.tsx, tph-grid-page use raw
  <dialog class="popup">).
ROOT CAUSE: Per-app dialog classes merged without consolidation; primitive
  added but never adopted.
IMPACT: Dead code + inconsistent dialog geometry contracts; aria/head-body-foot
  structure differs by which class a page happened to use.
RECOMMENDED FIX: Standardize on one dialog component + `.popup` (or rename
  cx-dialog onto it); delete dead rules.
CENTRALIZATION OPPORTUNITY: Yes — 5→1.
```

```
SEVERITY: Medium
ELEMENT: Small-button class quadruplication
LOCATION: cx-kit.css:198 (.btn-small 2rem), :200-201 (.btn-sm/.cx-btn--sm
  1.9rem), :205 (.cx-btn--small 2rem — verbatim duplicate of :198)
CATEGORY: Design System
ISSUE: `.btn-small` and `.cx-btn--small` are identical rules 7 lines apart;
  a third 1.9rem variant exists (.cx-btn--sm, used raw in 3 files) while
  Button size="sm" emits .cx-btn--small (5 files) — two different small sizes
  0.1rem apart with near-identical names.
ROOT CAUSE: Legacy .btn-* names mirrored under cx-* without dedup.
IMPACT: Visual jitter (32px vs 30.4px buttons side by side); confusion.
RECOMMENDED FIX: Keep one (--sm, 2rem); alias the rest; codemod raw users.
CENTRALIZATION OPPORTUNITY: Yes — 4 selectors → 1.
```

```
SEVERITY: Medium
ELEMENT: RTL physical-property leftovers
LOCATION: refresh.css:453-484 (.agenda padding-left/::before left:3.55rem/
  .ag-item::before left:-1.42rem), :210-218 (.stat[data-tone]::before
  inset:0 auto 0 0 — physical left), :640 (.trk-misfit inset 3px 0 0 shadow)
CATEGORY: Responsive / Accessibility (dir=rtl is a supported mode — boot sets it)
CATEGORY NOTE: layout.tsx:23 sets dir=rtl for lang=ar.
ISSUE: Timeline rail, stat accent stripe, and table warn-stripe are pinned to
  physical left; in RTL they stay left instead of flipping to inline-start.
ROOT CAUSE: Refresh layer authored LTR-only (unlike cx-kit which uses logical
  props + [dir=rtl] blocks).
IMPACT: Arabic-mode layout defects — stripes/bullets on the wrong side,
  misaligned agenda.
RECOMMENDED FIX: Convert to logical props (inset-inline-start) or add [dir=rtl]
  overrides like cx-kit:432/1424.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: .delta semantic inversion + .cx-toggle display conflict + misc defects
LOCATION: refresh.css:220-236 (.delta.up = bad-fg / .down = ok-fg, overridden by
  .delta.up.good); cx-kit.css:365-366 (.cx-toggle display:inline-flex then
  inline-block — later wins); refresh.css:634 (.dq-groupbreak uses
  var(--cx-muted, inherit) — --cx-muted is a class, not a defined token);
  cx-kit.css:595 duplicates theme.css:194 `table{font-size}`; cx-kit.css:1279
  (.toasts margin-inline-start rail calc — only constrains width <~44rem, likely
  vestigial); cx-kit.css:703 (.cx-need uses --cx-shadow-pop on a static card vs
  shadow-1 elsewhere); theme.css:463-475 (--qg-* tokens referenced, defined in
  quality-area sheets, not here); ui/Seg.tsx (required prop spreads onto <div>
  → invalid DOM attr).
CATEGORY: Design System / Maintainability
ISSUE: Collection of small contradictions/dead fallbacks documented above.
ROOT CAUSE: Accretion across port waves.
IMPACT: Confusing APIs (.delta.up.bad vs .up.good), dead CSS, silent fallbacks.
RECOMMENDED FIX: Invert .delta defaults or rename to .delta.worse/.better;
  pick one display value; define or drop --cx-muted; drop duplicate table rule;
  swap shadow-pop→shadow-1 on .cx-need; validate Seg props.
CENTRALIZATION OPPORTUNITY: Mixed (per item).
```

```
SEVERITY: Low
ELEMENT: SiteChrome auth-route detection
LOCATION: layout/SiteChrome.tsx:30
CATEGORY: Architecture
ISSUE: `pathname.startsWith('/auth/')` misses a hypothetical bare `/auth`
  route (today only callback/login/logout exist — all match). Suspense
  fallback=null hides the whole chrome during prerender (deliberate per
  comment; boot splash covers it).
ROOT CAUSE: Prefix check instead of segment match.
IMPACT: Only a future /auth index page would render with full AppShell chrome.
RECOMMENDED FIX: `pathname === '/auth' || pathname.startsWith('/auth/')`.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Component API gaps (no dead controls, but brittle contracts)
LOCATION: ui/Modal.tsx (no backdrop-click close, no aria-labelledby contract,
  relies on caller markup); ui/Tabs.tsx (panels lack tabIndex={0} — scrollable
  panels unreachable by keyboard; no aria-orientation); ui/Seg.tsx (name prop
  required — good); ui/Button.tsx (single size option; variant set minimal —
  fine for baseline).
CATEGORY: Accessibility / Design System
ISSUE: Minor a11y contract gaps in unused/low-use primitives; noted so the
  baseline is honest if these get adopted.
RECOMMENDED FIX: Add labelledby prop + light-dismiss to Modal; tabIndex 0 +
  aria-orientation on Tabs panels.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Baseline positives (noted for balance)
LOCATION: theme.css:427-514 (pointer:coarse target bump, forced-colors ring,
  reduce-transparency, reduced-motion zeroing); cx-kit.css:37-69 ([data-status]/
  [data-age] attribute-driven token triples — clean pattern); cx-kit.css:115-126
  (focus-visible pinned on all interactive classes); ui/Field.tsx (label+
  describedby wiring); Skeleton aria-hidden; logical properties used widely in
  cx-kit; print block cx-kit.css:1426.
CATEGORY: —
ISSUE: These are correct and should be the pattern other areas follow.
RECOMMENDED FIX: —
CENTRALIZATION OPPORTUNITY: No.
```

---

## A. Layout & Alignment Summary
- Components reviewed: 20 ui primitives + SiteChrome + 5 CSS files (~3.7K lines live CSS audited; styles/*.css out of scope = other shards).
- Misaligned/overlapping elements: 0 verifiable statically; `--page-max:none` ultrawide stretch is the structural flag.
- Spacing violations: ~15 off-scale literals (see typography finding); `.page-head` defined twice with different margins (refresh.css:19 1.4rem vs cx-kit.css:1454 --space-5).

## B. Design-System Violations (severity)
- High: unused primitive set (6/18); three style generations w/ divergent same-semantic classes; Tabs selected-state broken + .cx-tab dead.
- Medium: dead sheets + dead CSS families (.cx-dialog, .pw-seg-vs-cx-seg-vs-.seg, .agechip d0-3 vs 7-step ramp); token layer duplication (~80 --cx-* aliases of --* primitives); untokenized z-index; breakpoint drift; 100vh; iOS input zoom; double entrance animations; Chip×3; dialog×5; small-btn×4; RTL physical props.
- Low: .delta semantics; .cx-toggle display conflict; --cx-muted phantom var; duplicate table font-size rule; .toasts rail margin; .cx-need pop shadow; Seg `required` spread; SiteChrome prefix edge case.

## C. Shared-Components Opportunity Report
- Centralize: Tabs→.cx-tab contract; Chip/StatusChip/shell-Chip→1; dialogs→1 (adopt or delete Modal); segmented controls (seg/cx-seg/pw-seg)→1 primitive w/ mode prop; notes/empties/cards/tables→canonical family each.
- Tokenize: z-index scale; breakpoints; --text-2xs (if micro-text intentional); --page-max.
- Extract: eslint rule or codemod banning raw `cx-table`/`cx-panel`/`.card` markup in favour of primitives (or vice-versa — pick one).
- Duplicated implementations live in: every feature area (36 files .card, 21 cx-table raw, 40 .empty-family, 33 .note-family, 28 .pill, 13 raw .btn).

## D. Technical-Debt Analysis
- Duplicate code: ~35-45% of the audited CSS is either dead (globals+legacy-apps ≈ 2.4K lines/~230KB not loaded) or a second/third implementation of the same widget. ~250 of ~600 primitive lines are dead components.
- Refactor effort: M — mostly mechanical class renames + deletes; risky part is visual diffing the divergent pairs (.note vs .cx-note etc.).
- Highest-risk areas: the load-order/specificity contract (`:root .cls` ties beat `[data-app]` sheets) — any reorder of CSS imports or specificity changes breaks visual hierarchy silently; Tabs primary+quiet stacking proves the fragility.

## E. Architecture Scorecard (/10, this baseline only)
- UI Consistency: 4 — three vocabularies, divergent same-semantic classes.
- Layout Quality: 7 — solid grid/rail system, logical props, but ultrawide + RTL gaps.
- Design System Compliance: 3 — tokens exist and are good; usage bypasses them constantly; dead files claim "source of truth".
- Component Reusability: 4 — form controls adopted; surfaces/tabs/dialogs dead.
- Responsiveness: 6 — coarse-pointer targets + mobile rail exist; 100vh, breakpoint drift, iOS zoom, ultrawide.
- Accessibility: 6 — focus rings, reduced-motion, describedby are genuinely good; disabled-invisible, Tabs trap, borderline ink-3, aria-invalid gap.
- Performance: 6 — dead CSS not shipped (good); ~230KB dead source; double animations.
- Maintainability: 3 — misleading headers, specificity hacks, duplicated everything.
- Scalability: 4 — new widgets get added per-area instead of centrally.

## F. Top 20 Priority Fixes (this area; merged into global Top 20 by PM)
1. Pick ONE class family per widget (recommend .cx-* kit) + codemod — kills the largest debt. (H, high effort/high payoff)
2. Fix Tabs → render .cx-tab (or delete) + delete dead .cx-tab CSS if unused. (H, trivial)
3. Delete/relocate globals.css + legacy-apps.css; fix stale "loads last"/"source of truth" headers. (M, trivial)
4. Add disabled styling for cx-seg/cx-toggle/cx-switch spans. (M, small)
5. Field: propagate aria-invalid when error set. (M, 1 line)
6. Collapse small-button classes to one --sm. (M, small)
7. One Chip + typed status union; delete StatusChip/shell Chip. (M, small)
8. Snap off-scale font sizes/weights to scale (or add --text-2xs). (M, sweep)
9. z-index token scale. (M, small)
10. Breakpoint normalization (1180 vs 1200 etc.). (M, sweep)
11. 100vh→100dvh (fill/shell/rail/login/dialogs). (M, sweep)
12. Single dialog contract; delete .cx-dialog + adopt-or-delete Modal. (M, medium)
13. iOS input font-size ≥16px under pointer:coarse. (M, 1 media block)
14. Choose one entrance system; scope to .page children. (M, small)
15. --page-max default for ultra-wide. (M, 1 token)
16. RTL logical-prop fixes (.agenda, .stat tone stripe, .trk-misfit). (M, small)
17. Measure + fix --cx-ink-3 if <4.5:1 (VERIFY in browser). (M, 1 line)
18. Fix .delta.up semantics / rename. (L, trivial)
19. .page-head duplicate rule delete; .cx-toggle display conflict; --cx-muted phantom var; Seg required-spread. (L, trivial)
20. Decide Empty/Card/Table primitives: adopt with codemod or delete from barrel. (H, strategic — with #1)

Not verified (no shots/ rendered): actual contrast of --cx-ink-3 mix, Tabs visual state in-situ (code-proven broken regardless), mobile rail/overflow behaviour, reduced-motion coverage in practice.
