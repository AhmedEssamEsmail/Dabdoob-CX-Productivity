# TL report 1 — table-center-align (BUILD)

## Status: COMPLETE — all 15 leaves done, integration checks pass.

## Changed files (this task only; foreign dirty-tree edits excluded)
- CSS (6): src/app/cx-kit.css (+2 cascade rules, cx-num-col end→center),
  src/app/styles/{desk,people,quality,queue}.css, src/app/refresh.css
- TSX tagged with cx-num (13): tl-performance-page, agents-page,
  one-on-ones-views, pv-shared, tph-grid-{views,matrix}, aging-page,
  heatmap-page, calibration-page, ctls-page, disputes-page, qa-shared,
  quality-analytics-{page,charts}, quality-scores-page
- Test (1 new): tests/css/table-center-align.test.ts (12 tests)
- Audit-only leaves with zero diff: mail-desk-page, trackers-page,
  coaching-page, status-validation-page, productivity-analytics-page,
  scheduler-page, analytics/queue/checkins pages, audit-queue-{page,detail},
  audit-queue-coverage, my-auditor-kpis, qa-forms, kb-gaps pages,
  admin-{roster,config}, people-holidays, overview-page — all already carried
  cx-num/centered classes or had no numeric tds.

## Results files: specs/table-center-align/results/S0{1,2,3}-*.md (15 files)

## Anomalies reported by workers (not fixed, per contract — PM/QA visibility)
- Missing scope="col": queue.css hm-need-table thead ths (~802-807),
  aging-page.tsx:214, queue-page.tsx:294 (q-agemix)
- Ambiguous mixed cells left untagged: audit-queue-page.tsx:550 (repeatFails),
  agents-page.tsx:390/419, productivity-analytics ~169 (Change td),
  quality-analytics Agents "Channels" td, quality-scores-page.tsx:376,
  charts qa-cov trailing ths + mixed chip td (S02-11)
- Row-label guards confirmed: sch-sticky, cx-groupbreak, cx-rowhead,
  qa-cov__name, tph-hg :first-child, hm-gt (tbody) all untouched.

## Gates run
- `npx tsc --noEmit` — PASS (clean, empty log results/tsc-checkpoint.log)
- `npx vitest run tests/css/table-center-align.test.ts` — 12/12 PASS
- `npx vitest run tests/quality/qa-cov-center.test.tsx` — 2/2 PASS (S02-11)
- Per-leaf `npx eslint` on every touched file — 0 errors
- Full gates (`eslint .`, `vitest run`, e2e, build) are PM-run per PLAN #6.

## Notes for PM
- Foreign dirty-tree edits preserved untouched (hub-shared.tsx,
  overview-page.tsx, roster.ts, engine-live.ts, dq-hct-snapshot.test.ts,
  ui-shell-polish pngs — incl. new pngs appearing mid-run).
- `qe-performer-resolution` vitest failure is pre-existing/foreign — attribute only.
- Commit step (#7) is PM's; stage only the files listed above + tests/css/.
- No reviewers/gates spawned by TL per rules; no RESHARD_NEEDED; no blockers.
