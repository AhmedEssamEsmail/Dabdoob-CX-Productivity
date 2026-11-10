/**
 * S06-07 — v1_ops misc tabs → mappings/v1-ops-misc.ts.
 *
 * Source: v1_ops `1hul-T…` "Dabdoob CX Operations — Database" (same workbook
 * as v1-ops.ts / decisions-v1-ops.md). Covers the six tabs assigned to this
 * leaf: `Settings` (migrate), `TaskOccurrences` (NEW table created by
 * S06-04's 20261109134359_s06_new_tables.sql), and the four rejected tabs —
 * RoadmapVisibility, Tickets, IdentityPins, HardCases — which get DECISIONS
 * lines only, never mappings.
 *
 * Merge contract for S06-10 (engine.ts):
 *   1. Spread `MAPPINGS` into MODULE_MAPPINGS and `DECISIONS` into
 *      MAPPING_DECISIONS.
 *   2. No ROW_TRANSFORMS export: none of these tabs needs a synthetic cell —
 *      every mapped column has a verbatim sheet header (readSheet lowercases
 *      them, so camelCase ones map via sheetToDb).
 *
 * Runner hazards inherited from v1-ops.ts / people-core.ts: Sheets display
 * dates parse MDY and `updated_at`/`submitted_at` pass as raw strings into
 * timestamptz — flagged for the dry run.
 */
import 'server-only'
import type { TableMapping } from '../engine'

export const MAPPINGS: TableMapping[] = [
  {
    // `Settings` headers VERBATIM: key, value (decisions-v1-ops.md:55).
    // 17 data rows; keys seen: admin_email, tl1..tl3 — V1 TL-app config,
    // NOT the live V2 `config` table (PM gate: package non-goal "changing
    // settings values"). `value` stays text/jsonb-string — NUM_COLS entry
    // for 'value' was deliberately deleted engine-wide (queue-quality.ts:190
    // precedent; options.value 'Egypt' → NaN → null killed rows).
    spreadsheet: 'v1_ops', sheet: 'Settings', table: 'sched_config',
    columns: ['key', 'value'],
    upsertOn: 'key',
    require: ['key'],
  },
  {
    // `TaskOccurrences` headers VERBATIM: id, taskId, dueDate, status,
    // doneAt, note, updatedBy, updatedAt (decisions-v1-ops.md:62-71).
    // 353 colA rows incl. header. Occurrence-grain recurring-task rows —
    // the wrong grain for actions/action_updates/action_planned_milestones.
    // task_id joins actions.source_id of the S04-02 Tasks->actions rows.
    spreadsheet: 'v1_ops', sheet: 'TaskOccurrences', table: 'v1_task_occurrences',
    columns: ['occurrence_id', 'task_id', 'due_date', 'status', 'done_at',
      'note', 'updated_by', 'updated_at'],
    sheetToDb: {
      occurrence_id: 'id',
      task_id: 'taskid',
      due_date: 'duedate',
      done_at: 'doneat',
      updated_by: 'updatedby',
      updated_at: 'updatedat',
    },
    upsertOn: 'occurrence_id',
    require: ['occurrence_id', 'task_id'],
  },
]

export const DECISIONS: string[] = [
  'v1_ops:Settings (17 rows) -> sched_config; upsertOn key; verbatim key,value — V1 TL-app config (admin_email, tl1..tl3), NOT the live V2 config table (decisions-v1-ops.md:55-58; PM gate on settings values stands)',
  "v1_ops:TaskOccurrences (353 rows incl. header) -> v1_task_occurrences (NEW table, S06-04 migration 20261109134359_s06_new_tables.sql); upsertOn occurrence_id<-id; task_id<-taskid joins actions.source_id of the Tasks->actions rows; due_date<-duedate, status verbatim, done_at<-doneat, note, updated_by<-updatedby, updated_at<-updatedat (timestamptz)",
  'v1_ops:RoadmapVisibility REJECTED — empty store (header taskId,tl,sharedBy,sharedAt, 0 data rows); would-be holder actions.visibility is live state (decisions-v1-ops.md:77-78). No mapping emitted.',
  'v1_ops:Tickets REJECTED — empty store (header id,cust,ch,tl,days,cat,status,action,added, 0 data rows) and ⊆ the tickets data class (decisions-v1-ops.md:84-85). No mapping emitted.',
  'v1_ops:IdentityPins REJECTED — credential material (headers kind,key,pin,note, 21 data rows); secrets never land in DB per contract (decisions-v1-ops.md:75-76). No mapping emitted.',
  'v1_ops:HardCases REJECTED — empty store (header id,tl,ch,sum,pri,dec,stake,logged,status,resolvedDate,resolution, 0 data rows); would-be holder none (decisions-v1-ops.md:86-87). No mapping emitted.',
  'FLAG (both mappings): camelCase sheet headers arrive lowercased (taskid/duedate/doneat/updatedby/updatedat) and map via sheetToDb; due_date/done_at/updated_at pass raw sheet values — Sheets display dates parse MDY (people-core hazard #3), verify on dry run.',
]
