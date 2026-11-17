# W2-ADM: admin readers de-sheeted — mirrors peek + source-health DB probes + engine flags off
Kind: package
ID: W2-ADM
Dispatch: NEVER

## Goal and contract
The three remaining grandfathered admin sheet readers are replaced or closed
(sec-2/sec-3 closure): `POST /api/admin/mirrors {peek}` reads the DB mirror
table (bounded) instead of the source tab; `GET /api/admin/source-health`
probes DB mirrors/tables/config instead of opening workbooks; `engine.ts`'s
two `{deferred:true}` flags come off so every non-allowlisted mapping read
throws `SheetsFreezeError` through `assertSheetReadAllowed_` (allowlisted
`(quality, qa_audits)` still passes; the throw surfaces as a failed
TableResult in admin/migrate — loud, per DECISION); `/api/admin/list-sheets`
returns 410 Gone. Three independent leaves, all parallel-safe.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| W2-ADM-01 | dev | none | #5 mirrors peek -> DB mirror rows (sec-2) | 1/4/90/8 |
| W2-ADM-02 | dev | none | #5 source-health -> DB probes | 1/5/130/10 |
| W2-ADM-03 | dev | none | #5 engine deferred removal + list-sheets 410 (sec-3) | 2/3/60/5 |

## W2-ADM-01: mirrors peek — DB mirror rows, bounded
Kind: mini
ID: W2-ADM-01
Parent: W2-ADM
Owner: dev
Depends: none
Criteria: PLAN Amendment 4 #5; reports/sec-1.md sec-2 (unbounded slice)
Skills: none
Budget: files=1; actions=4; changed_lines=90; minutes=8

### Goal
`POST /api/admin/mirrors {peek:{tab,head?,tail?,slice?}}` returns rows of the
DB mirror table in the same cell layout the sheet peek returned — no
`fetchWorkbookTabs`, no arbitrary-workbook oracle, bounded slice.

### Files
- Edit: `src/app/api/admin/mirrors/route.ts` | the `body.peek` branch (:29-52) + imports (:6-7)

### Context
- `src/app/api/admin/mirrors/route.ts:20-70` | current POST: peek branch + sync branch (keep)
- `src/features/shared/jobs/mirror-cells.ts` | `fdActivityCells_`/`maqsamCells_`/`freshchatCells_` — typed row -> the legacy cell layout
- `src/features/shared/jobs/mirrors.ts:124-188` | mirror typed columns per table (peek selects `*` and emits via cells fn)

### Contract
`tab -> table`: `'Activities' -> fd_activities`, `'Maqsam Calls' -> maqsam_calls`, `'Freshchat' -> freshchat`; any other `tab` -> 400 `{error:"Peek supports 'Activities' | 'Maqsam Calls' | 'Freshchat' (the DB mirror tables)."}`. `body.peek.ssId` is ignored (documented in the route comment — the oracle is the mirror table now).
- `totalRows` = `select('*',{count:'exact',head:true})` on the table.
- `head` = first N rows ordered `ts_ms` asc (`limit(head)`, head capped 1..50 as today) mapped through the table's cells fn.
- `tail` = `order('ts_ms',{ascending:false}).limit(tail)` mapped then reversed to chronological.
- `slice` = `.order('ts_ms').range(s0, s1-1)` with `s1-s0` clamped to <=500 rows (sec-2 bound) mapped through cells.
- Response `{ ok:true, table, tab, totalRows, head, tail?, slice? }` (drop `workbook`; keep `tab` echo). `fetchWorkbookTabs` import + `dqSetting_`/`configAll` usage inside the peek branch go (configAll still used by the sync branch — keep the import if referenced there; `dqSetting_` may drop).
Out of scope: the sync branch and GET route, mirror-cells emitters, any other file.

### Actions
1. Rewrite the peek branch per contract (tab->table map, bounded queries, cells emitters).
2. Fix imports (fetchWorkbookTabs out; mirror-cells in; prune unused).
3. Update the peek comment block to the DB-oracle reality.
4. `npx tsc --noEmit` clean; `rg "fetchWorkbookTabs|deferred" src/app/api/admin/mirrors/route.ts` -> 0 hits.

### Done when
- Peek returns DB mirror cells head/tail/slice with a 500-row slice cap and no sheet call; unknown tab -> 400; tsc clean.

### Verify
- Run: `npx tsc --noEmit && rg "fetchWorkbookTabs|deferred" src/app/api/admin/mirrors/route.ts` -> 0 errors / no matches.

### Handoff
sec-2 closed (bounded, no arbitrary sheet oracle). `deferred:` gone — feeds W2-STRICT-01.
Write results/W2-ADM-01.md (<=10 lines); TL alone updates TRACKER.md.

## W2-ADM-02: source-health — sheet probes become DB mirror/table checks
Kind: mini
ID: W2-ADM-02
Parent: W2-ADM
Owner: dev
Depends: none
Criteria: PLAN Amendment 4 #5
Skills: none
Budget: files=1; actions=5; changed_lines=130; minutes=10

### Goal
The "why is everything zero" diagnostic stops opening workbooks: the two
sheet-probe blocks become DB mirror/table/config checks covering the same
failure modes.

### Files
- Edit: `src/app/api/admin/source-health/route.ts` | `---- source sheets ----` (:150-185), `---- legacy store audit ----` (:187-205), imports (:7-9), `requiredOk` (:266-268), `REQUIRED_CONFIG` (:61-69)

### Context
- `src/app/api/admin/source-health/route.ts:95-126` | `probeTable` helper + the APP_TABLES/EXTERNAL probe pattern to reuse
- `src/app/api/admin/source-health/route.ts:150-205` | the two blocks being replaced (3 workbook probes + legacy audit)
- `src/app/api/admin/mirrors/route.ts:78-87` | `mirror_state_<t>` config shape `{last_ts_ms,last_sync_at}` for freshness detail
- `src/features/shared/jobs/dbbook.ts` | the DB equivalents of the probed tabs (Assumptions <- config `prod_assumptions`, Freshchat <- `freshchat` table)

### Contract
Replace the `---- source sheets ----` + `---- legacy store audit ----` sections with one `---- data feeds (was: source sheets) ----` block of `probeTable`-style checks (each `{name,kind:'table'|'config',ok,detail,hint?}`):
- `mirror fd_activities`, `mirror maqsam_calls`, `mirror freshchat` — `ok` = table exists && count > 0; detail = `<count> rows; watermark <cfg.mirror_state_<t>.last_sync_at || 'never'>`; hint on empty/missing: `Run POST /api/admin/mirrors {table:'<t>', full:true}.`
- `prod_daily_layers <current month>` — count `.gte('date', month+'-01')`; ok = >0; hint: `The nightly-aggregates job writes these rows — check cron prod_snapshot/daily-layers.`
- `config prod_assumptions` — ok = `cfg.prod_assumptions` object with numeric `mq`; hint: `Seed once via scripts/ops/seed-prod-assumptions.ts output in /admin/config.` (Simpler: append `'prod_assumptions'` to `REQUIRED_CONFIG` — pick one, keep it consistent.)
- `dq_hct roster snapshot` — `ok` = exists && count > 0; detail = count + `synced_at` max; hint: `Manual "Sync roster from HCT now" (admin) writes it.` (EXTERNAL-kind ok: missing -> ok:false, hint.)
The `sheet credentials` check STAYS but renames to `'sheet credentials (HCT + qa_audits allowlist)'` — the service account still gates the two allowlisted reads; `sheetCreds` import kept, `fetchWorkbookTabs`/`prodFileFor_`/`prodToday_`/`dqSetting_` (if unused) imports and `requiredOk` deleted; `Check.kind` union drops `'legacy'` (keep `'sheet'` for the creds check). LEGACY_PRODUCTIVITY_SS/LEGACY_TABS consts deleted.
Out of scope: tables/env/cron/health sections, any other file.

### Actions
1. Delete the two sheet blocks; write the data-feeds block per contract.
2. Rename the creds check; prune dead imports/helpers/consts.
3. Ensure `kind:'sheet'` only on the creds check; union updated.
4. `npx tsc --noEmit` clean; `rg "fetchWorkbookTabs|deferred|LEGACY_" src/app/api/admin/source-health/route.ts` -> 0 hits.
5. Sanity: the checks array still covers table/config/env/sheet(creds)/cron kinds.

### Done when
- Route contains zero sheet reads; every former probe has a DB equivalent check; tsc clean.

### Verify
- Run: `npx tsc --noEmit && rg "fetchWorkbookTabs|spreadsheets" src/app/api/admin/source-health/route.ts` -> 0 errors / no matches.

### Handoff
Source-health is sheet-free; `deferred:` gone — feeds W2-STRICT-01.
Write results/W2-ADM-02.md (<=10 lines); TL alone updates TRACKER.md.

## W2-ADM-03: engine.ts deferred flags off + list-sheets -> 410
Kind: mini
ID: W2-ADM-03
Parent: W2-ADM
Owner: dev
Depends: none
Criteria: PLAN Amendment 4 #5 (engine deferred removed; non-allowlisted mappings throw); reports/sec-1.md sec-3
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=5

### Goal
`migrateTable`/`backfillTrackerRecords` no longer pass `{deferred:true}` — every
non-allowlisted sheet read hits `assertSheetReadAllowed_` and throws — and
`/api/admin/list-sheets` becomes a 410 Gone stub.

### Files
- Edit: `src/features/shared/migration/engine.ts` | `readSheet` call :238 and `readSheetRaw` call :300
- Edit: `src/app/api/admin/list-sheets/route.ts` | POST body -> 410 stub (whole googleapis block)

### Context
- `src/features/shared/migration/engine.ts:233-241,294-301` | both call sites sit inside try/catch that converts a throw into a failed `TableResult` (`errors: [...]`) — the loud path DECISION wants
- `src/features/shared/lib/sheets-freeze.ts:21-34` | the guard: allowlist passes; else throws (after W2-STRICT-01 the `deferred` field itself is gone — this leaf only removes the two call-site flags, which already compile once the type shrinks)
- `src/app/api/admin/list-sheets/route.ts:1-65` | keep `checkAdminAuth` + `maxDuration`; replace the googleapis try block

### Contract
- engine.ts: `readSheet(spreadsheetId, mapping.sheet)` and `readSheetRaw(spreadsheetId, b.sheet)` — no opts arg (zero behaviour change for allowlisted `(ss_quality_id,'qa_audits')` reads; everything else throws SheetsFreezeError into the TableResult errors).
- list-sheets POST: keep `maxDuration` + `checkAdminAuth` 401 gate, then `return Response.json({ error: 'Sheet reads are frozen (qa-live-sheets-freeze); this diagnostic is retired.' }, { status: 410 })` — googleapis import, sheetId/body parsing, sheets.get/values.get all deleted (~40 lines -> ~20).
Out of scope: other engine call sites (roster manualHct, user-owned cx-quality), the scan EXPECTED map (W2-STRICT-01 owns), admin/migrate route itself.

### Actions
1. Remove both `{ deferred: true }` args in engine.ts.
2. Rewrite list-sheets POST to the 410 stub.
3. `npx tsc --noEmit` clean; `rg "deferred" src/features/shared/migration/engine.ts` + `rg "googleapis" src/app/api/admin/list-sheets/route.ts` -> 0 hits.

### Done when
- engine passes no opts on either internal read; list-sheets returns 410 after auth; tsc clean.

### Verify
- Run: `npx tsc --noEmit && rg "deferred" src/features/shared/migration/engine.ts` -> 0 errors / no matches.

### Handoff
sec-3's route half closed (qaFirstSheetRows_ stays USER-OWNED). `deferred:` gone from engine.ts — feeds W2-STRICT-01.
Write results/W2-ADM-03.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
All three leaves done; package verified when `rg "fetchWorkbookTabs|deferred|googleapis"` over the five touched files is empty and admin/migrate surfaces SheetsFreezeError as a failed TableResult for a non-allowlisted mapping.
