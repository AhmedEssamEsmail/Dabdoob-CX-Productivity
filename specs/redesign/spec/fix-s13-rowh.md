# Fix: data-table row-height contract violation

Slug: fix-s13-rowh. Project root: `C:\Users\AHMED\KPIs\CX-Hub`.

## Finding
Source: `specs/redesign/reports/contract-violations.md` (S13 shot pass).
PLAN criterion #5: data-table rows ≤ 2.25rem (36px). The shot harness measures first visible `table tr` at 45–50.5px on 21 routes (admin/config, admin/roster, agents, aging, analytics, calibration, coaching, ctls, disputes, kb-gaps, mail-desk, my-auditor-kpis, notes, people-holidays, qa-forms, quality-analytics, quality-scores, queue, status-validation, tl-performance, trackers) in both themes.

The uniform ~45px suggests a shared rule (`.cx-table` th/td padding in `src/app/cx-kit.css`), possibly re-padded per-app in `src/app/styles/*.css`. First confirm the probe isn't measuring a `th` header row — if data rows are already ≤36px and only headers exceed, tighten header rows to ≤36px too (dense header is in-spec) OR confirm with computed styles which element the probe hits and fix the real culprit.

## Goal
First visible table row (header or data — whichever the probe `table tr` selects) computes to ≤36px on the listed routes, in light AND dark, without breaking the DOM contract (no class/attr changes) and without touching `.tsx` files unless strictly required (if a tsx change is needed, keep it to class additions only and note it in your reply).

## Files (only these)
- `src/app/cx-kit.css`
- `src/app/styles/hub.css`, `quality.css`, `queue.css`, `people.css`, `operations.css`, `desk.css`, `productivity.css`

## Rules
- Tokens only; no hex/px outside the scale — use `var(--cx-*)` values already defined in `theme.css` (density lives there).
- Check whether `.cx-table` (or per-app table classes: `dq-*`, `qa-*`, `trk-*`, `md-*`, `pv-*` tables) carry extra `padding`/`line-height` on `td`/`th` pushing rows past 36px.
- Do NOT loosen the contract or edit the harness/probe.

## Verify
1. `npx tsc --noEmit` 0 errors; `npx eslint` on touched files 0 errors.
2. Re-run `node .devin/work/shoot-new.mjs` (or a targeted re-probe of ≥5 of the listed routes: queue, status-validation, agents, trackers, mail-desk) and confirm `rowH ≤ 36` in `contract-report.json`. Report the post-fix rowH per route probed.
3. Update your TRACKER row: add a note under Notes with the fix result; add a "Review findings" row for `fix-s13-rowh` marked done with evidence.
