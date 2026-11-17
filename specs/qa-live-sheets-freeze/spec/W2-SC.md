# W2-SC: scorecard de-sheeting — sc_daily from DB + Business Behaviour form
Kind: package
ID: W2-SC
Dispatch: NEVER

## Goal and contract
`scorecard-server.ts` performs ZERO sheet reads. `scNightly_`/`refreshScorecard`
rebuild `sc_daily` for a month from `prod_daily_layers` (targets/achieved, the
same extract the Matrix carried) + `qa_audits` (live audits/score) + `roster`
(names). `prod_daily_layers` rows are `layer='effective'` preferred, else `raw`.
Stored `fcr_*` verdicts survive a rebuild per (date,email) — FCR has no live
source (accepted, DECISION). `sc_behaviour` is never touched by refresh again:
the new admin form owns its writes. `scInspect_`/`scReadWorkbook_` and the
`fetchWorkbookTabs`/`sheetCreds` gates are deleted; `saveScorecardSource`
becomes a config-only write. Golden-covered pure parsers
(`scParseMatrix_`/`scParseFcr_`/`scParseBehaviour_`/`scBuildDaily_`/`scSheetId_`)
STAY — tests/golden/people.test.ts pins them. The nightly pg_cron job
`cxh-scorecard-nightly` (06:45 UTC) then exercises the DB path end-to-end.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| W2-SC-01 | dev | none | #1 sc_daily DB builder + test | 2/5/350/10 |
| W2-SC-02 | dev | W2-SC-01 | #1 refresh rewire + FCR preserve + dead-code drop | 3/8/320/10 |
| W2-SC-03 | dev | W2-SC-02 | #2 addBehaviourCase + route op | 3/5/180/8 |
| W2-SC-04 | dev | W2-SC-03 | #1/#2 ScorecardAdmin UI (source box + behaviour form) | 1/4/180/8 |

## W2-SC-01: scDailyRowsDb_ — build one month's sc_daily rows from DB
Kind: mini
ID: W2-SC-01
Parent: W2-SC
Owner: dev
Depends: none
Criteria: PLAN Amendment 4 #1 (sc_daily from prod_daily_layers + roster + qa_audits)
Skills: none
Budget: files=2; actions=5; changed_lines=350; minutes=10

### Goal
A new exported function `scDailyRowsDb_(month)` returns sc_daily-shaped rows
for `yyyy-MM` computed entirely from DB — targets/achieved/matrix_day from
`prod_daily_layers`, audits/score from `qa_audits`, names from `roster` — plus
its focused vitest. No caller wiring yet (that is W2-SC-02).

### Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | add `scDailyRowsDb_` in the `---------- store:` region (near `scBuildDaily_`, ~line 199)
- Create: `tests/platform/sc-daily-db.test.ts` | focused vitest for the same behaviour

### Context
- `src/features/cx-people/lib/scorecard-server.ts:164-197` | `scBuildDaily_` — the row shape to reproduce (`zero()` + sort by date,email); fcr fields stay 0 here (preserve-merge is SC-02)
- `src/features/cx-people/lib/kpi/server.ts:120-142` | the layer-preference rule: `effective` wins, else rows with `layer` null/'raw' — reuse verbatim
- `supabase/migrations/20261031193219_domain_tables.sql:36-50` | prod_daily_layers columns: `date,email,"agentName",layer,"inboundTarget","inboundAchieved","textingTarget","textingAchieved","waTarget","waAchieved","totalAudits","avgScore"`
- `supabase/migrations/20261105172048_quality.sql:62-97` | qa_audits columns: `agent_email,audit_date(text yyyy-MM-dd),score,score_final,kind,status,source`
- `tests/platform/dq-hct-snapshot.test.ts:40-70` | repo-mock fixture pattern for readAllPaged/readStore

### Contract
`export async function scDailyRowsDb_(month: string): Promise<{ rows: Record<string, unknown>[] }>`:
- `prod_daily_layers`: `readAllPaged` with `.gte('date', month+'-01').lt('date', nextMonth+'-01')` (nextMonth = month+1 computed from the 'yyyy-MM-01' date — never string-math the month digits). Keep one row per `date|email`: `layer === 'effective'` wins; when no effective row exists for that key use `layer` null/`'raw'`.
- `qa_audits`: `readAllPaged` with `.gte('audit_date', month+'-01').lt('audit_date', nextMonth+'-01')`; keep rows `kind === 'audit'` and `status` null/`!== 'voided'` (all sources incl. offqueue — they still measure the agent). `audits` = count per `audit_date|scEmail_(agent_email)`; `score_x_audits` += `scPct100_(score_final ?? score)` per row.
- `roster`: `readStore('roster').rows` -> `email -> name` map; row `name` = roster name, else layer `agentName`, else `''`.
- Row per `date|email` union of layer keys + audit keys: layer key -> `matrix_day:1` + the six target/achieved numbers (`Number()` each, 0 default); audit-only key -> `matrix_day:0`, zero metrics (same semantics as scBuildDaily_ fcr-only `zero()` rows). `fcr_passed/fcr_failed/fcr_excluded = 0`. Sort `date` then `email` like scBuildDaily_.
Out of scope: fcr preservation, sc_replace/writes, deleting the sheet path (all W2-SC-02), any file besides the two listed.

### Actions
1. Write `scDailyRowsDb_` per contract (layer preference + audit aggregation + name map + union rows + sort).
2. Test: fixture layers (effective + raw + another-month row excluded) -> expected rows incl. effective-beats-raw.
3. Test: fixture audits (2 same day/agent, 1 voided, 1 kind!=audit, 1 offqueue kept, score_final-null->score, 0.92->92 pct normalization).
4. Test: audit-only agent-day -> matrix_day 0 row with audits/score; roster name beats layer agentName.
5. Run targeted vitest + tsc.

### Done when
- `scDailyRowsDb_` returns contract rows for fixtures; new tests green; `npx tsc --noEmit` clean.

### Verify
- Run: `npx vitest run tests/platform/sc-daily-db.test.ts && npx tsc --noEmit` -> pass / 0 errors.

### Handoff
`scDailyRowsDb_` is the read seam W2-SC-02 wires into `scRefreshMonth_`.
Write results/W2-SC-01.md (<=10 lines); TL alone updates TRACKER.md.

## W2-SC-02: scRefreshMonth_ rewired to DB + FCR preserved + sheet readers deleted
Kind: mini
ID: W2-SC-02
Parent: W2-SC
Owner: dev
Depends: W2-SC-01
Criteria: PLAN Amendment 4 #1 (zero sheet reads; FCR stored verdicts preserved; sc_behaviour read from DB)
Skills: none
Budget: files=3; actions=8; changed_lines=320; minutes=10

### Goal
`scRefreshMonth_` rebuilds via `scDailyRowsDb_`, merges the month's stored
`fcr_*` verdicts into the rebuild (no live source — accepted), stops touching
`sc_behaviour`, and every sheet-reading symbol (`fetchWorkbookTabs` import,
`scReadWorkbook_`, `scHeaders_`, `scColumn_`, `scInspect_`, both `sheetCreds`
gates) leaves the codebase. `saveScorecardSource` becomes a config-only write.

### Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | refresh rewire (:453-513), deletes, saveScorecardSource (:619-638), jobScorecardNightly gate (:533-546), docstring :3-16
- Edit: `src/app/api/cron/scorecard-nightly/route.ts` | drop `sheetCreds` import + gate (:5, 33-42 -> plain dqStep_ call)
- Edit: `tests/platform/sc-daily-db.test.ts` | add scMergeFcr_ + refresh-path cases

### Context
- `src/features/cx-people/lib/scorecard-server.ts:453-513` | current `scRefreshMonth_` — keep the `fail()` machinery, `scMonthRowsDb_`, `scMonthUpsert_`, `scReplaceMonth_('sc_daily',...)`, computed_at stamp and all meta fields
- `src/features/cx-people/lib/scorecard-server.ts:591-616` | `scInspect_` to delete; `saveScorecardSource`'s inspect block :626-632
- `src/features/cx-people/lib/scorecard-server.ts:382-395` | `scHeaders_`/`scColumn_` private helpers — dead once `scReadWorkbook_` goes
- `src/app/api/cron/scorecard-nightly/route.ts:5,33-42` | the creds gate (now wrong: no sheets needed)
- `src/features/cx-queue/lib/heatmap.ts` | DO NOT TOUCH — W2-HM owns it

### Contract
- `scRefreshMonth_`: replace the `src.id` gate + `fetchWorkbookTabs`/`scReadWorkbook_` block with `const built = await scDailyRowsDb_(month)` inside the existing try (fail message 'Could not rebuild from the database: <msg>.'). Keep `meta.workbook_id = src.id` for display compat.
- New pure-ish merge inside the same file: read stored `sc_daily` for the month BEFORE replace; build `key = date+'|'+email -> {fcr_passed,fcr_failed,fcr_excluded,name}`; each built row at a stored key inherits those fcr counts; stored keys absent from the rebuild append as zero rows (`matrix_day:0`, metrics 0, audits 0, kept name + fcr counts). `meta.fcr_rows` = total preserved verdicts; `meta.fcr_dated = ''`; `meta.fcr_note = 'Stored FCR verdicts preserved on rebuild (no live source).'`.
- `sc_behaviour` is NOT replaced/deleted — the refresh leaves it alone; `meta.behaviour_found = 1`, `meta.behaviour_cases` = count of the month's `sc_behaviour` rows (`select('*',{count:'exact',head:true}).eq('month',month)`), `meta.behaviour_note = 'Managed via the admin behaviour form.'`.
- Never-wipe invariant kept: `!merged.rows.some(r => r.matrix_day)` -> `fail('No prod_daily_layers rows dated in ' + month + ' — earlier data for this month is kept.')`.
- `meta.title = 'DB rebuild (prod_daily_layers + qa_audits)'`; all other meta fields as today.
- Deletions: `fetchWorkbookTabs`/`sheetCreds` import (:33), `scInspect_`, `scReadWorkbook_`, `scHeaders_`, `scColumn_`, `jobScorecardNightly`'s sheetCreds gate (function returns `{ configured: true, months: await scNightly_() }` unconditionally), route.ts's identical gate. `saveScorecardSource` keeps `scMonthOk_` + `scSheetId_` validation + `setConfig('productivity_files', …)`; drops the inspect call + `found` (returns `{ month, workbookId: id, saved: true }`); keep `removeScorecardSource` unchanged. Update the file docstring (:3-16): the workbook seam is gone, tables are rebuilt from `prod_daily_layers`/`qa_audits`.
- KEEP (golden-pinned): `scParseMatrix_`, `scParseFcr_`, `scParseBehaviour_`, `scBuildDaily_`, `scSheetId_`, all `SC_*` consts.
Out of scope: agents-page.tsx + route.ts people/scorecard (SC-03/04), `prod_daily_layers`/`qa_audits`/`roster` writers, `fcr_daily` reads (no live FCR source per DECISION), heatmap/tlqueue/admin files.

### Actions
1. Swap the refresh read block to `scDailyRowsDb_` + stored-fcr snapshot + merge.
2. sc_behaviour replace call -> untouched; behaviour meta fields per contract.
3. Delete `scInspect_`; `saveScorecardSource` drops the inspect/`found` block.
4. Delete `scReadWorkbook_` + `scHeaders_` + `scColumn_` + the sheets import.
5. Drop both `sheetCreds` gates (jobScorecardNightly + cron route) and their imports.
6. Update file + route docstrings to the DB-rebuild reality.
7. Test: `scMergeFcr_` (or the refresh path under mocks) — stored verdicts land on rebuilt rows; orphan fcr-only key preserved as zero row; sc_behaviour never written; meta fields per contract.
8. `npx tsc --noEmit` + targeted vitest + `rg "fetchWorkbookTabs|sheetCreds" src/features/cx-people` -> 0 hits.

### Done when
- `rg "fetchWorkbookTabs|sheetCreds|scInspect_|scReadWorkbook_" src/features/cx-people` -> empty.
- Rebuild preserves stored fcr counts by (date,email) incl. orphan keys; sc_behaviour untouched by refresh.
- Golden + new tests green; tsc clean.

### Verify
- Run: `npx vitest run tests/platform/sc-daily-db.test.ts tests/golden/people.test.ts tests/golden/scorecard.test.ts && npx tsc --noEmit` -> pass / 0 errors.

### Handoff
scorecard-server is sheet-free; `addBehaviourCase` (SC-03) and the admin UI (SC-04) build on this tree. `deferred:` gone from this file — feeds W2-STRICT-01.
Write results/W2-SC-02.md (<=10 lines); TL alone updates TRACKER.md.

## W2-SC-03: addBehaviourCase — admin write into sc_behaviour (+ route op)
Kind: mini
ID: W2-SC-03
Parent: W2-SC
Owner: dev
Depends: W2-SC-02 (same files, serial)
Criteria: PLAN Amendment 4 #2 (admin Business Behaviour entry writes sc_behaviour)
Skills: none
Budget: files=3; actions=5; changed_lines=180; minutes=8

### Goal
A server function `addBehaviourCase` writes one business-behaviour case into
`sc_behaviour` (month derived from the date), exposed as `op:'add_behaviour'`
on the existing `/api/people/scorecard` route, with focused tests.

### Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | new `addBehaviourCase` near the other admin endpoints (~:574)
- Edit: `src/app/api/people/scorecard/route.ts` | add the `add_behaviour` op + import
- Create: `tests/platform/sc-behaviour.test.ts` | focused vitest (repo-mock pattern)

### Context
- `src/app/api/people/scorecard/route.ts:1-40` | the op dispatch shape (`refresh`/`save_source`/`remove_source`)
- `src/features/cx-people/lib/scorecard-server.ts:88-93,363-372` | `scMonthOk_`/`scDateOk_`/`scEmail_` validators + `db()`/`described` write pattern
- `supabase/migrations/20261109130415_dedupe_uniques_logs_ops.sql:142-153` | `sc_behaviour_month_date_email_note_uidx (month,date,email,note)` — duplicate insert collides on 23505
- `src/features/cx-people/lib/scorecard-server.ts:30-31` | `requireRole`/`assertWritable` gate pattern (`saveScorecardSource` is the twin)

### Contract
`export async function addBehaviourCase(input: { email?: unknown; date?: unknown; note?: unknown }): Promise<Record<string, unknown>>` —
`requireRole(['admin'])` + `assertWritable()`; `email = scEmail_(input.email)` (throw 'Give a valid agent email.'), `date` must satisfy `scDateOk_` (throw 'Date is yyyy-MM-dd.'), `note = String(input.note||'').trim()` length 1..500 (throw 'Note the behaviour in one line (1-500 chars).'). Insert `{ month: date.slice(0,7), date, email, note, submitted_by: user.email }` into `sc_behaviour`; on a 23505/conflict error return `{ saved: false, duplicate: true }` instead of throwing; other errors -> `described`. Return `{ saved: true, month, date, email }`.
Route: `op === 'add_behaviour'` -> `addBehaviourCase(body)`; default/error shape unchanged.
Out of scope: the UI form (W2-SC-04), edits/deletes of existing sc_behaviour rows, kpi_behaviour_log (separate manual log — untouched).

### Actions
1. Write `addBehaviourCase` per contract.
2. Wire `add_behaviour` into the route's op dispatch + import.
3. Test: happy path inserts the shaped row (mock db insert); invalid email/date/long note rejected before insert.
4. Test: 23505 -> `{saved:false, duplicate:true}`; other error -> described throw.
5. `npx tsc --noEmit` + targeted vitest.

### Done when
- POST {op:'add_behaviour', email, date, note} inserts the sc_behaviour row; duplicate returns `duplicate:true` without erroring; tests green; tsc clean.

### Verify
- Run: `npx vitest run tests/platform/sc-behaviour.test.ts && npx tsc --noEmit` -> pass / 0 errors.

### Handoff
`op:'add_behaviour'` + `addBehaviourCase` are the contract W2-SC-04's form calls.
Write results/W2-SC-03.md (<=10 lines); TL alone updates TRACKER.md.

## W2-SC-04: ScorecardAdmin UI — config-only source box + Business Behaviour form
Kind: mini
ID: W2-SC-04
Parent: W2-SC
Owner: dev
Depends: W2-SC-03 (route op) — serial on scorecard chain
Criteria: PLAN Amendment 4 #1/#2 (workbook-check copy + found panel removed; behaviour entry form)
Skills: none
Budget: files=1; actions=4; changed_lines=180; minutes=8

### Goal
The `ScorecardAdmin` block in agents-page.tsx matches the de-sheeted server:
no "check" promises, no `found` panel, and a new small "Log a business-behaviour
case" form posting `op:'add_behaviour'`.

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | `ScorecardAdmin` (:254-440) + the `api` seam object (:16-24)

### Context
- `src/features/cx-people/components/agents-page.tsx:254-361` | the block: `save`/`refresh`/`remove` runners, month+link form, `found` panel (:350-361), months table
- `src/features/cx-people/components/agents-page.tsx:16-24` | `api` seam — add `addBehaviour` beside `saveSource`/`removeSource`
- `src/features/cx-hub/components/admin-config-page.tsx:17-53` | fetchJson + PUT/POST pattern already proven for admin config writes
- `specs/ux-ui-audit-v3/PLAN.md` Phase 2 + `e2e/page-contract.spec.ts` | DoD contract — keep existing cx-* classes/labels; no new UI patterns (gate runs at PM level, not this leaf)

### Contract
- `api.addBehaviour = (email: string, date: string, note: string) => fetchJson('/api/people/scorecard', { op: 'add_behaviour', email, date, note })`.
- Source box: button text `Check and save` -> `Save` (no workbook is opened any more — saving records the month's workbook id for the month-keyed prefetch). Hint text updated: months' data now rebuilds from live tables on Refresh; the id only marks which month a workbook covers. Delete the `found` state + its note panel and the `setFound` call in `save` (response no longer carries `found`).
- New card inside the same block: 'Log a business-behaviour case' — three `Input`s (agent email `type="email"` required, `type="date"` required, note required, `maxLength={500}`) + `Button` submit; reuse the block's `run`/`note`/`noteErr`/`busyKey` machinery; on `{saved:true}` show 'Logged for <month>.' and clear inputs; on `duplicate` show 'Already logged.'; on error `noteErr`. Keep `cx-filters`/`cx-field`/`cx-label`/hint classes — same visual system, 375px-safe single-column fields.
Out of scope: the months table, refresh/remove actions, other page regions, any server file.

### Actions
1. Add `api.addBehaviour` to the seam object.
2. Reword the source-box button/hint; remove `found` state, its setter and the found panel JSX.
3. Add the behaviour form card (3 inputs + submit through `run('behaviour', …)`).
4. `npx tsc --noEmit` + `npx eslint src/features/cx-people/components/agents-page.tsx` clean.

### Done when
- No `found`/inspect copy remains; the source box saves config-only; the behaviour form posts `add_behaviour` and surfaces saved/duplicate/error; tsc + eslint clean.

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-people/components/agents-page.tsx` -> 0 errors.

### Handoff
Scorecard wave-2 surface complete; strict flip (W2-STRICT-01) unaffected by UI.
Write results/W2-SC-04.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
All four leaves done; `npx tsc --noEmit` + targeted vitest green; package
verified when `rg "fetchWorkbookTabs|sheetCreds" src/features/cx-people` is
empty and a rebuild of a fixture month keeps stored fcr_* while sc_behaviour
stays append-only via add_behaviour.
