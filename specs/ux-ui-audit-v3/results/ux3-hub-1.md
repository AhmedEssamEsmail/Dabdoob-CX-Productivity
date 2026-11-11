# UX3 audit — hub shard 1 — 2026-11-11 — ux-ui-expert

Env: `npm run dev` @ :3000 (existing dev server, PID 14556 — a duplicate
:3001 instance was refused by Next's single-dev guard), e2e seed users
(`e2e.admin@dabdoob.com`), chromium headless, viewport height 900.
Error-state probe per route: `/api/*` (non-auth) aborted, page reloaded —
read-only, no source touched. Focus verified with real Tab key (programmatic
`.focus()` does not trigger `:focus-visible`; earlier false negatives corrected).

| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|-------|-----|-----|------|------|------------|---------|
| `/overview` | FAIL | FAIL | FAIL | PASS | Q1 (375–1024) | FAIL |
| `/my-day` | PASS | PASS | PASS | PASS | — (LOW: Q3, Q6) | PASS |
| `/admin` | FAIL | FAIL* | FAIL* | FAIL* | Q3, Q4, Q5-minor | FAIL |
| `/admin/config` | PASS | PASS | PASS | PASS | — (LOW: Q4) | PASS |
| `/admin/roster` | PASS | PASS | PASS | PASS | — (LOW: Q4) | PASS |
| `/people-holidays` | PASS | PASS | PASS | PASS | — (LOW: Q4) | PASS |
| `/ecosystem` | FAIL | PASS | PASS | PASS | Q4 (375) | FAIL |

*`/admin` at 768/1024/1440 fails on minor grounds only (clipped setting-key
text without accessible full text — B16); the 375 failure is blocker-grade.

## /overview — FAIL
- Q1: FAIL (375/768/1024) — clicking Refresh changes the page-head height:
  `{y:221,h:123}` → `{y:221,h:193}` @375, `h:56→108` @768, `h:59→111` @1024
  (status text "You started a refresh …; it is still running." wraps inside
  the head block). Stable @1440 (fits inline). Severity **major**.
  Suspected class A2 (status shares the toolbar row). Selector:
  `main` head block containing the `Refresh`/`Refreshing…` control.
  Shots: `hub/overview-375.png`, `hub/overview-768.png`, `hub/overview-1024.png`.
- Q2: PASS — real Tab probe: `:focus-visible` true, 2px solid outline + double
  ring on all sampled controls; disabled Refresh = `opacity:.55` +
  `cursor:not-allowed`.
- Q3: PASS — no raw elements; TOC/nav anchors all classed.
- Q4: PASS — no h-scroll (`scrollWidth ≤ innerWidth` all widths). LOW: age-mix
  ladder `span` digits clipped without `title` at all widths (B16).
- Q5: PASS — designed empty ("No snapshot yet today…"), skeletons under error
  probe + `role=alert` banner "This page could not load. … Try again"
  (`hub/overview-err.png`).
- Q6: PASS — `span.nav-ind` translate/width inline styles are JS-positioned
  nav indicator (dynamic, exempt); no literal colors/px in DOM styles.
- Q7: PASS — single h1, no skips, nav/main/banner + 7 labelled regions.
- Q8: PASS — hover changes computed style; disabled distinct; selected nav
  pill visible.

## /my-day — PASS
- Q1: PASS — head box identical before/after Refresh click at all widths.
- Q2: PASS — Tab probe rings OK; controls labelled ("Book focus block", etc.).
- Q3: PASS w/ LOW note — raw `<input type="radio" name="md-agenda-range">`
  (Today/Week) inside styled labels: accessible name via wrap, visually a
  designed segmented control; still outside shared `ui/` (A3-lite, LOW).
- Q4: PASS — no overflow/clipping/h-scroll at any width.
- Q5: PASS — designed "Not connected" panels per section (styled, actionable
  hint), designed error banner + skeletons on probe (`hub/my-day-err.png`).
  Note: mail/calendar APIs return 500 in local env — handled gracefully.
- Q6: FAIL-LOW — `hr.hr` ×3–4 `style="margin: 0.7rem 0px"` inline spacing
  literal (B4). Non-blocking.
- Q7: PASS — single h1 "My day", 10 labelled regions.
- Q8: PASS — hover distinct; no disabled controls present.

## /admin — FAIL
- Q1: PASS w/ note — no primary action clicked (refresh-like control not
  actionable in probe); head size constant; earlier "shift" was the probe's
  scroll-into-view, not CLS.
- Q2: PASS — Tab probe rings OK (skip-link, nav, pill TOC all `fv=true`,
  2px ring); controls labelled.
- Q3: FAIL — legacy GAS UI rendered in Settings: `app_url_hub|fcr|quality…`
  values are raw `https://script.google.com/a/macros/dabdoob.com/s/…` strings
  shown to the admin (A5 "obsolete legacy/GAS UI / Im-style URL lists").
  Severity **major** @all widths. Selector: `dl.kv .kv-row .setting-value`.
- Q4: FAIL — **blocker @375**: `document.documentElement.scrollWidth=494`
  (input `.cx-input` right=432, `.setting-actions` right=432, `.cx-btn`
  right=416 — settings edit row doesn't fit, A6); and `.kv`/`.kv-row` use
  fixed-px grids (`dl.kv` `grid-template-columns:277px`, `.kv-row`
  `220px 41px`) so `.setting-value` gets a 41px column: `qa_engine_settings`
  (4,204-char JSON) renders an **89,124px-tall row**, `tlp_responsibility_areas`
  24,526px, `app_url_*` GAS rows 3,061px each — whole page ≈ **244,517px**.
  Classes A6 + B16 (no clamp/scroll on values). Shot: `hub/admin-375.png`.
  At 768–1440 minor: `.setting-key` spans (`prod_confidence_auto_threshold`,
  `…_warning_threshold`) ellipsized without `title`/full text (B16).
  Shots: `hub/admin-768.png` … `admin-1440.png`.
- Q5: FAIL-minor — API-blocked probe shows per-section designed errors
  ("Choices did not load: Failed to fetch", "Settings did not load …") but
  **no retry control** (alert=3, retry=[]) unlike page-level `Try again`
  elsewhere. `hub/admin-err.png`. Reminders toggle stuck on perpetual
  "● loading" with no error state.
- Q6: PASS — only dynamic `nav-ind` transform inline.
- Q7: PASS — single h1, labelled regions; TOC is a second `<nav>` (unlabelled
  but scoped, LOW).
- Q8: PASS — hover distinct; `Save`/`Cancel` disabled={saving} via `.btn`.

## /admin/config — PASS
- Q1: PASS — head box unchanged; no refresh-type control on page.
- Q2: PASS — Tab probe rings OK; every Edit button named; selects labelled.
- Q3: PASS — no raw/unstyled elements.
- Q4: PASS — `table.cx-table` (1,354px) inside `.cx-tablewrap` scrolls
  horizontally; page never h-scrolls. LOW: `Actions` `th` clipped at wrap
  edge without `title` at all widths (B16).
- Q5: PASS — designed error + "Try again" on probe (`hub/admin-config-err.png`);
  empty marker present.
- Q6: PASS — only dynamic nav-indicator inline style.
- Q7: PASS — h1 "Configuration", sane headings; only 1 labelled region (LOW).
- Q8: PASS — hover distinct.

## /admin/roster — PASS
- Q1: PASS — head box unchanged.
- Q2: PASS — Tab rings OK; "Add user"/"Edit" buttons named.
- Q3: PASS — clean.
- Q4: PASS — roster table (913px) scrolls inside `.cx-tablewrap`
  (`scrollLeft=0`, first column fully visible at left edge); no page h-scroll.
  Spec's Q4/table-scroll check at 375 verified. LOW: `Actions` `th` clipped
  at wrap edge w/o `title` (B16).
- Q5: PASS — designed error + Try again (`hub/admin-roster-err.png`).
- Q6: PASS — no literal inline styles.
- Q7: PASS — h1 "Roster".
- Q8: PASS — hover distinct; Active badges are styled chips.

## /people-holidays — PASS
- Q1: PASS — head unchanged.
- Q2: PASS — controls named/focusable; Tab rings verified suite-wide.
- Q3: PASS.
- Q4: PASS — table (662px) in `overflow-x:auto` wrap; no page h-scroll.
  LOW: `Edit` `th` clipped at wrap edge w/o `title` at all widths (B16).
- Q5: PASS — empty states present ("No holidays yet"), designed error on
  probe (`hub/people-holidays-err.png`).
- Q6: PASS.
- Q7: PASS — h1, 3 labelled regions.
- Q8: PASS — hover distinct.

## /ecosystem — FAIL
- Q1: PASS — head constant; page is a fixed-viewport scene (doc height = 900
  at every width).
- Q2: PASS — canvas internals exempt per spec; DOM chrome uses real named
  `<button>`s (group tags, `Now`, `Auto-rotate`, slider, `1 Issue` chip).
- Q3: PASS — no raw elements; `button.eco3-tag` inline `translate3d` styles
  are dynamic scene positioning (exempt).
- Q4: FAIL @375 — floating info tags overlap the page header/attribution:
  "Productivity" tag covers `Ecosystem` title + "Camel model by eb78, CC BY
  4.0" credit; group tags clipped at viewport edges and collide with each
  other (text partially unreadable). Shot: `hub/ecosystem-375.png`.
  Severity **minor** (content still reachable, but text overlap is real).
  Clean at 768+.
- Q5: PASS — designed fallback: "Ecosystem health did not load: Failed to
  fetch — Try again" (`hub/ecosystem-err.png`); status marker present.
- Q6: PASS — only dynamic transform styles.
- Q7: PASS w/ LOW note — h1 + nav + main present; 0 labelled regions
  (acceptable for a canvas page).
- Q8: PASS — selected group tag shows distinct blue outline; chip dismisses.

## Suspected Phase-1 classes observed
A2 (overview refresh-status head shift), A5 (script.google.com `app_url_*`
values rendered in Admin settings), A6 (fixed-px `.kv`/`.kv-row` grids +
`.setting-actions` row overflow @375), B16 (clipped `.setting-key`,
`Actions`/`Edit` th, ladder digits without `title`), B4 (`hr.hr` margin
literal on /my-day), A3-lite (raw `md-agenda-range` radios on /my-day).

## Not verified / assumptions
- Empty states: exercised only where UI offered them; forced-error probe used
  `/api/*` abort (no source edit). `/admin` section-level errors have no retry.
- Console noise on all routes: `unstable value Date.now() while prerendering`
  (Next 16 dev-mode, cache-components) and 500s on mail/calendar endpoints in
  local env — not user-facing defects; UI handles them via designed states.
- `Now` control absent from ecosystem bottom bar at 375 (may be intentional
  collapse); slider + chip + Auto-rotate fit.
- Fixed-position `1 Issue ×` filter chip overlays content on several pages —
  styled, dismissible; logged as observation, not a fail.
- web-design-guidelines source URL not fetched (no WebFetch); the embedded
  8-question Phase-2 contract is the operative checklist per spec.
