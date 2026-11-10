# fix-live-3 — missing `server-only` runtime dependency (LIVE-03 halt)

Source: results/LIVE-03.md — `run-qa-history.ts --write` exit=1,
`Fatal: Cannot find module 'server-only'` required by
`src/features/cx-quality/lib/migrate.ts` (line 18 `import 'server-only'`).
`server-only` is imported in ~60 src files but absent from package.json /
node_modules; Next.js resolves it internally (next/dist/compiled/server-only),
`tsc` via src/types/server-only.d.ts — `npx tsx` has neither path.

## lv3-01: install the official `server-only` stub and verify tsx resolves

Kind: mini
ID: lv3-01
Parent: LIVE (fix for LIVE-03 halt)
Owner: maintainer
Depends: none
Criteria: LIVE-03 blocker (only fix; 5 --write scripts pending)
Skills: none
Budget: files=2; actions=3; changed_lines=10; minutes=5

### Goal
The official Vercel `server-only` package is declared in package.json +
lockfile so bare `import 'server-only'` resolves under tsx, matching what
the source already assumes. Then prove the import no longer fatals.

### Files
- Edit: `package.json` | add `server-only` dependency (version from npm)
- Edit: `package-lock.json` | updated by npm install (lockfile only)

### Context
- `src/types/server-only.d.ts` | existing ambient decl — keep as is
- `src/features/cx-quality/lib/migrate.ts:18` | the failing import site
- `node_modules/next/dist/compiled/server-only/` | Next's bundled copy (app unaffected)

### Contract
Install `server-only` (production dependency, latest) via
`npm install server-only`. Do NOT touch any other dependency, do not edit
source files, do not run npm audit fix / upgrades. The runtime import in
migrate.ts stays (it is an intended guard).

### Actions
1. `npm install server-only` from project root.
2. Verify: `npx tsx migration/run-qa-history.ts --probe` reaches sheet reads
   (exit=0 or a NON-module-resolution failure only — 'Cannot find module
   server-only' must be gone; sheet/network errors are out of scope).
3. Write results/lv3-01.md (installed version, probe outcome).

### Done when
- package.json + lockfile contain server-only; `npx tsx -e "import 'server-only'"`
  exits 0.
- run-qa-history --probe no longer fails on module resolution.

### Verify
- Run: `npx tsc --noEmit` -> exit=0 (no type regression).

### Handoff
Unblocks LIVE-03 resume (5 remaining --write scripts, data-engineer).
Write results/lv3-01.md (<=10 lines); TL alone updates TRACKER.md.

## lv3-02: QA history cursor config keys must be lower_snake_case

Kind: mini
ID: lv3-02
Parent: LIVE (fix for LIVE-03 resume halt #2)
Owner: dev
Depends: none
Criteria: LIVE-03 blocker #2 (run-qa-history exit=1 mid-write)
Skills: none
Budget: files=1; actions=3; changed_lines=15; minutes=5

### Goal
`importQualityAuditHistory_` crashes on the FIRST cursor write:
`setConfig` enforces `^[a-z0-9_]{1,64}$` (settings.ts:211) but
migrate.ts builds `curKey = 'QE_HIST_' + key.toUpperCase()` (line ~331)
and `restartQualityAuditHistory_` repeats it (line ~447). Keys are already
lowercase (`voice`, `text` in QA_HIST_SOURCES) — only the prefix casing is
wrong. `getConfig` does not validate, so no cursor was ever written;
switching to lowercase is consistent and loses nothing.

### Files
- Edit: `src/features/cx-quality/lib/migrate.ts` | lines ~8 (docblock QE_HIST_*), ~331, ~447

### Context
- `src/features/shared/platform/settings.ts:205-215` | CONFIG_KEY_RE enforcement (setConfig only)
- `src/features/cx-quality/lib/migrate.ts:326-368` | cursor read/write loop
- `src/features/cx-quality/lib/migrate.ts:445-448` | restartQualityAuditHistory_ same pattern

### Contract
`curKey` becomes `'qe_hist_' + key` (key is already lowercase in
QA_HIST_SOURCES — do NOT call toLowerCase on a label; keep it simple and
deterministic). Same for the restart loop's setConfig. Update the line-8
docblock `QE_HIST_*` -> `qe_hist_*`. Do NOT touch the QA_HIST_SOURCES map,
audit upsert logic, or any other file.

### Actions
1. Line ~331: `'QE_HIST_' + key.toUpperCase()` -> `'qe_hist_' + key`.
2. Line ~447: same replacement.
3. Line ~8 docblock: `QE_HIST_*` -> `qe_hist_*`; write results/lv3-02.md.

### Done when
- `npx tsc --noEmit` exit=0.
- `npx tsx --conditions=react-server migration/run-qa-history.ts --probe` exit=0
  (still reaches sheets — probe never calls setConfig; proves no regression).

### Verify
- Run: `grep -n "QE_HIST" src/features/cx-quality/lib/migrate.ts` -> 0 matches.

### Handoff
Unblocks LIVE-03 resume attempt 3 (5 scripts; qa_audits partial upserts are
idempotent on audit_id — re-running run-qa-history from cursor row 2 is safe).
Write results/lv3-02.md (<=10 lines); TL alone updates TRACKER.md.

## lv3-03: qa history audit row — null for typed cols, drop Sheets apostrophe

Kind: mini
ID: lv3-03
Parent: LIVE (fix for LIVE-03 resume halt #3)
Owner: dev
Depends: none
Criteria: LIVE-03 blocker #3 (run-qa-history exit=1 at first qa_audits upsert)
Skills: none
Budget: files=1; actions=4; changed_lines=15; minutes=5

### Goal
`qaHistoryRows_` emits `''` into typed Postgres cols:
`invalid input syntax for type numeric: ""`. Per DDL
(supabase/migrations/20261105172048_quality.sql:62-97) the typed cols are
score_final numeric, started_at timestamptz, acknowledged_at timestamptz
(score gets a real number; submitted_at/updated_at get real ISO strings —
leave them). Also `interaction_at` emits `"'" + qeFmt_(...)` — a legacy
Sheets escape that would store a literal leading apostrophe in a text col.

### Files
- Edit: `src/features/cx-quality/lib/migrate.ts` | audit out.push block ~line 279

### Context
- `supabase/migrations/20261105172048_quality.sql:62-97` | qa_audits DDL
- `src/features/cx-quality/lib/migrate.ts:272-282` | the emitted row literal

### Contract
`score_final: ''` -> `null`; `started_at: ''` -> `null`;
`acknowledged_at: ''` -> `null`; `interaction_at` drop the leading `'`
(`qeFmt_(parsedCall, 'yyyy-MM-dd')` bare, `''` stays for the else branch —
text col accepts ''). Do NOT change any other field, function, or file.
Text cols (queue_id, calibration_id, etc.) keep `''` — they are text.

### Actions
1. score_final/started_at/acknowledged_at `''` -> `null` (3 spots, one line).
2. interaction_at: remove `"'" + ` prefix.
3. `npx tsc --noEmit` must be 0; write results/lv3-03.md.
4. `npx tsx --conditions=react-server migration/run-qa-history.ts --probe` exit=0.

### Done when
- tsc=0, probe exit=0, no `''` remains for numeric/timestamptz emits.

### Verify
- Run: `grep -n "score_final: ''\|started_at: ''\|acknowledged_at: ''\|interaction_at: \"'\"" src/features/cx-quality/lib/migrate.ts` -> 0 matches.

### Handoff
Unblocks LIVE-03 resume attempt 4 (5 scripts; idempotent re-run safe).
Write results/lv3-03.md (<=10 lines); TL alone updates TRACKER.md.
