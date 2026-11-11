# UX3 audit — people shard 1 — 2026-11-11 — ux-ui-expert

Env: `npm run dev` @ :3000 (pre-existing dev instance; a second spawn exited with
"Another next dev server is already running"), `npm run test:e2e:seed` ok,
chromium via Playwright, login as `e2e.admin@dabdoob.com`.
Method: per route+width — `documentElement.scrollWidth <= innerWidth`, DOM probe
(controls/names/headings/landmarks/inline styles/state regions/interactive
attrs), header bbox before/after exercising the primary action, keyboard-Tab
focus-ring check, hover delta on first main control, full-page screenshot.
Screenshots: `results/ux3-screens/people/<route>-<w>.png`.

| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|-------|-----|-----|------|------|------------|---------|
| /agents | PASS | PASS | PASS | PASS | — | PASS |
| /one-on-ones | PASS | PASS | PASS | PASS | — | PASS |
| /tl-tasks | PASS* | PASS | PASS | PASS | — | PASS |
| /meetings | PASS | PASS | PASS | PASS | — | PASS |
| /my-actions | PASS* | PASS | PASS | PASS | — | PASS |
| /notes | PASS | PASS | PASS | PASS | — | PASS |
| /coaching | PASS | PASS | PASS | PASS | — | PASS |
| /hard-cases | FAIL | — | — | FAIL | placeholder check | FAIL |
| /kpi-close | FAIL | — | — | FAIL | placeholder check | FAIL |

\* = PASS with minor notes (see per-route).

## /agents — PASS
- Q1: PASS — "Refresh" clicked; `.page-head` bbox identical before/after at all 4 widths.
- Q2: PASS — 29 controls, 0 unnamed; Tab stops in main all show focus ring (8/8 sampled).
- Q3: PASS — 0 classless/raw controls.
- Q4: PASS — `scrollWidth <= innerWidth` all widths; `.cx-table` (sw 1567) sits in `.cx-tablewrap` overflow-x:auto; "How scoring works" tab overflows into a scrollable strip (right 509>375, parent overflow-x:auto) — sanctioned pattern, content reachable.
- Q5: PASS — `role=status` regions present; `LinesSkeleton` used (agents-page.tsx:436,876,905).
- Q6: PASS — 0 inline-style literals in main.
- Q7: PASS — h1×1 then h2,h2 ("Stack Ranking", …); nav+main+header landmarks present.
- Q8: PASS — hover changes computed style; `aria-selected`/`aria-current` set on tabs (4 role=tab).
- Note: agent-name column truncates mid-word at 375 inside the scroll wrapper — acceptable (scrollable), watch if `title` attr wanted (B16).

## /one-on-ones — PASS
- Q1: PASS — Tabs switched (aria-label "One-to-ones"); page-head bbox identical at all widths; view switcher exercised per spec.
- Q2: PASS — 93 controls, 0 unnamed; focus rings on sampled in-main stops.
- Q3: PASS — 0 raw controls.
- Q4: PASS — no hscroll; "Who is due" roster (~40 rows) stacks vertically at 375, no clipping.
- Q5: PASS — `Empty` used (one-on-ones-views.tsx:1547,2119,2181,2279,2487); empty state rendered in DOM (emptyish=1).
- Q6: PASS — 0 inline literals.
- Q7: PASS — h1×1; nav+main+header present.
- Q8: PASS — 3 role=tab with selected state; hover delta confirmed.
- Note: very long page at 375 (~6800px) — data volume, not a defect.

## /tl-tasks — PASS (minors)
- Q1: PASS — seg-switch exercised; one transient head jump (y 162→0) observed once at 375, **not reproduced** on re-run (`tl-tasks-375-postseg.png`, headTop 161.5→161.5, scroll 0→0). Logged as minor, likely shell-chrome reflow during initial settle.
- Q2: PASS — 31 controls, 0 unnamed; 8/8 focus stops ring.
- Q3: minor — 16 classless controls: 10 gantt task `<button>`s + 6 `<input type=radio>` (custom `.pw-gantt` widget, not shared `Button`; visually consistent). Suspected class B2/A3-adjacent.
- Q4: PASS — `.pw-gantt` sw=1400 inside `.cx-panel` overflow-x:auto (cw 325 @375); scrolls internally even at 1440 — sanctioned B7 pattern.
- Q5: PASS — `Empty` (tl-tasks-page.tsx:742,996); role=status present.
- Q6: PASS — 0 inline literals.
- Q7: PASS — h1×1; landmarks present.
- Q8: PASS — 6 seg buttons, `aria-pressed`/`aria-current` set; hover delta confirmed.

## /meetings — PASS
- Q1: PASS — first main button clicked; head bbox identical all widths.
- Q2: PASS — 11 controls; the 2 `datetime-local` inputs are wrapped in `<label class=field>` with visible label text ("Meeting date and time (Kuwait)", "Next meeting…") — implicit labelling, accessible.
- Q3: PASS — 0 raw controls.
- Q4: PASS — no overflow/clip at any width.
- Q5: PASS — `Empty` (meetings-page.tsx:465,559,890); series cards + "Set up a meeting series" CTA designed.
- Q6: PASS — 0 inline literals.
- Q7: PASS — h1,h2,h3 sane; 2 nav + main + header.
- Q8: PASS-with-note — hover produced no computed change on the shared `icon-btn` (first control, empty text but has accessible name); the same shared control shows hover delta on /my-actions and /notes — likely timing, logged as low-confidence minor.
- Minor: dev-server "1 issue" badge overlaps the first datetime field in `meetings-375.png` — dev overlay artifact, not app UI.

## /my-actions — PASS (minor)
- Q1: PASS — first button clicked; head bbox identical.
- Q2: PASS — 2 controls, both named; focus rings ok.
- Q3: PASS.
- Q4: minor — ~300px blank white band between mobile search field and "People & Performance" band at 375 (`my-actions-375.png`); other people pages don't show it. Possibly a reserved/empty chrome slot — verify intent.
- Q5: PASS — designed Empty "You have no open actions." (my-actions-page.tsx:141) + `LinesSkeleton` (:145).
- Q6: PASS.
- Q7: PASS — h1×1; landmarks present.
- Q8: PASS — button hover delta confirmed (re-probed, changed=true).

## /notes — PASS
- Q1: PASS — button click stable.
- Q2: PASS — 6 controls named; focus rings ok.
- Q3: PASS.
- Q4: PASS — no overflow.
- Q5: PASS — Empty "Nothing here yet. Write the first thought in the box above."; designed.
- Q6: PASS.
- Q7: PASS — h1×1; landmarks present.
- Q8: PASS — disabled "Save note" visibly muted (disabled=1, distinct — good B14 signal); hover delta confirmed.

## /coaching — PASS
- Q1: PASS — select-change exercised (Person/Topic); head bbox identical.
- Q2: PASS — 6 controls, labelled ("Person", "Topic", "What you saw"); focus rings on all sampled stops (6/6 @375/768; desktop widths Tab sampling reached only nav — sampling limit, not a defect).
- Q3: PASS.
- Q4: PASS — no overflow.
- Q5: PASS — "Nothing sent yet." empty + `Empty` import (coaching-page.tsx:136).
- Q6: PASS.
- Q7: PASS — h1,h2 sane; landmarks present.
- Q8: PASS — hover delta confirmed.

## /hard-cases — FAIL (both widths)
- Placeholder quick-check: designed `UnbuiltPage` does NOT render. Page shows the
  error boundary: "This page hit an error and could not be shown: Attempted to
  call D() from the server but D is on the client…" + "Try again". HTTP 200,
  `role=alert` present, h1 "Hard cases" renders above the error.
- Where: `src/app/[...slug]/page.tsx` (server component) → `UnbuiltPage`
  (`src/features/shared/components/shell/StateScreen.tsx:22`) calls client-only
  `D()` (`shared/shell/i18n`) during server render.
- Widths: 375 + 1440. Shots: `ux3-screens/people/hard-cases-375.png`,
  `hard-cases-1440.png`. Severity: **blocker** — nav-linked route (sidebar shows
  "Hard cases") dead-ends in an error. Suspected class: none in A1-A7/B1-B18 —
  server/client boundary bug (fix: render `UnbuiltPage` from a client boundary or
  make `D()` server-safe).

## /kpi-close — FAIL (both widths)
- Identical defect: h1 "Month-end KPI close" renders, body is the same D()
  server-call error boundary instead of `UnbuiltPage`.
- Widths: 375 + 1440. Shots: `ux3-screens/people/kpi-close-375.png`,
  `kpi-close-1440.png`. Severity: **blocker** — nav-linked placeholder route
  errors. Same suspected fix as /hard-cases (one fix covers both).

## Global findings (affect all routes above)
- **Broken shell logo (major, shared shell):** `<img src="/_next/image?url=%2Fassets%2Fdabdoob-logo.png…">` returns 500 in dev (`naturalWidth=0`); broken-image icon top-left in every shot. Dev server log: "internal image response failed for /assets/dabdoob-logo.png 307". Likely belongs to P2-SH-01 scope but is visible on every route here.
- **Next.js dev overlay "N issue(s)" badge** visible in 375px shots (e.g. `my-actions-375.png`) — dev artifact, no action.
- **Console noise on all routes:** "unstable value `Date.now()` while prerendering" (RootLayout, Next 16 dev warning) + the logo's 500. Dev-mode findings; not counted against route verdicts.

## Evidence
- Raw probe data: `results/ux3-people-1.json`
- Capture script: `specs/ux-ui-audit-v3/ux3-people-capture.mjs`; focused re-probe: `ux3-people-verify.mjs`
- 33 screenshots under `results/ux3-screens/people/` (32 required + `tl-tasks-375-postseg.png`).

Not verified: error-state appearance on built routes (no UI control to force an
error); dark-mode variants (shell default only); hover on every individual
control (sampled first-per-page). Contrast not instrumented — out of the
8-question scope.
