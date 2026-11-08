# ux report — dabdoob-refresh — MOCKUP-PARITY RE-GATE (round 3, DELTA)

Verdict: **PASS** — all 10 pages now match their mockups (or carry only the
documented divergences). Both round-2 residuals on /tph are fixed: DOM order
is head → tabs → note → stats → cards, and the day-picker renders one row.

Open: 0B / 0H / 0M / 0L
Shots: `.devin/work/parity-gate/` — fresh `app-09.png` + `app-09-dark.png` vs
`mock-09.png`, 1440×900 light+dark. `_index.json`: 0 page errors on all routes.

## Prior-findings verification

| Prior ID | Finding | Status | Evidence |
|---|---|---|---|
| ux-p2-1 (MED) | `Qs` cap-chart + Needs-attention pair rendered above `.tph-tabs` | **fixed** | `app-09.dom.txt` L149-199: `header.page-head` → `div.tph-tabs` (L157) → `div.note.warn.mb-3` (L164) → `div.grid.grid-5.mb-3` (L170) → `div.grid.mb-3` 2× `section.card` (L191-198) → `#tph-panel-overview` (L199). Source: `summary` fragment (tph-grid-page.tsx:2156-2218) = note → grid-5 → `<Qs>`, passed to `Ga` which renders `<Ya>` then `{summary}` (L1972-1973). Shots app-09.png/-dark.png confirm visual order = mock 09-tph.html L54-129. |
| ux-p2-2 (LOW) | `#tph-date` full-width → day-picker stacked 3 rows | **fixed** | `style={{width:'9.5rem'}}` on `Input` (tph-grid-page.tsx:395), mirroring agents-page fix. Both shots show `Previous day · date · Next day` on a single row in head actions, matching mock L60-62. |

## /tph vs mock-09 — residual check

- Tab set: Overview · Grid and tasks · Cases · Agents · Caps and touches ·
  Channels — 1:1. Active = Overview (`.on` green underline both).
- Warn note copy 1:1 ("Touches aren't in yet. Today's counts arrive tomorrow
  ~08:30…").
- 5 stats 1:1 (TPH `–`, coverage `0/0`, agents `0` vs mock `14` — data-driven;
  Over cap `–` warn tone; Call time "Estimate").
- Cap chart card + Needs-attention card side-by-side; empty state "Nothing
  needs attention" 1:1; clipped %-of-cap spark strip below.
- Additive (below mock fold, not divergences): "Last automatic build …" footer
  line; "View as" rail control; "1 issue" chip = Next dev-overlay (documented).
- Dark mode: warn note, stat cards, tabs, chart all themed; no light leaks.

## Other 9 pages — spot-check

Unchanged since round-2 PASS; `_index.json` 0 errors; app-02.png re-checked —
topbar, 4 stats, needs-you list, queues-right-now, Team pulse all present.
Documented divergences still in effect (not failures): H7b missing
TOUCHES/DUR/EVIDENCE cols, Team-pulse adherence `–`, my-day Week = 2-day
window, Next dev-overlay chip.

## Open findings

None.

Not verified: mobile breakpoints (gate is 1440px parity only), tab keyboard
arrow nav on shots (roving code reviewed L423-432), non-overview tab panels
(this gate shoots the default Overview tab only).
