# WP-14 — cx-operations module audit

Auditor: wave1-agent · HEAD `2ca871a` · Legacy: `../Operations_deprecated/Trackers.js` (802 lines, the module's only server file) · Extract: `.devin/work/extract/operations/` (`trackers` only — `escalation-matrix` confirmed unbuilt).

**Verdict: shipped, verbatim.** 7/7 public fns ported, 1/1 built pages verbatim, `escalation-matrix` placeholder is parity-correct. Golden oracle exists at HEAD (`operations.test.ts`, 159 tests) — WP-20's job is residual vectors, not authoring. Two ≤30-line defects fixed in this pass (page options-envelope crash; lost `patchTrackerFieldRow_` fail-closed). Three residual gaps → WP-F2/F3/F4.

## 1. Function matrix (Trackers.js → `src/features/cx-operations/lib/trackers.ts`)

### Public surface (`function name(` — no trailing underscore; all 7)

| Legacy fn (:line) | Port (:line) | API route | Class |
|---|---|---|---|
| `getTrackersPage` (613) | `getTrackersPage` (775) | `GET /api/trackers?t=` | PORTED — verbatim |
| `getTrackerRecords` (628) | `getTrackerRecords` (798) | `GET /api/trackers/records?tracker=` | PORTED — verbatim |
| `addTrackerRecord` (634) | `addTrackerRecord` (804) | `POST /api/trackers/records` | PORTED — verbatim |
| `addTrackerField` (646) | `addTrackerField` (816) | `POST /api/trackers/fields` | PORTED — verbatim |
| `updateTrackerField` (663) | `updateTrackerField` (833) | `PATCH /api/trackers/fields` | PORTED — verbatim |
| `createTracker` (709) | `createTracker` (871) | `POST /api/trackers` | PORTED — verbatim |
| `setupTrackers` (771) | `setupTrackers` (979) | `POST /api/trackers/setup` | PORTED — report shape diverges (documented, §5) |

Grepped the file myself (`^function [a-zA-Z0-9]+[^_]\(`): no other public fns. No `job*` fns → module has no HB jobs (see §4).

### Private helpers

| Legacy (:line) | Port (:line) | Note |
|---|---|---|
| `tf_`/`BUILTIN_TRACKERS` (46/53) | — | Seed data moved to `supabase/migrations/009_operations.sql` — **but only `trackers` rows were seeded; `tracker_fields` for the 5 built-ins exist nowhere** → WP-F2 |
| `slugId_` (94) | `slugId_` (111) | identical |
| `trackerValueHash_` (100) | `trackerValueHash_` (121) | identical; page mirror `Rn`/`Vt` (trackers-page.tsx:172-179) verbatim |
| `trackerListKey_`/`trackerDepKey_` (107/111) | (131/135) | identical — options-service keys `tracker.<id>.<field>[.<hash>]` |
| `rolesList_` (115) | `rolesList_` (139) | identical |
| `trackerIsReadOnly_` (120) | `trackerIsReadOnly_` (147) | identical — `access_mode!=='edit'` **or** refund-ledger spreadsheet id |
| `trackersSpreadsheet_` (128) | — | GAS-only (script-property spreadsheet); native → `tracker_records` |
| `seedTrackerRegistry_` (134) | — | replaced by migration 009 (partial) → WP-F2; port `trackerRegistry_` returns empty reg on missing tables (documented, test :597) |
| `trackerFromRow_` (162) | `trackerFromRow_` (155) | + `ownerEmail` surfaced (Postgres col exists; page never reads it — test strips for compare) |
| `trackerRegistry_` (176) | `trackerRegistry_` (179) | 5-min cache dropped — documented header comment; reads fresh every call |
| `dropTrackerCaches_` (201) | — | N/A (no caches ported) |
| `trackerOrThrow_`/`trackerPerms_`/`trackerSummary_` (207/213/220) | (210/216/223) | identical |
| `trackerSheet_`/`trackerHeaders_` (231/238) | `trackerIoFor_`/`io.headers` (356) | PORTED-AS `TrackerIo` seam (see §5 storage decision) |
| `mapTrackerColumns_` (248) | `mapTrackerColumns_` (380) | identical — header-TEXT mapping, fail-closed |
| `trackerCellOut_` (263) | `trackerCellOut_` (408) | tz pinned +3/Asia-Kuwait vs per-sheet tz — documented divergence (all sheets are Kuwait; fixture `scriptTz` covers it) |
| `trackerFieldsOut_`/`readTrackerData_` (276/284) | (364/424) | identical minus the 60-s row cache |
| `matchChoice_` (346) | `matchChoice_` (489) | returns `String(x)` vs raw element — documented (test :221) |
| `parseTrackerNumber_`/`validTrackerUrl_`/`validDateText_` (353/361/365) | (496/504/508) | identical |
| `validateTrackerRecord_` (376) | `validateTrackerRecord_` (519) | identical; `allOptions_()` now an injected param (testability) — callers pass `await allOptions()` |
| `refuseTrackerWrite_` (426) | `refuseTrackerWrite_` (574) | identical |
| `ensureTrackerSystemColumns_` (433) | (581) | identical via `io.appendHeaders` (native is a no-op — all headers exist at creation) |
| `nextFormattedId_` (450) | `io.maxFormattedId` + `format.replace('{n}')` (623) | PORTED-AS; identical regex/max+1 |
| `newTrackerRecordId_` (463) | `newTrackerRecordId_` (595) | `newId('')` (time+rand base36) vs `Utilities.getUuid()` — same `TRK-…` shape, different entropy |
| `writeTrackerRow_` (471) | `writeTrackerRow_` (604) | contiguous-run cell write collapses to `io.append({recordId,submittedBy,submittedAt,values})` — mapped cells only; `actor_name` stamp preserved |
| `withLock_` (Repo.js:220) | — | **no equivalent** — concurrent native writes can collide on `row_n` → WP-F3 |
| `seedFieldChoices_`/`cleanChoiceList_`/`normaliseFieldDef_`/`uniqueFieldId_`/`addTrackerColumn_`/`registerTrackerFields_` (504–603) | (633/643/671/718/734/743) | identical; `cleanChoiceList_` non-array → `[]` vs TypeError (documented hardening); `addTrackerColumn_` gains a `native` branch; `registerTrackerFields_` adds submitted_by/at stamps |
| `patchTrackerFieldRow_` (686) | inline update (849) | **fixed this pass** — port now throws `'That field no longer exists. Reload the page.'` on a 0-row patch (was a silent no-op) |
| `viewAsGuard_` (Auth.js — in every write helper) | `assertWritable()` (viewas.ts:87) | called on all 5 mutating fns + inside `addOption`; ordering nuance: port refuses before validation, legacy on first sheet write — same refusal surface |
| `normEmail_`/`actorEmail_`/`requireRole_`/`currentUser_` (Auth.js) | `platform/identity.ts` | verbatim; `actorEmail` fallback `'system:trigger'` vs legacy `'system:<installer>'` — platform-level note (WP-17) |
| `allOptions_`/`optionsFor_`/`addOption_`/`OPTION_MAX_LEN` (Options.js) | `platform/options.ts` | verbatim port, shared |
| `ensureTable_`/`readTable_`/`appendRow_`/`getTable_`/`headersOf_`/`toCellValue_`/`normHeader_`/`isTrue_` (Repo.js) | `platform/repo.ts`/`stores.ts` | shared platform |

## 2. Page checklist

### `trackers` — `src/app/trackers/page.tsx` → `features/cx-operations/components/trackers-page.tsx` (877 lines)

vs `pages/trackers.closure.js` (`Un` + `Kt`/`Jn`/`Kn`/`er`/`Xn`/`ut`/`zn`/`Qn`/`Wt` helpers): **parity.**

- **Classes:** full inventory diffed by grep — identical (`trk-*` ×34, `field*`, `btn`, `input`, `select`, `req`, `sr-only`, `other-row`, `page page-fill trk-page`, `page-head trk-head`, plus computed `is-on`/`is-off`/`is-busy`/`trk-banner-error`/`trk-skel-*`/`trk-num`/`trk-misfit` all present with same predicates).
- **Copy:** all user-visible strings verbatim — purposes, `Vn` kind names/descriptions, `jn` hints, empty states (`No records yet. Add the first one with the form.` / `Nothing matches that search.`), view-only banner, headerProblems pause banner, `, newest 300 shown` / `, only the ones you added`, `Other: create a new tracker…`, ` (view only)`, misfit title `Kept as entered: not a valid …`, `Entered in the sheet`.
- **Element order / structure:** `Un` body byte-structural: page-head → switch select → error banner → `Kn` skeleton → `er` create form → `trk-body` (view_only banner → headerProblems banner → `trk-grid`[records: tools/table | `Xn` form]) → `Jn` dialog. `Bn` date format (`en-GB`, Asia/Kuwait) identical; `qe`/`NEW_TRACKER` sentinel, `?t=` hash param read, `We`/`Qn` misfit logic, `'#'+index` parent refs in `er`, `ve`/`Ce`/`de` options cache, dependent-clearing in `Xn`'s `f()` — all present.
- **`ee`/`oi` coverage: 6/6** — `getTrackersPage`→`GET /api/trackers`, `getTrackerRecords`→`GET …/records`, `addTrackerRecord`→`POST …/records`, `addTrackerField`→`POST …/fields`, `updateTrackerField`→`PATCH …/fields`, `createTracker`→`POST /api/trackers`. `setupTrackers` has no page caller (legacy identical — editor-run only; no extract references it).
- **Gate metadata:** registry `roles: [admin,tl,agent]`, `reqs: [16]` — `pageAllowed` default branch (roles only), matching legacy `Wt`.
- **Fix applied:** `G.getDropdownOptions` now unwraps the route's `{listKey, options}` envelope (was cast to `string[]` → `k.includes` TypeError on any listKey absent from `choices` — i.e., un-seeded dropdown/dependent keys). Mirrors `hub-shared.tsx:99`.

### `escalation-matrix` — placeholder parity ✓

- Extract has **no** `escalation-matrix` page (extract-notes: `operations | pt | 1 built | 2 registry | unbuilt: escalation-matrix`). No server fns exist for it (Trackers.js is the whole server file; `pt` dispatch maps only `trackers: Un`).
- Port: no `src/app/escalation-matrix/` dir → `[...slug]` catch-all finds the registry row (roles admin/tl, reqs [10]) and renders `UnbuiltPage` — byte-identical markup to legacy `tr`/`hs` (`.page` + `.page-head`/`h1.page-title#page-title`/`p.page-purpose` + `.pending > .pending-line` "Not built yet. Covers requirement 10 in the brief.").
- Role gate: agent → `pageAllowed` fails → AppShell redirect to fallback + `?from=` denied note — same as the legacy hash router dropping non-visible pages. **Parity-correct; do not build it.**

## 3. Gate matrix

| Route | Registry roles | Page gate | API gate | View-as write refusal |
|---|---|---|---|---|
| `/trackers` | admin,tl,agent | `pageAllowed` default→roles | — | — |
| `/escalation-matrix` | admin,tl | `pageAllowed` default→roles | — | — |
| `GET /api/trackers` | — | — | `requireRole([admin,tl,agent])` inside `getTrackersPage` | n/a |
| `POST /api/trackers` | — | — | `requireRole([admin,tl])` inside `createTracker` | `assertWritable()` :873 |
| `GET /api/trackers/records` | — | — | `requireRole([admin,tl,agent])` | n/a |
| `POST /api/trackers/records` | — | — | `requireRole` + `trackerPerms_.add` + `refuseTrackerWrite_` | `assertWritable()` :809 |
| `POST /api/trackers/fields` | — | — | `requireRole` + `trackerPerms_.build` + `refuseTrackerWrite_` | `assertWritable()` :821 |
| `PATCH /api/trackers/fields` | — | — | same | `assertWritable()` :838 |
| `POST /api/trackers/setup` | — | — | `requireRole([admin])` | `assertWritable()` :981 |
| `GET/POST /api/options/[listKey]` | — | — | `currentEmail()` | `assertWritable()` inside `addOption` |

**`access_mode` enforcement (residual Q — answered):** complete. `trackerIsReadOnly_` = `access_mode!=='edit'` **or** `spreadsheet_id===REFUND_LEDGER_SPREADSHEET_ID` → `refuseTrackerWrite_` blocks every write path (add record, add field, update field) regardless of roles; `trackerPerms_` masks add/build on read-only; `trackerSummary_.accessMode='view_only'` drives the banner + hidden forms; refund ledger is refused by id even if the registry row lies. `viewer_roles`/`editor_roles`/`builder_roles` per tracker: `open=view||add`, `!viewAll` → rows filtered to `submittedBy===user.email`. Golden-covered (159 tests incl. perms ×4 roles, view-only refuses, agent-sees-own).

## 4. Jobs

None — `HB_NO_JOBS.operations = 'No scheduled jobs: trackers are read live when opened'` (`platform/health.ts:74`). Trackers.js has no `job*`/`run*` fns. ✓

## 5. Residual gaps

| # | Gap | Class | Evidence | Disposition |
|---|---|---|---|---|
| 1 | **`tracker_fields` for the 5 built-ins seeded nowhere** — `BUILTIN_TRACKERS` dropped; `009_operations.sql:66-79` seeds only the 5 `trackers` rows. Fresh env → fieldless built-ins until WP-32 migrates the `TrackerFields` tab (needs B2). | GAP | migration file; golden test documents at `operations.test.ts:597-614` | **WP-F2** |
| 2 | **`withLock_` absent** — concurrent `addTrackerRecord` on one native tracker can compute the same `row_n` (order noise only; `(tracker_id,record_id)` PK still protects ids; formatted-id races are external-adapter concerns). | GAP (low) | trackers.ts:604-630 vs Repo.js:220 | **WP-F3** |
| 3 | **External `storage_mode` cutover unspecified** — 009 comment says migrated rows go to `tracker_records` "storage stays 'external'", but `trackerIoFor_` (:357) fail-closes external reads when `sheetIo` is unset → backfilled rows unreachable. | DECISION PENDING | migration comment + :356-363 | **WP-F4** (decision for WP-32: flip `storage_mode→'native'` on backfill, or let the seam serve `tracker_records`) |
| 4 | `setupTrackers` report shape — joined string, no `'columns OK'`/`'MISSING <cols>'` segment; no registry re-seed step. | documented divergence | trackers.ts:1004; test :956-960 | recorded; re-seed part folds into WP-F2 |
| 5 | `trackerCellOut_` pins Asia/Kuwait (+3) vs per-spreadsheet tz. | documented divergence | trackers.ts:408-416 | recorded — every legacy sheet is Kuwait; `scriptTz` fixture pins it |
| 6 | `matchChoice_` returns `String(el)` vs raw element. | documented | test :221-229 | recorded — options store is strings-only in practice |
| 7 | `cleanChoiceList_` non-array → `[]` vs TypeError. | documented hardening | test :358-365 | recorded |
| 8 | `actorEmail` fallback `'system:trigger'` vs `'system:<installer-email>'`. | platform note | identity.ts:47-51 | WP-17 territory, noted |
| 9 | 5-min registry + 60-s row caches dropped (`TRACKER_REGISTRY_CACHE`, `cc_trk_rows_v1_*`, `dropTrackerCaches_`). | documented divergence | header comment :22-24 | recorded — Postgres reads are cheap; always-fresh is stricter than legacy |
| 10 | `newTrackerRecordId_` entropy `newId` (time+rand) vs UUID. | cosmetic | :595 | recorded — same `TRK-` shape, opaque id |
| 11 | `assertWritable` runs before validation (legacy refused on the first sheet write, i.e., after validation). | cosmetic ordering | :804-813 | recorded — same refusal surface, same message |
| 12 | Missing registry tables → empty registry (legacy lazily seeds built-ins). | documented | test :597 | subsumed by WP-F2 |

### `storage_mode` decision — recorded

**Hybrid, staged per D-DATA/D-GOOGLE:** `native` trackers are Postgres-internal end-to-end (`tracker_records`, one row per record, `values` jsonb keyed by field id — the Postgres answer to "one tab per tracker"). `external` (sheet-backed) trackers keep `storage_mode='external'` and read/write through the `TrackerIo` seam (`trackers.ts:252-311`): a `sheetIo` adapter is pluggable for live Sheets access, but **none is configured** — every external read/write fail-closes with a deterministic "source sheet cannot be reached" error, nothing fabricated (owner rule: honest, never guessed). WP-32 is the cutover vector: it backfills rows into `tracker_records`; the pending decision (WP-F4) is whether backfill also flips `storage_mode→'native'` or the seam learns to serve migrated externals. Golden `mkSheetIo` (ops-fakes.ts:111) proves the io contract byte-for-byte against the legacy sheet ops.

## 6. Golden vectors needed for WP-20

Owner's file already covers: every pure helper, `validateTrackerRecord_` happy+error table, `normaliseFieldDef_`, registry read paths, `readTrackerData_` (perms/fail-closed/tz/cap), page facades, `addTrackerRecord` incl. cell-parity, `addTrackerField`/`updateTrackerField` side-effects, `createTracker`, `setupTrackers` seeding. **Coercion branches enumerated** (`validateTrackerRecord_` :534-568; note — **there is no `bool` field type**: `TRACKER_USER_TYPES=['date','text','number','money','link','dropdown','dependent']`; boolean coercions live on registry rows — `isTrue(form_backed|required)` and `active`/`archived_at` truthiness — covered):

1. skip: `computed`/`auto` fields never read client input — **covered**.
2. empty→required throw / optional omit — **covered**.
3. `TRACKER_TEXT_MAX` 2000 boundary (2000 ok / 2001 throw) — **covered**.
4. `date`: `validDateText_` yyyy-mm-dd + real-day — **covered**; value stays **string**.
5. `number`/`money`: `parseTrackerNumber_` (numeric passthrough, `1,234.5` grouping strip, `12,5`/`12 KD`→null) — **covered**; result stored as **number**. `money` decimal cap counts chars after `.` **in the raw string** — add vectors `1,234.500` (passes, dec=3) and `1,234.5000` (throws, dec=4).
6. `link`: `validTrackerUrl_` — **covered**.
7. `dropdown`: `matchChoice_` canonical spelling or throw — **covered** incl. inactive option.
8. `dependent`: parent-exists → parent-answered → depKey list match — **covered** incl. orphan parent.
9. `text`/unknown: passthrough trimmed — **covered**.
10. unknown input key → throw — **covered**.

Residual vectors worth adding:

- **View-as refusal on all 5 write fns** (`VIEW_AS_READONLY`) — hub-fakes supports `view_as`; not currently covered anywhere in this file.
- **Native end-to-end**: `createTracker` → `addTrackerRecord` → `getTrackerRecords` via `nativeIo` (row_n ordering, `values` jsonb, `maxFormattedId` on native format).
- `updateTrackerField` child-protection (`X depends on Y… cannot change`), self-dependency, computed/auto-field refusal, nonexistent field — plus the new 0-row patch throw (WP-14 fix).
- `normaliseFieldDef_` `keptDep` path (dependent edit, no `choicesByParent` sent, keeps stored lists).
- `ensureTrackerSystemColumns_` external path: missing sys headers → `appendHeaders` lands at first blank-tail position.
- `readTrackerData_` boundaries: exactly 300 (not limited) vs 301; `outside` rows; `total` counted pre-slice; `submittedBy` case-fold.
- `trackerRegistry_` edges: `position` non-numeric→0, `column_header` fallback to `label`, `active` '' variants.
- `getTrackersPage`: chosen-tracker read throws → `error` string + `current:null`; `canCreate` false for agent.
- `setupTrackers`: unreachable tracker → error line in output; `OPTION_MAX_LEN`/`'other'`/dedupe skips; non-dropdown skipped.
- `addTrackerField` `'bound'` path (label matches an unmapped column header → no append).
- `addTrackerRecord`: `auto`≠`actor_name` field not written; `\r\n`→`\n` normalisation; `recordIdFormat` `{n}`=1 when no prior ids.
- dep-key option add round-trip (hashed `tracker.<id>.<field>.<hash>` list key via `addOption`).

## 7. Fixes shipped this WP (all inside `src/features/cx-operations/`)

| File | Change |
|---|---|
| `components/trackers-page.tsx:44-47` | `G.getDropdownOptions` unwraps `{listKey, options}` — fixes crash on un-seeded list keys (was casting the envelope to `string[]`) |
| `lib/trackers.ts:849-864` | `updateTrackerField` patch now `.select('field_id')` and throws `'That field no longer exists. Reload the page.'` on 0 matched rows — restores `patchTrackerFieldRow_` fail-closed semantics |
| `lib/trackers.ts:27,36` | dropped dead imports (`readRows`, `getConfig`, `setConfig`) |
| `lib/trackers.ts:280` | dropped unused `headers` param on native `appendHeaders` |

## 8. Gates (post-fix)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run` | **817 tests / 41 files / 0 failures** (`operations.test.ts` 159/159) |
| `npx eslint src/features/cx-operations` | **0 errors, 0 warnings** (was 4 warnings) |

## 9. Questions for the orchestrator

1. **WP-F4 (blocking WP-32/51):** external-tracker cutover — flip `storage_mode→'native'` when backfilling `tracker_records`, or teach the io seam to serve `tracker_records` for migrated externals? Owner rule (D-DATA: "migrate then continue in Supabase") favours the flip; the 009 comment ("storage stays 'external'") suggests provenance preservation. Needs owner decision or a WP-32 implementation note.
2. **WP-F2:** preferred seed mechanism for built-in `tracker_fields` — port `seedTrackerRegistry_` as an admin re-seed (keeps BUILTIN_TRACKERS in TS, self-heals), or extend a migration with ~57 INSERT rows (drift risk vs Trackers.js)?
3. The stray `nul` file at repo root (`?? nul` in `git status`, pre-existing) — not from this WP; leave or clean?
