# 02-shot-harness   (shard id: S02)
Owner: dev     Depends: none     Criteria: PLAN #4,#5
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md

## Goal
Restore and extend the page-capture harness so every route is shot in light+dark (6 pages also mobile) into `.devin/work/shots/redesign/`, with computed-style assertions for the density/geometry contract.

## Files
Edit/create ONLY: `.devin/work/shoot-new.mjs`, `.devin/work/lib-shots.mjs`, `.devin/work/legacy-fixtures.mjs` (all gitignored — copied then adapted)
Read-only context: `C:\Users\AHMED\KPIs\_archive\devin-work\shoot-new.mjs` (whole file), `C:\Users\AHMED\KPIs\_archive\devin-work\lib-shots.mjs`, `C:\Users\AHMED\KPIs\_archive\devin-work\legacy-fixtures.mjs`, `src/features/shared/components/shell/registry.ts` (PAGES route list), `e2e/README.md` (env/auth model)
Forbidden: everything else — nothing under `src/`, manifests, `.env*` (read-only by the script, never modified/printed)

## Steps
1. Copy the three archive files into `.devin/work/`.
2. In `shoot-new.mjs`: `createRequire` from `C:/Users/AHMED/KPIs/CX-Hub/package.json`; try `require('playwright')`, fall back to `require('@playwright/test')`'s chromium. Read env from `C:/Users/AHMED/KPIs/CX-Hub/.env.local`.
3. `OUT = .devin/work/shots/redesign`.
4. Replace the shot list with one `shoot()` per route for every path in `PAGES` (`registry.ts`) plus `admin/config`, `admin/roster`, `tph-grid`, `ecosystem`, `auth/login` (anon ctx) — ~45 shots — each with a sensible `readySel` (`main,.cxp,.state-screen,form,canvas` variants per page; reuse the archived selectors where the page matches).
5. Run every route twice: light ctx and dark ctx (`dark:true`); name files `<route>.png` and `<route>-dark.png`. Mobile (390×844) for the 6 responsive-critical routes: `/`, `status-validation`, `tph`, `my-status`, `productivity-analytics`, `queue` → `<route>-mobile.png`. Agent ctx keeps `my-status`; unknown ctx keeps `no-access`.
6. Extend `lib-shots.mjs`'s `collectStyles`/STYLE_PROPS to capture the **contract**: `min-height`,`border-radius`,`border-width`,`font-size` on first `.cx-btn`/`button`; `height` on first `.cx-table tr,table tr`; `--cx-target` on `:root`; `font-size` on `td`. Write `<name>.styles.json` as before AND append a `contract` block per shot: `{target: <px>, rowH: <px>, btnMinH, btnRadius, btnBorderW, baseFont}`.
7. After all shots, write `_index.json` plus `contract-report.json`: per page whether `btnMinH == target`, `btnBorderW == '1px'`, `rowH <= 36px` (2.25rem), `baseFont ≈ 13px`, `target == 36` desktop / `44` coarse. Do not fail the run — record.
8. RTL spot-check support: a `RTL_PAGES` list (`/`, `status-validation`, `queue`) shot with `dir:'rtl'` + `localStorage cx.appearance {lang:'ar'}` init script → `<route>-rtl.png`.

## Done when
- `npm run dev` + `node .devin/work/shoot-new.mjs` → `_index.json` lists ~45×2 + 6 mobile + 3 RTL shots with captured styles/contract data; no fixture/login failures.
- Verify: `node .devin/work/shoot-new.mjs` -> exits 0 and `.devin/work/shots/redesign/contract-report.json` exists.
