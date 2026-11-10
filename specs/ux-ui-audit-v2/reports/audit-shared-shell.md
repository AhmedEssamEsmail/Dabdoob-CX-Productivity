# Area audit — shared-shell (nav, topbar, toasts, view-as, command palette, popups)

Scope: `src/features/shared/components/shell/*` (AppShell, Topbar, CommandPalette, ViewAs, Popups, Toasts, OneOnOneAlerts, ErrorBoundary, StateScreen, BootSplash, HashShim, NavIcon, ui.tsx, registry.ts), `src/features/shared/shell/` (context/gates/i18n), `platform/`, `lib/`, `vendor/` + the shell-owned CSS blocks (`cx-kit.css:832-1464` rail/nav/view-as/toasts/dialogs; `refresh.css:8-159` topbar/rail-search/palette/icon-btn/avatar).

`platform/`, `lib/`, `vendor/`, `shell/` contain **zero rendered UI** (verified by grep: no className/aria/role in any of them) — bootstrap, view-as, popups, notify, vendor API clients are logic only; they surface through the components above and are otherwise clean for this audit.

Rendered shots: rail + topbar verified in `shots/home--1440/390.png`, `quality-scores--1440.png`, `queue--768.png` (every shot carries the shell). No shot captures: palette open, view-as banner, reminders dialog, toast, oo-alert, collapsed-rail mode — those findings are code-derived (marked VERIFY where a rendered check would settle them).

Capture-environment note: the red "1 Issue ×" pill bottom-left in shots is the **Next.js dev-overlay indicator**, not app UI — it overlays the rail foot; ignore it as a defect.

---

## FINDINGS

```
SEVERITY: High
ELEMENT: Rail search button — accessible name destroyed in collapsed rail
LOCATION: AppShell.tsx:513-537 (.rail-search) + refresh.css:98-100
CATEGORY: Accessibility (WCAG 4.1.2, Level A)
ISSUE: The button's name comes from its text content. In `.rail-off` the
  `.rail-search-label` and `kbd` go `display:none` (98-100) and the svg is
  aria-hidden — the button has NO accessible name in the collapsed rail; a
  screen-reader user hears an unnamed button for the primary ⌘K entry point.
  `.nav-group-label` survives the same collapse because it sets aria-label
  (AppShell.tsx:552) — the pattern exists, this control just didn't get it.
ROOT CAUSE: rail-off hides label text with display:none instead of the
  visually-hidden/absolute technique used for `.nav-text` (cx-kit:1023-1044);
  no aria-label fallback on the button.
IMPACT: Every rail-off screen reader session loses palette discoverability.
RECOMMENDED FIX: Add `aria-label={D('Search or jump to…')}` to .rail-search
  (and optionally `title`); or swap display:none for the .nav-text technique.
CENTRALIZATION OPPORTUNITY: No (1 line).
```

```
SEVERITY: High
ELEMENT: Shell buttons carry 2-3 competing button vocabularies at once
LOCATION: ViewAs.tsx:117-119 (`cx-btn btn va-switch`), AppShell.tsx:504
  (cx-btn + .nav-toggle), :615 (cx-btn + .rail-collapse), ViewAs.tsx:176
  (cx-btn + .va-person); raw .btn: AppShell.tsx:332, ViewAs.tsx:46, :201,
  Popups.tsx:129-137, OneOnOneAlerts.tsx:214-226, ErrorBoundary.tsx:34
CATEGORY: Design System / Architecture
ISSUE: <Button> always emits `cx-btn` (Button.tsx:22-28); shell callers then
  append `.btn`, `.nav-toggle`, `.rail-collapse`, `.va-open`, `.va-person`,
  `.va-switch` — all standalone button contracts that re-declare padding,
  min-height, borders and colors. Same specificity, load-order decides which
  wins per property — the exact mechanism that silently broke Tabs in the
  baseline report. Meanwhile five other shell buttons bypass the primitive
  entirely (raw `.btn`). The shell — the most visible surface — demonstrates
  all three vocabulary generations on adjacent elements.
ROOT CAUSE: Legacy .btn class contract kept "for parity" while new controls
  were built as cx-btn; the two were stacked rather than migrated.
IMPACT: Visual drift already visible (va-switch shows dashed .btn chrome on a
  cx-btn base); any restyle must chase 8 selector contracts (.cx-btn, .btn,
  .nav-toggle, .rail-collapse, .rail-signout, .icon-btn, .va-*, .rail-search).
RECOMMENDED FIX: Extend Button with the needed variants/sizes (quiet, icon,
  link-ish) and delete the per-class contracts, or keep raw classes and drop
  cx-btn from these callers — pick one system per element.
CENTRALIZATION OPPORTUNITY: Yes — one Button API; ~10 call sites in shell.
```

```
SEVERITY: Medium
ELEMENT: Nav group label — pointer target <24px
LOCATION: refresh.css:642 (.nav-group-label) — button at AppShell.tsx:546-564
CATEGORY: Accessibility (WCAG 2.5.8 AA)
ISSUE: Full-width button, but block size is ~.6563rem text + .25rem padding
  ≈ 17px. It is not in the interactive-target selector list (cx-kit:108-110)
  and has no min-block-size, so it misses the 24px AA floor; under
  pointer:coarse it stays ~17px while siblings grow to 44px.
ROOT CAUSE: Group header restyled as a button in refresh.css without joining
  the --cx-target contract.
IMPACT: Motor-impaired and touch users get a hard-to-hit expand/collapse on
  every group of the primary nav.
RECOMMENDED FIX: `min-block-size` ≥1.5rem (or add to the --cx-target list);
  keep the small text via line-height, not box height.
CENTRALIZATION OPPORTUNITY: Yes — token already exists.
```

```
SEVERITY: Medium
ELEMENT: Notification bell — count is a 7px dot only; dead when empty
LOCATION: Topbar.tsx:36-54 + refresh.css:340-353 (.icon-btn .dot) +
  AppShell.tsx:644 (onBell → reopenTick)
CATEGORY: Accessibility / UX
ISSUE: Pending reminders are indicated solely by a 7px red dot: no count, no
  text, and `aria-label="Notifications"` never changes — AT users hear nothing
  about pending state (1.4.1-adjacent, 4.1.2). With pending=0 the button does
  literally nothing on click (dismissed-set cleared on an empty set) — a dead
  control with no feedback. The count itself is "not-dismissed-this-session",
  not "unresolved", so the dot semantics are also misleading.
ROOT CAUSE: Visual-only badge; reopenTick is the only wired affordance.
IMPACT: Screen-reader users never learn reminders exist; sighted users get a
  click that does nothing when empty.
RECOMMENDED FIX: aria-label=`Notifications (${pending} pending)`; render the
  count (or sr-only text); on click with 0, toast('No reminders') or disable.
CENTRALIZATION OPPORTUNITY: Yes — a Badge/count pattern for .icon-btn.
```

```
SEVERITY: Medium
ELEMENT: document.title — app title only, never the page
LOCATION: AppShell.tsx:253-255
CATEGORY: Accessibility (WCAG 2.4.2) / UX
ISSUE: `document.title = ctxTitle` — every route titles identically
  ("Dabdoob CX Quality" etc.). Tabs, history, bookmarks and window-switchers
  can't distinguish pages; the two title-flashers (Popups.tsx:51-59,
  OneOnOneAlerts.tsx:161-170) capture/restore this static title.
ROOT CAUSE: Ported per-app behavior (one title per app) into a unified app
  that now serves 40 routes.
IMPACT: All 40 routes share ~8 distinct titles; navigation context lost.
RECOMMENDED FIX: `document.title = \`${D(current.title)} · ${ctxTitle}\``.
CENTRALIZATION OPPORTUNITY: No (1 line).
```

```
SEVERITY: Medium
ELEMENT: Shell i18n split — half the shell ignores D()
LOCATION: D()-wrapped: AppShell, CommandPalette, StateScreen. Hardcoded
  English: ViewAs.tsx (banner, picker, errors — incl. aria-label="View as"),
  Topbar.tsx:39,58 (aria-labels/titles), Popups.tsx:114-138,
  OneOnOneAlerts.tsx:199-233, LoadError ui.tsx:91-94, ErrorBoundary.tsx:31-39,
  PageHead/timeAgo/vsPrev strings in ui.tsx
CATEGORY: Design System / Accessibility (lang=ar is a supported mode —
  i18n.ts:59-60 sets dir=rtl)
ISSUE: In Arabic mode the rail/page furniture translates but the view-as
  banner, reminder popups, 1:1 alerts, error screens and topbar tooltips stay
  English — a mixed-language chrome on the elements most tied to duty.
ROOT CAUSE: Per-file porting waves; later files never wrapped strings.
IMPACT: RTL users get English on the highest-attention surfaces (alerts).
RECOMMENDED FIX: Wrap all shell strings in D(); add missing keys to
  specs/legacy-parity/data/legacy-i18n-ar.json.
CENTRALIZATION OPPORTUNITY: Yes — one dictionary sweep.
```

```
SEVERITY: Medium
ELEMENT: Command palette — focus restores to the wrong element
LOCATION: AppShell.tsx:222-229 (ux-14 comment) — always .rail-search
CATEGORY: Accessibility (WCAG 2.4.3)
ISSUE: Every close path restores focus to `.rail-search`. When the palette
  was opened via ⌘K while focus sat in a page input, Esc drops the user at
  the rail — focus order jumps, the field context is lost. Correct for the
  click-path, wrong for the keyboard-path that dominates palette usage.
ROOT CAUSE: Restore target hardcoded instead of capturing the invoker.
IMPACT: Keyboard users lose their place on every palette round-trip.
RECOMMENDED FIX: Store `document.activeElement` at open; restore it on close
  (fall back to .rail-search). Also add aria-expanded to ViewAsPicker's
  trigger (ViewAs.tsx:117-122) which has aria-haspopup but no state.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: Toasts — fixed 4s expiry, no pause, no dismiss
LOCATION: Toasts.tsx:29-49 + cx-kit.css:1273-1316
CATEGORY: Accessibility (WCAG 2.2.1-adjacent) / UX
ISSUE: All tones expire at 4s with no hover-pause, no close button, no
  persistence. Callers send long actionable errors (e.g. scheduler-page:1005
  "Re-read every input. The roster only changes when…" — 90+ chars) that are
  unreadable in the window; error and success get identical lifetimes.
  `toast(text, tone)` takes a free-form string — an unknown tone silently
  renders the default ok-stripe.
ROOT CAUSE: Legacy emitter kept verbatim; tone never typed.
IMPACT: Actionable errors vanish before they can be read or acted on.
RECOMMENDED FIX: Pause on hover/focus; error tone → sticky or ≥10s + close
  button; type tone as 'ok'|'info'|'warn'|'error'.
CENTRALIZATION OPPORTUNITY: Yes — typed toast API for all 52 call sites.
```

```
SEVERITY: Medium
ELEMENT: dialog.popup — modal with no visible scrim (two overlay systems)
LOCATION: cx-kit.css:1322-1340 + :1455 (::backdrop animation only) vs
  .cpk-backdrop refresh.css:110-115 (var(--scrim) rgba(15,23,32,.5))
CATEGORY: Design System / UX
ISSUE: `.popup` (reminders, view-as picker) never sets a ::backdrop
  background — the UA default is ~10% black, so modals float over a nearly
  undimmed page while the sibling command palette dims with --scrim (.5).
  Two shell-owned modal systems, two different overlay treatments.
  VERIFY rendered: Chrome's UA sheet may be the only scrim — it is visibly
  weak either way.
ROOT CAUSE: Custom overlay built for the palette; native dialogs styled for
  geometry but the backdrop contract forgotten.
IMPACT: Weak modal separation; inconsistent focus signaling between the two
  most prominent overlays.
RECOMMENDED FIX: `dialog.popup::backdrop, dialog.trk-dialog::backdrop,
  dialog.hm-dialog::backdrop { background: var(--scrim) }` (keep fade-in).
CENTRALIZATION OPPORTUNITY: Yes — one scrim token, already exists.
```

```
SEVERITY: Medium
ELEMENT: va-banner-error — red error text on amber banner
LOCATION: ViewAs.tsx:41 + cx-kit.css:1203 (--cx-status-bad-fg on --signal bg)
CATEGORY: Accessibility (WCAG 1.4.3 — VERIFY measured contrast)
ISSUE: Exit-failure errors render --cx-status-bad-fg (~#b3261e) on --signal
  #e9a412: estimated ~4.0:1 — below the 4.5:1 needed at .875rem. Banner body
  itself (--signal-ink #3a2a00 on #e9a412 ≈ 7:1) is fine; the error tier is
  the failure.
ROOT CAUSE: Status color chosen for surfaces, applied on a tinted banner.
IMPACT: The one message a view-as user must read on failure may fail AA.
RECOMMENDED FIX: Use --signal-ink text + bold, or a bad-bg chip on the banner.
CENTRALIZATION OPPORTUNITY: No (1 line).
```

```
SEVERITY: Medium
ELEMENT: Topbar contract — duplicated title, muted current, phantom height
LOCATION: Topbar.tsx:30-34 + refresh.css:9-15; theme.css:130
  (--cx-topbar-height) + cx-kit.css:534 (.cx-dock offset)
CATEGORY: Layout / Design System
ISSUE: (a) Crumb "Quality / Team scores" repeats the in-page h1 "Team scores"
  ~40px below it on every page — visible in quality-scores--1440.png.
  (b) The current page is bold --cx-ink-2, same muted color as the group —
  weakest element carries the most meaning; " / " is a literal text slash
  (announced as "slash", no nav landmark). (c) --cx-topbar-height:3rem exists
  and .cx-dock reserves it, but .topbar isn't sticky — space is reserved for
  a topbar that scrolls away; in the dead legacy sheets it's 3.5rem.
ROOT CAUSE: Crumb pattern ported for a shell where pages lacked h1s; the
  sticky-topbar token is leftover intent.
IMPACT: Redundant title noise on 40 pages; wrong-sized dock offsets.
RECOMMENDED FIX: Keep crumbs OR in-page h1 — if kept, wrap in
  <nav aria-label="Breadcrumb"> and make the current page --cx-ink; decide
  sticky vs not and align .cx-dock to reality.
CENTRALIZATION OPPORTUNITY: Yes — Topbar is already shared; fix once.
```

```
SEVERITY: Medium
ELEMENT: oo-alerts — live-region misuse + no sound control
LOCATION: OneOnOneAlerts.tsx:186-236 + cx-kit.css:1462-1472
CATEGORY: Accessibility / UX
ISSUE: (a) `aria-label` on a plain <div className="oo-alerts"> — dropped,
  needs role="region". (b) 'soon' alerts get role=status yet aria-live=
  "assertive" — contradicts the implicit polite and interrupts for a
  15-min-away reminder. (c) Chime plays on every start alert once audio
  unlocks; "Sound off: click anywhere to allow it" offers the reverse of a
  control — there is no way to mute, ever. (d) 'In N min' countdown is
  render-time text, stale between 60s polls. (e) Hardcoded English (i18n).
ROOT CAUSE: Legacy parity port; assertive copy-paste; no preference surface.
IMPACT: Interruptive announcements; users stuck with sound they can't stop.
RECOMMENDED FIX: role="region"; assertive only on data-type=start; add a
  mute toggle persisted to localStorage; tick countdown per minute.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: Off-scale literals inside shell CSS (spacing/typography)
LOCATION: refresh.css:642 (.6563rem + weight 650 nav-group-label), :137
  (.6563rem cpk-group), :79-97 (.75/.45/.65rem rail-search margins/padding,
  .6875rem kbd), :11 (1.4rem topbar margin), :113 (12vh palette top),
  :124-143 (.8/.45/.55/.4rem cpk paddings), :348-352 (7px dot, top:4px
  right:5px), cx-kit.css:1205 (va-exit 2.25rem), :1145 (14vh state-screen)
CATEGORY: Design System / Typography / Spacing
ISSUE: ~15 one-off values below/between the token scales inside shell chrome
  alone — the same drift the baseline flagged sheet-wide, concentrated in the
  newest shell layer (palette, rail-search, group labels).
ROOT CAUSE: px-faithful port of the mockups' chrome.
IMPACT: Rhythm drift on the most-seen surface; micro-labels at 10.5px.
RECOMMENDED FIX: Snap to scale (baseline fix #8 covers the same literals).
CENTRALIZATION OPPORTUNITY: Yes — with the baseline's typography sweep.
```

```
SEVERITY: Low
ELEMENT: Palette — unranked fuzzy match + hard 20-item slice + misc
LOCATION: CommandPalette.tsx:23,42-47,91-94; markup :192-227
CATEGORY: UX / Architecture
ISSUE: Subsequence match keeps registry order — 'admin' can bury the exact
  Admin page under earlier groups; slice(0,20) then hides overflow matches
  entirely. Items repeat their group name in a `.cpk-kbd`-styled <span>
  (kbd styling on a non-key hint, duplicating the group label above); groups
  are role=presentation with no role=group/aria-labelledby; no footer hint
  (↑↓ Enter Esc); in-app picks router.push without the view-transition the
  rail uses (inconsistent transition); Tab is preventDefaulted outright —
  safe but removes expected dialog Tab cycling between input and list.
ROOT CAUSE: Minimal port; correctness over ranking.
IMPACT: Discoverability degrades as PAGES grows; small polish gaps.
RECOMMENDED FIX: Score matches (exact > prefix > subsequence), cap after
  ranking; use a real <kbd> only for keys (move group name to plain span);
  role="group" + aria-labelledby per group; footer hint line.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Dead/vestigial shell CSS + phantom tokens
LOCATION: cx-kit.css:880 (.brand-mark — superseded by .brand-logo img,
  AppShell.tsx:493), :1007-1019 (.nav-ext/.nav-ext-note — no markup),
  :970-971 (.nav-link--off — no markup), :1288 (.cx-toast twin of .toast),
  :1325 (.pw-dialog in shared dialog rule — lives in people.css scope),
  :982-984 (--qg-dur-ind / --qg-* quality-sheet token names inside shell
  .nav-ind), :1279 (--rail-w fallback chain — --rail-w undefined outside
  [data-app] pins)
CATEGORY: Architecture / Maintainability
ISSUE: Dead selector weight + cross-area token names in the shell contract;
  --qg-* reads as "quality owns it" yet .nav-ind is global.
ROOT CAUSE: Accretion + generated-name leakage across sheets.
IMPACT: Auditors re-audit dead rules; token provenance misleading.
RECOMMENDED FIX: Delete dead selectors; rename --qg-dur-ind → --cx-dur-ind
  (or drop the var for a literal).
CENTRALIZATION OPPORTUNITY: Yes — dead-CSS sweep, ~30 lines.
```

```
SEVERITY: Low
ELEMENT: rail-off leftovers — brand-sub visible, double active highlight
LOCATION: refresh.css:77 (.brand-sub) vs cx-kit.css:1075 (hides only
  .brand-name/.rail-who); cx-kit.css:965-984 (.nav-link[aria-current] bg +
  .nav-ind tone pill both render)
CATEGORY: Layout / Design System
ISSUE: (a) In mini-rail, `.brand-name` hides but `.brand-sub` "Operations
  console" stays — clipped stray text under the logo. (b) The active link
  gets accent-soft background AND the tone-tinted .nav-ind pill — two
  overlapping active indicators in different hues.
ROOT CAUSE: rail-off rules written against brand-name only; nav-ind added
  on top of the class-based current style.
IMPACT: Small visual sloppiness in the collapsed mode.
RECOMMENDED FIX: Hide .brand-sub in rail-off; let .nav-ind be the only
  active background (or remove it and keep the link bg).
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Mobile/touch polish — kbd hint + icon-btn sizing + dead avatar
LOCATION: refresh.css:93-100 (.rail-search kbd visible at 390px — see
  home--390.png), :340-353 (.icon-btn 2rem fixed, no coarse bump), 
  Topbar.tsx:55-76 (avatar aria-hidden, no menu)
CATEGORY: Responsive / UX
ISSUE: "Ctrl K" kbd chip renders on touch devices where no keyboard exists;
  .icon-btn stays 32px while --cx-target grows to 44px on coarse pointers
  (passes 2.5.8's 24px but below the app's own target convention); the topbar
  avatar is decorative-only — looks like a user menu, does nothing (sign-out
  lives only in the rail foot).
ROOT CAUSE: Desktop-first chrome contracts.
IMPACT: Minor confusion; below-convention touch targets on the topbar.
RECOMMENDED FIX: `.rail-search kbd { display:none }` under
  (pointer:coarse); include .icon-btn in the target contract; give the
  avatar a menu or de-emphasize it.
CENTRALIZATION OPPORTUNITY: Yes — --cx-target exists.
```

```
SEVERITY: Low
ELEMENT: Latent traps + misc defects
LOCATION: ui.tsx:81-98 (LoadError renders "Try again" button even when
  onRetry is undefined — every one of ~15 current callers passes it, so the
  dead-button path is latent only); ui.tsx:208-228 (PageHead uses desk-queue
  .dq-head classes for a shared primitive + hardcoded id="page-title" —
  duplicate id if two heads render); AppShell.tsx:157-178 (nav-ind
  useLayoutEffect re-measures DOM every render); Popups.tsx:107-111 (Esc on
  reminders = "Later", no permanent dismiss — deliberate nag, noted);
  Toasts.tsx:32-35 (setTimeout not cleaned on unmount); BootSplash.tsx:9
  (z-index:50 literal — joins the untokenized z-sprawl); AppShell.tsx:552
  (aria-label duplicates visible group text — harmless, required for
  rail-off)
CATEGORY: Maintainability / Accessibility
ISSUE: Small contract brittleness noted for honesty.
RECOMMENDED FIX: Require onRetry or hide the button; unique id prop on
  PageHead; cleanup timer; add BootSplash z to the z-token sweep.
CENTRALIZATION OPPORTUNITY: Mixed.
```

```
SEVERITY: Low
ELEMENT: Shell positives (noted for balance)
LOCATION: AppShell.tsx:481 (.skip → #main + tabIndex=-1), :538-583
  (aria-current, aria-expanded/controls on groups, hidden on closed ul,
  aria-labelledby), :222-229 (deliberate focus-restore attempt), :197-213
  (⌘K ignored inside inputs except the palette's own), CommandPalette.tsx
  (aria-modal + combobox + activedescendant + body scroll-lock + Esc +
  backdrop dismiss + scrollIntoView), ViewAs.tsx (native dialog + label
  wiring + loading/empty/error states + busy-disable), Popups.tsx (Esc→Later
  via onCancel), Toasts (role=status aria-live), BootSplash (pre-paint,
  role=status, reduced-motion + dark variants, bilingual text), NavIcon
  (aria-hidden), .va-banner (role=region landmark), rail-off nav-text
  technique (labels preserved for AT), theme.css focus-visible + forced-
  colors + reduced-motion rails all consumed by the shell.
CATEGORY: —
ISSUE: These are correct patterns; feature areas should copy them.
RECOMMENDED FIX: —
CENTRALIZATION OPPORTUNITY: No.
```

---

## A. Layout & Alignment Summary
- Components reviewed: 14 shell component files (~2.7K lines) + registry + ~40 shell CSS selector families across cx-kit.css/refresh.css; 4 logic dirs (no UI).
- Misaligned elements: 0 structural in shots; `.brand-sub` remnant clipped in rail-off (Low). The rail-foot "overlap" in shots is the Next dev overlay, not app UI.
- Overlapping elements: double active-nav highlight (accent-soft bg + .nav-ind pill).
- Spacing violations: ~15 off-scale literals concentrated in palette/rail-search/group-label/topbar chrome (see findings).
- Topbar crumb duplicates the in-page h1 on all 40 routes.

## B. Design-System Violations (severity)
- High: cx-btn+btn+standalone stacked button vocabularies on shell controls.
- Medium: .nav-group-label off the --cx-target contract; popup vs palette scrim divergence; va-banner-error status-color-on-signal; topbar muted-current + phantom --cx-topbar-height; ~15 off-scale literals; i18n split.
- Low: .cx-toast/.nav-ext/.nav-link--off/.brand-mark dead selectors; --qg-* phantom tokens in .nav-ind; kbd-styled non-kbd chip (.cpk-kbd); PageHead borrowing .dq-head classes.

## C. Shared-Components Opportunity Report
- Centralize: one Button variant set covering .btn/.nav-toggle/.rail-collapse/.va-*/.icon-btn; one modal contract (native dialog + --scrim backdrop) for popup/palette/pickers; one Badge/count for .icon-btn; one empty-state style (.va-empty/.cpk-empty/.empty/.cx-empty); one kbd-chip style (.rail-search kbd vs .cpk-kbd).
- Tokenize: join baseline's z-index sweep (.cpk 60, .skip 60, .oo-alerts 45, .toasts 40, .viewing-as::after 30, .va-banner 6, .rail 5, BootSplash 50) and breakpoint sweep (shell uses 820/821 consistently — good).
- Extract: focus-restore utility (palette + future dialogs); typed toast tones; D() sweep across shell strings.
- Hooks: `useDialogModal` (showModal + close sync + focus) would dedupe the 3 hand-rolled patterns (Popups, ViewAsPicker, palette).
- Pages using duplicated implementations: all 40 routes consume this shell — every shell fix is global leverage.

## D. Technical-Debt Analysis
- Duplicate code: ~15-20% of the shell area (three modal impls, two kbd chips, two empty styles, stacked button vocabularies, twin toast class).
- Refactor effort: S-M — mostly class merges + a11y one-liners; the button consolidation is the only multi-file sweep.
- Highest-risk areas: the specificity ties between `cx-btn` and the standalone contracts (same fragility class as the baseline's Tabs break); the 3-css-generation merge on `.va-switch`; focus handling around the palette (regression-prone on keyboard paths).

## E. Architecture Scorecard (/10, this area)
- UI Consistency: 6 — looks cohesive in shots; vocabulary soup underneath.
- Layout Quality: 7 — grid shell + rail modes work; topbar/crumb contract weak.
- Design System Compliance: 4 — colors/spacing tokenized, but stacked vocabularies, phantom tokens, dead selectors.
- Component Reusability: 6 — primitives exist and are used; shell buttons + modals bypass them.
- Responsiveness: 7 — 820px collapse + coarse targets verified in shots; 100vh rail, kbd-on-touch, icon-btn sizing gaps.
- Accessibility: 5 — skip link, landmarks, dialog semantics done right; undermined by rail-search name loss, dot-only bell, static title, i18n split, group-label target.
- Performance: 7 — small modules, single merged 60s poll, no obvious waste; every-render layout measuring + twin title-flashers noted.
- Maintainability: 5 — excellent legacy-mapping comments; debt is duplication, not clarity.
- Scalability: 6 — registry-driven nav/palette scale; fuzzy-no-ranking + hard slice will age.

## F. Top 20 Priority Fixes (this area; merged into global Top 20 by PM)
1. `.rail-search` aria-label — restores the button's name in rail-off. (H, 1 line)
2. Consolidate shell buttons onto one contract (extend Button variants; drop stacked .btn/standalone classes). (H, small sweep)
3. Bell: count in aria-label + visible count + empty-click feedback. (M, small)
4. `document.title = ${page} · ${app}`. (M, 2 lines)
5. `dialog.*::backdrop { background: var(--scrim) }`. (M, 1 rule)
6. D() sweep: ViewAs/Topbar/Popups/OneOnOneAlerts/LoadError/ErrorBoundary + dict keys. (M, mechanical)
7. Palette focus restore → captured invoker, fallback .rail-search. (M, small)
8. `.nav-group-label` min-block-size ≥24px / join --cx-target list. (M, 1 line)
9. Toast: error tone sticky/longer + close + hover-pause + typed tones. (M, small)
10. va-banner-error → --signal-ink or bad-bg chip (verify measured contrast). (M, 1 line)
11. Topbar: decide sticky vs not (align .cx-dock/--cx-topbar-height); breadcrumb nav landmark + unmuted current. (M, small)
12. oo-alerts: role=region, assertive only on start, mute toggle, live countdown. (M, small)
13. Snap the ~15 off-scale shell literals into the scale sweep. (M, with baseline #8)
14. Palette: rank matches before the 20-slice; group roles; footer hint. (L, small)
15. Dead CSS sweep (.brand-mark/.nav-ext/.nav-link--off/.cx-toast) + --qg-* rename. (L, sweep)
16. rail-off: hide .brand-sub; single active-nav indicator. (L, 2 lines)
17. `.rail-search kbd` hidden under pointer:coarse; .icon-btn joins target contract. (L, 1 media rule)
18. aria-expanded on ViewAsPicker trigger. (L, 1 attr)
19. LoadError: require onRetry or drop the button; PageHead id prop. (L, types)
20. useDialogModal hook deduping Popups/ViewAsPicker/palette plumbing. (L, M effort)

Not verified (no matching shots): rendered palette, view-as banner, reminders dialog backdrop strength (code-proven weak), toast appearance/timing, oo-alert stack, rail-off visuals, dark mode, RTL rendering, measured contrast of va-banner-error and --cx-ink-3 labels (estimated only).
