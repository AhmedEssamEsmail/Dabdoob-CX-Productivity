# PLAN: unify-roster-source
Type: refactor   Status: draft
Date: 2026-11-16   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
One people table, `roster`. Eliminate the two redundant copies:

1. **`dq_hct`** — Postgres staging mirror of the HCT "Headcount" Google Sheet (spreadsheet `1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw`, tab `Sheet1`). It is written by `migrateAll` via `HCT_MAPPINGS` (`POST /api/admin/migrate`) and `scripts/ops/backfill-hct-headcount.mts`, and read by exactly one consumer: `dqReadHct_()` in `src/features/cx-hub/lib/roster.ts` inside `dqSyncRoster_`. Unify by making `dqReadHct_` read `Sheet1` directly through the existing `readSheet` engine (`src/features/shared/migration/engine.ts`) so roster sync becomes Sheet → roster in one step. Then drop the table.
2. **`headcount`** — dead V1 legacy table that exists only in the remote DB (referenced nowhere in src; only in `20261106151132_remote_reconcile.sql`'s RLS policy list). Drop it. (`JobEnv['headcount']` at `src/features/shared/jobs/env.ts:318` is a variable name = roster rows, not the table.)
3. **Other dead V1 remote tables** (user-approved drop, verified unreferenced 2026-11-16 — zero `from()/readStore()/readRows()/appendRow()/updateRow()` hits repo-wide): `team_structure`, `schedule`, `days_off`, `weekly_schedule`, `tls`, `tlp`, `md`. CAUTION on name collisions: drop only the exact-name tables — `tlp` ≠ the live `tlp_*` family (tlp_resp_ratings, tlp_kb, tlp_otd, tlp_ticket_exclusions), `schedule` ≠ `one_on_one_schedule`, `days_off` table ≠ the `roster.days_off` column. Remote existence is assumed from remote_reconcile's policy list; the migration must use `DROP TABLE IF EXISTS` for all of them.

## Why these tables exist today (context for reviewers)
- `roster` = app people table: access `role` (admin/tl/agent/specialist), org (`tl_email`, `position`), manual fields (`role_override`, `tl_override`, `days_off`, `based_in_country`) that the HR sheet cannot own. Everything reads it — `identity.ts`, `pwDirectory`, `JobEnv.headcount`, schedulers, quality/productivity/people features.
- `dq_hct` = migration-era staging mirror, kept so roster sync could run without sheet access; redundant now that the app's `readSheet` machinery already reads the same sheet via `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`.
- `headcount` = never-ported V1 table; `remote_reconcile` slapped an RLS policy on it during a lockdown sweep.

## Success criteria
1. `dqReadHct_` reads `Sheet1` directly (via `readSheet` + the HCT column projection), returning the same adapter record keys `dqRosterFromHct_` consumes (`name,email,position,department,section,manager,status,lwd,hiringDate,fdId,fdName,maqsamName,code,gender,contactNumber`). No `dq_hct` table read remains.
2. "Sync roster from HCT now" (`syncRosterNow`, admin) and `jobRosterSync` (cron) produce identical roster mutations vs a captured baseline — same adds/changes/deactivations and same unresolved/out-of-scope report.
3. A new timestamped migration drops all nine tables (`dq_hct`, `headcount`, `team_structure`, `schedule`, `days_off`, `weekly_schedule`, `tls`, `tlp`, `md`) with `IF EXISTS` (destructive — production apply is still gated by merge to main + user approval).
4. No live `dq_hct`/`headcount` references remain in `src/` or `tests/`: `HCT_MAPPINGS` removed from `MODULE_MAPPINGS`, `mappings/hct.ts` deleted (its `sheetToDb` column map is preserved where `dqReadHct_` consumes it), `/api/admin/migrate` no longer targets it, `scripts/ops/backfill-hct-headcount.mts` deleted or rewritten to sync roster directly. Migration-history files and specs/ docs may keep historical mentions.
4b. The second `dq_hct` consumer — `qaActiveEmails_` (`src/features/cx-quality/lib/server.ts:1753`), the active-agent filter for QA score pages — is re-pointed per the architect decision (roster.active vs shared sheet reader + cache). Its semantics depend on dq_hct holding OUT-OF-SCOPE sections (Data Entry) that roster never contains — a silent narrowing if re-pointed blindly.
5. Access semantics unchanged: `roleForEmail`/`requireRole`/`pwDirectory`/`admin_emails` behave identically; role/position/titleLevel split untouched.
6. Gates pass from project root: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, `npm run test:e2e` (page-contract for /people-holidays), `npm run test:security`.

## Scope / Non-goals
In: `dqReadHct_` sheet-direct read; removal of the dq_hct mapping/table and its only callers; `headcount` drop; keeping the sync's exact reconciliation semantics (scope filter, manager resolution, role_default, overrides, DQ_SYNC_KEEP_MANUAL, deactivation, dqLogRun_ heartbeat).
Out: any change to the access/role model; renaming `JobEnv.headcount` (variable, cosmetic — allowed as a small cleanup leaf only if free); other dead V1 remote tables (`team_structure`, `tls`, `tlp`, `md`, `weekly_schedule`, `schedule`, `days_off` — separate cleanup pending user decision); production deploy; package.json/lockfile; .env*; `cx-kpis-*.json`.

## Risk flags (y/n)
arch **y** (read-path shape: reuse engine vs bespoke reader; mapping ownership moves) · db **y** (DROP TABLE migration) · data **y** (roster sync pipeline = KPI/people data source) · auth **y** (roster feeds every role check — regression = lockout) · external-api **y** (Google Sheets service account) · ui n · perf n · deps n · tests **y** (golden hub-people-holidays + sync tests) · docs **y** (docs/ARCHITECTURE.md mentions the mirror pipeline — verify) · deploy n (migration auto-applies on merge; remote drops flagged for approval then)

Review gates: QA (always) · Security: run (auth + external-api) · Data: run · UX/Perf: skip.

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`

## Conventions
- Schema changes only via `npx supabase migration new <name>` (timestamped file; auto-applies on merge to main). No dashboard SQL. Remote DB writes need explicit user approval.
- Next.js 16 differs from training data: read `node_modules/next/dist/docs/` before Next code.
- Forbidden: package.json/lockfile, `.env*`, `cx-kpis-*.json`.
- Legacy-parity naming (verbatim legacy fn names) — specs/cx-hub/PORTING-GUIDE.md. `dqRosterFromHct_`, `dqReadHct_`, `dqSyncRoster_` names stay even though the store changes.
- Lazy-init clients; no env-dependent module top-level calls (`SPREADSHEETS` map already uses env at module scope for `core` — hct is a literal, fine). `import 'server-only'` needs scripts/tsconfig paths for tsx/vitest.
- Sheets: readSheet paces calls ~700 ms + 429 retry already; batchGet caps ~8 KB URL (~150 ranges).
- Heavy output to log files + bounded tail (OUTPUT-BUDGET.md); leaf results under `specs/unify-roster-source/results/`.

## Research notes (verified 2026-11-16)
- `dqReadHct_` (roster.ts:247-256): `readStore('dq_hct')` → rows; throws "Roster master is not connected" if table missing. Callers: `dqSyncRoster_` (roster.ts:268+) via `syncRosterNow` (378) and `jobRosterSync` (391) — PLUS `qaActiveEmails_` (cx-quality/lib/server.ts:1753-1764) which builds the active-email set for `getQaScoresPage`/`qaActiveKeep_` filtering (returns null when the store is missing/empty — that null path becomes the fallback once the table is gone; decide deliberately, null ≠ same semantics).
- Test seams to rework: `tests/golden/hub-fakes.ts:34` (`hubDb.missing` includes 'dq_hct'), `tests/golden/hub-people-holidays.test.ts` (`base.tables.dq_hct` fixtures at ~355/385, the 'refuse without dq_hct' test at ~344) — fakes must mock the sheet reader instead of the table.
- Dead-table verification (repo-wide grep of all table-access call shapes, 2026-11-16): `headcount`, `team_structure`, `schedule`, `days_off`, `weekly_schedule`, `tls`, `tlp`, `md` — zero hits in src/tests/scripts/migration/e2e. `migration/validate.ts:266` lists `headcount` as `backed:false` (metadata only).
- Writers of `dq_hct`: `HCT_MAPPINGS` (mappings/hct.ts — `Sheet1 → dq_hct`, `upsertOn: email`, `require: [email,name]`, camelCase keys verbatim) inside `MODULE_MAPPINGS` (engine.ts:94) reached by `POST /api/admin/migrate` (app/api/admin/migrate/route.ts:36 `migrateAll`); `scripts/ops/backfill-hct-headcount.mts` upserts it directly.
- `readSheet(spreadsheetId, sheetName)` (engine.ts:168) returns header-keyed objects; `headerKeys` handles blank/dup headers; `mapRow` (engine.ts:190, not exported) applies `sheetToDb` + typed coercion — for dq_hct all cols are text so a plain projection by `sheetToDb` suffices. Sheets auth: `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` envs (engine.ts:104-118) — same creds `/api/admin/migrate` uses today, so parity of access is proven in-prod.
- `dqRosterFromHct_` (roster.ts:168-240) is pure: takes records + scope + tz + cfg; manager resolution uses ALL sheet rows incl. out-of-scope — direct sheet read preserves this exactly.
- `headcount` evidence: grep whole src → zero `from('headcount')`/`readStore('headcount')`; only `remote_reconcile.sql:211` RLS list + `env.ts:318` variable. Other dead remote tables (same evidence class): team_structure, tls, tlp, md, weekly_schedule, schedule, days_off — NOT in scope unless user expands.
- `remote_reconcile.sql` RLS loop mentions `headcount` — dropping the table is fine (policy dies with it); do NOT edit historical migration files.
- Tests touching the surface: `tests/golden/hub-people-holidays.test.ts` (roster admin), any test mocking `readStore('dq_hct')` — search for `dq_hct` in tests/ during spec.
- `docs/ARCHITECTURE.md` — check for mirror-pipeline mentions to update (docs flag).
- PostgREST typed-column lesson: roster row mappers must emit null not '' for typed cols (lessons.md) — sync writes text cols, low risk.

## Key pointers
- src/features/cx-hub/lib/roster.ts — `dqReadHct_` (247), `dqRosterFromHct_` (168), `dqSyncRoster_` (268), `syncRosterNow` (378), `jobRosterSync` (391), ROSTER_TABLE (35)
- src/features/shared/migration/engine.ts — `readSheet` (168), `readSheetRaw` (126), `headerKeys` (155), `mapRow` (190), `MODULE_MAPPINGS` (94), `SPREADSHEETS.hct` (40)
- src/features/shared/migration/mappings/hct.ts — column map + DECISIONS to preserve-as-comment where consumed
- src/app/api/admin/migrate/route.ts — migrateAll caller; ensure `wanted` handling tolerates removed mapping
- supabase/migrations/20261109131140_dq_hct_table.sql, 20261112142701_headcount_access_split.sql — history, do not edit; new drop migration supersedes
- src/features/shared/jobs/env.ts:318 — `headcount` variable (cosmetic only)
- scripts/ops/backfill-hct-headcount.mts — delete or repoint
- tests/golden/hub-people-holidays.test.ts + tests/** for `dq_hct` mocks

## Architect decision
See `DECISION.md`: `dqReadHct_` reuses `readSheet` + projection constants moved into roster.ts (incl. require [email,name] + last-wins email dedupe); `qaActiveEmails_` calls `dqReadHct_()` behind repo `cacheGet/cachePut` 600s, fail-open null (roster.active rejected — drops out-of-scope agents); nine tables dropped in one migration with `IF EXISTS`, **no CASCADE**; tests mock engine `readSheet` via importOriginal.

## User decisions (2026-11-16)
- Drop both `dq_hct` and `headcount` — "drop both but make sure no code reference them" (verification recorded in Research notes).
- Expanded scope: also drop the other dead V1 remote tables (team_structure, schedule, days_off, weekly_schedule, tls, tlp, md).

## Spec-time findings (2026-11-16, spec-architect)
- `/api/admin/migrate` needs NO edit: `wanted` Set matching (route.ts:32-36, engine.ts:357) makes `tables:['dq_hct']` a tolerated no-op once the mapping is gone; `migration/migrate-all.ts:25-27` inherits `MODULE_MAPPINGS` removal automatically.
- Legacy `dqReadHct_` (RosterSync.js:130-153) read per-column via `DQ_HCT_COLS` (12 cols, 'Maqsam Name' stop); the app-facing record stream is dq_hct's 15-col projection (mappings/hct.ts) — the port keeps the 15-col set incl. code/gender/contactNumber. Adding Code/Gender/'Contact Number' after 'Maqsam Name' in test fixtures is invisible to the oracle's stop-column reader.
- `migration/validate.ts` INVENTORY lists `dq_hct` (:152) + all 8 dead legacy names (:266-273) → stale after the drop; cleanup assigned S02-03. Scratch refs (chk.mjs, final-counts.mjs, probe-cols2.mjs, apply-pending-ddl.mjs, probe-remaining-tabs.ts) = one-off ops history, untouched.
- `docs/ARCHITECTURE.md` has zero dq_hct/mirror-pipeline mentions → docs flag satisfied with no leaf. `viewas-sweep.test.ts` calls `syncRosterNow`/migrate POST but refuses at `assertWritable` before any sheet/table read — unaffected.
