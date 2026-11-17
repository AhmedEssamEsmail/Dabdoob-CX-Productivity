# sec report - qa-live-sheets-freeze - round 1 (FULL)

Verdict: FAIL
Open: 0B/0H/1M/3L

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | MED | src/features/cx-hub/lib/roster.ts:274 | `{manualHct:true}` is baked inside `dqReadHct_`, so the Sheet1 exemption is granted at the read site, not the manual-action boundary. `qaActiveEmails_` (cx-quality/lib/server.ts:1811 — quality-page request path, per-instance TTL-600 cache, cold instance = live sheet read) and any future caller of `dqReadHct_`/`dqSyncRoster_` pass the freeze guard silently — no `[SHEETS_FREEZE_VIOLATION]` log, no admin check at read level. Violates PLAN criterion 1 (Sheet1 only in the manual sync action). | Give `dqReadHct_(opts?)` a param defaulting to no `manualHct`; pass `{manualHct:true}` only from `dqSyncRoster_` (reachable solely via admin-gated `syncRosterNow`/`jobRosterSync`, roster.ts:424-441). `qaActiveEmails_` already fail-opens to null on read error, so it degrades safely until the user repoints it to `dq_hct`. | dev |
| sec-2 | LOW | src/app/api/admin/mirrors/route.ts:33-51 | Request-supplied `peek.ssId`/`peek.tab` with `deferred:true` = arbitrary-sheet read oracle for admin/key callers; `slice` is unbounded (only head/tail capped at 50), so a caller can page out an entire workbook tab. Same class: `buildHeatmapFromSource(spreadsheetId)` heatmap.ts:566 (regex-validated, `requireRole(['admin'])`). | Grandfathered wave-1 (logged); for wave-2 cap `slice` to a bounded window and drop request-supplied `ssId`. | dev |
| sec-3 | LOW | src/app/api/admin/list-sheets/route.ts:20-55; src/features/cx-quality/lib/migrate.ts:289-309 | Direct `googleapis` seams outside `assertSheetReadAllowed_`: list-sheets takes request `sheetId` -> metadata + header rows 1:2 of any sheet (keyed by MIGRATION_SECRET_KEY, fail-closed); `qaFirstSheetRows_` reads QA_HIST_SOURCES constants (admin/secret-gated, user-owned, wave-2 hand-back; not reachable from job-qa-engine after this diff). Both pinned in tests/freeze/sheets-freeze-scan.test.ts EXPECTED. | Wave-2 de-sheeting per spec; until then freeze criterion "no reads outside allowlist" is enforced at seams only, not globally. | dev |
| sec-4 | LOW | src/features/cx-hub/lib/roster.ts:310-315 | `dq_hct` upsert `onConflict:'email'`: NULL/empty-email HCT records never hit the unique index (NULLs are distinct) -> duplicate snapshot rows accumulate on every sync. | Filter/blank-check `email` before upsert (or make email NOT NULL with a generated fallback) before remote apply. | data-engineer |

## Verified clean
- **Cron auth**: job-qa-engine route keeps `cronOk` Bearer-CRON_SECRET check, fail-closed in production (route.ts:14-18), plus `requireJobCaller()` ahead of every step; history step is now DB-only `qaReconcileQueueLog_` (migrate.ts:401 — readRows + parameterized `eq()` updates, no googleapis on that path).
- **pg_cron migration** 20261116202809: zero secret literals; `app.settings.app_url`/`cron_secret` read via `current_setting` at each run and raises when unset. `net.http_get/http_post` arg order correct.
- **RLS**: `dq_hct` + `aux_spans` recreated with `ENABLE ROW LEVEL SECURITY`, no policies = deny-all anon/authenticated; service-role writes bypass.
- **Snapshot write**: parameterized `upsert` in <=500 batches, throws on error (fail-closed, no half-write); `dbbook.ts` uses parameterized `.gte/.lt/.eq` on static column lists, tab dispatch is a fixed switch — no injection surface.
- **prod_assumptions admin control**: writes go through `/api/config` POST/PUT, both `requireRole(['admin'])` + `viewAsGuard()`; PUT routes through `saveConfigValue` typed validation.
- **Allowlist widening**: all `SheetReadGateOpts` call sites pass code literals; `/api/admin/migrate` `body.tables` only selects among static `ROUTE_MAPPINGS`/`MODULE_MAPPINGS` (x-migration-key gated). `extraIds` comes only from admin-writable config `fd_activity_ss_id`.
- **Secrets**: diff scan for key/token literals clean; `.env*` gitignored (`git check-ignore .env.pulled .env.production` OK); seed script reads config-derived ids only, CLI-only, one approved exempt read.
- No `fetchWorkbookTabs`/`readSheet` in any cron route or non-admin route.

## Not verified / assumptions
- Remote `cron.job` state and `app.settings.*` GUC provisioning (PM-blocked, outside diff); deferred readers (scorecard/heatmap/tlqueue, engine internal calls) are spec-approved wave-1 and log violations.
- `qaImportHistory_` remains reachable via the user-owned qa action route — its `qa_history_secret` gate is in that user-owned path (out of edit scope).
