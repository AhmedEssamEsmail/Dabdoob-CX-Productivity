# S07-02: FD_AUX -> aux_spans mapping (consumes the col_ keys)
Kind: mini
ID: S07-02
Parent: S07
Owner: dev
Depends: S07-01
Criteria: reshard row 1a; decisions-ops-tabs.md FD_AUX verdict
Skills: none
Budget: files=2; actions=5; changed_lines=160; minutes=10

## Goal
Author the FD_AUX -> aux_spans mapping in ops-tabs.ts (MAPPINGS entry +
ROW_TRANSFORMS['FD_AUX'] + DECISIONS rewrite) using S07-01's
`col_e/col_f/col_g` keys so the unlabeled E..G cells reach the verbatim
A..G `cols` array, plus a read-only scratch probe proving the keys carry
data.

## Files
- Edit: `src/features/shared/migration/mappings/ops-tabs.ts` | MAPPINGS append, ROW_TRANSFORMS append, DECISIONS blocked-line rewrite + module-header KNOWN-GAPS bullet
- Create: `migration/probe-fd-aux.ts` | one read-only scratch probe (~60 lines; migration/ is gitignored)

## Context
- `src/features/shared/migration/mappings/ops-tabs.ts:38-92,103-172` | MAPPINGS + transform patterns — the Transcript transform is the closest sibling
- `specs/migration-remaining/decisions-ops-tabs.md` FD_AUX section | verdict, dedupe rule, verbatim A..G column order
- `supabase/migrations/20261109134359_s06_new_tables.sql:21-28` | aux_spans DDL (id, dedupe_key, ts_ms, cols jsonb, synced_at)
- `results/S07-01.md` | exact key names emitted for blank headers
- `migration/migrate-all.ts` | env bootstrap + dynamic engine import pattern the probe reuses

## Contract
MAPPINGS entry: `{ spreadsheet: 'oct_workbook', sheet: 'FD_AUX',
table: 'aux_spans', columns: ['dedupe_key','cols','synced_at'],
upsertOn: 'dedupe_key', require: ['dedupe_key'] }`.
ROW_TRANSFORMS['FD_AUX'], guarded on
`ctx.spreadsheet==='oct_workbook' && ctx.table==='aux_spans'`: `row.cols` =
the seven verbatim cells in order [agent name, status name, start time,
end time, col_e, col_f, col_g] (null when absent); early-return when the
seven are empty so `require` drops blank rows; `row.dedupe_key` = sha1 of
the seven cells joined '|'; `row.synced_at` = now ISO; ts_ms left unset
('Start time' zone ambiguous — Transcript precedent). Rewrite the FD_AUX
DECISIONS string and the module-header KNOWN-GAPS bullet to the migrated
state; leave the agent_email bullet for S07-03.
Probe: dotenv `.env.local`, dynamic-import engine, `readSheet` on
oct_workbook `1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI` tab `FD_AUX`,
print row count + `Object.keys(row[0])` + one row's col_e/f/g values.
Out of scope: engine.ts (S07-01 owns it); qa_ctls/agent_email (S07-03);
validate.ts; tracker backfills; live runs (--write is a PM gate).

## Actions
1. Append the aux_spans MAPPINGS entry exactly per contract.
2. Append ROW_TRANSFORMS['FD_AUX'] per contract (sha1 import already exists).
3. Rewrite the FD_AUX DECISIONS string + header bullet to the migrated state.
4. Create probe-fd-aux.ts per contract.
5. `npx tsc --noEmit`, then run the probe into the log and confirm col_e/f/g data.

## Done when
- `npx tsc --noEmit` exits 0; probe exits 0 logging keys incl. col_e/col_f/col_g and a non-zero row count.
- DECISIONS records FD_AUX as migrated->aux_spans; no 'NO MAPPING AUTHORED (blocked)' text remains for it.

## Verify
- Run: `npx tsx migration/probe-fd-aux.ts > specs/migration-remaining/logs/s07-02-fdaux.log 2>&1; echo "exit=$?"; tail -c 1500 specs/migration-remaining/logs/s07-02-fdaux.log` -> exit=0; log shows col_e/f/g keys plus row count (~13k expected)

## Handoff
PM gate: `migrate-all --dry --tables aux_spans`, then live `--tables
aux_spans` AFTER the S06-04 migration file is applied. Write
results/S07-02.md (<=10 lines); TL updates TRACKER.md.
