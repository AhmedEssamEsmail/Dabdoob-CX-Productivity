# FUX-10: unscope shared `.dq-*` family + `.trk-table` — move to global refresh.css
Kind: mini
ID: FUX-10
Parent: FIX-UF
Owner: dev
Depends: none
Criteria: reports/user-fix-round.md UF-1 (HIGH)
Skills: none
Budget: files=3; actions=4; changed_lines=170; minutes=8

## Goal
`/overview` (data-app="hub") renders `.dq-*` queue-health classes unstyled
because every `.dq-*` rule lives in `src/app/styles/queue.css` behind
`[data-app="queue"]`, and that sheet only loads on queue pages. The same
latent bug hits `.trk-table` (operations.css, used by the queue-app heatmap).
Move the shared rule blocks VERBATIM into the globally-loaded
`src/app/refresh.css` as `:root` selectors (same 0,2,0 specificity), deleting
them from the scoped sheets. No declaration changes; this is a cut-and-prefix
move, not a rewrite.

## Files
- Edit: `src/app/refresh.css` | append moved `.dq-*` + `.trk-table` rules at file end under a `/* shared legacy families (was per-app scoped) */` comment
- Edit: `src/app/styles/queue.css` | delete the two `.dq-*` rules at L9-10 and the whole `.dq-*` block at L232-305 (it sits under the "recovered from globals.css" comment; keep `hm-*`/`sch-*` and the file header)
- Edit: `src/app/styles/operations.css` | delete the `.trk-table`-anchored selectors at L21-24 and the `.trk-table …` selector arms inside the combined rule at ~L75-77

## Context
- `src/app/layout.tsx:2-4` | refresh.css loads globally via the root layout; per-area `styles/*.css` load only on their pages
- `src/app/styles/queue.css:8-10,232-305` | every `.dq-*` rule (`dq-totals*`, `dq-stats`, `dq-stat*`, `dq-agebar`, `dq-rowhead`, `dq-sub`, `dq-statusline`, `dq-refresh`, `dq-needs`, `dq-clear`, `dq-correct`, `dq-spark*`, `dq-pct*`, `dq-chart*`, `dq-ch--*`, `dq-headline*`, `dq-split`, `dq-rank*`, `dq-crumb`, `dq-legend`, `dq-countries`, `dq-editor*`, `dq-days`, `dq-holform`, `dq-groupbreak`) — all used cross-app
- `src/app/styles/operations.css:21-24,75-77` | `.trk-table` + `.trk-table th/td` + `.trk-table .trk-num` + `.trk-table td.trk-misfit` + `.trk-table td a`; `.input.trk-num`/`.cx-input.trk-num` arms stay scoped (trackers-only)
- `src/features/cx-queue/components/heatmap-page.tsx:62` | `className="trk-table hm-reg-table"` — queue app using operations class
- `src/features/cx-hub/components/overview-page.tsx:150-196` + `people-holidays-page.tsx`, `agents-page.tsx:360-371`, `quality-analytics-page.tsx:303-378` | `.dq-*` consumers outside the queue app

## Contract
- Every moved selector gets prefix `[data-app="<app>"] ` -> `:root `, including
  rules inside the `@media`/`@media (prefers-reduced-motion …)` blocks.
  Declarations, order and values stay byte-identical.
- The combined selector at operations.css ~L75
  (`[data-app="operations"] .trk-table .trk-num, [data-app="operations"] .input.trk-num, [data-app="operations"] .cx-input.trk-num`)
  is SPLIT: the `.trk-table .trk-num` arm moves out as `:root .trk-table .trk-num`;
  the `.input.trk-num` + `.cx-input.trk-num` arms stay as one scoped rule.
- Keep `.trk-table-wrap`, `.trk-records`, `.trk-empty`, `trk-skel*` and all
  other `trk-*` rules scoped — only `.trk-table`-anchored selectors move.
- Out of scope: markup/class changes in any .tsx; other scoped families
  (`hm-*`, `sch-*`, `md-*`, `nt-*`, `oo-*`, `pw-*`, `qa-*`, `qs-*`, `pv-*`,
  `tph-*`, `dk-*`, `setting-*`, `upnext-*`, `ap-*`) — verified single-app by
  TL preflight; do not touch. `dq-help`/`dq-page` are dead marker classes
  with no rules anywhere — leave as-is.

## Actions
1. In queue.css delete L9-10 `.dq-*` rules and the L232-305 `.dq-*` block;
   paste them at the end of refresh.css with `[data-app="queue"] ` -> `:root `
   prefix on every selector (incl. inside @media blocks), keeping the section
   comment updated to say these are shared cross-app families.
2. In operations.css remove the `.trk-table` selectors (L21-24) and split the
   ~L75-77 combined rules; paste the `.trk-table`-anchored rules into
   refresh.css as `:root` selectors.
3. Bounded sweep check (TL preflight already mapped cross-app use — confirm,
   do not expand): grep `src/features/cx-hub`, `src/features/cx-people`,
   `src/features/cx-quality` and `src/features/cx-queue/components/heatmap-page.tsx`
   for `className` hits on the families listed under Out of scope; paste the
   grep output in results/FUX-10.md (expected: only `dq-*` on those files,
   `trk-table` on heatmap, `pw-seg`/`oo-alert*` which have global cx-kit
   rules — anything else = report it, do not fix).
4. `npx tsc --noEmit` still clean (no-op for CSS) + `git diff` shows
   declarations moved verbatim, none rewritten.

## Done when
- `grep -c 'data-app="queue"\] \.dq-' src/app/styles/queue.css` -> 0 and
  `grep -c ':root .dq-totals\|:root .dq-stat\|:root .trk-table' src/app/refresh.css` -> >=5.
- `grep -n '\.dq-' src/app/styles/queue.css` -> only `dq-page`/`dq-help` class
  names absent from CSS entirely (no `.dq-` selectors remain in queue.css).
- operations.css keeps `.input.trk-num`/`.cx-input.trk-num` scoped and all
  non-`.trk-table` `trk-*` rules; zero `[data-app]`-scoped `.trk-table` left.
- `git diff src/app/refresh.css src/app/styles/queue.css src/app/styles/operations.css`
  shows moved declarations only (no property/value edits).

## Verify
- Run: `grep -c '.dq-' src/app/styles/queue.css` -> 0
- Run: `grep -n ':root .dq-stats\|:root .trk-table\b' src/app/refresh.css` -> hits

## Handoff
`.dq-*`/`.trk-table` now resolve on every app shell — overview, agents,
people-holidays, quality-analytics and heatmap pick them up with no markup
edits. TL gates + reshoot confirm visual parity vs `mockups/pages/02-home.html`.
Write results/FUX-10.md (<=10 lines); TL alone updates TRACKER.md.
