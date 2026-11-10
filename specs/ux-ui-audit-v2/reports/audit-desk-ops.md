# Area audit — desk-ops

Scope: `src/features/cx-desk/*` (kb-tracker, kpi-logs, mail-desk, tl-performance + libs), `src/features/cx-operations/*` (trackers + lib), `src/app/styles/desk.css`, `operations.css`, `src/app/auth/login/page.tsx`, `src/app/auth/logout/page.tsx` (redirect, no UI), plus route-level verification of `/admin`, `/admin/config`, `/admin/roster`, `/ctls`, `/aging`, `/heatmap`, `/kb-gaps`, `/kb-tracker`, `/tl-performance`, `/tl-tasks`.

Route→component reality: `/admin*` → `cx-hub/admin-*.tsx` + hub.css, `/ctls` + `/kb-gaps` → `cx-quality/*` + quality.css, `/aging` + `/heatmap` → `cx-queue/*` + queue.css, `/tl-tasks` → `cx-people/*` + people.css. Those components are deep-audited by their owning area shards; this report audits the wrappers (all correct thin entries loading the right stylesheet) and records route-level rendered evidence with a `X-AREA` tag so consolidation can dedup.

Rendered shots (`specs/ux-ui-audit-v2/shots/`): all routes present at 390/768/1440; also `mail-desk`, `kpi-logs`, `trackers` shots (my components, other shards' routes). Page-width check (PNG width vs viewport): **admin--390 = 490px (overflow), kb-gaps = 1202px @390 / 1205 @768 / 1452 @1440 (overflow at every viewport)**; all other routes render at exact viewport width.

`data-app` scoping verified: registry groups map `/trackers`→operations, `/tl-performance`/`/kb-tracker`/`/kpi-logs`/`/mail-desk`→desk, delegated routes→their owning apps (AppShell.tsx:479, registry.ts:506). Stylesheets apply as intended.

---

## FINDINGS

```
SEVERITY: High
ELEMENT: Duplicated page-scaffolding block (Skeleton / Failed / Shell / Badge /
  ErrMsg / useLoaded / useRun / DAYS+MONTHS+utc3+B+V date helpers / Count)
LOCATION: cx-desk/components/kb-tracker-page.tsx:36-205,
  kpi-logs-page.tsx:33-127, mail-desk-page.tsx:79-206,
  tl-performance-page.tsx:75-238 — ~150 lines copied into each of 4 files
CATEGORY: Architecture / Design System
ISSUE: The same 7 helpers + date-format trio are verbatim clones in every
  desk page (~600 duplicated lines total). Copies have already DIVERGED:
  tl-performance's Count (105-164) has prefers-reduced-motion + arDigits
  Arabic-digit support; kb-tracker's Count (53-117) has neither — so
  /kb-tracker animates numbers under reduced-motion and shows Western digits
  in ar mode while /tl-performance does not. Mail-item badge logic
  ("Open past due", "Replied after the shift ended", coveringMissed) is
  copy-pasted between mail-desk SlaTr (244-251) and tl-performance MailItem
  (430-432). shared/platform/time.ts already exports KUWAIT_TZ/pwKwDate/pwKwTime
  — re-implemented locally instead. The same scaffolding also exists again in
  cx-queue/components/shared.tsx — the pattern is an unowned informal system.
ROOT CAUSE: Each legacy port copied the Desk boilerplate; no shared
  desk-level module was ever extracted.
IMPACT: Fixes must be made 4x (and have already been missed once — the
  kb-tracker Count is the older revision). New desk pages copy the drifted
  version they happen to open. ~600 lines of dead-weight duplication in this
  area alone.
RECOMMENDED FIX: Extract `cx-desk/components/dk-shared.tsx` (or promote to
  shared/components/ui): <PageShell title purpose aside>, <Skeleton>,
  <Failed retry>, <Badge>→shared Chip, <ErrMsg>, useLoaded, useRun, and a
  single Count + Kuwait date helpers delegating to shared/platform/time.ts.
  Keep the tl-performance (newer) Count as canonical.
CENTRALIZATION OPPORTUNITY: Yes
  - Suggested: cx-desk/dk-shared.tsx (+1 Count + date utils in shared/lib)
  - Files affected: 4 page components (~150 lines removed from each)
  - Duplication reduction: ~600 → ~150 lines; kills the divergence class
  - Maintainability: single place for skeleton/error/shell contract changes
```

```
SEVERITY: High
ELEMENT: /kb-gaps page — horizontal overflow at every viewport [X-AREA: cx-quality]
LOCATION: route /kb-gaps → cx-quality/components/kb-gaps-page.tsx;
  shots/kb-gaps--{390,768,1440}.png (measured 1202 / 1205 / 1452 px wide)
CATEGORY: Responsive / Layout
ISSUE: The rendered page is ~1200-1450px wide regardless of viewport: at 390
  users must scroll horizontally ~810px to reach the STATUS/"Mark added to KB"
  column; even at 1440 the page is 12px over and the "9 not yet in the KB"
  counter is clipped at the right edge. Cause is visible in the shot: the GAP
  column contains unbroken percent-encoded Freshdesk URLs (300+ chars, e.g.
  ...items-return-policy-in-kuwait-%D8%A7%D9%84...) that expand the cell
  because the table cells lack overflow-wrap / min-width containment.
ROOT CAUSE: Long unbroken URL strings inside table cells without
  overflow-wrap:anywhere / table-layout:fixed / scroll wrapper.
IMPACT: Page fails WCAG 1.4.10 reflow at mobile widths; primary action column
  unreachable without horizontal scrolling on desktop too.
RECOMMENDED FIX: Wrap the table in a scrollable container with
  overflow-wrap:anywhere (or word-break) on URL text inside cells; truncate
  displayed URL (show path tail or link icon). Owner: quality shard fix.
CENTRALIZATION OPPORTUNITY: No (single-file cell-style fix; the scroll-wrap
  pattern should come from the shared table contract — see dk-scroll finding).
```

```
SEVERITY: High
ELEMENT: /admin page — mobile overflow + 16.8Kpx unstructured page [X-AREA: cx-hub]
LOCATION: route /admin → cx-hub/components/admin-page.tsx;
  shots/admin--390.png (490px wide = 100px page overflow, 244,165px tall),
  admin--1440.png (16,811px tall)
CATEGORY: Responsive / Layout / Architecture
ISSUE: (a) Page renders 490px wide inside a 390 viewport → 100px horizontal
  overflow (WCAG 1.4.10 fail; some form control or table in the settings
  sections exceeds the viewport). (b) At 1440 the page is ~16,800px tall —
  dozens of settings sections with no in-page navigation, anchors, accordions
  or save-state grouping; finding a setting is a multi-screen scroll.
ROOT CAUSE: Single flat page ported 1:1 from the legacy Admin dump; no
  section IA; some wide control (likely a table or textarea) unbounded.
IMPACT: Broken on mobile; poor discoverability/efficiency on desktop for the
  highest-privilege page in the app.
RECOMMENDED FIX: (a) identify and constrain the overflowing control
  (min-width:0 + overflow-wrap on the widest section); (b) add a sticky
  section index or accordion/Tab grouping (Roster, Dropdowns, Jobs, Email…).
  Owner: hub shard fix.
CENTRALIZATION OPPORTUNITY: Yes — a shared <SettingsSection id title>
  wrapper + in-page TOC pattern is reusable by /admin/config too
  (admin__config--*.png: ~13,100px tall, same flat-scroll disease, though it
  fits 390 width).
```

```
SEVERITY: Medium
ELEMENT: Mail-desk SLA table — crushed instead of scrolling at 390
LOCATION: mail-desk-page.tsx:496-516 (.dk-scroll > table.dk-table.md-table);
  desk.css:44-46; shots/mail-desk--390.png
CATEGORY: Responsive
ISSUE: .dk-table is width:100% with no min-width, so at 390 the five columns
  squeeze to ~55-90px each: subject wraps mid-word ("MyFatoor ah refund
  update, ssudhaka ran@myf atoorah.c om"), the REPLY column stacks "No reply
  yet" into 1-2-word lines, and the flags badge is clipped at the right edge.
  The .dk-scroll wrapper never engages because the table never exceeds the
  container width.
ROOT CAUSE: No min-width (or responsive card fallback) on the table;
  overflow-x:auto alone can't trigger when cells are allowed to shrink.
IMPACT: Illegible table on phones; the flag column (the actionable bit) is
  partially hidden.
RECOMMENDED FIX: .dk-table { min-width: 40rem } (or per-table) inside
  .dk-scroll; add a visible scroll affordance/fade; longer-term a shared
  responsive-table contract (cards under N px, table above).
CENTRALIZATION OPPORTUNITY: Yes — same fix needed by tl-performance
  queue/OTD tables (see next finding): shared `TableScroll` wrapper
  (min-width, tabindex, fade) → shared/ui.
```

```
SEVERITY: Medium
ELEMENT: .dk-scroll — horizontally scrollable region not keyboard-focusable
LOCATION: desk.css:44; used mail-desk-page.tsx:496, tl-performance-page.tsx:336
  (OTD) and :635 (queue table); contrast trackers-page.tsx:708
  (.trk-table-wrap has tabIndex={0} role="region" aria-label + focus ring,
  operations.css:20)
CATEGORY: Accessibility
ISSUE: overflow-x:auto containers that AREN'T focusable can't be scrolled by
  keyboard-only users (WCAG 2.1.1). The sibling implementation in the same
  area (.trk-table-wrap) does it correctly; the dk-* pages don't.
ROOT CAUSE: Two table-wrap patterns authored independently; the older dk one
  predates the a11y treatment.
IMPACT: When a dk-table overflows (mid-widths, zoomed text, small windows),
  keyboard users cannot reach clipped columns.
RECOMMENDED FIX: tabindex="0" role="region" aria-label + focus-visible ring
  on .dk-scroll (or adopt the shared TableScroll from the previous finding,
  folding .trk-table-wrap into it too — three sites, one component).
CENTRALIZATION OPPORTUNITY: Yes — .dk-scroll + .trk-table-wrap + refresh.css
  .trk-table context → one TableScroll primitive.
```

```
SEVERITY: Medium
ELEMENT: Rating slider — fill is always green regardless of zone
LOCATION: tl-performance-page.tsx:240-320; desk.css:73-83
CATEGORY: Design System / Accessibility (color semantics)
ISSUE: The track gradient and glow use --cx-status-ok-edge unconditionally;
  only the THUMB changes color for data-label=below (desk.css:80-81). A 20/100
  "Below" rating still renders a green filled bar — the fill colour asserts
  "ok" while the value asserts "below".
ROOT CAUSE: Track gradient authored once with ok-edge; per-zone recolour only
  applied to the thumb.
IMPACT: Wrong semantic colour on every below/meets rating (a manager glancing
  at the slider sees green); color is the only zone cue on the control itself.
RECOMMENDED FIX: Drive track fill from a --zone-color variable switched by
  [data-label] (below→bad-edge, meets→warn/ink, exceeds→ok-edge); keep
  aria-valuetext as is (it's correct).
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: "Leave out" submit button floats into form grid column
LOCATION: kpi-logs-page.tsx:347-387 + desk.css:91 (.dk-kb-form grid);
  shots/kpi-logs--1440.png (button sits top-row far-right, detached)
CATEGORY: Alignment / Layout
ISSUE: .dk-kb-form is repeat(auto-fill,minmax(200px,1fr)); the exclusion form
  has exactly 3 fields + .md-actions div → at ≥4 columns the actions cell
  lands in column 4 of row 1, so "Leave out" renders at the far right of the
  input row, vertically centred against the inputs. The other two forms avoid
  it only because .dk-kb-note (grid-column:1/-1) pushes actions to row 2.
ROOT CAUSE: .md-actions participates in grid auto-placement instead of being
  pinned to a full row.
IMPACT: Misaligned, floating primary action; inconsistent with sibling forms
  on the same page (visible defect, not just code).
RECOMMENDED FIX: .dk-kb-form .md-actions { grid-column: 1 / -1; } (and
  consider span-based alignment for the button row).
CENTRALIZATION OPPORTUNITY: No (one-line CSS fix).
```

```
SEVERITY: Medium
ELEMENT: Unconfirmed destructive "Remove" on KPI-log entries
LOCATION: kpi-logs-page.tsx:182-203 (RemoveBtn ×3 lists)
CATEGORY: Interaction
ISSUE: Remove deletes a logged behaviour case / leave / SLA exclusion with a
  single click — no confirm, no undo, just a toast after the fact. These are
  HR-grade records (behaviour cases zero a KPI). Compare the same codebase's
  reset-to-pending in mail-desk (312-323) which DOES use window.confirm.
ROOT CAUSE: Per-form inconsistency; no shared destructive-action contract.
IMPACT: One mis-click removes an HR record with no recovery path in the UI.
RECOMMENDED FIX: Add window.confirm (match mail-desk's copy style) or an
  undo affordance; long-term a shared <ConfirmButton>/destructiveAction helper
  so every area confirms the same way.
CENTRALIZATION OPPORTUNITY: Yes — confirm pattern already exists twice
  (here + mail-desk) → extract.
```

```
SEVERITY: Medium
ELEMENT: Inline confirm panel claims role="alertdialog" without dialog semantics
LOCATION: mail-desk-page.tsx:330-345
CATEGORY: Accessibility
ISSUE: The confirm step renders <div class="md-confirm" role="alertdialog"
  aria-label="Confirm the reply"> inline inside the card. alertdialog asserts
  modal dialog behaviour — focus should move to it, be constrained, and return
  on dismiss (4.1.2). Here focus stays wherever it was; nothing is trapped;
  there's no aria-describedby; keyboard order just continues.
ROOT CAUSE: Inline two-step confirm marked up with the dialog role for the
  announcement but not the behaviour.
IMPACT: SR users get a "dialog" announcement for a non-dialog region —
  misleading expectation; the action buttons may sit several tab stops away.
RECOMMENDED FIX: Either use a real <dialog> (the codebase already has
  raw-dialog precedent in trackers Jn) or drop role="alertdialog" to
  role="group" and move focus to the confirm heading on open.
CENTRALIZATION OPPORTUNITY: Yes — a shared inline-confirm component would
  also serve the Remove button fix above.
```

```
SEVERITY: Medium
ELEMENT: Design-system bypass: .md-reject vs variant="danger"; .dk-sm vs size="sm";
  className="input"/"select" re-added to primitives
LOCATION: mail-desk-page.tsx:351-357 (.md-reject on quiet Button while
  ButtonVariant 'danger' exists — Button.tsx); desk.css:19 (.dk-sm padding
  4px 10px — a 5th small-button size; Button has size="sm"→cx-btn--small);
  kb-tracker/kpi-logs/trackers pass className="input"/"select" to Input/Select
  which already emit cx-input/cx-select → dual-classed controls everywhere
CATEGORY: Design System
ISSUE: Three layers of the same widget coexist on one page set: primitive
  variants unused while ad-hoc classes re-create them; the reject button is
  red text on a quiet button instead of the danger variant; controls carry
  both .input and .cx-input (currently identical rules — cx-kit.css:261 —
  but redundant and a divergence trap).
ROOT CAUSE: Ports kept legacy class habits instead of adopting primitive APIs.
IMPACT: Small buttons render at a different size vs other areas (4px/10px vs
  the kit's 1.9rem); danger affordance inconsistent; if the legacy .input rule
  is ever removed these forms silently restyle.
RECOMMENDED FIX: Use size="sm" (delete .dk-sm), variant="danger" for Reject,
  drop the redundant "input"/"select" classNames.
CENTRALIZATION OPPORTUNITY: No (use existing primitives).
```

```
SEVERITY: Medium
ELEMENT: Dead + split stylesheets: .dk-seg, .dk-badge dead; .trk-form defined
  twice; trk-table split across refresh.css (global) + operations.css (scoped)
LOCATION: desk.css:22-25 (.dk-badge, 0 tsx users), :37-43 (.dk-seg, 0 tsx
  users — a 4th segmented control on top of seg/cx-seg/pw-seg from baseline);
  operations.css:26 + :70 (.trk-form duplicate selector, later wins, :26's
  top:16px dead); refresh.css:635-641 (.trk-table at :root — applies
  globally, unscoped, while the rest of trk-* is [data-app="operations"])
CATEGORY: Design System / Architecture
ISSUE: desk.css ships two unused widget families; operations.css declares the
  same selector twice; the trackers table's core cell styling (max-width 260px
  ellipsis, sticky header) lives in the GLOBAL refresh sheet while everything
  else trk-* is operations-scoped — deleting operations.css still leaves a
  half-styled table, and other apps' .trk-table (none today) would inherit it.
ROOT CAUSE: Ported rules split by historical wave, not by scope.
IMPACT: Dead CSS auditors keep re-reading; specificity/scope surprises;
  refresh.css keeps accumulating area rules (contradicts the per-area
  stylesheet architecture).
RECOMMENDED FIX: Delete .dk-seg + .dk-badge; merge the .trk-form rules;
  move .trk-table (and .trk-misfit/.trk-num in refresh.css:636-640) into
  operations.css under [data-app="operations"].
CENTRALIZATION OPPORTUNITY: Mixed (delete dead; consolidate trk-table).
```

```
SEVERITY: Medium
ELEMENT: operations.css — untokenized px spacing/sizing throughout
LOCATION: operations.css whole file: 8(12px 24px),11(10px 14px),14(19rem/26vw
  /24rem,20px),16(8px 16px),24(24px),25(16px,14px),28(-8px),30(100vh-3rem),
  33-60 (12/8/6/10/2/120/8/640/16/14/8/46/38/360px…), breakpoints 900px/480px
CATEGORY: Design System / Typography & spacing scale
ISSUE: desk.css consistently uses --cx-space-*/--cx-text-* tokens;
  operations.css was authored with raw px values for nearly every declaration
  (~40). Breakpoints are raw literals (900/480 — the baseline breakpoint-drift
  finding adds these to its list), .trk-dialog uses 100vh-3rem (baseline 100vh
  finding), and desk.css itself has two non-cx leftovers:
  var(--space-6, 32px) at desk.css:21 + :52.
ROOT CAUSE: operations.css ported px-faithful; tokenization applied only to
  colors, not geometry.
IMPACT: Off-scale rhythm vs sibling area; breakpoint values can't be governed
  centrally; violates the doc's spacing-scale audit.
RECOMMENDED FIX: Snap to --cx-space-* / --cx-text-* (4px grid); add the two
  breakpoints to the shared --bp-* contract; --space-6→--cx-space-* in desk.css.
CENTRALIZATION OPPORTUNITY: Yes — token sweep, ~45 declarations.
```

```
SEVERITY: Medium
ELEMENT: "Forgot password?" — dead interactive-looking span on the login form
LOCATION: src/app/auth/login/page.tsx:138-143; shots/auth__login--*.png
CATEGORY: Accessibility / Interaction
ISSUE: A <span> styled like an action (accent token + weight 600, right-aligned
  beside the Password label — the exact visual recipe for a link) is not a
  link, not a button, not focusable, and does nothing. Also: brand <img> at
  :85-90 renders nothing in BOTH shots (asset exists at
  public/assets/dabdoob-logo.png — likely capture timing, VERIFY live); raw
  <img> instead of next/image; hardcoded "v2.4" footer (:203).
ROOT CAUSE: Placeholder affordance shipped without the feature; cosmetic span.
IMPACT: Users who forgot their password get a dead end on the app's only
  public path — reads as a bug even if intentional; keyboard users can never
  reach it (so it also isn't operable, 2.1.1-adjacent).
RECOMMENDED FIX: Remove the span until the flow exists, or wire it to a real
  reset flow / mailto:IT link. VERIFY logo live; if confirmed broken, check
  the /assets path served by the shell.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: Count component divergence — reduced-motion missing in kb-tracker copy
LOCATION: kb-tracker-page.tsx:53-117 vs tl-performance-page.tsx:105-164
CATEGORY: Accessibility / Design System
ISSUE: The kb-tracker Count animates numbers via rAF with no
  prefers-reduced-motion / data-reduce-motion guard; the tl-performance copy
  has the guard (lines 113-114). theme.css zeroes CSS durations but rAF
  animation is unaffected — the guard is the only protection, and it's absent
  in the older copy.
ROOT CAUSE: Duplicate component drift (see scaffolding finding).
IMPACT: Vestibular-sensitive users get number-counting animation on
  /kb-tracker; inconsistent behaviour between sibling pages.
RECOMMENDED FIX: Covered by the scaffolding consolidation — keep the guarded
  copy. (Separated out as its own a11y-visible symptom.)
CENTRALIZATION OPPORTUNITY: Yes — single Count.
```

```
SEVERITY: Low
ELEMENT: TL switcher doesn't persist the ?tl= selection
LOCATION: tl-performance-page.tsx:734-754 (setTl never writes URL; hashchange
  listener only reads)
CATEGORY: Interaction / Architecture
ISSUE: Picking another team lead updates state but leaves the URL unchanged —
  reload, share, or back/forward loses the selection (pageParams reads both
  query and legacy hash, but nothing writes).
ROOT CAUSE: Param is read-only in the port.
IMPACT: Minor workflow friction (managers reviewing several TLs).
RECOMMENDED FIX: router.replace(`/tl-performance?tl=${v}`) on change.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: Trackers page — small a11y/robustness cluster
LOCATION: trackers-page.tsx:848 (rel="noopener" without noreferrer —
  inconsistent with every other external link in the area); :696 (title attr
  only when value >40 chars, but refresh.css:636 truncates at max-width:260px
  — cells truncated below 40 chars, e.g. "Mouza …" in trackers--1440.png, have
  no way to reveal full text); :429-440 (Kn skeleton aria-hidden with no
  aria-busy/role=status on the container — SR users get silence during load;
  desk pages' Skeleton does set aria-busy+aria-label); :882 (Xn keyed by
  tracker.id + fields.length — adding a field remounts and wipes an in-progress
  record draft); 894-line file with closure-minified identifiers (PORTING-GUIDE
  requires verbatim legacy names — noted, not re-flagged as style debt)
CATEGORY: Accessibility / Maintainability
ISSUE: Cluster of small gaps listed above.
RECOMMENDED FIX: noreferrer; title whenever text truncates (or
  overflow-wrap on the column); aria-busy on the page region; preserve draft
  across field-count change or only remount on tracker switch.
CENTRALIZATION OPPORTUNITY: Partially (empty/skeleton contract).
```

```
SEVERITY: Low
ELEMENT: Cross-area route nits observed in shots (for consolidation dedup)
LOCATION: aging--390.png CONTACT column renders literal "null" for empty
  contacts (cx-queue aging-page); heatmap--1440.png "Slot time per chat"
  input shows clipped text "13 (calculated" (cx-queue heatmap-page);
  ctls--390.png 12,431px tall — fits width, no overflow (cx-quality);
  tl-tasks--1440.png renders cleanly (cx-people); admin__roster--390/1440 fit.
CATEGORY: —
ISSUE: Delegated-route evidence for the owning shards; listed so route
  coverage is complete. Also: dk-none class is used (mail-desk:224,241) — fine;
  kpi-logs placeholders "451230, 451244"/"Ajex" read as pre-filled values —
  acceptable example-text pattern, note only.
RECOMMENDED FIX: Owning shards.
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Low
ELEMENT: --cx-ink-3 (borderline token) used on login chrome
LOCATION: refresh.css:537 (.login-foot, .72rem) + :552 (.login-divider, .75rem)
  — instance of the baseline MEDIUM token finding (audit-shared-tokens, ink-3)
CATEGORY: Accessibility
ISSUE: "Restricted to Dabdoob CX team members", "v2.4" and the "or" divider
  use the ~4.2-4.5:1 borderline token at ≤12px — cited as rendered evidence
  for the baseline fix (VERIFY measurement pending there).
RECOMMENDED FIX: Per baseline — darken --cx-ink-3 mix.
CENTRALIZATION OPPORTUNITY: Yes — token-level.
```

```
SEVERITY: Low (positive notes)
ELEMENT: Patterns done right in this area
LOCATION: trackers-page.tsx:708 (scrollable table: tabIndex+role+label+ring —
  the correct pattern dk pages lack); :405 (native <dialog> with labelledby,
  onCancel); :275 (visually-hidden radio with real name/checked); :511
  (aria-hidden req asterisk + real required); mail-desk-page.tsx:482
  (aria-pressed filter buttons); tl-performance-page.tsx:263-279 (slider
  sr-only label + aria-valuetext + <output htmlFor>); login page (autoComplete,
  role=alert, Field wiring); desk.css:84-86 + operations.css:62-64
  (reduced-motion blocks); operations.css:36-41 (trk-kind :focus-within ring +
  is-off disabled styling — the pattern cx-seg lacks per baseline); kpi-logs
  :388-391 (permission-empty state instead of hidden form).
CATEGORY: —
ISSUE: Correct implementations other areas should copy.
CENTRALIZATION OPPORTUNITY: No.
```

---

## A. Layout & Alignment Summary
- Components reviewed: 6 page components (kb-tracker 368ln, kpi-logs 417, mail-desk 527, tl-performance 766, trackers 894, login 208) + 2 stylesheets + 15 route page.tsx entries + 15 shot sets.
- Misaligned elements: 1 verified (kpi-logs "Leave out" button floating into grid column 4 — shot-proven); mail-desk SLA table column crush at 390; admin page 100px h-overflow at 390; kb-gaps h-overflow all viewports.
- Overlapping elements: 0 area-owned (shell "1 Issue" FAB overlaps content at 390 on several shots — shared-shell shard).
- Spacing violations: operations.css ~40 raw px declarations vs token scale; desk.css var(--space-6,32px) ×2; .md-actions grid-placement bug (above).

## B. Design-System Violations (severity)
- High: scaffolding ×4 duplication; kb-gaps overflow; admin overflow+flat 16.8Kpx page.
- Medium: slider green-fill; .dk-scroll keyboard; dk-sm/md-reject/dual-classed controls; dead .dk-seg/.dk-badge; trk-form duplicate rule; trk-table styling split refresh.css↔operations.css; operations.css px tokens; forgot-password dead control; Count reduced-motion divergence.
- Low: ?tl= not persisted; trackers misc cluster; login ink-3 instances; dk-kb-form name reuse for non-KB forms.

## C. Shared-Components Opportunity Report
- Centralize: `dk-shared.tsx` (PageShell/Skeleton/Failed/ErrMsg/Badge/useLoaded/useRun/Count/date-fmt) — 4 files → 1 (~600→150 lines); `TableScroll` (min-width+tabindex+fade) covering .dk-scroll + .trk-table-wrap; shared Count (canonical = tl-performance copy); shared inline-confirm/destructive-action (mail-desk confirm + kpi-logs Remove); Kuwait date formatters → shared/platform/time.ts (already exists — adopt).
- Tokenize: operations.css spacing/breakpoints → --cx-space-*/--bp-*; --space-6 leftovers in desk.css.
- Delete: .dk-seg, .dk-badge (dead); .trk-form first rule; .trk-* rules in refresh.css → operations.css; redundant className="input"/"select" on primitives.
- Pages using duplicated implementations: all 4 cx-desk pages; trackers shares the skeleton/field-error idiom with a different implementation again (Kn vs Skeleton).

## D. Technical-Debt Analysis
- Duplicate code: ~25-30% of the area's component code is copy-paste scaffolding; within desk.css/operations.css, ~12% dead or double-defined.
- Estimated refactor effort: S-M — the scaffolding extraction is mechanical; risk sits in verifying the dk-table min-width values per table and the admin/kb-gaps fixes owned by other shards.
- Highest-risk areas: (1) the duplicated Count has already diverged once — every un-consolidated month invites more drift; (2) trk-table styling split across a global sheet means scope assumptions break silently; (3) admin page length + overflow on the highest-privilege screen.

## E. Architecture Scorecard (/10, this area)
- UI Consistency: 7 — coherent dk/trk look, good badges/stats; slider color lie + dk-sm deviations cost points.
- Layout Quality: 7 — clean page/grid structure; exclusion-form button misplacement; mail-desk crush.
- Design System Compliance: 5 — primitives used for controls but bypassed for sizing/variants; dead classes; px sheet.
- Component Reusability: 3 — the area's defining flaw: 4× scaffolding, 2× Count, 2× badge logic, 3rd table wrap.
- Responsiveness: 6 — trackers/login/kb-tracker good; mail-desk + dk-scroll weak; delegated kb-gaps/admin overflow (cross-area).
- Accessibility: 6 — genuinely good bits (slider ARIA, trk dialog, filter aria-pressed) offset by dk-scroll, alertdialog misuse, dead forgot-password, missing RM guard.
- Performance: 7 — rAF Count guarded in one copy; redundant reload() after save in kb-tracker (291-293: setData then void reload); no heavy trees.
- Maintainability: 4 — duplication, dead CSS, split trk styling; trackers minified identifiers (porting constraint) limit readability.
- Scalability: 5 — a 5th desk page would copy scaffolding again; forms/dialogs not shared.

## F. Top 20 Priority Fixes (this area; merged into global Top 20 by PM)
1. Extract dk-shared.tsx scaffolding (Skeleton/Failed/Shell/ErrMsg/useLoaded/useRun/Badge/Count/date-fmt) — kills ~600 lines + the divergence class. (H)
2. kb-gaps table overflow: wrap + overflow-wrap:anywhere on URL cells (X-AREA quality). (H)
3. admin page: fix 100px overflow @390 + add section nav/accordions (X-AREA hub). (H)
4. TableScroll shared wrapper: min-width + tabindex + fade → .dk-scroll + .trk-table-wrap. (M)
5. Slider fill color per data-label zone (below≠green). (M)
6. .dk-kb-form .md-actions { grid-column:1/-1 } — fixes floating "Leave out". (M, 1 line)
7. Confirm (or shared destructive-action) on kpi-logs Remove buttons. (M)
8. mail-desk confirm: real <dialog> or role="group" + focus move. (M)
9. variant="danger" for Reject; size="sm" replacing .dk-sm; drop redundant input/select classNames. (M)
10. operations.css px→--cx-space-* sweep + breakpoints into shared contract. (M)
11. Move .trk-table/.trk-misfit/.trk-num rules refresh.css→operations.css [data-app]; merge duplicate .trk-form. (M)
12. Delete dead .dk-seg + .dk-badge rules. (M, trivial)
13. Login "Forgot password?": remove or implement; VERIFY logo renders live. (M)
14. Count: adopt tl-performance (RM-guarded) copy as the single component. (M — with #1)
15. Persist ?tl= via router.replace on TL switch. (L)
16. trackers: noreferrer; title on any truncating cell; aria-busy on load region; keep record draft on field add. (L)
17. Mail-desk SLA table min-width (with #4) + flags column visibility at 390. (M — with #4)
18. --cx-ink-3 instances (login-foot/divider) — covered by baseline token fix. (L — cross-ref)
19. kb-tracker: drop the redundant void reload() after save (setData already updates). (L)
20. Decide dk-table vs cx-table vs trk-table canonical family (with baseline #1). (H — strategic)

Not verified / assumptions: live contrast measurements (ink-3 usages); login logo absence (asset exists — likely capture timing); dark-mode rendering of band/slider colours (token-driven, judged code-level); keyboard traversal executed in-browser (code-verified only); delegated-route component internals (owning shards).
