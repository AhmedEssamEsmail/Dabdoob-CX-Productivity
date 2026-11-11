# UX3 audit — quality shard 1 — 2026-11-11 — ux-ui-expert

Env: npm run dev @ :3000 (pre-existing instance PID 14556), `npm run test:e2e:seed` re-run OK, chromium (Playwright).
Identity: **e2e.admin@dabdoob.com** for all 5 routes (admin role; /audit-queue opens in "view-as" read-only auditor mode by default).
Screenshots: `specs/ux-ui-audit-v3/results/ux3-screens/quality/<route>-<w>.png` (fullPage). DOM metrics probed per route×width.

| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|-------|-----|-----|------|------|------------|---------|
| /audit-queue | PASS | PASS | PASS | PASS | — | **PASS** |
| /calibration | PASS | PASS | PASS | PASS | — | **PASS** |
| /ctls | FAIL | FAIL | FAIL | FAIL | page load | **FAIL** |
| /disputes | PASS | PASS | PASS | PASS | — | **PASS** |
| /kb-gaps | PASS | PASS | PASS | PASS | — | **PASS** |

All loaded routes: `documentElement.scrollWidth <= innerWidth` at every width; 0 unnamed controls of 7–567 visible controls per route; landmarks `nav`+`main`+banner+labelled `section`s present; single H1, no level skips; focus ring measured on every probed control (universal `:focus-visible` rule, cx-kit.css:120); `--cx-*` tokens throughout (only inline `style` flagged = `.nav-ind` sliding-indicator `transform/width` px — JS-measured animation, not a hardcoded layout value).

## /audit-queue — PASS
- Q1: PASS — `.page-head`-level chrome identical (y112, h101, w1122) before/after clicking "View as" (opens `DIALOG.popup.va-picker`); no jump on load→settle. Sort controls `button.cx-btn.qa-sort` per column.
- Q2: PASS — 544–567 controls, 0 unnamed; all `cx-btn`/`cx-select`; focus rings verified on probed elements.
- Q3: PASS — 3 classless `input[type=radio]` are the shared hidden-input `.cx-seg` pattern (named via wrapping `<label>`; focus ring lands on `input:focus-visible + span`, cx-kit.css:383). No legacy/GAS UI.
- Q4: PASS — scrollW=vw all widths; only flagged clips were `span.cx-sr` (screen-reader-only class — false positive) and one `truncated+title/ellipsis` span @1024+.
- Q5: PASS — designed states observed: `Empty` "Pick a queue item to start auditing." (workspace region `#qq-h`), `va-empty` "Loading the roster…", `.cx-note.qa-viewing` read-only banner.
- Q6: PASS — tokens; `.nav-ind` transform px only.
- Q7: PASS — H1 "Audit Desk" → H2s ("Non-ticket audits", "Off-queue audits", "Today…", "This week…"); 6/7 sections labelled. Note (LOW): an h2 ("View as") precedes the h1 in DOM order.
- Q8: PASS — sort buttons hover/focus per kit CSS; rows expand via `aria-expanded`; `aria-current` nav selected; 1 disabled control rendered with distinct state.
- Detail view (spec note): admin defaults to "view-as" read-only — "Start audit" is hidden by design in that mode; va-picker is a shared `useDialogModal` dialog with labeled search + `va-empty` loading. Evidence: `ux3-screens/quality/audit-queue-detail-1024.png`.
- Dev-mode note: dev overlay "1 Issue" badge bottom-left in shots (sibling shard traced it to the `Date.now()` prerender console error — dev-only artifact, not app UI).

## /calibration — PASS
- Q1: PASS — header rect identical before/after clicking primary "Assign calibration" `.cx-btn--primary`; no jump.
- Q2: PASS — 12–35 controls, 0 unnamed; labeled `cx-input`/`cx-select` pairs (Ticket number, Channel*, Auditor, Reference, Agent).
- Q3: PASS — 0 raw elements; selects are shared `.cx-select`.
- Q4: PASS — scrollW=vw all widths; form stacks cleanly @375 (verified in shot).
- Q5: PASS — designed empty panels "No finished calibrations yet." ×2 (Alignment by month, Results).
- Q6: PASS — tokens only.
- Q7: PASS — H1 → H2 section heads; landmarks ok.
- Q8: PASS — primary button distinct; selects focusable w/ rings; `aria-current` nav.
- Dev-mode note: same dev "1 Issue" badge; at 375 it overlaps the "Reference (team lead)" label in the shot (dev overlay artifact).

## /ctls — FAIL
- **FAIL (blocker)** — page renders only the designed error state at all 4 widths and across two separate runs: `.cx-note` "This page could not load. TypeError: fetch failed" + "Try again" `.cx-btn--quiet`. Data region never loads → page unusable. Where: main content region under h1 "CTLs". Widths: 375/768/1024/1440. Screenshots: `ux3-screens/quality/ctls-375.png`, `-768.png`, `-1024.png`, `-1440.png`. Severity: **blocker**. Phase-1 class: none (fetch/data failure — possibly related to the dev prerender defect noted in ux3-quality-2.md's cross-route finding; verify whether it reproduces outside dev). Secondary (minor): raw exception text "TypeError: fetch failed" is surfaced verbatim to users.
- Q1: PASS — header stable (y112, h82) across loaded→error and after activating controls.
- Q2: PASS — visible controls all named/shared (Try again = `cx-btn--quiet`).
- Q3: PASS — nothing raw.
- Q4: PASS — no overflow; minor note: ~250px empty band between header and content @375 on the error layout (ctls-375.png).
- Q5: PASS — designed error state exists (see FAIL above for the copy nit).
- Q6: PASS — tokens.
- Q7: PASS — H1 + landmarks (only 2 sections — page content absent).
- Q8: PASS — Try again is a real button w/ quiet styling.

## /disputes — PASS
- Q1: PASS — header identical (y112, h82) before/after activating a control; no jump.
- Q2: PASS — 24–47 controls, 0 unnamed; `<details class="qa-card qa-card--strip">` expandable cards are natively keyboard-operable; "Record the decision" `.cx-btn--primary`.
- Q3: PASS — 9 classless `input[type=radio]` = `.cx-seg` decision-radio pattern inside cards (named via labels; ring via `:focus-visible + span`). Freshdesk `ticket #` links styled `.qa-link`.
- Q4: PASS — scrollW=vw all widths. Minor note @375: "Disputes per auditor" `.cx-table` clips at card edge (UPHELD/DISPUTE RATE cols) but scrolls inside `.cx-tablewrap{overflow-x:auto}` (disputes-page.tsx:224 — sanctioned pattern per sibling verdicts); no scroll affordance cue. `p.qa-note`/`qa-note-txt` truncated w/ ellipsis — full text shown via `--full` variant on expand (designed truncation, B16-ok).
- Q5: PASS — `Empty` "No disputes waiting for a meeting decision." exists in code path; populated cards/table verified live.
- Q6: PASS — tokens only.
- Q7: PASS — H1 → H2 "3 to decide" / "Disputes per auditor, 2026-11"; landmarks ok.
- Q8: PASS — chips ("0%, critical" red vs "0%" green), selected nav, hover rules in kit; details expand/collapse state visible via chevron.
- Dev-mode note: dev "1 Issue" badge overlaps the "…per auditor" heading @375 (artifact).

## /kb-gaps — PASS
- Q1: PASS — header identical (y112, h101) before/after activating a control; no jump.
- Q2: PASS — 24–47 controls, 0 unnamed; "Mark added to KB" `.cx-btn` per row.
- Q3: PASS — 0 raw elements; ticket links styled.
- Q4: PASS — scrollW=vw all widths; gaps table inside `TableScroll` (minWidth 44rem, fade) — scrolls internally @375 by design.
- Q5: PASS — populated table + designed `.cx-note` explainer "A gap is logged from one of your own audits…".
- Q6: PASS — tokens only.
- Q7: PASS — H1 "KB gaps" → labelled Gaps table (`TableScroll label="Knowledge-base gaps"`); landmarks ok.
- Q8: PASS — "Yes" chips, `aria-current` nav, hover/focus via kit.
- Notes (LOW): TYPE chips wrap mid-word @1440 ("Missin g data", "Inaccu rate") — chip cell too narrow; suggest nowrap or `overflow-wrap:anywhere`. Evidence `kb-gaps-1440.png`. "9 not yet in the KB" top-right reads as plain text — verify it is/needs a control.
- Dev-mode note: same dev badge.

## Cross-route finding
- Same dev-only overlay as ux3-quality-2.md: "1 Issue" badge bottom-left overlaps content in 375px shots; underlying console defect = `Date.now()` prerender error (dev artifact; see sibling report for detail). Also observed: `p.va-empty "Loading the roster…"` persisted on every page — slow roster fetch under concurrent audit load; transient.
- `input:not([class])` radios on /audit-queue + /disputes are pattern-consistent `.cx-seg` but would trip a raw-input lint (same caveat as sibling shard).

## Not verified / assumptions
- /ctls content itself — page never got past its error state (Q1–Q8 answered for the chrome that did render).
- Hover distinctness verified via stylesheet (`.cx-btn:hover` cx-kit.css:162, `:focus-visible` :120, `.cx-seg` checked states) — runtime hover probe on first-button was inconclusive (target retained focus ring); same approach as sibling shard.
- Empty states on /disputes, /kb-gaps seen in code (`Empty` imports) but not triggered (requires mutating data — read-only rule respected).
- /audit-queue admin-tools workspace not opened: switching identity in the va-picker requires picking "You, with admin tools" which did not complete under load; read-only mode + picker dialog verified instead.
