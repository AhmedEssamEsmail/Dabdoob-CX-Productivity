# TRACKER: ux-ui-audit-v2
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (pre-BUILD, NOT ours — never revert): package.json+lock,
specs/megaplan, specs/perf-remediation/TRACKER.md, src/features/shared/migration/**,
src/features/cx-quality/lib/migrate.ts, supabase/** renames+new, tests/lib/migration-*,
docs/UX-UI Improvement v2.md, specs/ux-ui-audit-v2/ (this spec), nul, probe-lv3-03.log,
reports/, results/, specs/migration-remaining/, specs/supabase-gh-migrations/.
Serialization (same-file writers, TL-enforced): cx-kit.css, refresh.css, theme.css,
shell/ui.tsx, AppShell.tsx, tph-grid-page.tsx, styles/*.css, ui/index.ts, eslint.config.mjs.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | none | n/a | not dispatchable | done | 4/4 children done; integration = tsc clean + registry guard green |
| S02 | package/- | - | none | n/a | not dispatchable | done | 11/11 children done; tsc clean, all goldens pass |
| S03 | package/- | - | S04-02 (cx-kit serialization) | n/a | not dispatchable | done | 16/16 leaves done; S03-03 residual resolved via S03-17→S03-18 (verified) |
| S04 | package/- | - | S01-02, S01-04, S03-04, S03-05 | n/a | not dispatchable | done | 7/7 children done; tsc clean |
| S05 | package/- | - | S01-01, S02-04, S03-15, S04-07 | n/a | not dispatchable | done | 15/15 leaves done; tsc clean, shell tests 8/8 |
| S06 | package/- | - | S02-11, S03-15 | n/a | not dispatchable | done | 15/15 leaves done (S06-16+S06-17 closed S06-02 residual); tsc clean, people 24/24 |
| S07 | package/- | - | S02-06, S02-07, S03-15, S06-04 | n/a | not dispatchable | done | 14/14 leaves done; tsc clean, quality golden 64/64 |
| S08 | package/- | - | S02-08, S03-15, S05-08 | n/a | not dispatchable | done | 10/10 leaves done; tsc clean, queue golden 10/10 |
| S09 | package/- | - | S02-04, S02-10, S03-15 | n/a | not dispatchable | done | 15/15 + S09-16/S09-17 reshard leaves done; tsc clean, goldens pass |
| S10 | package/- | - | S01-01, S02-05, S02-09, S03-15, S04-02 | n/a | not dispatchable | done | 9/9 leaves done; tsc clean, hub/my-day 24/24+10/10 |
| S11 | package/- | - | S02-01..06, S03-15, S04-07, S08-07 | n/a | not dispatchable | done | 9/9 leaves done; tsc clean, desk golden 160/160 |
| S12 | package/- | - | S04-07, S05-08, S05-11, S06..S11 area codemods | n/a | not dispatchable | done | 12/12 + reshard program complete: S12-13..33 done (S12-27 superseded→S12-33), warn-family closed (S12-32), S12-DQ DQ-1..7 done |
| S12-DQ | package/S12 | - | S12-31 | n/a | not dispatchable | done | 7/7 children done (DQ-1..7); dq-* family closed except documented keeps (dq-editor/days/holform) |
| S13 | package/- | - | S06..S11 area codemods | n/a | not dispatchable | done | 7/7 + S13-08 done (S13-07 superseded→S13-08 memo pass); tsc clean |
| S14 | package/- | - | S03-15, S09-17 | n/a | not dispatchable | done | 6/6 + S14-06/S14-07 done (S14-01 residual closed: /tph renders TphGridPage; a11y-keyboard e2e 3/3) |
| S01-01 | mini/S01 | dev | none | 3/3/80/8 | PASS | done | results/S01-01.md — vitest 2/2, tsc clean (fix r1: root route '' + PAGES[0] exact-match) |
| S01-02 | mini/S01 | dev | none | 1/3/30/5 | PASS | done | results/S01-02.md (TL-verified stub; worker died post-edit) |
| S01-03 | mini/S01 | dev | none | 1/2/10/4 | PASS | done | results/S01-03.md — cc-chart overflow + 600px seg; tsc clean |
| S01-04 | mini/S01 | dev | none | 3/4/45/7 | PASS | done | results/S01-04.md — cols-32/75 + collapse; tsc clean |
| S02-01 | mini/S02 | dev | none | 2/3/60/5 | PASS | done | results/S02-01.md — vitest 5/5, tsc clean (fix r1: typed vi.fn mock) |
| S02-02 | mini/S02 | dev | none | 2/3/160/9 | PASS | done | results/S02-02.md — vitest 4/4, tsc clean |
| S02-03 | mini/S02 | dev | none | 2/3/120/8 | PASS | done | results/S02-03.md — vitest 3/3, tsc clean |
| S02-04 | mini/S02 | dev | none | 2/2/120/8 | PASS | done | results/S02-04.md — tsc clean; full vitest 1175 green |
| S02-05 | mini/S02 | dev | none | 2/3/130/8 | PASS | done | results/S02-05.md — tsc clean, vitest green |
| S02-06 | mini/S02 | dev | none | 2/3/140/8 | PASS | done | results/S02-06.md — PageStates 4 primitives + Count; tsc clean |
| S02-07 | mini/S02 | dev | S02-01,S02-02,S02-03,S02-06 | 1/4/120/7 | PASS | done | results/S02-07.md — tsc clean, golden 64/64 |
| S02-08 | mini/S02 | dev | S02-01..04,S02-06 | 1/5/140/8 | PASS | done | results/S02-08.md — tsc clean, golden 60/60; optReload note |
| S02-09 | mini/S02 | dev | S02-01..04,S02-06 | 1/5/140/8 | PASS | done | results/S02-09.md — tsc clean, golden 34/34 |
| S02-10 | mini/S02 | dev | S02-01..03,S02-06 | 1/3/80/5 | PASS | done | results/S02-10.md — tsc clean, golden 16/16 |
| S02-11 | mini/S02 | dev | S02-01..03,S02-06 | 2/5/120/8 | PASS | done | results/S02-11.md — tsc clean, people.test 24/24 |
| S03-01 | mini/S03 | dev | none | 2/4/140/8 | PASS | done | results/S03-01.md + fix r2 (results/S03-01-fix2.md) — PageShell + className + aria-busy; tsc clean |
| S03-02 | mini/S03 | dev | none | 3/5/220/10 | PASS | done | results/S03-02.md — vitest 5/5, tsc clean |
| S03-03 | mini/S03 | dev | none | 3/4/90/7 | PASS | superseded | results/S03-03.md — Chip union+StatusChip DONE, tsc clean; residual → S03-17 (leaves.md) |
| S03-04 | mini/S03 | dev | S04-02 | 3/4/110/8 | PASS | done | results/S03-04.md — Button variants; tsc clean |
| S03-05 | mini/S03 | dev | S04-02 | 5/5/220/10 | PASS | done | results/S03-05.md — Dialog+useDialogModal; Modal deleted; tsc clean |
| S03-06 | mini/S03 | dev | none | 1/2/60/5 | PASS | done | results/S03-06.md — tsc clean |
| S03-07 | mini/S03 | dev | none | 2/3/90/6 | PASS | done | results/S03-07.md — TableScroll + .tblscroll; tsc clean |
| S03-08 | mini/S03 | dev | none | 2/3/120/8 | PASS | done | results/S03-08.md — vitest 6/6, tsc clean |
| S03-09 | mini/S03 | dev | none | 2/4/200/10 | PASS | done | results/S03-09.md — PaintGrid APG; vitest 8/8, tsc clean |
| S03-10 | mini/S03 | dev | none | 2/3/90/6 | PASS | done | results/S03-10.md — PagedList + cv-auto; tsc clean |
| S03-11 | mini/S03 | dev | none | 1/3/80/6 | PASS | done | results/S03-11.md — tsc clean |
| S03-12 | mini/S03 | dev | none | 1/2/60/4 | PASS | done | results/S03-12.md — Meter.tsx + .cx-meter CSS contract in cx-kit.css; tsc clean |
| S03-13 | mini/S03 | dev | S03-05 | 3/4/40/5 | PASS | done | results/S03-13.md — Card/Table deleted; barrel pruned |
| S03-14 | mini/S03 | dev | S03-01..03, S03-05..07, S03-13 | 1/2/25/4 | PASS | done | results/S03-14.md — batch A exports; tsc clean |
| S03-15 | mini/S03 | dev | S03-04, S03-08..12, S03-14, S03-16, S02-05, S02-06 | 1/3/30/5 | PASS | done | results/S03-15.md — barrel published; tsc clean |
| S03-16 | mini/S03 | dev | none | 1/2/60/4 | PASS | done | results/S03-16.md — tsc clean |
| S04-01 | mini/S04 | dev | S03-04, S03-05 | 2/4/60/7 | PASS | done | results/S04-01.md — Field invalid prop + cx-seg disabled; tsc clean |
| S04-02 | mini/S04 | dev | S01-02 | 2/3/20/5 | PASS | done | results/S04-02.md — tsc clean; 40 ink-3 consumers inherit |
| S04-03 | mini/S04 | dev | S04-01, S04-02 | 3/4/80/8 | PASS | done | results/S04-03.md — z-scale+dvh; tsc clean; styles/*.css+BootSplash literals flagged for later leaves/PM |
| S04-04 | mini/S04 | dev | S04-03 | 2/4/40/6 | PASS | done | results/S04-04.md — page-max+input font; tsc clean; people.css:290 keyframe flagged |
| S04-05 | mini/S04 | dev | S01-04 | 1/4/60/7 | PASS | done | results/S04-05.md — literal→token sweep; tsc clean |
| S04-06 | mini/S04 | dev | S04-05 | 2/3/40/6 | PASS | done | results/S04-06.md — logical props; tsc clean |
| S04-07 | mini/S04 | dev | S04-06, S04-04 | 2/4/30/5 | PASS | done | results/S04-07.md — delta/toggle/dq-groupbreak; tsc clean; call-site semantics flagged |
| S05-01 | mini/S05 | dev | S01-01 | 2/3/30/5 | PASS | done | results/S05-01.md — rail-search aria-label; tsc clean, shell 8/8 |
| S05-02 | mini/S05 | dev | S05-01 | 1/3/40/5 | PASS | done | results/S05-02.md — per-route document.title; tsc clean |
| S05-03 | mini/S05 | dev | S05-02 | 2/4/90/8 | PASS | done | results/S05-03.md — invoker capture+scoring; tsc clean |
| S05-04 | mini/S05 | dev | S05-03 | 1/5/80/8 | PASS | done | results/S05-04.md — PERF-7 layout effect/memo/boot store; tsc clean, shell 8/8 |
| S05-05 | mini/S05 | dev | S05-04 | 1/3/40/5 | PASS | done | results/S05-05.md — Image preload + honest redirect state; tsc+eslint clean |
| S05-06 | mini/S05 | dev | S04-07 | 3/4/60/7 | PASS | done | results/S05-06.md — bell badge; tsc clean, shell 8/8 |
| S05-07 | mini/S05 | dev | S05-06 | 3/4/50/6 | PASS | done | results/S05-07.md — topbar sticky+title; tsc clean |
| S05-08 | mini/S05 | dev | S05-07 | 2/5/70/8 | PASS | done | results/S05-08.md — 4/5 done; "dead avatar rule" doesn't exist (.avatar live) — audit premise wrong, PM decision for de-emphasis |
| S05-09 | mini/S05 | dev | S05-10, S05-14, S05-15 | 6/4/90/9 | PASS | done | results/S05-09.md — shell strings→D() +35 ar keys; tsc clean, shell 8/8 |
| S05-10 | mini/S05 | dev | S05-08 | 2/4/90/8 | PASS | done | results/S05-10.md — typed toasts+pause/sticky; tsc clean, shell 8/8 |
| S05-11 | mini/S05 | dev | S05-10 | 2/3/50/6 | PASS | done | results/S05-11.md — alerts aria-live+mute; tsc clean, shell 8/8 |
| S05-12 | mini/S05 | dev | S02-04 | 1/3/40/5 | PASS | done | results/S05-12.md — Popups→usePoll; tsc clean, shell 8/8 |
| S05-13 | mini/S05 | dev | S03-04, S05-05 | 4/4/80/8 | PASS | done | results/S05-13.md — btn stacks resolved; shell 8/8; quality-analytics tsc errs flagged |
| S05-14 | mini/S05 | dev | S03-05, S05-12, S05-13, S05-15 | 2/4/80/7 | PASS | done | results/S05-14.md — useDialogModal both; tsc clean, shell 8/8 |
| S05-15 | mini/S05 | dev | none | 3/5/50/6 | PASS | done | results/S05-15.md — auth-route + LoadError + va-banner contrast; tsc clean |
| S06-01 | mini/S06 | dev | S02-11, S03-01 | 1/3/40/5 | PASS | done | results/S06-01.md (r2) — PwShell→PageShell .pw-page; tsc clean, golden 24/24 |
| S06-02 | mini/S06 | dev | S06-01 | 7/5/140/9 | PASS | superseded | results/S06-02.md — pw.tsx done; residual → S06-16 + S06-17 (leaves.md) |
| S06-03 | mini/S06 | dev | S06-08 | 3/4/320/9 | PASS | done | results/S06-03.md — carried-review extract; tsc clean, golden 24/24 |
| S06-04 | mini/S06 | dev | S03-04, S06-01 | 3/3/30/4 | PASS | done | results/S06-04.md — pw-del-btn→Button danger-quiet; tsc clean |
| S06-05 | mini/S06 | dev | S06-01 | 2/3/90/7 | PASS | done | results/S06-05.md — agents cx-table/cx-chip/cx-num; tsc clean |
| S06-06 | mini/S06 | dev | S06-05, S03-02 | 3/4/120/8 | PASS | done | results/S06-06.md — Tabs adopted; tsc clean, golden 24/24; agents tabpanel unwired (handoff) |
| S06-07 | mini/S06 | dev | S03-04 | 2/3/60/7 | PASS | done | results/S06-07.md — logical props; tsc clean |
| S06-08 | mini/S06 | dev | S06-01 | 6/5/120/9 | PASS | done | results/S06-08.md — pw-* utils; tsc clean, golden 24/24 |
| S06-09 | mini/S06 | dev | S06-07 | 1/3/60/6 | PASS | done | results/S06-09.md — marks focusable+labels; tsc clean; tab-order note flagged |
| S06-10 | mini/S06 | dev | S06-07 | 1/3/30/5 | PASS | done | results/S06-10.md — target sizes + affordance; tsc clean; .pw-late-ext flagged |
| S06-11 | mini/S06 | dev | none | 1/2/15/3 | PASS | done | results/S06-11.md — mount-focus removed; tsc clean |
| S06-12 | mini/S06 | dev | S03-03, S06-01 | 3/3/70/6 | PASS | done | results/S06-12.md — Chip adopted ×3 sites; SCOPE_REQUEST: real 2nd local Chip is my-actions-page.tsx (folds into S06-02 reshard) |
| S06-13 | mini/S06 | dev | S06-03, S03-12 | 1/3/40/5 | PASS | done | results/S06-13.md — Meter adopted; tsc clean, golden 24/24; cc-sweep-bar fill hook documented |
| S06-14 | mini/S06 | dev | S06-03 | 2/3/50/6 | PASS | done | results/S06-14.md — pw-inline wrap CSS; tsc clean |
| S06-15 | mini/S06 | dev | S06-13 | 2/3/40/5 | PASS | done | results/S06-15.md — req a11y + PwDialog confirm; tsc clean; PP-L1 nits flagged |
| S03-17 | mini/S03 | dev | S03-01, S02-07, S02-10 | 5/6/45/8 | PASS | superseded | results/S03-17.md — SCOPE_REQUEST: file map stale post-S13-06; residual → S03-18 (verified) |
| S06-16 | mini/S06 | dev | none | 4/5/390/8 | PASS | done | results/S06-16.md — queue-core.ts created; tsc clean; people+queue 34/34; zero cx-queue in people/lib |
| S06-17 | mini/S06 | dev | S06-16 | 2/4/45/6 | PASS | done | results/S06-17.md — zero cx-queue in cx-people (PP-H1 complete); tsc clean, people 24/24 |
| S09-16 | mini/S09 | dev | S03-09, S05-06, S12-01 | 3/5/130/8 | PASS | done | results/S09-16.md — 5 props + head row + stroke-end commit + cx-kit base CSS; tsc clean, 10/10 |
| S09-17 | mini/S09 | dev | S09-16, S09-10, S09-12 | 2/4/140/8 | PASS | done | results/S09-17.md — Es→PaintGrid, roving tabindex, readOnly reachable; tsc clean, 48/48 |
| S07-01 | mini/S07 | dev | S02-07, S02-06 | 1/4/300/8 | PASS | done | results/S07-01.md — ~250 dup lines → qa-shared imports; tsc clean, golden 64/64 |
| S07-02 | mini/S07 | dev | S03-03 | 2/4/120/8 | PASS | done | results/S07-02.md — tsc clean, golden 64/64 |
| S07-03 | mini/S07 | dev | S06-04 | 2/3/50/5 | PASS | done | results/S07-03.md — workitem class; tsc clean |
| S07-04 | mini/S07 | dev | S07-03, S03-02 | 1/3/50/5 | PASS | done | results/S07-04.md — Seg; tsc clean |
| S07-05 | mini/S07 | dev | S07-04, S03-01 | 1/3/60/6 | PASS | done | results/S07-05.md — PageShell head; tsc clean, golden 64/64 |
| S07-06 | mini/S07 | dev | S02-07 | 3/4/140/9 | PASS | done | results/S07-06.md — TableScroll×2 + .qa-q retarget; tsc clean, golden 64/64; kb-gaps .tbl → S07-10 handoff |
| S07-07 | mini/S07 | dev | S07-05 | 2/2/80/7 | PASS | done | results/S07-07.md — coverage cells focusable; tsc clean |
| S07-08 | mini/S07 | dev | S07-07 | 2/3/70/7 | PASS | done | results/S07-08.md — focus/restore; tsc clean; 2 PassForm sites flagged |
| S07-09 | mini/S07 | dev | S07-06 | 2/3/50/6 | PASS | done | results/S07-09.md — cx-field/cx-note + hash link; tsc clean; quality-analytics:1958 residual flagged |
| S07-10 | mini/S07 | dev | S03-07 | 2/3/60/6 | PASS | done | results/S07-10.md — kb-gaps TableScroll+cx-table; tsc clean; .tbl gone from cx-quality |
| S07-11 | mini/S07 | dev | S07-09 | 2/4/60/7 | PASS | done | results/S07-11.md — qa-shared+audit-queue done; SCOPE_REQUEST: QL-L1/L6 sites in quality-scores/analytics/quality.css flagged → S07-14 or PM |
| S07-12 | mini/S07 | dev | none | 1/2/30/4 | PASS | done | results/S07-12.md — exclusive render chain; tsc clean, golden 64/64 |
| S07-13 | mini/S07 | dev | S07-02, S07-06 | 4/4/60/6 | PASS | done | results/S07-13.md — qa-meta wrap + 8-color trend palette; tsc clean |
| S07-14 | mini/S07 | dev | S07-02, S03-16 | 2/3/70/6 | PASS | done | results/S07-14.md — ConfirmInline + reduceMotion gate; tsc clean |
| S08-01 | mini/S08 | dev | none | 2/3/40/5 | PASS | done | results/S08-01.md — md-flags__in wrap; status-validation:548 syntax err = S09-05 in-flight |
| S08-02 | mini/S08 | dev | S05-08 | 2/3/40/5 | PASS | done | results/S08-02.md — q-agemix class; tsc clean |
| S08-03 | mini/S08 | dev | S08-02 | 2/4/60/6 | PASS | done | results/S08-03.md — mixbar CQ+a11y; tsc clean, queue golden 10/10 |
| S08-04 | mini/S08 | dev | S08-03 | 1/2/10/3 | PASS | done | results/S08-04.md — colgroup scope removed; tsc clean; overview:333 same pattern flagged |
| S08-05 | mini/S08 | dev | S02-08, S03-01 | 2/3/70/6 | PASS | done | results/S08-05.md — Head→PageShell; tsc clean, golden 60/60 |
| S08-06 | mini/S08 | dev | S08-05 | 1/3/60/7 | PASS | done | results/S08-06.md — queue.css token sweep; tsc clean |
| S08-07 | mini/S08 | dev | S08-01 | 2/3/50/6 | PASS | done | results/S08-07.md — dk-table wrap; tsc clean |
| S08-08 | mini/S08 | dev | S08-04 | 2/2/25/4 | PASS | done | results/S08-08.md — btn-quiet reset; tsc clean |
| S08-09 | mini/S08 | dev | S08-08, S03-16 | 3/4/50/6 | PASS | done | results/S08-09.md — resolveLink+cx-filter+null cell; tsc clean; scheduler/mail-desk residuals flagged |
| S08-10 | mini/S08 | dev | S08-06 | 1/3/20/4 | PASS | done | results/S08-10.md — sr-only dupe + hm-dialog fold; tsc clean |
| S09-01 | mini/S09 | dev | none | 1/4/80/8 | PASS | done | results/S09-01.md — tsc clean, golden 16/16 |
| S09-02 | mini/S09 | dev | S09-01, S03-02 | 2/3/90/7 | PASS | done | results/S09-02.md — tsc clean, golden 16/16 |
| S09-03 | mini/S09 | dev | S09-02, S03-09 | 1/3/120/8 | PASS | superseded | results/S09-03.md SCOPE_REQUEST — residual → S09-16 + S09-17 (leaves.md) |
| S09-04 | mini/S09 | dev | S09-17, S03-08 | 1/3/60/6 | PASS | done | results/S09-04.md — As→AutoSaveInput commit-on-blur + isSaving; tsc clean, 16/16 |
| S09-05 | mini/S09 | dev | S03-10 | 2/3/80/7 | PASS | done | results/S09-05.md — PagedList ×2; tsc clean, golden 16/16 |
| S09-06 | mini/S09 | dev | S09-04, S09-05 | 1/2/50/5 | PASS | done | results/S09-06.md — .cv-auto on agent-day card dls (PV-H6); tsc clean |
| S09-07 | mini/S09 | dev | S09-05, S02-10 | 3/4/70/7 | PASS | done | results/S09-07.md — focusable spark/Za/pv tips; tsc clean |
| S09-08 | mini/S09 | dev | S02-04, S09-06 | 3/5/110/8 | PASS | done | results/S09-08.md — ?date/?tab/?flag/?agent/?view/?week via useSearchParamState; tsc clean, 16/16 |
| S09-09 | mini/S09 | dev | S03-01, S09-05 | 3/4/140/9 | PASS | done | results/S09-09.md — PageShell+PageStates ×3; tsc clean, golden 16/16 |
| S09-10 | mini/S09 | dev | S09-09 | 2/3/70/7 | PASS | done | results/S09-10.md — pv-item--row class; tsc clean |
| S09-11 | mini/S09 | dev | S02-05, S09-08 | 3/3/60/6 | PASS | done | results/S09-11.md — Empty detail pane + toUserText errors; refresh.css untouched (rules already cover); tsc clean |
| S09-12 | mini/S09 | dev | S09-07 | 4/3/80/7 | PASS | done | results/S09-12.md — literals→classes; tsc clean; analytics margin:0 flagged |
| S09-13 | mini/S09 | dev | S09-08 | 2/3/40/5 | PASS | done | results/S09-13.md — matrix bounds/labels data-derived; wa=waiting address confirmed vs prod_wa_groups (no rename per audit VERIFY); tsc clean |
| S09-14 | mini/S09 | dev | S09-10 | 3/4/100/7 | PASS | done | results/S09-14.md — dead dispute code deleted; tsc clean, golden 16/16 |
| S09-15 | mini/S09 | dev | S09-14 | 4/4/70/7 | PASS | done | results/S09-15.md — dialog backdrop + lane vars; tsc clean, golden 16/16 |
| S10-01 | mini/S10 | dev | S01-01 | 2/4/140/9 | PASS | done | results/S10-01.md — admin pages on barrel plumbing; tsc clean |
| S10-02 | mini/S10 | dev | none | 2/4/60/6 | PASS | done | results/S10-02.md — ecosystem skip-link + state labels; tsc clean |
| S10-03 | mini/S10 | dev | S04-02 | 2/4/110/8 | PASS | done | results/S10-03.md — tsc clean |
| S10-04 | mini/S10 | dev | S02-09, S03-01, S03-02 | 2/5/110/8 | PASS | done | results/S10-04.md — PageShell head + Seg; tsc clean, my-day 24/24; overview:437 flagged |
| S10-05 | mini/S10 | dev | S10-01, S03-11 | 2/4/140/9 | PASS | done | results/S10-05.md — SettingsSection+TOC; tsc clean, hub 10/10 |
| S10-06 | mini/S10 | dev | S10-03 | 1/2/40/5 | PASS | done | results/S10-06.md — hub.css tokens+breakpoints; tsc clean |
| S10-07 | mini/S10 | dev | S02-05, S10-05 | 4/3/80/7 | PASS | done | results/S10-07.md — toUserText sweep + admin gating; tsc clean, my-day 24/24 |
| S10-08 | mini/S10 | dev | S10-03 | 2/3/50/6 | PASS | done | results/S10-08.md — resolveLink + nav landmark; tsc clean; people-holidays:60 flagged |
| S10-09 | mini/S10 | dev | none | 3/4/40/5 | PASS | done | results/S10-09.md — h1 + alert + ids; tsc clean |
| S11-01 | mini/S11 | dev | S02-06, S02-04 | 2/4/250/9 | PASS | done | results/S11-01.md — PageShell+PageStates+Count; tsc clean, golden 172/172 |
| S11-02 | mini/S11 | dev | S02-06, S08-07 | 2/3/250/9 | PASS | done | results/S11-02.md — barrel adoption ×2; tsc clean, desk golden 160/160 |
| S11-03 | mini/S11 | dev | S03-07, S11-02, S11-06 | 3/3/80/7 | PASS | done | results/S11-03.md — TableScroll ×3; tsc clean |
| S11-04 | mini/S11 | dev | S11-02, S03-12 | 2/3/60/6 | PASS | done | results/S11-04.md — dk-slider zone tones; tsc clean |
| S11-05 | mini/S11 | dev | S11-01, S03-16 | 2/3/70/7 | PASS | done | results/S11-05.md — ConfirmInline + md-actions pin; tsc clean |
| S11-06 | mini/S11 | dev | S11-02, S03-16, S03-04 | 2/5/100/8 | PASS | done | results/S11-06.md — mail-desk fixes+ConfirmInline; tsc clean |
| S11-07 | mini/S11 | dev | S04-03 | 1/2/70/7 | PASS | done | results/S11-07.md — px→tokens; tsc clean |
| S11-08 | mini/S11 | dev | none | 1/2/15/3 | PASS | done | results/S11-08.md — login dead span; tsc clean |
| S11-09 | mini/S11 | dev | S11-03, S11-04, S02-04 | 2/3/50/6 | PASS | done | results/S11-09.md — useSearchParamState + a11y nits; tsc clean |
| S12-01 | mini/S12 | dev | none | 5/5/1424/8 | PASS | done | results/S12-01.md — dead CSS deleted, headers corrected; earlier TS blockers were S01-01/S02-01 in-flight, now both fixed |
| S12-02 | mini/S12 | dev | S06-10 | 1/4/150/7 | PASS | done | results/S12-02.md — ~30 dead rules deleted; tsc clean |
| S12-03 | mini/S12 | dev | S11-06, S11-07 | 2/3/120/7 | PASS | done | results/S12-03.md — 13 dead rules; tsc clean |
| S12-04 | mini/S12 | dev | S07-13 | 1/3/60/6 | PASS | done | results/S12-04.md — qa-q__w dead selectors; tsc clean |
| S12-09 | mini/S12 | dev | S08-10 | 1/3/60/6 | PASS | done | results/S12-09.md — 3 dead selectors deleted; tsc clean |
| S12-10 | mini/S12 | dev | S10-06 | 1/3/60/6 | PASS | done | results/S12-10.md — 4 dead accent-preview rules; tsc clean |
| S12-11 | mini/S12 | dev | S09-12 | 1/3/60/6 | PASS | done | results/S12-11.md — 2 dead rules; tsc clean |
| S12-05 | mini/S12 | dev | S04-07, S05-08, S05-11, S08-03, S09-10 | 2/4/300/10 | PASS | done | results/S12-05.md — dead rules deleted refresh+cx-kit; tsc clean, BUILD GREEN; survivors listed for S12-06 |
| S12-06 | mini/S12 | dev | S12-05 | 1/3/30/6 | PASS | done | results/S12-06.md — loser-classnames gate (0 err/578 warn); 12 pre-existing test errors → S12-12 |
| S12-12 | mini/S12 | dev | S12-06 | 1/3/30/6 | PASS | done | results/S12-12.md — feature-boundary + local-defs rules; 0 new errors |
| S12-07 | mini/S12 | dev | S04-04 | 2/2/30/4 | PASS | done | results/S12-07.md — theme/cx-kit contract headers; tsc clean |
| S12-08 | mini/S12 | dev | S12-02..07, S12-09..12 | 1/4/40/6 | PASS | done | results/S12-08.md + dead-css-sweep.md — deletions verified 0 users; RESHARD: warn-family backlog + cx-kit dead rules (the 13 eslint errs were leaf-caused and fixed — final eslint 0 errors/952 warnings, gate log `final`) |
| S13-01 | mini/S13 | dev | S10-02, S10-08 | 1/4/60/6 | PASS | done | results/S13-01.md — ecosystem scene lazy 2663→149; tsc+build clean |
| S13-02 | mini/S13 | dev | S13-01 | 4/4/700/10 | PASS | done | results/S13-02.md — scene→data+ui split; tsc clean, hub 10/10 |
| S13-03 | mini/S13 | dev | S06-15 | 4/4/900/10 | PASS | done | results/S13-03.md — 1:1 split 2675→81; tsc clean, golden 24/24; views.tsx 2450 lines flagged |
| S13-04 | mini/S13 | dev | S09-13 | 4/3/700/10 | PASS | done | results/S13-04.md — tph-grid 2026→242 + 3 siblings; tsc clean, 16/16 |
| S13-05 | mini/S13 | dev | S07-08 | 4/3/700/10 | PASS | done | results/S13-05.md — audit-queue split 2115→623; tsc clean, golden 64/64 |
| S13-06 | mini/S13 | dev | S07-07 | 3/3/500/8 | PASS | done | results/S13-06.md — charts extract 1822→1250; tsc clean, golden 64/64 |
| S13-07 | mini/S13 | dev | S13-02..06 | 5/3/120/8 | PASS | superseded | results/S13-07.md — SCOPE_REQUEST: hot components relocated by S13-03/04/05 splits; residual → S13-08 (done) |
| S14-01 | mini/S14 | dev | S03-15, S09-17 | 2/4/180/9 | PASS | superseded | results/S14-01.md — spec+config written, 2/3 pass; /tph self-redirect residual → S14-06 + S14-07 (both verified; e2e 3/3) |
| S14-02 | mini/S14 | dev | none | 1/2/15/4 | PASS | done | results/S14-02.md — Promise.all identity; tsc clean |
| S14-03 | mini/S14 | dev | none | 1/3/40/5 | PASS | done | results/S14-03.md — next/font self-hosted; tsc+build clean |
| S14-04 | mini/S14 | dev | none | 2/2/20/4 | PASS | done | results/S14-04.md — unenforced-gate markers; tsc clean |
| S14-05 | mini/S14 | dev | none | 1/2/10/3 | PASS | done | results/S14-05.md — devIndicators pre-satisfied; tsc clean |
| S03-18 | mini/S03 | dev | none | 5/6/45/8 | PASS | verified | results/S03-18.md — 6 symbols→ChipStatus + shell/ui re-export; goldens 80/80 |
| S04-08 | mini/S04 | dev | none | 3/4/8/5 | PASS | verified | results/S04-08.md — verdict-tone swap ×3; "up good" 0 hits; goldens 50/50 |
| S06-18 | mini/S06 | dev | none | 1/3/12/4 | PASS | verified | results/S06-18.md — local Chip deleted, barrel Chip; people 24/24 |
| S14-06 | mini/S14 | dev | S13-04 (done) | 1/3/15/4 | PASS | verified | results/S14-06.md — /tph renders TphGridPage; foreign redirect kept; unblocks S14-07 |
| S12-13 | mini/S12 | dev | none | 1/3/30/5 | PASS | verified | results/S12-13.md — 8 dead .cx-* rule blocks deleted; live cx-grid-2/cx-split intact |
| S12-31 | mini/S12 | dev | none | 1/3/80/9 | PASS | verified | results/S12-31.md + results/dq-map.md — 48 dq-* tokens mapped, DQ-1..07 split proposed → PM |
| tsc1-01 | mini/S13 | dev | none | 1/2/4/3 | PASS | verified | results/tsc1-01.md — ticketUrl props → required (audit-queue-detail :336,:861); tsc exit 0 |
| qa1-01 | mini/qa-1 | dev | none | 2/5/40/8 | PASS | verified | results/qa1-01.md — 14 `any` → Tph* shared types + local HgRow/HgCell; memo wrappers intact; eslint 0 err, tsc exit 0 |
| S07-15 | mini/S07 | dev | S03-18 | 2/4/20/6 | PASS | verified | results/S07-15.md — TrendChart O===0 Empty + qs-hero--flat. VERIFY r6: tsc 0, quality golden 64/64, eslint 0 err |
| S07-16 | mini/S07 | dev | S03-18 | 2/4/8/4 | PASS | verified | results/S07-16.md — qa-health/qa-cov-wrap/stray p ref dropped (live qa-health-h aria id kept). VERIFY r6: tsc 0, golden 64/64, eslint 0 err |
| S07-17 | mini/S07 | dev | S07-15 | 3/3/10/5 | PASS | verified | results/S07-17.md — qa-sampling→qa-details-panel rename ×3 files; grep confirms zero tokens. VERIFY r6: tsc 0, golden 64/64 |
| S14-07 | mini/S14 | dev | S14-06 | 1/2/10/8 | PASS | verified | results/S14-07.md — a11y-keyboard e2e 3/3 chromium (logs/s14-07-e2e.log re-tailed this round); closes S14-01 residual |
| S12-20 | mini/S12 | dev | S07-15, S07-16, S07-17 | 9/4/50/8 | PASS | verified | results/S12-20.md — empty→Empty ×9 quality files; grep zero `empty` tokens src-wide. VERIFY r6: tsc 0, golden 64/64, eslint 0 err |
| S12-22 | mini/S12 | dev | S12-18 | 7/5/160/10 | PASS | verified | results/S12-22.md — card*→cx-panel/cx-section__* hub ×6 files. VERIFY r6: tsc 0, hub-*.test.ts ×4 55/55 (stale hub.test.ts/my-day.test.ts names → see tl-yours), 0 card warns |
| S12-23 | mini/S12 | dev | S12-19, S12-14 | 7/5/120/10 | PASS | verified | results/S12-23.md — card*→cx-panel people ×7 files. VERIFY r6: tsc 0, people 24/24, 0 card warns |
| S12-24 | mini/S12 | dev | S07-16, S07-17, S03-18, S12-20 | 7/5/80/9 | PASS | verified | results/S12-24.md — card*→cx-panel quality slice A ×6. VERIFY r6: tsc 0, golden 64/64 |
| S12-25 | mini/S12 | dev | S07-15, S12-20 | 4/5/90/9 | PASS | verified | results/S12-25.md — card*→cx-panel quality slice B ×4; area-wide card grep clean (qa-card kept). VERIFY r6: tsc 0, golden 64/64 |
| S12-28 | mini/S12 | dev | S12-22, S12-23 | 8/6/60/9 | PASS | verified | results/S12-28.md — pill*→Chip hub+people ×8 files; zero pill tokens. VERIFY r6: tsc 0, eslint 0 err, hub-*.test.ts ×4 + people 79/79 |
| S12-29 | mini/S12 | dev | S12-24, S12-25 | 4/4/15/5 | PASS | verified | results/S12-29.md — pill*→Chip quality ×4; zero pill tokens. VERIFY r6: tsc 0, golden 64/64, eslint 0 err |
| S12-26 | mini/S12 | dev | S12-16, S12-21 | 10/5/120/10 | PASS | verified | results/S12-26.md — card*→cx-panel/cx-section__* desk+queue ×10 files ~60 sites; only md-card* remain. VERIFY r6: tsc 0, eslint 0 err/0 card warns, queue golden 10/10 |
| S12-27 | mini/S12 | dev | S12-15, S12-21 | 7/5/120/10 | PASS (structural) | superseded | results/S12-27.md — RESHARD_NEEDED: stale Files (real hits in unlisted tph-grid-views.tsx:597-603) + unmapped `card--flat` variant (status-validation:161); no edits made; residual → S12-33 (leaves.md, results/S12-27-reshard.md) |
| S12-30 | mini/S12 | dev | S12-26, S12-33 | 9/6/40/8 | pending | verified | results/S12-30.md — pill*→Chip ×9 files; zero pill tokens src/features; pill family complete area-wide. Merged done + VERIFY r6: tsc 0, eslint 0 err/0 pill warns, queue+productivity 26/26 |
| S12-33 | mini/S12 | dev | S12-15, S12-21, S13-08, S12-11 | 6/6/80/10 | PASS (manual) | verified | results/S12-33.md — card*→cx-panel/cx-section__* productivity+operations ×6 files (pv-card--flat documented skin). VERIFY r6: tsc 0, eslint 0 err/0 card warns, productivity golden 16/16 |
| ux1-01 | mini/ux-1 | dev | DQ-3 | 1/3/10/4 | PASS | verified | results/ux1-01.md — cx-kit.css:549-552 `:root .cx-panel > .cx-section__head` padding+border rule (zero .tsx edits); tsc 0, goldens 74/74; ux r2 PASS (ux-yours-2.md, real-CSS fixture 40/40 rendered checks light/dark ×1280/390). VERIFY final: tsc 0, eslint 0 err, vitest 1196/1196, build 156/156 |
| S12-14 | mini/S12 | dev | S04-08 | 4/4/15/6 | PASS | done | results/S12-14.md — tag→Chip plain ×5 + page-sub→page-purpose ×3; zero tag/page-sub tokens; tsc clean |
| S12-15 | mini/S12 | dev | S04-08, S12-14 | 4/6/40/8 | PASS | done | results/S12-15.md (was mis-filed repo-root, copied in) — tbl→cx-table + TableScroll + refresh.css retargets; tsc clean, 26/26 |
| S12-16 | mini/S12 | dev | S12-15, S12-13 | 4/6/60/8 | PASS | done | results/S12-16.md (was mis-filed repo-root, copied in) — seg→Seg + pw-dialog→Dialog, dead CSS removed; tsc clean, 34/34 |
| S12-17 | mini/S12 | dev | S12-14, S12-15, S12-16 | 1/3/6/4 | PASS | done | results/S12-17.md — eslint ratchet tag/tbl/seg/page-sub/pw-dialog warn→error + cx-tab(s) exempt; eslint 0 err |
| S12-18 | mini/S12 | dev | S12-14 | 9/6/80/9 | PASS | done | results/S12-18.md — empty→Empty hub+shell ×7 files; tsc clean, 63/63 |
| S12-19 | mini/S12 | dev | S06-18, S12-14 | 6/4/60/8 | PASS | done | results/S12-19.md — empty→Empty cx-people ×6; tsc clean, people 24/24 |
| S12-21 | mini/S12 | dev | S04-08 | 9/6/60/8 | PASS | done | results/S12-21.md — empty→Empty desk+queue+productivity+operations ×9 files/20 sites; tsc clean, 26/26 |
| S12-32 | mini/S12 | dev | S12-17, S12-22..26, S12-33, S12-28..30, DQ-6 | 2/4/90/8 | PASS | done | results/S12-32.md — refresh.css loser rules deleted + .md .card→.cx-panel + empty/card/pill warn→error; eslint 0 err |
| S13-08 | mini/S13 | dev | S13-03, S13-04, S13-05 | 5/7/140/8 | PASS | done | results/S13-08.md — React.memo hot row/cell renderers ×5 post-split modules; memo counts 3/3/1/9/6; tsc clean, 104/104 |
| DQ-1 | mini/S12-DQ | dev | S12-23, S12-28 | 4/4/7/5 | PASS | done | results/DQ-1.md — dq-page→page hub+people ×4; tsc clean, 47/47 |
| DQ-2 | mini/S12-DQ | dev | S12-33, S12-29, S12-30 | 7/4/9/6 | PASS | done | results/DQ-2.md — dq-page→page productivity+quality ×7; tsc clean, 80/80 |
| DQ-3 | mini/S12-DQ | dev | S12-16, S12-30 | 4/5/25/7 | PASS | done | results/DQ-3.md — queue dq-page→page + dead dq-help + orphan .dq-head* CSS; tsc clean, queue 10/10 |
| DQ-4 | mini/S12-DQ | dev | DQ-1, DQ-3, S12-15, S12-24 | 7/8/110/10 | PASS | done | results/DQ-4.md — shared-helper dq-*→cx-* renames + refresh.css; zero renamed-family tokens; tsc clean, 121/121 |
| DQ-5 | mini/S12-DQ | dev | DQ-4, S12-26 | 2/5/170/10 | PASS | done | results/DQ-5.md — queue-analytics ~32 dq-*→cx-* (dq-split→cx-chsplit) + refresh.css; tsc clean, queue 10/10 |
| DQ-6 | mini/S12-DQ | dev | DQ-5 | 3/4/8/4 | PASS | done | results/DQ-6.md (was mis-filed repo-root, copied in) — dq-refresh→cx-refresh ×3 files; zero dq-refresh/dq-head; tsc clean, 20/20 |
| DQ-7 | mini/S12-DQ | dev | DQ-2, DQ-6, S12-32 | 3/5/18/6 | PASS | done | results/DQ-7.md (was mis-filed repo-root, copied in) — dq-* warn→error ratchet w/ documented keeps + .page,.dq-page collapse; eslint 0 err |
| e2e1-01 | mini/fix-e2e-1 | dev | none | 1/3/8/4 | PASS | done | results/e2e1-01.md — Empty `level` prop + role=heading; tsc clean; target specs pass; strict-mode collision → e2e1-02 |
| e2e1-02 | mini/fix-e2e-1 | dev | e2e1-01 | 1/2/2/3 | PASS | done | results/e2e1-02.md — `exact: true` on 'This week' (:18 only); my-status e2e 4/4 chromium, goldens 876/876 |
| ux1-02 | mini/fix-ux-1 | dev | none | 1/3/15/5 | PASS | done | results/ux1-02.md — TableScroll wrap :279-380, ref={h} kept; tsc+eslint clean |
| ux1-03 | mini/fix-ux-1 | dev | none | 1/2/4/4 | PASS | done | results/ux1-03.md — cx-kit.css :655 inset-inline-start + :689 seg relative; tsc clean |
| ux1-04 | mini/fix-ux-1 | dev | none | 2/3/55/5 | PASS | done | results/ux1-04.md — barrel export removed + NotConnected.tsx deleted; 0 hits; tsc+eslint clean |
| ux1-05 | mini/fix-ux-1 | dev | none | 1/2/2/3 | PASS | done | results/ux1-05.md — aria-orientation off tabpanel, kept on tablist; tabs.test 5/5, tsc clean |
| ux1-06 | mini/fix-ux-1 | dev | ux1-03 (cx-kit.css serial) | 1/2/6/4 | PASS | done | results/ux1-06.md — cx-empty p{margin:0;34ch} + cx-panel>cx-empty variant :821; tsc clean |
| ux1-07 | mini/fix-ux-1 | dev | none | 1/2/3/4 | PASS | done | results/ux1-07.md — .cx-chip.trk-outside::before currentColor :27; tsc clean |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| S03-03 (spec/S03.md#S03-03) | files limit — caller narrowing out of leaf scope | done: Chip union + StatusChip typed; REMAINING: narrow 4 status helpers (qa-shared:235,250; quality-analytics-page ×9; quality-scores-page:242; pv-shared:49) then shell/ui.tsx Chip→ui/Chip re-export (one leaf, ~5 files) | RESOLVED — resharded to S03-17 (leaves.md) |
| S09-03 (spec/S09.md#S09-03) | spec gap — leaf files can't achieve "same visual grid" contract | REMAINING: (a) PaintGrid cx-paintgrid CSS + column-header/row-class hooks + style prop (S03-09 follow-up, ~2 files incl cx-kit.css); (b) tph-grid Es adoption + productivity.css tph-row/tph-name/--tph-n rules (~2 files) | RESOLVED — resharded to S09-16 + S09-17 (leaves.md) |
| S06-02 (spec/S06.md#S06-02) | spec gap — "zero cx-queue imports" unreachable in listed files | done: pw.tsx Frag removed, pages already on PageShell; REMAINING: re-point cx-queue imports in people shared.tsx:32, lib/one-on-ones-page.ts, lib/one-on-ones.ts, my-actions-page.tsx (Head→PageShell) | RESOLVED — resharded to S06-16 + S06-17 (leaves.md) |
| S04-07 residual | spec gap — .delta semantic inversion needs call-site swap | leaf done: CSS .delta.up→ok/.down→bad; emitters fixed by S04-08 (queue-page:27,346; agents-page:628; my-status:74) | RESOLVED — S04-08 done |
| S07-11 residual (QL-L1/L6) | files limit — sites outside leaf Files, uncovered by S07-14 | REMAINING: quality-scores-page (empty-hero/TrendChart defect), quality-analytics-page (.qa-health/.qa-cov-wrap/stray p ref), quality.css (.qa-sampling rename retarget) | RESHARDED → S07-15, S07-16, S07-17 (leaves.md) |
| S12-08 residual | warn-family backlog + lint gate | dead-css-sweep.md: warn survivors empty×37, card×41, pill×23, dq-*×18 files; cx-kit dead rules outside SH-L2 | RESOLVED — S12-13..33 all done (S12-27 superseded→S12-33), S12-32 closed loser rules + ratchet, S12-DQ DQ-1..7 done; zero loser tokens remain except documented keeps |
| S06-12 residual | shard named wrong file | my-actions-page.tsx:31-33 local Chip + callers | RESOLVED — S06-18 done |
| S03-17 (spec/leaves.md#S03-17) | spec gap — file map stale after S13-06 split | none changed; narrowing retargeted across quality-analytics-charts.tsx, qa-shared.tsx (6 symbols), quality-scores-page.tsx, pv-shared.tsx DECISIONS, shell/ui.tsx re-export | RESOLVED — resharded to S03-18, done |
| S14-01 residual (spec/S14.md#S14-01) | runtime-discovered app bug — /tph self-redirect loop | done: tests/e2e/a11y-keyboard.spec.ts (3 specs) + playwright.config.ts; route wiring fixed by S14-06 (/tph renders TphGridPage; foreign tph-grid redirect kept); REMAINING: e2e re-run (PaintGrid journey) | RESOLVED — S14-06 verified (/tph renders TphGridPage) + S14-07 verified (a11y-keyboard e2e 3/3) |
| S13-07 (spec/S13.md#S13-07) | spec gap — Files list stale after S13-03/04/05 splits | none changed; REMAINING: memo hot leaf components in one-on-ones-views.tsx, tph-grid-matrix.tsx/tph-grid-views.tsx, audit-queue-detail.tsx/audit-queue-coverage.tsx (kpi-logs/queue-page dropped — not in perf-3) | RESOLVED — resharded to S13-08 (leaves.md), done: memo counts 3/3/1/9/6, goldens 104/104 |
| S12-27 (spec/leaves.md#S12-27) | spec gap — stale Files (tph-grid-page.tsx has zero card hits; actual hits in unlisted tph-grid-views.tsx:597-603) + unmapped `card--flat` variant outside S12-22 five-class mapping | none changed; REMAINING: card*→cx-panel productivity+operations+auth incl tph-grid-views.tsx + explicit `card--flat` decision (productivity.css styling) | RESOLVED — resharded to S12-33 (leaves.md, results/S12-27-reshard.md); S12-33 done → S12-30 unblocked |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| r1 | typecheck | `npx tsc --noEmit` (log: logs/tl-tsc-r1.log) | FAIL — only tests/lib/fetch-json.test.ts :43-55 (vi.fn mock.calls typed [] tuple; S02-01 fix in flight) |
| r1 | vitest (targeted) | `npx vitest run tests/shell/registry-coverage.test.ts tests/lib/fetch-json.test.ts` | FAIL — registry-coverage 1 fail ('my-day' PAGES[0] exact-match false positive + 'page.tsx' root-route derivation bug); fetch-json 6/6 pass |
| final | typecheck | `npx tsc --noEmit` (log: logs/tl-tsc-final.log) | PASS exit 0 |
| final | vitest | `npx vitest run` (log: logs/tl-vitest-final.log) | PASS 1194/1194 tests, 67 files |
| final | eslint | `npx eslint .` (logs: tl-eslint-final.log, tl-eslint-final2.log) | PASS 0 errors / 952 warnings after 4 fix leaves (13 leaf-caused errors fixed: use-poll, use-options, PageShell, Toasts, OneOnOneAlerts, audit-queue, ecosystem-scene, 3 test files; stray imports-oo.cjs removed) |
| final | build | `npm run build` (log: logs/tl-build-final.log) | PASS compiled 3.2s, 156/156 static pages |
| final | security | `npm run test:security` (log: logs/tl-security.log) | PASS 4/4 |
| final | performance | `npm run test:performance` (log: logs/tl-perf.log) | PASS 14/14 |
| final | e2e | `npm run test:e2e` (logs: tl-e2e.log, tl-e2e-rerun.log) | r1: 40 failed (PageShell missing aria-busy — S03-01 contract defect). fix r2 → 108 passed / 2 failed; the 2 are tablet-only `e2e login failed` seed flakes (env, not code) |
| tl3 | typecheck | `npx tsc --noEmit` (log: logs/tl3-tsc.log) | PASS exit 0 |
| tl3 | eslint | `npx eslint .` (log: logs/tl3-eslint.log) | PASS 0 errors / 956 warnings |
| tl3 | vitest | `npx vitest run` (log: logs/tl3-vitest.log) | PASS 1196/1196, 67 files |
| tl3 | build | `npm run build` (log: logs/tl3-build.log) | PASS compiled 3.1s, 156/156 pages |
| tl3 | security | `npm run test:security` (log: logs/tl3-security.log) | PASS 4/4 |
| tl3 | performance | `npm run test:performance` (log: logs/tl3-perf.log) | PASS 14/14 (vacuous stub — unenforced per S14-04/PLAN note) |
| tl3 | e2e | `npm run test:e2e` (log: logs/tl3-e2e.log) | 118 pass / 7 fail / 10 skip — 5 = a11y PaintGrid spec on known /tph redirect loop (S14-01 residual→PM); 1 = a11y Tabs mobile-project aria-busy wait (spec robustness, same residual); 1 = tablet auth log-out env flake (same class as r2) — ZERO pre-existing spec regressions |
| tl4 | vitest (targeted) | `npx vitest run tests/golden/{quality,productivity,queue,people}.test.ts` (log: logs/tl4-vitest.log) | PASS 114/114, 4 files |
| tl4 | typecheck | `npx tsc --noEmit` (log: logs/tl4-tsc.log) | FAIL r1 — audit-queue-detail.tsx:363+:887 TS2322 (S13-05 split residual, `ticketUrl?: string` vs TicketRef `url: string`) → fix leaf tsc1-01 |
| tl4 | typecheck final | `npx tsc --noEmit` (log: logs/tl4-tsc-final.log) | PASS exit 0 |
| tl5 | eslint re-check (qa-1) | `npx eslint tph-grid-views.tsx tph-grid-matrix.tsx tph-grid-shared.ts` | FAIL — 14 no-explicit-any errors (views ×12 :643,792,793,902,937,945,960,961,995,1118,1217,1222; matrix ×2 :38,:48), grew from qa-1's 5 as checkpointed S13-07 memo pass left more `any` props. Files UNTRACKED (S13-04 product + S13-07 memo edits); no HEAD to revert to; no writer since 21:15 |
| tl5 | typecheck | `npx tsc --noEmit` (log: logs/tl5-tsc.log) | PASS exit 0 |
| tl5 | eslint | `npx eslint .` (log: logs/tl5-eslint.log) | PASS 0 errors / 957 warnings (loser-classnames backlog unchanged) — qa-1 gate restored |
| tl6 | typecheck | `npx tsc --noEmit` (log: logs/tl6-tsc.log) | PASS exit 0 |
| tl6 | eslint | `npx eslint .` (log: logs/tl6-eslint.log) | PASS 0 errors / 429 warnings (warn-family program closed — was 957 at tl5) |
| tl6 | vitest | `npx vitest run` (log: logs/tl6-vitest.log) | PASS 1196/1196, 67 files |
| tl6 | security | `npm run test:security` (log: logs/tl6-security.log) | PASS 4/4 |
| tl6 | performance | `npm run test:performance` (log: logs/tl6-perf.log) | PASS 14/14 (vacuous stub — unenforced per S14-04/PLAN note) |
| tl6 | build | `npm run build` (log: logs/tl6-build.log) | PASS compiled 1.8s, 156/156 static pages |
| tl6 | e2e | `npm run test:e2e` (log: logs/tl6-e2e.log) | FAIL r1 — 110 pass/15 fail/10 skip; 10 = Empty heading-role regression (my-status ×2 specs ×5 projects, S12-21 contract `.t` h2→`<strong>`) → fix leaves e2e1-01+e2e1-02; 5 = known env class |
| tl6 | post-fix re-verify | tsc + scoped eslint + vitest (logs: tl6-tsc-r2, tl6-eslint-r2, tl6-vitest-r2) | PASS — tsc exit 0; eslint 0 err on Empty.tsx+my-status.spec.ts; vitest 1196/1196 unchanged |
| tl6 | e2e r2 | `npm run test:e2e` (log: logs/tl6-e2e-r2.log) | PASS-conditional — 124 pass/1 fail/10 skip; sole fail = webkit `e2e login failed` seed flake (env class — non-deterministic, migrates between projects across runs; all 10 regression + 4 r1-flake failures healed) |
| tl7 | typecheck | `npx tsc --noEmit` (log: logs/tl7-tsc.log) | PASS exit 0 |
| tl7 | eslint | `npx eslint .` (log: logs/tl7-eslint.log) | PASS 0 errors / 428 warnings (was 429 at tl6) |
| tl7 | vitest | `npx vitest run` (log: logs/tl7-vitest.log) | PASS 1196/1196, 67 files |
| tl7 | build | `npm run build` (log: logs/tl7-build.log) | PASS compiled 2.5s, 156/156 static pages |
| tl7 | security | `npm run test:security` (log: logs/tl7-security.log) | PASS 4/4 |
| tl7 | performance | `npm run test:performance` (log: logs/tl7-perf.log) | PASS 14/14 (vacuous stub — unenforced per S14-04/PLAN note) |
| tl7 | e2e | `npm run test:e2e` (log: logs/tl7-e2e.log) | PASS 125 pass / 0 fail / 10 skip — first fully clean e2e round (no env flake this run) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 HIGH — `npx eslint .` red: no-explicit-any in tph-grid-views/matrix | reports/qa-1.md | dev → qa1-01 | done | tl5 re-check: 14 errors (was 5); foreign untracked files, attributed to S13-04 split + checkpointed S13-07 memo pass — typed in place, no reverts; `npx eslint .` now 0 errors/957 warnings |
| qa-2 LOW — .delta verdict swap lacks rendered-assertion coverage | reports/qa-1.md | test-engineer | deferred | LOW → deferred per FIX rules; S12 family / Phase F e2e may cover |
|| ux-1 MED — `card-head→cx-section__head` mapping drops `.card-head` padding/border (~50 `cx-panel > cx-section__head` sites) | reports/ux-yours-1.md | spec-architect → dev → ux1-01 | closed | DECISION (a) CSS-contract patch executed verbatim at cx-kit.css:549-552 (results/ux1-01.md); ux r2 PASS — reports/ux-yours-2.md: real-CSS fixture 40/40 checks light/dark ×1280/390, in-panel heads healed, canonical cx-section heads untouched; zero .tsx edits |
|| ux-2 LOW — `.cx-empty` inside `.cx-panel` double border; `Empty` p margin/max-width | reports/ux-yours-1.md + reports/ux-1.md | dev → ux1-06 | done | re-activated per PM; cx-kit.css :821 two rules landed |
|| ux-3 LOW — `.trk-outside` Chip dot resolves info-edge on grey chip | reports/ux-yours-1.md + reports/ux-1.md | dev → ux1-07 | done | re-activated per PM; operations.css :27 compound selector |
|| ux-4 HIGH — /queue `table.cx-table` in bare `.cc-chart`: no clip → 857px page h-scroll @390 (WCAG 1.4.10) | reports/ux-1.md | dev → ux1-02 | done | TableScroll wrap landed; awaits reviewer re-render |
|| ux-5 MED — `.cx-sr`/`.sr-only` abspos inside pos:static `.cx-ladder__seg` escapes clip → 84px phantom scroll | reports/ux-1.md | dev → ux1-03 | done | both declarations landed; awaits reviewer re-render |
|| ux-6 MED — `NotConnected` exported, zero consumers; named adopt sites are toast/hint (not panel fits) | reports/ux-1.md | dev → ux1-04 | done | DECISION "delete zero-value wrappers": export dropped + file deleted |
|| ux-7 LOW — `aria-orientation` on `role="tabpanel"` (Tabs.tsx:106), invalid per APG | reports/ux-1.md | dev → ux1-05 | done | attribute dropped on panel; kept on tablist |
|| qa-1 LOW — `as ChipStatus` casts over `string`-typed helper returns (cx-people defs) | reports/qa-yours-1.md | dev | deferred | LOW → deferred per FIX rules |
|| qa-2 LOW — leaves.md S12-22/S12-28 Verify cite nonexistent `hub.test.ts`/`my-day.test.ts` | reports/qa-yours-1.md | tech-writer | deferred | LOW → deferred per FIX rules (real coverage = 4 `hub-*.test.ts`, documented in tl-yours) |
|| qa-3 LOW — stray `nul` artifacts: `src/app/nul` (45B) + `specs/ux-ui-audit-v2/nul`, untracked, not gitignored | reports/qa-yours-2.md | dev | deferred | LOW → deferred per FIX rules; fix = delete both + use `> /dev/null`; not deleted — no destructive approval |

## Blocked / needs user
- e2e env flake (recurring, all rounds): `e2e login failed` seed exhaustion on one browser project per run (r1 firefox, r2 webkit) + occasional remote-load `aria-busy` timeouts. Not code — needs `e2e/seed-users.mjs` re-run / dev-env attention; non-blocking (deterministic specs all green).
