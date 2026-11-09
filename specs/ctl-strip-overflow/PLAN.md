# PLAN — ctl-strip-overflow

## Goal
CTLs page: compact strip rows overflow horizontally off the right side of the
page (document-level scrollbar, pills/actions pushed off-screen). Rows must
stay inside the card and clip long meta text with ellipsis instead.

## Symptom / expected
- Symptom (commit e41f9f1 "compact qa-card strips"): on `/quality` CTLs page
  each `article.qa-card.qa-card--strip` row is wider than the card; pills and
  the "Open in the form"/"Resend result email" buttons sit off-screen right;
  horizontal scrollbar at document level.
- Expected: every strip row width == `.qa-list` content width; `.qa-meta`
  truncates with ellipsis; no horizontal scrollbar; actions visible in-page.

## Repro hints
- User screenshot: 29 open CTLs, names like "Abdelsamad Mohamed Abdelsamad
  Youssef", ticket labels like `Cash refund-KW9BA88YN000000000000000211SZ7001`,
  admin sees two buttons per row. Dark theme, ~1400px viewport.

## Suspected root cause (verify, don't assume)
`.qa-list` (`src/app/styles/quality.css` ~line 217) is `display:grid` with an
implicit `auto` column → auto tracks size to item **max-content** and can
exceed the container; the strip row's flex max-content (~2x page width: nowrap
name + nowrap meta + pills + buttons) widens the column, the article
overflows into document scroll. `.qa-meta { flex:1; min-width:0; overflow:hidden }`
never gets a chance because the track is already max-content.
Codebase precedent for the fix: `src/app/styles/hub.css` `.md-layout` /
`.md-main` use `grid-template-columns: minmax(0,1fr)` + `min-width:0`.
Also check `details.qa-card--strip` (disputes, my-audits) — same `.qa-list`
grid, so the same overflow can occur there; fix at the shared selector.

## Round 2 (2026-11-09): Submit-a-CTL card too wide
- Symptom: on wide monitors the "Submit a CTL" card spans the full page
  (`--page-max:none`), so the `.qa-ctl` 3fr/2fr grid gives the form column
  ~1100px+; mockup (`mockups/ctl-compact/mock.css:52` `.mk-main .cxp
  {max-width:72rem}`) capped it ~72rem.
- Intended fix: cap only the form card — e.g.
  `[data-app="quality"] .card:has(.qa-ctl) { max-inline-size:72rem }`
  (`:has()` already used in cx-kit.css). Keep list/SLA cards full width.
- Success: at ≥1600px viewport the Submit-a-CTL card ≈72rem wide, form+aside
  side-by-side inside, no overflow; at <64rem layout unchanged (single column).

## Non-goals
- No redesign of the strip layout; keep commit e41f9f1 visuals.
- No changes to disputes/my-audits markup beyond what the shared CSS fix needs.

## Risk flags
- `ui` → UX/UI gate after fix.
- No auth/db/data/perf/deps flags. Security gate skipped (pure CSS/DOM layout).

## Gates (from .devin/workflow.md; run in repo root C:\Users\AHMED\KPIs\CX-Hub)
- `npx tsc --noEmit`
- `npx eslint .` (scope to changed files if full run is slow)
- Visual check of the CTLs page (browser or fixture) — required for this bug.

## Conventions
- Next.js 16 differs from training data; read `node_modules/next/dist/docs/`
  guides before Next-specific code (not expected needed for a CSS fix).
- Forbidden: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`.
- Token-based CSS only (`var(--cx-*)`), scoped under `[data-app="quality"]`.
- Heavy output → log file + bounded tail (see skills/OUTPUT-BUDGET.md).

## Success criteria
1. CTLs page has no document-level horizontal scrollbar at ~1280–1920px
   viewports with 29 rows incl. long names/ticket labels.
2. Strip rows render fully inside the card; "Open in the form" and "Resend
   result email" buttons are on-screen.
3. `.qa-meta` text truncates with ellipsis instead of pushing the row wider.
4. Disputes page and my-audits page strips still render correctly (no
   regression in `details.qa-card--strip` variant).
5. `npx tsc --noEmit` and `npx eslint` pass.

## Key pointers
- `src/app/styles/quality.css` lines ~214–239 (`.qa-list`, `.qa-card--strip`)
- `src/features/cx-quality/components/ctls-page.tsx` (list markup ~line 375+)
- `src/features/cx-quality/components/disputes-page.tsx`,
  `my-audits-page.tsx` (details/summary variant)
- Prior spec: `specs/qa-card-compact-strips/` (PLAN + reports)
