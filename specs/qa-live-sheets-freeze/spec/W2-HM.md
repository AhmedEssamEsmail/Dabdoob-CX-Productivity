# W2-HM: heatmap de-sheeting — buildHeatmapFromSource reads DB only
Kind: package
ID: W2-HM
Dispatch: NEVER

## Goal and contract
`buildHeatmapFromSource` stops fetching the raw-tabs workbook and instead
synthesizes the same five tab grids (`Maqsam`, `Freshchat`, `Freshdesk`, `WA`,
`Excluded Groups`) from DB/config, wraps them in the existing `sheetBook` seam,
and feeds the UNTOUCHED `buildHeatmapFromRawTabs_`. Mirror columns are ISO
instants; the sheet tabs held Cairo wall-clock text — every ts cell is emitted
as `formatDate_(ms,'Africa/Cairo','yyyy-MM-dd HH:mm:ss')` so `hmKuwaitSlot_`
lands the same Kuwait slot. Country cells absent in mirrors (`maqsam_calls`,
`freshchat`) emit `''` -> the builder's `(country || '*')` bucket, per DECISION's
accepted fallback; `tickets.country` and `wa_parcels.values.country` are real and
used. `runPriorHeatmapRegression` is retired (one-off already run): function,
route op and UI button all go. `buildHeatmapFromRawTabs_`, upload parsing and the
stored-input surface are unchanged.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| W2-HM-01 | dev | none | #3 DB grids + rewire + retire regression | 3/8/400/10 |
| W2-HM-02 | dev | W2-HM-01 | #3 heatmap-page admin box | 1/4/80/6 |

## W2-HM-01: DB tab synthesizers + buildHeatmapFromSource rewire + regression retired
Kind: mini
ID: W2-HM-01
Parent: W2-HM
Owner: dev
Depends: none
Criteria: PLAN Amendment 4 #3 (DB-only build; heatmap_excluded_groups; regression retired)
Skills: none
Budget: files=3; actions=8; changed_lines=400; minutes=10

### Goal
`buildHeatmapFromSource` builds from `maqsam_calls`/`freshchat`/`tickets`/
`tracker_records('wa_parcels')`/config `heatmap_excluded_groups` — zero sheet
reads — and `runPriorHeatmapRegression` + the `regression` route op are deleted.

### Files
- Edit: `src/features/cx-queue/lib/heatmap.ts` | new `hmSourceCells_` + `buildHeatmapFromSource` rewire (:562-576) + delete `runPriorHeatmapRegression`/`HM_PRIOR_SHEET_ID` (:35, 578-603) + imports (:27-28)
- Edit: `src/app/api/queue/heatmap/route.ts` | drop `runPriorHeatmapRegression` import + `regression` op (:10-11, 33-34)
- Create: `tests/platform/hm-db-source.test.ts` | focused vitest for the synthesizers + window bound

### Context
- `src/features/cx-queue/lib/heatmap.ts:270-380` | `buildHeatmapFromRawTabs_` — consumer contract: per-tab header lookup `hmReadTab_`, `add()` filters `opts.from/to`, `(country||'*')` fallback, Excluded Groups flag `/^ex/i`
- `src/features/shared/jobs/mirrors.ts:124-188` | mirror typed columns: maqsam_calls `started_at,state,direction,handling,ts_ms`; freshchat `initiated_at,status,channel,ts_ms`
- `src/features/cx-queue/lib/index.ts:52-57` | `FD_TICKET_HEADERS` — tickets has `created_at,group_name,country`
- `src/features/shared/migration/mappings/ops-tabs.ts:165-186,204` | `tracker_records('wa_parcels').values` = `{country,creation_date,warehouse,order_id,status_3pl,whatsapp_status,invoice_id,link,code,trailed,confirmed,date_only}` (row_n order)
- `src/features/shared/lib/adapters.ts:135-151` | `formatDate_(ms,'Africa/Cairo','yyyy-MM-dd HH:mm:ss')` — the Cairo wall text the sheet cells held

### Contract
New private `hmSourceCells_(opts: { from: string; to: string }): Promise<Record<string, unknown[][]>>` emitting header+rows grids:
- Window: `from = opts.from || dqAddDays_(dqDateKey_(new Date()), -56)`, `to = opts.to || dqDateKey_(new Date())`; `fromMs/toMs` parsed at `T00:00:00Z`, `toMs += 86400000`. When `opts.from` was absent, callers push the note `'Defaulted to the last 8 weeks (no window given).'`.
- `'Maqsam'`: header `['Start time','Call direction','Call state','Country']`; rows = `readAllPaged('maqsam_calls', { columns: 'started_at,state,direction,ts_ms', build: q => q.gte('ts_ms', fromMs-86400000).lt('ts_ms', toMs) , order ts_ms asc via readAllPaged's default pk order })` -> `[cairoWall(started_at), direction||'', state||'', '']`.
- `'Freshchat'`: header `['Initiated At','Channel','Bot conversation flag','Status','Country']`; rows = freshchat `ts_ms >= fromMs - 7*86400000` (ts_ms tracks updated — pad for late resolutions) mapped `[cairoWall(initiated_at), channel||'', '', status||'', '']`, then JS-filtered to `initiated_at` inside the window.
- `'Freshdesk'`: header `['Created date','Group name','Group Check','Country']`; rows = tickets `.gte('created_at', iso(fromMs)).lt('created_at', iso(toMs))` order created_at asc -> `[cairoWall(created_at), group_name||'', '', country||'']` (Group Check was a sheet formula — always `''`; excluded groups do the filtering).
- `'WA'`: header `['invoice_creation_date','Address Confirmed3',"Customer Didn't Answer3",'Country_Name']`; rows = `tracker_records` `.eq('tracker_id','wa_parcels').order('row_n')` -> `[values.creation_date || values.date_only || '', confirmedFlag, didntFlag, values.country || '']` where `confirmedFlag = /address confirmed/i.test(values.status_3pl) || Number(values.confirmed) === 1 ? 1 : ''` and `didntFlag = /customer didn'?t answer/i.test(values.status_3pl) ? 1 : ''` (status_3pl carries the 3pl disposition vocabulary the flag columns encoded; misses degrade to skipped rows — accepted).
- `'Excluded Groups'`: header `['Group name','In/excluded']`; rows = `(await getConfig('heatmap_excluded_groups', []))` (string[]; absent -> `[]` — admins create the key via /admin/config when needed) mapped `[g, 'Excluded']`.
`buildHeatmapFromSource(spreadsheetId?, opts?)`: keeps requireRole admin + assertWritable; IGNORES `spreadsheetId` and the `heatmap_source_spreadsheet_id` config (deleted lookup + regex); builds `sheetBook(await hmSourceCells_(win), 'db')` -> `buildHeatmapFromRawTabs_(ss, {...opts, from: win.from, to: win.to})`; stores via `storeHeatmapInput_(…, 'db_mirrors', …)` (provenance marker). `runPriorHeatmapRegression`, `HM_PRIOR_SHEET_ID`, `fetchWorkbookTabs` import: deleted (`sheetBook`, `formatDate_` stay; add `dqAddDays_`, `dqDateKey_`, `readAllPaged`/`db` as needed — `db`/`getConfig` already imported).
Out of scope: `buildHeatmapFromRawTabs_` internals, upload/inputs/sets/countries functions, heatmap-page.tsx (W2-HM-02), any other file.

### Actions
1. Window helper + `hmSourceCells_` with the five grids per contract.
2. Rewire `buildHeatmapFromSource` to the DB book; drop id/config resolution.
3. Delete `runPriorHeatmapRegression` + `HM_PRIOR_SHEET_ID` + `fetchWorkbookTabs` import.
4. Route: remove `runPriorHeatmapRegression` import and the `regression` op (unknown ops already fall to `saveHeatmapInput` — return a 400 `Unknown op.` for 'regression' explicitly instead).
5. Test: fixture rows per table -> exact grid cells (incl. Cairo-wall conversion of one ISO instant, `''` country, wa_parcels flag mapping).
6. Test: Excluded Groups config absent -> header-only grid; window default when `opts.from` absent -> 56-day bound applied in the maqsam build filter.
7. `npx tsc --noEmit` + targeted vitest + `rg "fetchWorkbookTabs" src/features/cx-queue` -> 0 hits.
8. Confirm `deferred`/`HM_PRIOR_SHEET_ID` gone from heatmap.ts.

### Done when
- `buildHeatmapFromSource` performs only DB reads; grids match contract cell-for-cell on fixtures; `rg "fetchWorkbookTabs|runPriorHeatmapRegression|HM_PRIOR_SHEET_ID" src/` -> only test/doc mentions gone (route import removed); tests + tsc green.

### Verify
- Run: `npx vitest run tests/platform/hm-db-source.test.ts && npx tsc --noEmit` -> pass / 0 errors.

### Handoff
`op:'build'` now ignores `spreadsheetId`; `op:'regression'` -> 400. W2-HM-02 drops the dead UI. `deferred:` gone from heatmap.ts — feeds W2-STRICT-01.
Write results/W2-HM-01.md (<=10 lines); TL alone updates TRACKER.md.

## W2-HM-02: heatmap-page admin box — live-data build, regression button removed
Kind: mini
ID: W2-HM-02
Parent: W2-HM
Owner: dev
Depends: W2-HM-01 (route contract)
Criteria: PLAN Amendment 4 #3 (surface matches de-sheeted ops)
Skills: none
Budget: files=1; actions=4; changed_lines=80; minutes=6

### Goal
`AdminBuild` in heatmap-page.tsx builds from live data (no spreadsheet-id
input) and the September-regression button/table/`be.priorRegression` seam are
removed.

### Files
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | `be` seam (:17-26), `AdminBuild` (:96-145), `RegTable` (:31-93)

### Context
- `src/features/cx-queue/components/heatmap-page.tsx:17-26` | `be` object — `buildFromSource`/`priorRegression`
- `src/features/cx-queue/components/heatmap-page.tsx:96-145` | `AdminBuild` — the ss-id field + two buttons + RegTable mount
- `src/features/cx-queue/components/heatmap-page.tsx:31-93` | `RegTable` — regression-only component
- `specs/ux-ui-audit-v3/PLAN.md` Phase 2 | keep existing hm-* classes; no new UI patterns (contract gate is PM-level)

### Contract
- `be.buildFromSource = () => fetchJson('/api/queue/heatmap', { op: 'build' })` (no arg; server ignores `spreadsheetId`). `be.priorRegression` deleted.
- `AdminBuild`: remove the `hm-sid` input/`s` state; one `Button` 'Build volumes from live data' -> `u('source')` (same `run` machinery); hint updated to 'Rebuilds call/chat/ticket/WA volumes from the live tables. Cairo timestamps are moved to Kuwait time before they are counted.' Delete the regression button, its hint, `p`/`d` state and `<RegTable>`; delete the `RegTable` component if it has no other reference.
Out of scope: every other page region (upload, saved sets, countries), route.ts (done in W2-HM-01), any server file.

### Actions
1. Update `be` seam (drop arg, drop `priorRegression`).
2. Simplify `AdminBuild` to the single build button + hint; delete regression JSX/state.
3. Delete `RegTable` when unreferenced.
4. `npx tsc --noEmit` + `npx eslint src/features/cx-queue/components/heatmap-page.tsx` clean.

### Done when
- No spreadsheet-id input or regression control remains; the build button posts `op:'build'`; tsc + eslint clean.

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-queue/components/heatmap-page.tsx` -> 0 errors.

### Handoff
Heatmap surface de-sheeted end-to-end; feeds the strict-flip dependency set.
Write results/W2-HM-02.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
Both leaves done; package verified when `rg "fetchWorkbookTabs|priorRegression|RegTable" src/features/cx-queue` is empty and a fixture-driven `buildHeatmapFromSource` produces cells only from DB rows.
