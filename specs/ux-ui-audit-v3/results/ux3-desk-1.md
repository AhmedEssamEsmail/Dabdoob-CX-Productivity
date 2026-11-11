# UX3 audit — desk shard 1 — 2026-11-11 — ux-ui-expert

Env: `npm run dev` @ :3000 (pre-existing server, Next 16.4.3 Turbopack), e2e seed users (`npm run test:e2e:seed`, exit=0), chromium headless, login `e2e.admin@dabdoob.com` via `/auth/login`. Widths 375/768/1024/1440 × h=900. All 4 routes rendered as admin (no BLOCKED). Screenshots: `results/ux3-screens/desk/<route>-<w>.png` (fullPage).

| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|-------|-----|-----|------|------|------------|---------|
| `/tl-performance` | FAIL | FAIL | FAIL | FAIL | Q3 | FAIL |
| `/kb-tracker` | PASS | PASS | PASS | PASS | — | PASS |
| `/kpi-logs` | PASS | PASS | PASS | PASS | — | PASS |
| `/mail-desk` | FAIL | FAIL | FAIL | FAIL | Q3 | FAIL |

---

## /tl-performance — FAIL

- Q1: PASS — `.topbar` is sticky (probe @375: y=150→0 only because clicking the bottom "Reload" button scrolled the page 1895px; toolbar itself stays put, `hScrollAfter=false`).
- Q2: PASS — 5 buttons / 2 inputs / 1 select all named & focusable @375 (14/2/1 @1440); 8-Tab walk shows visible focus indicator on every real control (`nextjs-portal` hits = Next dev overlay, not product UI).
- Q3: **FAIL** —
  - Raw unstyled link: `<a href="https://mail.google.com/mail/u/0/#all/19ea6f1032938c3f">` with **no class** renders as browser-default blue inside the "Mails to answer by the end of the shift" card. Visible in `tl-performance-375.png` and `tl-performance-1440.png`. All widths. Severity **major**, class **B1** (unstyled link; shared `.cx-link` does not exist per census).
  - Raw classless inputs: `<input type="range" id="dk-r-Refunds">`, `<input id="dk-r-Operational loss">` in "Responsibilities, week of Sun 8 Nov" — labeled (accessible name OK) but bypass shared control class. Severity **minor**, class **A3**.
- Q4: PASS — `documentElement.scrollWidth <= innerWidth` at all widths; `table.dk-table` (sw=512) sits in `div.tblscroll` `overflow-x:auto` (cw=293 @375) — sanctioned B7 scroll-wrapper, no page-level scroll.
- Q5: PASS — designed state markup present (`.empty`×1, `[role=status]`×4, `aria-busy` hooks); error state not reachable via existing controls — not verified visually.
- Q6: PASS — only inline literal is `span.nav-ind` `transform: translate(…px)` — dynamic nav-indicator position (allowed per B4 census: dynamic setters exempt).
- Q7: PASS — single h1, sequence 1→2→2→2→2 (no skips); nav=1, main=1, header=1, labelled sections=2.
- Q8: PASS — stylesheets: 27 `:hover`, 10 `:disabled`, 20 `:focus-visible`, `aria-selected`+active+error rules; hover changed first main button computed style; focus ring visible.

## /kb-tracker — PASS

- Q1: PASS — `.topbar` stable across load + resizes; no refresh/toggle control exists on this page (only primary action "Add a KB update"), so no state-toggle exercised — noted.
- Q2: PASS — 5 buttons @375 (14 @1440), all named/focusable; Tab walk: `a,a,button,button,button,button,button` all show visible indicator.
- Q3: PASS — zero unstyled `<a>`/`href="#"`/raw controls detected.
- Q4: PASS — no h-scroll, no overflowing elements (only `a.skip` offscreen by design).
- Q5: PASS — designed empty state "No KB updates yet. Add the first one when an article is requested." in `kb-tracker-375.png`; stat cards show "–" placeholders for absent data.
- Q6: PASS — `span.nav-ind` dynamic transform only.
- Q7: PASS — h1=1; nav/main/header/1 labelled section.
- Q8: PASS — same token'd state rules; hover ring on primary button confirmed.

## /kpi-logs — PASS

- Q1: PASS — `.topbar` stable across load + resizes; no refresh control on page.
- Q2: PASS — 7 buttons / 7 inputs / 4 selects @375, zero unlabeled; date input shows visible focus ring in `kpi-logs-375.png`.
- Q3: PASS — no raw controls/links.
- Q4: PASS — no h-scroll, no clipped text at any width (three stacked form cards reflow cleanly, `kpi-logs-375.png`).
- Q5: PASS — three designed empty strings in panels: "No cases in the last 180 days.", "No unplanned leaves in the last 180 days.", "No tickets left out in the last 180 days."
- Q6: PASS — `nav-ind` dynamic transform only.
- Q7: PASS — h1=1, sequence 1→2→2→2; landmarks present.
- Q8: PASS — hover/disabled/focus-visible/selected rules present; distinct focus ring verified.

## /mail-desk — FAIL

- Q1: PASS — `.topbar` stable; no refresh control (data refreshes server-side "Gmail checked every 10 minutes").
- Q2: PASS — 7 buttons @375 (16 @1440) all named/focusable; Tab walk all-visible indicators.
- Q3: **FAIL** — same raw unstyled link `<a href="https://mail.google.com/mail/u/0/#all/19ea6f1032938c3f">` (no class) inside `.md-table` MAIL column — default-blue "Re: Refund Status Update – 1575 – Dabdoob App". All widths; `mail-desk-375.png`, `mail-desk-1440.png`. Severity **major**, class **B1**.
- Q4: PASS — no page h-scroll at any width; `table.md-table` (sw=704) inside `div.tblscroll` `overflow-x:auto` @375; long subject wraps within cell — the feared long-content overflow does NOT break layout.
- Q5: PASS — designed filters "Last 7 days, 1 / Open, 1 / Late or covered by another TL", badge "Open past due"; `.empty` markup present.
- Q6: PASS — `nav-ind` dynamic transform only.
- Q7: PASS — h1=1, h2 for section; 3 labelled sections; landmarks present.
- Q8: PASS — state rules present; hover ring verified.

---

## Not verified / assumptions

- Error and loading visuals not triggerable through existing UI controls (spec forbids forcing); only DOM markers (`role=status`, `aria-busy`, `.empty`) verified — PASS reflects designed markup presence, not rendered error styling.
- Disabled-state appearance: no `[disabled]` control rendered on any route; rule coverage (10 `:disabled` rules) verified in CSS only.
- Console noise is dev-mode only: `Date.now()` prerender warning + one 500 resource per route, plus the "1 Issue" Next dev overlay in screenshots — not counted as product defects.
- `span.cx-sr` clipped-text hits are the intentional screen-reader-only pattern — not a defect.
- `a.skip` (skip link) measured offscreen until focus — intended pattern.
- Q1 on kb-tracker/kpi-logs/mail-desk verified via load + resize + scroll only (no refresh/toggle control on those pages).

## Fix handoff (per `P2-fix-template.md`)

| # | Finding | Class | Sev | Where |
|---|---------|-------|-----|-------|
| 1 | Unstyled `<a href="https://mail.google.com/…">` in mails card/table | B1 | major | `/tl-performance` + `/mail-desk` — `desk` mail link markup |
| 2 | Raw `<input type="range" id="dk-r-*">` sliders without shared class | A3 | minor | `/tl-performance` Responsibilities section |
