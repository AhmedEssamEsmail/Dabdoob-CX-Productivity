# fix-qa-5 — FIX leaves for reports/qa-5.md (qa-live-sheets-freeze)

Source report: `specs/qa-live-sheets-freeze/reports/qa-5.md`. One leaf per
finding; LOW qa-5-4 routed per PM instruction "all rows blocking" (split into
qa5-04 + qa5-05 to respect the 10-file cap).

## qa5-01: scDailyRowsDb_ reads the live snake_case prod_daily_layers columns
Kind: mini
ID: qa5-01
Parent: fix-qa-5
Owner: dev
Depends: none
Criteria: qa-5 report finding qa-5-1 (BLOCKER)
Skills: none
Budget: files=2; actions=3; changed_lines=80; minutes=8

### Goal
`scDailyRowsDb_` reads the real live `prod_daily_layers` shape — snake_case
columns (`inbound_target`, `agent_name`, … per env.ts `LAYER_COL_MAP`) — so
rebuilt sc_daily rows carry the actual metrics instead of all-zero + '' name.
The local migration DDL (20261031193219_domain_tables.sql:36-50) is stale
camelCase and must NOT be trusted as the column source.

### Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | inside `scDailyRowsDb_` only: the `readAllPaged('prod_daily_layers', …)` call (~:242) and the row reads at :292-296
- Edit: `tests/platform/sc-daily-db.test.ts` | `layer()` fixture helper + its per-test overrides (~:83-90, :110-116, :171-173, :248)

### Context
- `src/features/shared/jobs/env.ts:66-95` | `LAYER_COL_MAP` — canonical camel->snake write map; live columns are `agent_name`, `inbound_target`, `inbound_achieved`, `texting_target`, `texting_achieved`, `wa_target`, `wa_achieved`, `total_audits`, `avg_score`
- `src/app/api/prod/analytics/route.ts:66-69` | the existing snake->camel alias projection pattern on the same table
- `specs/perf-pushdown/results/layers-fix-01.md` | live evidence the remote table is snake_case (a 500 was fixed by aliasing `productive_min_resolution`)
- `src/features/shared/platform/repo.ts:199-217` | `readAllPaged` opts: `columns` select string, `build` filters; orders on PK `id` (exists on the table)
- `tests/platform/sc-daily-db.test.ts:30-34` | the mock's `select(_cols)` ignores the projection — fixture rows ARE the returned shape, so they must carry the real snake keys

### Contract
Inside `scDailyRowsDb_`, the prod_daily_layers read requests only the needed
columns and the row reads use the live snake names:
`columns: 'id,date,email,layer,agent_name,inbound_target,inbound_achieved,texting_target,texting_achieved,wa_target,wa_achieved'`
and `r.agent_name`, `r.inbound_target`, `r.inbound_achieved`, `r.texting_target`,
`r.texting_achieved`, `r.wa_target`, `r.wa_achieved` at :292-296.
(`r.date`, `r.email`, `r.layer` are already snake-compatible.) An aliased
`"camel":snake` projection keeping the camel reads is also acceptable ONLY if
the test mock is extended to apply the projection — prefer the direct snake
reads, they are what the test honestly exercises.
Fixture `layer()` emits the real snake shape (same key renames; `total_audits`,
`avg_score`); every call-site override key is renamed likewise.
Out of scope: qa_audits/roster reads, scMergeFcr_, the identical camel-trap in
`kpi/server.ts`/`cx-hub/lib/aggregates.ts` (report context — separate follow-up),
any migration file.

### Actions
1. scorecard-server.ts: add the `columns` projection to the prod_daily_layers `readAllPaged` call and switch the seven camel reads (:292 `agentName`, :294-296 six metric keys) to snake_case.
2. sc-daily-db.test.ts: convert `layer()` + overrides to snake keys (`agent_name`, `inbound_target`, `inbound_achieved`, `texting_target`, `texting_achieved`, `wa_target`, `wa_achieved`, `total_audits`, `avg_score`); fix comments naming camel keys.
3. Run the file's vitest; confirm rebuilt rows show nonzero metrics and the `agent_name` name fallback works ('Layer G' case).

### Done when
- No `r.inboundTarget` / `r.inboundAchieved` / `r.textingTarget` / `r.textingAchieved` / `r.waTarget` / `r.waAchieved` / `r.agentName` remains inside `scDailyRowsDb_`.
- `npx vitest run tests/platform/sc-daily-db.test.ts` passes with snake-shaped fixtures (a camel-read regression would now zero the metrics and fail).
- `npx tsc --noEmit` clean on the touched file.

### Verify
- Run: `npx vitest run tests/platform/sc-daily-db.test.ts` -> all pass, metrics nonzero

### Handoff
None. Write results/qa5-01.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.

## qa5-02: hmSourceCells_ pages tickets + tracker_records through readAllPaged
Kind: mini
ID: qa5-02
Parent: fix-qa-5
Owner: dev
Depends: none
Criteria: qa-5 report finding qa-5-2 (HIGH)
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=8

### Goal
`hmSourceCells_` stops silently truncating at PostgREST max-rows (~1000): the
`tickets` (8-week window on a ~65k table) and `tracker_records` (`wa_parcels`,
whole tracker ~2.3k rows) reads route through `readAllPaged` like the maqsam /
freshchat reads in the same function.

### Files
- Edit: `src/features/cx-queue/lib/heatmap.ts` | inside `hmSourceCells_` only: the `db().from('tickets')` block (:601-611) and `db().from('tracker_records')` block (:613-627)
- Edit: `tests/platform/hm-db-source.test.ts` | readAllPaged mock opts type + the Freshdesk/WA call assertions (:13, :41-54, :165-167)

### Context
- `src/features/shared/platform/repo.ts:196-217` | `readAllPaged(name, {pk, columns, build})` pages on PK order until a short page; throws `Error(error.message)` — same throw shape the replaced code had
- `src/features/cx-queue/lib/heatmap.ts:575-599` | the sibling maqsam/freshchat `readAllPaged` calls to mirror; `iso(ms)` helper at :578; grid emit loops at :608-627 stay unchanged
- `supabase/migrations/20261106151132_remote_reconcile.sql:153-162` | tickets has `id` bigint PK (default ordering works)
- `supabase/migrations/20261105172348_operations.sql:53-62` | tracker_records PK is (tracker_id, record_id); order by `row_n` (idx exists) — pass `pk: 'row_n'`
- `tests/platform/hm-db-source.test.ts:41-54,165-167` | pagedCalls records `{table, columns, filters}`; the current `waCall` assertion reads `h.dbCalls` and must move to `h.pagedCalls`

### Contract
Replace both `db().from().select()` blocks with `readAllPaged`:
- `readAllPaged('tickets', { columns: 'created_at,group_name,country', build: (q) => q.gte('created_at', iso(fromMs)).lt('created_at', iso(toMs)) })` — default `id` ordering replaces the created_at order (grid consumers are order-insensitive; each row is an independent add()).
- `readAllPaged('tracker_records', { columns: 'values', pk: 'row_n', build: (q) => q.eq('tracker_id', 'wa_parcels') })`.
The emitted Freshdesk/WA grids keep identical cells; `readAllPaged`'s throw
replaces the manual `if (error) throw` lines. The `db` import stays (used at
:138,:145). Out of scope: tlqueue `trackerRecords`/`ticketsSince` (report notes
them as pre-existing context only), any other heatmap function.

### Actions
1. heatmap.ts: swap the tickets read to `readAllPaged` with the created_at window build; drop `fdData/fdError` destructure in favour of the returned rows.
2. heatmap.ts: swap the tracker_records read to `readAllPaged` with `pk: 'row_n'` + `eq('tracker_id','wa_parcels')` build.
3. hm-db-source.test.ts: add `pk?: string` to the mocked readAllPaged opts, record `pk` in pagedCalls, and update the assertions — `tickets` paged call has gte/lt `created_at` bounds; `tracker_records` paged call has `eq tracker_id wa_parcels` + `pk === 'row_n'` (no dbCalls entries for either table).

### Done when
- No `db().from('tickets')` or `db().from('tracker_records')` remains in `hmSourceCells_`; both go through `readAllPaged`.
- `npx vitest run tests/platform/hm-db-source.test.ts` passes; all five grids still emit identical cells.
- `npx tsc --noEmit` clean on touched files.

### Verify
- Run: `npx vitest run tests/platform/hm-db-source.test.ts` -> all pass

### Handoff
None. Write results/qa5-02.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.

## qa5-03: note the missing bot flag on the DB-mirror Freshchat grid
Kind: mini
ID: qa5-03
Parent: fix-qa-5
Owner: dev
Depends: qa5-02 (same files — serial writer)
Criteria: qa-5 report finding qa-5-3 (MED)
Skills: none
Budget: files=2; actions=2; changed_lines=25; minutes=5

### Goal
`buildHeatmapFromSource` warns the admin that the freshchat mirror carries no
'Bot conversation flag', so bot-only chats are counted as demand — the engine's
bot exclusion can never fire on the synthesized grid.

### Files
- Edit: `src/features/cx-queue/lib/heatmap.ts` | inside `buildHeatmapFromSource` only (:640-652)
- Edit: `tests/platform/hm-db-source.test.ts` | `buildHeatmapFromSource` describe (:176-199) — one new case

### Context
- `src/features/cx-queue/lib/heatmap.ts:594-599,640-652` | the synthesized Freshchat grid always emits `''` for the bot column; `buildHeatmapFromSource` already pushes DB-path notes (`'Defaulted to the last 8 weeks…'` at :647) into `hm.notes` -> stored via `hm.notes.join(' ')`
- `src/features/cx-queue/lib/heatmap.ts:306-317` | the engine's bot exclusion `^yes$` + `bot` status can never fire — DO NOT edit `buildHeatmapFromRawTabs_`: it is a golden verbatim port (`tests/golden/queue-heatmap.test.ts` diffs notes cell-for-cell vs the legacy oracle)
- `tests/platform/hm-db-source.test.ts:185-198` | existing `buildHeatmapFromSource` case asserting `h.stored[0].notes`

### Contract
In `buildHeatmapFromSource`, capture the grids (`const cells = await
hmSourceCells_(...)` before `sheetBook(cells, 'db')`) and, when the Freshchat
grid has data rows (`(cells.Freshchat || []).length > 1`), push onto `hm.notes`
a line documenting the gap, e.g. `'Bot flag unavailable in the freshchat
mirror — bot-only chats are included.'` Keep the store/return shape unchanged.
Out of scope: the engine, `hmSourceCells_` internals, tlqueue, DECISION.md.

### Actions
1. heatmap.ts: hoist the `hmSourceCells_` result into `cells`, feed `sheetBook(cells, 'db')`, and push the bot-gap note onto `hm.notes` when the Freshchat grid has data rows.
2. hm-db-source.test.ts: add a case seeding one in-window `h.tables.freshchat` row, call `buildHeatmapFromSource`, assert `h.stored[0].notes` contains 'Bot flag unavailable' (and that the note is absent when no freshchat rows exist — optional second assertion in the same case).

### Done when
- A `buildHeatmapFromSource` run with freshchat mirror rows stores a notes line mentioning the bot-flag gap.
- `buildHeatmapFromRawTabs_` is byte-identical (no engine change — golden parity preserved).
- `npx vitest run tests/platform/hm-db-source.test.ts tests/golden/queue-heatmap.test.ts` passes.

### Verify
- Run: `npx vitest run tests/platform/hm-db-source.test.ts` -> all pass, new case green

### Handoff
None. Write results/qa5-03.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.

## qa5-04: move stray wave-2 result files into the spec results dir (batch 1)
Kind: mini
ID: qa5-04
Parent: fix-qa-5
Owner: dev
Depends: none
Criteria: qa-5 report finding qa-5-4 (LOW, routed as blocking)
Skills: none
Budget: files=6; actions=2; changed_lines=10; minutes=3

### Goal
Relocate the first six wave-2 result files that agents wrote to the untracked
repo-root `results/` into `specs/qa-live-sheets-freeze/results/` where leaf
evidence belongs.

### Files
- Edit: `specs/qa-live-sheets-freeze/results/W2-SC-02.md` | move-only: `mv results/W2-SC-02.md` here; no content change
- Edit: `specs/qa-live-sheets-freeze/results/W2-SC-03.md` | move-only: `mv results/W2-SC-03.md` here; no content change
- Edit: `specs/qa-live-sheets-freeze/results/W2-SC-04.md` | move-only: `mv results/W2-SC-04.md` here; no content change
- Edit: `specs/qa-live-sheets-freeze/results/W2-ADM-01.md` | move-only: `mv results/W2-ADM-01.md` here; no content change
- Edit: `specs/qa-live-sheets-freeze/results/W2-ADM-02.md` | move-only: `mv results/W2-ADM-02.md` here; no content change
- Edit: `specs/qa-live-sheets-freeze/results/W2-ADM-03.md` | move-only: `mv results/W2-ADM-03.md` here; no content change

### Context
- `specs/qa-live-sheets-freeze/reports/qa-5.md` row qa-5-4 | the 11 strays are `??`-untracked (verified `git status`); spec results dir already holds W2-SC-01/W2-TLQ-01
- `.devin/lessons.md` line "Leaf result files belong under specs/<slug>/results/" | the convention being restored

### Contract
Plain `mv` of the six files — no content edits, no deletes. All other files
under repo-root `results/` are tracked or foreign-owned: leave them exactly as
they are. Out of scope: anything not in the six paths above.

### Actions
1. `mv` the six files into `specs/qa-live-sheets-freeze/results/` (Git Bash).
2. Verify `git status --porcelain results/` no longer lists them and all six exist at the new path.

### Done when
- The six paths exist under `specs/qa-live-sheets-freeze/results/` and are gone from repo-root `results/`.
- `git status --porcelain | grep "results/W2-SC-0[234]\|results/W2-ADM-0"` returns nothing for repo-root.

### Verify
- Run: `ls results/W2-SC-02.md` -> fails; `ls specs/qa-live-sheets-freeze/results/W2-SC-02.md` -> exists

### Handoff
None. Write results/qa5-04.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.

## qa5-05: move stray wave-2 result files into the spec results dir (batch 2)
Kind: mini
ID: qa5-05
Parent: fix-qa-5
Owner: dev
Depends: none
Criteria: qa-5 report finding qa-5-4 (LOW, routed as blocking)
Skills: none
Budget: files=5; actions=2; changed_lines=10; minutes=3

### Goal
Relocate the remaining five wave-2 result files from untracked repo-root
`results/` into `specs/qa-live-sheets-freeze/results/`.

### Files
- Edit: `specs/qa-live-sheets-freeze/results/W2-FIX-01.md` | move-only: `mv results/W2-FIX-01.md` here; no content change
- Edit: `specs/qa-live-sheets-freeze/results/W2-FIX-02.md` | move-only: `mv results/W2-FIX-02.md` here; no content change
- Edit: `specs/qa-live-sheets-freeze/results/W2-HM-01.md` | move-only: `mv results/W2-HM-01.md` here; no content change
- Edit: `specs/qa-live-sheets-freeze/results/W2-HM-01-fix1.md` | move-only: `mv results/W2-HM-01-fix1.md` here; no content change
- Edit: `specs/qa-live-sheets-freeze/results/W2-STRICT-01.md` | move-only: `mv results/W2-STRICT-01.md` here; no content change

### Context
- `specs/qa-live-sheets-freeze/reports/qa-5.md` row qa-5-4 | same batch as qa5-04; all `??`-untracked
- `.devin/lessons.md` line "Leaf result files belong under specs/<slug>/results/" | the convention being restored

### Contract
Plain `mv` of the five files — no content edits, no deletes. All other files
under repo-root `results/` are tracked or foreign-owned: leave them exactly as
they are. Out of scope: anything not in the five paths above.

### Actions
1. `mv` the five files into `specs/qa-live-sheets-freeze/results/` (Git Bash).
2. Verify `git status --porcelain results/` no longer lists them and all five exist at the new path.

### Done when
- The five paths exist under `specs/qa-live-sheets-freeze/results/` and are gone from repo-root `results/`.
- `git status --porcelain results/` shows no `??` entries.

### Verify
- Run: `git status --porcelain results/` -> empty output

### Handoff
None. Write results/qa5-05.md (<=10 lines) under `specs/qa-live-sheets-freeze/results/`; TL alone updates TRACKER.md.
