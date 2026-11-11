# UX3 audit — productivity shard 1 — 2026-11-11 — ux-ui-expert

Env: npm run dev @ :3000 (pre-existing instance PID 14556), `npm run test:e2e:seed` OK,
chromium (project `playwright`), viewports 375/768/1024/1440 × 900, `fullPage` shots.
Identities: e2e.admin@dabdoob.com (admin routes), e2e.agent@dabdoob.com (`/my-status`,
separate browser context = signed-out separation). Loaded signal `.cxp[aria-busy="false"]`.
Note: audit-only, fixes deferred to P2F round.

| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|-------|-----|-----|------|------|-----------|---------|
| `/status-validation` | minor Q4 | pass | pass | pass | Q4@375 | FAIL |
| `/my-status` (agent) | pass | pass | pass | pass | — | PASS |
| `/productivity-analytics` | Q4 | pass | pass | pass | Q4@375, Q6 minor | FAIL |
| `/tph` | pass | pass | pass | pass | — | PASS |

Screens: `results/ux3-screens/productivity/<route>-<w>.png` (16 files, all on disk).

## /status-validation — FAIL

Identity: e2e.admin. Page renders flag queue ("652 to review" h2, "Status validation" h1).

- Q1: PASS — `header.page-head` bbox identical before/after `.pv-item` expand at all 4 widths (e.g. 375: x24 y222 w327 h165 → unchanged).
- Q2: PASS — 55–64 visible `button`s, 0 unnamed; Tab order brand→nav-toggle→rail-search→nav groups, every stop shows 2px `rgb(47,111,237)` outline + ring box-shadow.
- Q3: PASS — 0 class-less links, 0 `href="#"`, 0 unlabeled inputs; all controls shared `.cx-btn`/`.cx-chip` (50 chips) + radiogroup + 2 dialogs.
- Q4: FAIL @375 — `span.cx-muted` inside `button.cx-btn.workitem.pv-item > .wi-main > .wi-t.pv-item__who` (interval string e.g. "Wed 21 Oct, 18:55–14:53") is ellipsis-truncated at the viewport edge (`productivity.css:15` `overflow:hidden;text-overflow:ellipsis`) and `status-validation-page.tsx:388` has **no `title` attr** — full interval unreadable in the row. No document h-scroll (docSW=375). Severity: minor. Suspected class: B16. Shot: `status-validation-375.png`.
  - 768/1024/1440: no overflow, no clipped elements.
- Q5: PASS — "Pick a flag / Select a flag on the left…" designed empty detail pane; `emptyEls=2`; `.cx-chip[data-status]` states; "Show 50 more" pager.
- Q6: PASS — `pv-*`/`wi-*` classes on `--cx-*` tokens; only inline style is popover `transform: translate(...)` (dynamic JS positioning, not a hardcoded design value).
- Q7: PASS — 1 h1, sequence 2-1-2-2 (shell "View as" h2 precedes h1 — shared-shell pattern, no level skip); nav+main landmarks; 3/4 sections labelled.
- Q8: PASS — hover style change measured on controls; `aria-current` on nav, 11 `aria-expanded`, radiogroup, disabled states via `.cx-btn`.

## /my-status — PASS (identity: e2e.agent)

- Q1: PASS — `header.page-head` stable all widths (agent page has no refresh control; n/a action).
- Q2: PASS — 4–10 buttons, 0 unnamed; same visible 2px focus ring on every Tab stop.
- Q3: PASS — 0 raw/class-less links, 0 unlabeled inputs.
- Q4: PASS — docSW=innerWidth at all 4 widths; 0 elements past the viewport edge.
- Q5: PASS — designed empties everywhere: "No logged time this week yet.", "No flags in the last 45 days" + explainer, "—" stat dashes, "What you can do" tips.
- Q6: PASS — token classes; inline styles only dynamic popover transform.
- Q7: PASS — cleanest hierarchy: h1 "My status" → h2 This week/Your flags/Before vs after/What you can do; nav+main; 5/5 sections labelled.
- Q8: PASS — hover change measured; `aria-current`, 9 `aria-expanded`.

## /productivity-analytics — FAIL

- Q1: PASS — `header.page-head` bbox identical at all widths; no refresh control on page (Previous/Next week nav buttons not clicked — they navigate, not toggle state).
- Q2: PASS — 6–15 buttons, 0 unnamed, 1 disabled (visible disabled state); focus ring verified.
- Q3: PASS — 0 raw links/inputs.
- Q4: FAIL @375 — **document h-scroll: `docElement.scrollWidth=446 > 375`.** Culprit: bare `table.cx-table` inside `div.cx-panel.cx-panel--pad.pv-hist` ("Calibration of X" section, `pv-shared.tsx:215`) rendered **without `.cx-tablewrap`** — table right edge 446px, cells clipped at viewport. Screenshot confirms 446px-wide render. Severity: major (WCAG 1.4.10 reflow; spec rule `scrollWidth <= innerWidth` violated). Suspected class: B7. Shot: `productivity-analytics-375.png`.
  - 768/1024/1440: PASS — other tables sit in `.cx-tablewrap` (`overflow-x:auto`, `cx-kit.css:624`); the `.pv-heat` heatmap is itself `overflow-x:auto` (`productivity.css:65`) so its cell overflow is contained — intended scroll regions, no page-level scroll.
- Q5: PASS — designed empties: "No flags in this week.", "No disputes.", "— — —" in "Flag precision" chart.
- Q6: minor — six `h2#pa-*` section headings carry inline `style="margin: 0px"` (literal in DOM styles, B4-lite). Rest on tokens; 195 `[style]` elements are chart geometry/dynamic transforms. Severity: minor.
- Q7: PASS — 1 h1 + six h2 sections, all 8 sections labelled; nav+main present.
- Q8: PASS — hover change measured; `aria-current`; disabled button distinct.

## /tph — PASS

- Q1: PASS — `header.page-head` stable all widths (date picker + Previous/Next day; not clicked — navigation controls).
- Q2: PASS — 19–28 buttons, 0 unnamed, 1 disabled; focus ring verified (a.brand→nav-toggle→rail-search→tab buttons all ringed).
- Q3: PASS — 0 raw links/inputs; date input labelled.
- Q4: PASS — docSW=innerWidth all widths. @375 the tab strip `.tph-tabs` is `overflow-x:auto` (3 of 6 tabs visible, scrolls — designed mobile pattern); tab buttons' overflow is contained, no clip into page.
- Q5: PASS — designed empties: "Touches for today come in tomorrow at about 08:30" amber cards, "Nothing needs attention for 2026-11-11.", "None scored yet", "0 of 0" coverage.
- Q6: PASS — `--tph-*`/token classes; inline styles only dynamic popover transform.
- Q7: PASS — h1 "TPH and caps" + h2 sections; 6/6 labelled; nav+main. (Two h2s share the text "Who is on which channel" — duplicate label, cosmetic only.)
- Q8: PASS — `aria-selected` tab, `aria-current`, 2 radiogroups, disabled state, hover change measured.

## Cross-cutting notes (not page FAILs)

- Console noise on every route (dev-only): Next 16 `unstable value Date.now() while prerendering` error + `500` resource hits (`/api/qa/getQaCtlPage` ×8, `/api/queue/refresh` ×1 in devserver.log — other features' APIs, not these pages'). Environment noise; productivity routes' own APIs returned 200.
- Shell h2 "View as" precedes the page h1 in DOM order on admin pages — shared-shell pattern (ViewAs widget), identical across routes; no level skip.
- `my-status-375.png` shows the sticky shell header painted mid-page — fullPage stitching artifact, not a layout defect.

## Not verified

- Error states (no UI control reaches one without editing source); loading skeleton visual (settled before capture, `aria-busy` observed clearing); `/status-validation` Reviewed/Dismissed tab panes (Open tab audited); TPH "Grid and tasks/Cases/Agents/Caps and touches/Channels" tab panes (Overview audited — grid matrix `tph-grid-matrix.tsx` is behind a tab).
- Evidence format per spec: FAILs list width, selector/region, screenshot, severity, class.
