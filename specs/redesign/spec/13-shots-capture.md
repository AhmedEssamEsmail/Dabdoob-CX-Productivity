# 13-shots-capture   (shard id: S13)
Owner: dev     Depends: S12     Criteria: PLAN #4,#5,#7
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md

## Goal
Produce the full visual record: every route shot in light+dark (+mobile for 6, +RTL for 3) under `.devin/work/shots/redesign/`, with the density/geometry contract verified by computed styles.

## Files
Edit/create ONLY: files under `.devin/work/` (shots output; `shoot-new.mjs`/`lib-shots.mjs` may be tweaked to fix capture bugs found at run time)
Read-only context: `.devin/work/shoot-new.mjs` (from S02), `.devin/work/shots/redesign/contract-report.json`, PLAN.md criteria 4-7
Forbidden: `src/` (no source fixes — report failures, don't patch the design here)

## Steps
1. `npm run dev` in one terminal; `node .devin/work/shoot-new.mjs` in another.
2. Confirm `_index.json` covers every route ×{light,dark} + 6 mobile + 3 RTL; every entry `errors:[]`. For any route failing to capture (timeout, no readySel match), tune `readySel`/`settleMs` in `shoot-new.mjs` and re-run only the missing names.
3. Inspect `contract-report.json`: every page should show `target=36` (desktop) / `44` (mobile ctx), `btnMinH==target`, `btnBorderW='1px'`, `rowH<=36`, `baseFont≈13`. Record violations in `specs/redesign/reports/contract-violations.md` (page, property, actual) — do NOT fix source here.
4. Eyeball 10 representative shots (both themes) for obvious breakage (unstyled raw elements, legacy pine rail leftovers); log anomalies in the same report.
5. RTL: confirm the 3 `-rtl.png` shots render mirrored layout without broken chrome.

## Done when
- `shots/redesign/` contains the full matrix; `_index.json` has zero error entries; `contract-report.json` + `specs/redesign/reports/contract-violations.md` exist.
- Verify: `node .devin/work/shoot-new.mjs` -> exits 0; `grep -c '"name"' .devin/work/shots/redesign/_index.json` -> ≥ ~95.
