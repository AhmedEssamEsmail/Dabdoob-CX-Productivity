/** S03-02 — HCT roster master mapping: HCT Sheet1 -> dq_hct.
 * Headers are the verbatim Sheet1 headers recorded in
 * specs/migration-remaining/source-inventory.md §1 (readSheet lowercases
 * them but keeps spaces, hence the spaced sheetToDb values). The engine
 * wires `spreadsheet: 'hct'` into SPREADSHEETS/MODULE_MAPPINGS in S05-01. */
import 'server-only'
import type { TableMapping } from '../engine'

export const MAPPINGS: TableMapping[] = [
  {
    spreadsheet: 'hct', sheet: 'Sheet1', table: 'dq_hct',
    columns: ['name', 'email', 'position', 'department', 'section', 'manager',
      'status', 'lwd', 'hiringDate', 'fdId', 'fdName', 'maqsamName',
      'code', 'gender', 'contactNumber'],
    sheetToDb: {
      name: 'employee name', manager: 'direct repporter',
      hiringDate: 'hiring date', fdId: 'fresh desk id',
      fdName: 'freshdesk name', maqsamName: 'maqsam name',
      code: 'code', gender: 'gender', contactNumber: 'contact number',
    },
    upsertOn: 'email',
    require: ['email', 'name'],
  },
]

export const DECISIONS: string[] = [
  'Tab name Sheet1 comes from settings.ts roster_hct_ss_id ("tab Sheet1"); the S01-01 inventory confirms Sheet1 (53 data rows) and records Sheet2 (stale alt-layout copy) + Sheet3 (email->Agent name map) as ignored.',
  'Sheet header "Direct Repporter" is misspelled in the sheet itself — mapped verbatim to `manager` as lowercased "direct repporter" (readSheet lowercases only).',
  'Only columns A-S of Sheet1 are mapped; row-1 cols U-W hold a side-table header ("User ID, Name, Email") per the inventory and have no dq_hct columns.',
  '`code` is the HR ID and `contactNumber` is the mobile number; `position` was already mapped — existing dq_hct rows predate the new columns and are filled by the S07-01 backfill re-import.',
]
