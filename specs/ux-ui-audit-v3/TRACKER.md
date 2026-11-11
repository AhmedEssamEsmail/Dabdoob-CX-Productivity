# TRACKER — ux-ui-audit-v3

Only the TL edits this file. Owners write `results/<leaf-id>.md`.

Baseline dirty tree: ~37 perf-pushdown modified files + untracked tests/perf (see PLAN Execution notes). Stage per-leaf hunks only; never `git add` a file that also contains WIP.

## Phase 1A — Known classes (A1–A7)

| Leaf | Row | Spec | Owner | Depends | Status | Result/evidence |
|---|---|---|---|---|---|---|
| S01-01 | A1 | spec/S01.md#s01-01 | dev | none | done | results/S01-01.md — verify-only PASS, no edit; responsive.spec 20/20 |
| S01-02 | A2 | spec/S01.md#s01-02 | dev | none | done | results/S01-02.md — refresh.css own-row status + 11rem button; aging spec 20/20 |
| S01-03 | A4 | spec/S01.md#s01-03 | dev | none | done | results/S01-03.md — narrow prop removed; `.page-narrow` CSS kept (StateScreen still emits) |
| S01-04 | A5 | spec/S01.md#s01-04 | dev | S01-03, S02-03 | done | results/S01-04.md — "connected apps" 0 hits; keys/regex untouched |
| S01-05 | A6 | spec/S01.md#s01-05 | dev | none | done | results/S01-05.md — px-exact annotations + `.setting-find` min(); eslint n/a css; browser check deferred to gates |
| S01-06 | A7 | spec/S01.md#s01-06 | dev | S01-03 | done | results/S01-06.md — `.sr-only` alias removed; grep 0 hits |
| S02-01 | A3 | spec/S02.md#s02-01 | dev | none | done | results/S02-01.md — 5 groups→Seg, 2 marked raw; eslint 0/tsc clean |
| S02-02 | A3 | spec/S02.md#s02-02 | dev | none | done | results/S02-02.md — heatmap controls via Toggle/Seg; playwright 25/25 |
| S02-03 | A3 | spec/S02.md#s02-03 | dev | none | done* | results/S02-03.md — enumerated scope done; residual below |
| S02-04 | A3 | spec/S02.md#s02-04 | dev | none | done | results/S02-04.md — kept-raw markers normalized; eslint clean (3 pre-existing B4 warnings) |
| S02-05 | A3 | spec/S02.md#s02-05 | dev | none | done | results/S02-05.md — Input/Button/Toggle; eslint 0 (2 pre-existing B4 warnings) |
| S02-06 | A3 | spec/S02.md#s02-06 | dev | S01-04 | done | results/S02-06.md — swatch radios marked, checkboxes→Toggle, cardtoggle→Button |
| S02-07 | A3 | spec/S02.md#s02-07 | dev | none | done | results/S02-07.md — trackers Toggle/Button, scene controls marked; eslint 0 |
| S02-08 | A3 | spec/S02.md#s02-08 | dev | none | done | results/S02-08.md — Topbar marked, Popups→Button, palette→Input; eslint 0 |
| fx-01 | infra | spec/fix-ux3-1.md#fx-01 | dev | none | done | results/fx-01.md — no-raw-controls honors `intentionally raw` markers; disables removed |
| fx-02 | infra | spec/fix-ux3-2.md#fx-02 | dev | none | done | results/fx-02.md — 12 marked / 2 dialogs→Dialog / links already covered; eslint src = 0 problems, tsc clean |

Serial chains: S02-03 → S01-04 → S02-06; S01-03 → S01-04; S01-03 → S01-06.
Same-file serialization also enforced vs Phase-1B leaves (admin-page.tsx, cx-kit.css, hub.css etc.).

## Phase 1B — New classes (B1–B18)

| Leaf | Pkg | Spec | Depends | Status | Result/evidence |
|---|---|---|---|---|---|
| B12-01 | P1B-01 | spec/P1B-chrome.md#b12-01 | none + after S02-06 (admin-page/my-day conflicts) | done | results/B12-01.md — 7 hub files→PageShell; tsc err was B12-02 in-flight file |
| B12-02 | P1B-01 | spec/P1B-chrome.md#b12-02 | none + after S02-02/04/05 (queue file conflicts) | done | results/B12-02.md — 7 queue files→PageShell/Head; tsc clean |
| B12-03 | P1B-01 | spec/P1B-chrome.md#b12-03 | none + after S02-07 (audit-queue-page) | done | results/B12-03.md — QaPage/qa-forms via PageShell; audit-queue already compliant |
| B12-04 | P1B-01 | spec/P1B-chrome.md#b12-04 | none + after S02-07 (trackers-page) | done | results/B12-04.md — trackers→PageShell; 4 desk files already compliant |
| B12-05 | P1B-01 | spec/P1B-chrome.md#b12-05 | none + after S02-03 (agents-page) | done | results/B12-05.md — agents/my-actions→PageShell |
| B12-06 | P1B-01 | spec/P1B-chrome.md#b12-06 | none | done | results/B12-06.md — productivity-analytics→PageShell (3 already compliant) |
| B8-01 | P1B-01 | spec/P1B-chrome.md#b8-01 | B1-02, B4-02, B16-01, B13-01 | done | results/B8-01.md — h3→h2 in my-actions + 3 div→h2; 5 files compliant |
| B8-02 | P1B-01 | spec/P1B-chrome.md#b8-02 | B1-03, B17-03, B16-02 | done | results/B8-02.md — no-op, all h1/h2 compliant post-B12-02 |
| B8-03 | P1B-01 | spec/P1B-chrome.md#b8-03 | B1-01, B15-01, B17-03, B10-01 | done | results/B8-03.md — no edits, all compliant; tsc err was B8-07 in-flight (now clean) |
| B8-04 | P1B-01 | spec/P1B-chrome.md#b8-04 | B16-01, B17-02, B1-03 | done | results/B8-04.md — no edits, all headings already compliant |
| B8-05 | P1B-01 | spec/P1B-chrome.md#b8-05 | B16-02, B4-02, B17-03, B7-08 | done | results/B8-05.md — tph-grid-views h2→h3; 3 files compliant |
| B8-06 | P1B-01 | spec/P1B-chrome.md#b8-06 | B1-02, B4-03 | done | results/B8-06.md — no-op, already compliant |
| B8-07 | P1B-01 | spec/P1B-chrome.md#b8-07 | B1-01, B4-04, B15-01 | done | results/B8-07.md — ConfirmInline h4→h3; 9 files verified (state-screen h1s kept) |
| B10-01 | P1B-02 | spec/P1B-controls.md#b10-01 | B12-01, B12-04 | done | results/B10-01.md — markers on roster/tl-perf; others already compliant |
| B10-02 | P1B-02 | spec/P1B-controls.md#b10-02 | B12-03, B12-04, B12-05 | done | results/B10-02.md — 4 files labelled; meetings:852 `<button>` = S02-03 residual |
| B10-03 | P1B-02 | spec/P1B-controls.md#b10-03 | B12-02 | done | results/B10-03.md — no edits needed, already compliant |
| B9-01 | P1B-02 | spec/P1B-controls.md#b9-01 | B10-02, B10-03, B12-06 | done | results/B9-01.md — 3 dialogs→shared Dialog; `<dialog` 0 hits |
| B2-01 | P1B-02 | spec/P1B-controls.md#b2-01 | none | no-op | TL-run grep at integration (PM: skip) |
| B14-01 | P1B-02 | spec/P1B-controls.md#b14-01 | B8-06, B8-02, B15-01 | done | results/B14-01.md — .cpk-item[aria-disabled] styled; residual grep hit is sanctioned trk radio |
| B3-01 | P1B-03 | spec/P1B-states.md#b3-01 | B10-03, B12-02, B12-06, B9-01 | done | results/B3-01.md — Empty branches in 4 files; 3 already guarded |
| B3-02 | P1B-03 | spec/P1B-states.md#b3-02 | B10-02, B10-01, B12-03 | done | results/B3-02.md — Empty guards in 4 files; 4 already compliant |
| B7-01 | P1B-03 | spec/P1B-states.md#b7-01 | B3-02 | done | results/B7-01.md — 9 tablewraps→TableScroll; tsc/eslint 0 |
| B7-02 | P1B-03 | spec/P1B-states.md#b7-02 | B7-01 | done | results/B7-02.md — remaining 8 tables wrapped; tsc/eslint 0 |
| B7-03 | P1B-03 | spec/P1B-states.md#b7-03 | B3-02 | done | results/B7-03.md — 9 tablewraps converted; eslint clean |
| B7-04 | P1B-03 | spec/P1B-states.md#b7-04 | B12-03, B10-02 | done | results/B7-04.md — 10 sites in 7 files; 2 already compliant |
| B7-05 | P1B-03 | spec/P1B-states.md#b7-05 | B3-01 | done | results/B7-05.md — 8 tables wrapped; eslint 0 (5 pre-existing B4 warnings) |
| B7-06 | P1B-03 | spec/P1B-states.md#b7-06 | B10-02 | done | results/B7-06.md — 8 tables in TableScroll, wrappers merged |
| B7-07 | P1B-03 | spec/P1B-states.md#b7-07 | B10-01 | done | results/B7-07.md — 6 hub tablewraps converted |
| B7-08 | P1B-03 | spec/P1B-states.md#b7-08 | B3-01 | done | results/B7-08.md — 12 tables in 5 files wrapped |
| B13-01 | P1B-03 | spec/P1B-states.md#b13-01 | B7-03, B7-04, B7-06, B10-01 | done | results/B13-01.md — no-op: cites were data conditionals, already skeletized |
| B13-02 | P1B-03 | spec/P1B-states.md#b13-02 | B7-05, B7-07, B12-01, B7-08 | done | results/B13-02.md — skeletons in scheduler/my-day/tph-views; overview already ok |
| B4-01 | P1B-04 | spec/P1B-styles.md#b4-01 | B13-02, B3-01 | done | results/B4-01.md — literals→queue.css classes; eslint 0 |
| B4-02 | P1B-04 | spec/P1B-styles.md#b4-02 | B13-01, B7-06, B12-05, B3-02, B7-08 | done | results/B4-02.md — literals→people/productivity.css classes |
| B4-03 | P1B-04 | spec/P1B-styles.md#b4-03 | B3-02, B10-01, B12-01, B13-02, B13-01 | done | results/B4-03.md — literals→hub.css classes; others dynamic-only |
| B4-04 | P1B-04 | spec/P1B-styles.md#b4-04 | B7-04, B12-06 | done | results/B4-04.md — ViewAs color→class, my-status literals→pv-* classes |
| B5-01 | P1B-04 | spec/P1B-styles.md#b5-01 | none + after S01-05 (hub.css conflict) | done | results/B5-01.md — 13 --eco3-* tokens; literals only in defs |
| B5-02 | P1B-04 | spec/P1B-styles.md#b5-02 | none | done | results/B5-02.md — tph palette comment, #fff→token, px-exact annotations |
| B5-03 | P1B-04 | spec/P1B-styles.md#b5-03 | B4-03, B5-01 | done | results/B5-03.md — all 88 hits are 3D-internals; palette annotated |
| B6-01 | P1B-04 | spec/P1B-styles.md#b6-01 | none | no-op | TL-run grep at integration (PM: skip) |
| B11-01 | P1B-04 | spec/P1B-styles.md#b11-01 | none | done | results/B11-01.md — z-index:50→calc(var(--z-modal)+10); grep 0 hits |
| B1-00 | P1B-05 | spec/P1B-links-focus.md#b1-00 | none + after S01-06 (cx-kit.css conflict) | done | results/B1-00.md — `.cx-link` rules added to cx-kit.css |
| B1-01 | P1B-05 | spec/P1B-links-focus.md#b1-01 | B1-00, B7-07, B17-03 | done | results/B1-01.md — cx-link on 8 anchors in 4 files |
| B1-02 | P1B-05 | spec/P1B-links-focus.md#b1-02 | B1-00, B16-01, B17-02, B4-03 | done | results/B1-02.md — cx-link on 6 anchors in 5 files |
| B1-03 | P1B-05 | spec/P1B-links-focus.md#b1-03 | B1-00, B17-02, B7-02, B17-03, B4-01 | done | results/B1-03.md — cx-link on ticket anchors |
| B15-01 | P1B-05 | spec/P1B-links-focus.md#b15-01 | B14-01, B1-01 | done | results/B15-01.md — no-op, all 4 regions correct elements already |
| B16-01 | P1B-05 | spec/P1B-links-focus.md#b16-01 | B13-01, B7-04, B9-01 | done | results/B16-01.md — titles added in 6 files; tl-tasks already compliant |
| B16-02 | P1B-05 | spec/P1B-links-focus.md#b16-02 | B4-01, B4-02, B4-03, B4-04 | done | results/B16-02.md — titles added in 6 files; my-status compliant |
| B18-01 | P1B-05 | spec/P1B-links-focus.md#b18-01 | B8-07, B1-00, B4-04 | done | results/B18-01.md — .nt-capture-box focus ring added; 6 files covered |
| B18-02 | P1B-05 | spec/P1B-links-focus.md#b18-02 | B8-02, B8-05, B17-03, B1-03, B5-02 | done | results/B18-02.md — focus covered by universal rule; .mixbar clip fixed |
| B18-03 | P1B-05 | spec/P1B-links-focus.md#b18-03 | B8-04, B8-01, B8-03, B17-02, B1-03, B5-02, B18-01 | done | results/B18-03.md — verify-only, all 19 sites covered |
| B17-01 | P1B-06 | spec/P1B-format.md#b17-01 | B4-01 | done | results/B17-01.md — shared/lib/format.ts created; both fmt re-export |
| B17-02 | P1B-06 | spec/P1B-format.md#b17-02 | B17-01, B4-04, B13-01, B16-01 | done | results/B17-02.md — fmt/formatDate_ swaps; kept sites documented |
| B17-03 | P1B-06 | spec/P1B-format.md#b17-03 | B17-01, B16-02, B4-03, B4-02, B5-03 | done | results/B17-03.md — fmt swaps in 4 files; kept sites documented |

Spec normalization by TL before dispatch (format only, no scope change): S01-01/S01-03 Files-entry format; P1B `### Actions` lists expanded to per-site numbering matching declared `Budget: actions` (declared counts were already the honest per-site count per LIMITS atomic-action rule); B17-03 budget corrected files 7→8 / actions 8→9 (8 file entries listed). B2-01/B6-01 are no-op verify leaves skipped per PM; their greps run at integration.

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| S02-03 residual: `meetings-page.tsx:853` `<button>` | discovered after enumerated scope done; 1 hit, 1 file | RESOLVED by fx-02 (marked `intentionally raw`); no reshard needed | closed |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| integration | tsc | `npx tsc --noEmit` → logs/gate-tsc.log | PASS exit 0 |
| integration | eslint | `npx eslint src` → logs/fx-02-eslint.log | PASS — 0 problems after fx-02 |
| integration | residual greps | transition:all=0, .sr-only=0, "connected app"=0, raw z-index>10=0, page-head only in PageShell/StateScreen+comments, `<dialog` only in shared Dialog, unclassed `<a` 0 | PASS |
| integration | browser 375/1024 | S01-05 visual check | NOT RUN — deferred to PM ux gate |

## Blocked / needs user
- (none)

## Phase 2 — Page-by-page visual sweep (re-added by P2F TL from results files)

| Leaf | Spec | Owner | Status | Result/evidence |
|---|---|---|---|---|
| P2-APP-01 | spec/P2-app.md | ux-ui-expert | done | results/ux3-app-1.md — 4/4 FAIL: F1 logo 500 (global), F2 issue-pill overlap, F3 head +52px @1024 (A2, intermittent), F4 hr literals (B4), F5 View-as h2<h1 (B8), F6 nested main, F7 logout blank frame, F8 /tph title |
| P2-HUB-01 | spec/P2-hub.md | ux-ui-expert | done | results/ux3-hub-1.md — FAIL /overview (Q1 A2), /admin (Q3 A5 app_url_*, Q4 blocker kv-grid/h-scroll, Q5 no retry), /ecosystem (Q4 tag overlap @375); PASS /my-day, /admin/config, /admin/roster, /people-holidays |
| P2-QA-01 | spec/P2-quality.md | ux-ui-expert | done | results/ux3-quality-1.md — FAIL /ctls (blocker, fetch failed — env?); PASS /audit-queue, /calibration, /disputes, /kb-gaps (LOW chip wrap) |
| P2-QA-02 | spec/P2-quality.md | ux-ui-expert | done | results/ux3-quality-2.md — FAIL /quality-analytics (Q4 @375 svg grid blowout); PASS others; cross-route dev prerender noise |
| P2-PROD-01 | spec/P2-productivity.md | ux-ui-expert | done | results/ux3-productivity-1.md — FAIL /status-validation (Q4 B16 title @375), /productivity-analytics (Q4 tablewrap @375 + Q6 literals); PASS /my-status, /tph |
| P2-QUEUE-01 | spec/P2-queue.md | ux-ui-expert | done | results/ux3-queue-1.md — FAIL /queue (Q1 A2 @1440), /checkins (Q4 1px @375); PASS /aging, /analytics, /heatmap, /scheduler |
| P2-PEOPLE-01 | spec/P2-people.md | ux-ui-expert | done | results/ux3-people-1.md — FAIL /hard-cases, /kpi-close (UnbuiltPage blocker); PASS* /tl-tasks (Q3 gantt), /my-actions (Q4 band); PASS others |
| P2-OPS-01 | spec/P2-operations.md | ux-ui-expert | done | results/ux3-operations-1.md — FAIL /trackers (Q5+Q8 zero-state blocker, Q7 h2<h1), /escalation-matrix (UnbuiltPage blocker) |
| P2-DESK-01 | spec/P2-desk.md | ux-ui-expert | done | results/ux3-desk-1.md — FAIL /tl-performance + /mail-desk (Q3 raw mail.google.com links B1), /tl-performance (Q3 range inputs A3); PASS /kb-tracker, /kpi-logs |
| P2-SH-01 | spec/P2-shell.md | ux-ui-expert | done | results/ux3-shell-1.md — FAIL Topbar crumbTitle (global), /fcr UnbuiltPage blocker; minors: rail-search-label clip, rail blank band ≤820 |

## Phase 2F — Fix round 1 (spec/fix-P2-1.md) — TL section

Triage vs Phase-1 fixes (grep-verified, not tracker-trusted):

ALREADY-FIXED (verify rows, no leaf): desk mail links (mail-desk-page.tsx:173,243 + tl-performance-page.tsx:320 have `.cx-link`); dk-r range sliders (marker + labelled, tl-performance:159-167); pv-hist table (TableScroll, pv-shared.tsx:220); h2#pa-* margin literals (none in source); pv-item__who title (status-validation:389); hr.hr margin literals (none — hr--tight/hr--compact classes); md-agenda-range (shared Seg, my-day:1068); tl-tasks gantt controls (markers :399/:426 + Seg internals).

| Leaf | Root cause | Owner | Depends | Status | Result/evidence |
|---|---|---|---|---|---|
| P2FSH-01 | UnbuiltPage calls client D() in server render | dev | none | done | results/P2FSH-01.md — use client on StateScreen; eslint+tsc clean; browser re-check w/ auth |
| P2FSH-02 | proxy matcher lacks /assets → optimizer 500 | dev | none | done | results/P2FSH-02.md — matcher +assets; eslint+tsc clean; 200 verify at gate |
| P2FSH-03 | Topbar drops crumbTitle prop | dev | none | done | results/P2FSH-03.md — crumbs Group/<b>Page</b> per mock; eslint+tsc clean |
| P2FSH-04 | va-title h2 precedes page h1 in DOM | dev | none | done | results/P2FSH-04.md — h2#va-title→p; eslint+tsc clean |
| P2FSH-05 | rail-search-label clips w/o title | dev | none | done | results/P2FSH-05.md — title attr on .rail-search; eslint+tsc clean |
| P2FSH-06 | .shell grid stretch → rail blank band ≤820 | dev | none | done | results/P2FSH-06.md — shell rows auto+1fr ≤820; tsc clean |
| P2FOPS-01 | /trackers zero-state blank + dead __new__ | dev | none | done | results/P2FOPS-01.md — isEmpty Empty+create, switcher hidden; eslint+tsc clean |
| P2FQUEUE-01 | A2 refresh status reflows /queue + /overview (+/ my-day) | dev | none | done | results/P2FQUEUE-01.md — aging-page-head on /queue+/overview + generic status row; eslint+tsc clean |
| P2FQUEUE-02 | /checkins 1px doc h-overflow @375 (bisect) | dev | none | done | results/P2FQUEUE-02.md — content-box inputs @375: chk-form+border-box in queue.css; verified scrollWidth==innerWidth |
| P2FHUB-01 | /admin kv-grid crushes values + h-scroll @375 | dev | none | done | results/P2FHUB-01.md — hub.css: kv-row stack ≤40rem, setting-value clamp; tsc clean |
| P2FHUB-02 | app_url_* raw GAS URLs + setting-key title | dev | P2FHUB-01 | done | results/P2FHUB-02.md — app_url_* as cx-link + .setting-key title; eslint+tsc clean |
| P2FHUB-03 | /admin section errors no retry; reminders stuck | dev | P2FHUB-02 | done | results/P2FHUB-03.md — settings Try-again + Rb error chip/retry; eslint+tsc clean |
| P2FHUB-04 | /ecosystem floating tags overlap @375 | dev | P2FHUB-01 | done | results/P2FHUB-04.md — .eco3-tags hidden ≤600px; tsc clean |
| P2FQA-01 | /quality-analytics svg min-inline-size grid blowout | dev | none | done | results/P2FQA-01.md — min-inline-size:0 on .qa-cols__grid>*; tsc clean |
| P2FQA-02 | kb-gaps Type col mid-word wrap | dev | P2FQA-01 | done | results/P2FQA-02.md — .qa-kbgaps__type nowrap; eslint+tsc clean |
| P2FAPP-01 | /auth/login nested <main> | dev | none | done | results/P2FAPP-01.md — login main→div, single main verified live; eslint+tsc clean |
| P2FAPP-02 | /auth/logout blank mid-frame | dev | none | done | results/P2FAPP-02.md — logout renders BootSplash client-side; eslint+tsc clean |
| P2FPROD-01 | document.title unset on /tph | dev | P2FSH-05 | done | results/P2FPROD-01.md — title re-assert @0/50/200ms; /tph-grid→/tph verified 10/10 |

DEFERRED (LOW, routes still PASS or minor-only): clipped `Actions`/`Edit`/VERSION th on /admin/config,/admin/roster,/people-holidays,/qa-forms; /overview age-ladder digits + /agents name col + .setting-key≥768 (P2FHUB-02 covers setting-key); /disputes+qa-forms no scroll affordance cue; md-agenda radios A3-lite (now Seg); /admin unlabelled TOC nav; raw "TypeError: fetch failed" error copy (global PageStates copy decision); GOOGLE_* env-var copy on /my-day; /ctls ~250px band on error layout.

EXTERNAL/ENV (evidence, no fix): "N issues" pill overlap = Next dev-overlay badge (verify in prod build at PM gate); /ctls "TypeError: fetch failed" = upstream fetch failure (env/data — reproduce at gates); `Date.now()` prerender console errors = Next-16 dev-mode diagnostics (needs dynamic-render decision — NEEDS_APPROVAL for cross-cutting change); mail/calendar 500s on /my-day = missing Google creds env; /qa-forms "PLACEHOLDER" row = seed fixture data.

## Phase 3 — Regression lock-in (C1–C6) — TL section (re-added after Phase-1 TL rewrite)

Baseline (P3 TL): working tree holds unrelated uncommitted perf-pushdown WIP.
Workers stage ONLY their own leaf files; no commits — PM commits at the end.

| Leaf | Spec | Owner | Depends | Status | Result/evidence |
|---|---|---|---|---|---|
| P3-C1-01 | spec/P3-C1.md#P3-C1-01 | test-engineer | none | done | results/P3-C1-01.md: 41 routes, tsc+eslint+--list clean |
| P3-C1-02 | spec/P3-C1.md#P3-C1-02 | test-engineer | P3-C1-01 | done | results/P3-C1-02.md: 82 tests/width-pair enumerated, tsc+eslint clean |
| P3-C1-03 | spec/P3-C1.md#P3-C1-03 | test-engineer | P3-C1-02 | done | results/P3-C1-03.md + page-contract-baseline.md: 68/82; quirks tuned exact-match; real FINDINGs left failing pending Phase-1/2 |
| P3-C2-01 | spec/P3-C2.md#P3-C2-01 | test-engineer | A1=S01-01 done (verify-PASS) | done | results/P3-C2-01.md: 4/4 chromium, deterministic |
| P3-C2-02 | spec/P3-C2.md#P3-C2-02 | test-engineer | Phase-1 A2 (S01-02) | blocked | toolbar-stability.spec.ts — S01-02 still pending |
| P3-C2-03 | spec/P3-C2.md#P3-C2-03 | test-engineer | A4=S01-03 done | done | results/P3-C2-03.md: 4/4 chromium pass incl. narrow= scan (0 hits) |
| P3-C2-04 | spec/P3-C2.md#P3-C2-04 | test-engineer | A5=S01-04 done | done | results/P3-C2-04.md: 4/4 pass; 1 allowlist (ecosystem-page 'web app URL' field name) |
| P3-C2-05 | spec/P3-C2.md#P3-C2-05 | test-engineer | A3=S02-01..08 done* / A6=S01-05 done | done | results/P3-C2-05.md: 4/4 chromium, repeatable |
| P3-C34-01 | spec/P3-C34.md#P3-C34-01 | maintainer | none | done | results/P3-C34-01.md: 4 rules @warn, eslint exit 0, burn-in 75 warns |
| P3-C34-02 | spec/P3-C34.md#P3-C34-02 | maintainer | C34-01 + 0-warn burn-in + PM confirm | blocked | warn-only per PM; do NOT flip while warnings exist |
| P3-C5-01 | spec/P3-C5.md#P3-C5-01 | tech-writer | P3-C1-02 | done | results/P3-C5-01.md: DoD section appended, referenced paths verified |
| P3-C6-01 | spec/P3-C6.md#P3-C6-01 | test-engineer | P3-C1-01 + Phase-2 PASSes | blocked | optional package |

P3 preflight: check_shards.py PASS x12 after spec-metadata fixes (P3-C5 fence
`##` indent; P3-C2-01/02/05 budget actions 4->5; P3-C6-01 budget/files reword).
NOTE: a Phase-1 TL TRACKER rewrite dropped the Phase-2 TL's section too —
PM may need that TL to re-add it.
