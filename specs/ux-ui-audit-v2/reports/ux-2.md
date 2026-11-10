# ux report - ux-ui-audit-v2 - round 2 (DELTA)

Verdict: **PASS** — all 6 ux-1 findings verified fixed in code; the two rendered failures (ux-4/ux-5) re-verified clean in the browser at 390px.

Open: 0B/0H/0M/0L

Scope: tl-7 fix leaves ux1-02..07 — changed UI files: `queue-page.tsx`, `cx-kit.css`, `operations.css`, `Tabs.tsx`, `ui/index.ts`, `NotConnected.tsx` (deleted). Fresh rendered re-capture: 5 routes × 1440/390 into `shots/post-fix/` (log `logs/ux-r2-verify.log`, probe `logs/ux-r2-hscroll.log`, exit 0).

States checked: rendered 1440+390 (overview, queue, my-day, status-validation, login — all `hScroll=false`, h1 present, no page errors); unclipped-overflow probe @390 (scrollW=390=vw, zero offenders on /overview + /queue); keyboard/focus via TableScroll `role=region`+`tabIndex`+`:focus-visible` + tl-7 e2e 125/0. Not verified: 200% zoom, dark-mode live, remaining ~35 routes rendered.

## Prior findings — all closed

| ID | Sev | Verification | Result |
|---|---|---|---|
| ux-4 | HIGH | `queue-page.tsx:279-380` — `table.cx-table` now inside `<TableScroll label="By queue" minWidth="52rem" fade>` (region+tabIndex+aria-label, `ref={h}` kept on `.cc-chart`, barrel import :8). Rendered @390: `scrollW=390` (was 857); `queue--390.png` is 390px wide, table clips inside `.tblscroll` (cx-kit.css:612 `overflow-x:auto`) with fade hint — WCAG 1.4.10 restored, region keyboard-scrollable (2.1.1). | FIXED (rendered) |
| ux-5 | MED | `cx-kit.css:655` `inset-inline-start:0` on `:root .cx-sr, :root .sr-only` + `:689` `position:relative` on `.cx-ladder__seg` — clip box anchors to seg, not ICB. Rendered @390: `scrollW=390` (was 474); `overview--390.png` is 390px wide, phantom scroll gone. | FIXED (rendered) |
| ux-6 | MED | `NotConnected.tsx` deleted; barrel export + type export removed (`ui/index.ts`); `grep NotConnected src/` = 0 hits. Resolved via the report's drop-export option (adoption sites weren't the `.cx-empty` panel shape — tl-7 rationale sound). | FIXED |
| ux-7 | LOW | `Tabs.tsx:101-107` tabpanel no longer carries `aria-orientation`; tablist keeps it (:79). | FIXED |
| ux-2 | LOW | `cx-kit.css:822` `.cx-empty p{margin:0;max-width:34ch}` + `:823` `.cx-panel > .cx-empty{border:0;background:transparent}` — box-in-box gone at `audit-queue-page.tsx:364` + `my-actions-page.tsx:140`. | FIXED |
| ux-3 | LOW | `operations.css:27` `[data-app="operations"] .cx-chip.trk-outside::before{background:currentColor}` — (0,3,0) beats `:root .cx-chip::before` (0,1,1) order-independently; dot now matches chip ink. | FIXED |

## Regression / web-design-guidelines check on the diffs (no findings)

- `position:relative` on `.cx-ladder__seg` makes it the containing block for absolute descendants — segs contain only a count `<span>` (`hub-shared.tsx:453`, `shared.tsx:431`); `cc-tip` tooltips are `.cc-chart`-level siblings, unaffected.
- `.cx-sr` `inset-inline-start:0` is global but safe: sr-only boxes are 1px-clipped regardless of anchor; block axis stays at static position. Fixes the whole class of bug, not just the ladder.
- `TableScroll` satisfies guidelines: semantic `<table>` + `th scope` kept, named focusable scroll region, `:focus-visible` outline (cx-kit.css:613), `minWidth` prevents column crush.
- No `outline-none`, `transition:all`, unlabeled controls, or other guideline anti-patterns introduced in any diff.
- `queue--1440.png` desktop render intact: all 8 table columns + full ladder + legend.

## Not verified / assumptions

- Same as ux-1: only 5/~40 routes rendered; contrast not re-measured (token-for-token changes); dark mode via prior fixture evidence.
- `.cx-panel > .cx-empty` transparent variant applied globally to direct children — any empty state that *wanted* its own border inside a panel now needs a wrapper; none found in the two named sites.
