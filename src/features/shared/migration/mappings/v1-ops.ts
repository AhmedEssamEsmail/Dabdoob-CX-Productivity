/**
 * S04-02 — V1 ops workbook → actions mapping.
 *
 * Source: v1_ops `1hul-T…` "Dabdoob CX Operations — Database"
 * (specs/migration-remaining/source-inventory.md §2). The only task-shaped
 * tab is `Tasks` (18 data rows). This is the sanctioned substitute for the
 * never-ported legacy `importV1LeadTasks` (GATED G8,
 * specs/megaplan/audits/people.md:30).
 *
 * Merge contract for S05-01 (engine.ts):
 *   1. Add `v1_ops: '1hul-T…'` to SPREADSHEETS (full id lives in the
 *      inventory / env once shared to the SA).
 *   2. Spread `MAPPINGS` into MODULE_MAPPINGS and `DECISIONS` into
 *      MAPPING_DECISIONS.
 *   3. Merge `ROW_TRANSFORMS` into the engine record (same
 *      `{spreadsheet,table,index}` ctx shape; the 'Tasks' key is
 *      sheet-keyed and self-guards on spreadsheet/table).
 *
 * Runner hazards inherited from people-core.ts §"Runner hazards" (known,
 * not ours to fix here): every actions text col below is
 * `TEXT NOT NULL DEFAULT ''` and mapRow turns empty cells into null —
 * the pending engine NULL_AS_EMPTY/default-emission fix covers this
 * table family; transforms here only guarantee the synthetic cols.
 */
import 'server-only'
import type { TableMapping } from '../engine'

export const MAPPINGS: TableMapping[] = [
  {
    // `Tasks` headers VERBATIM (inventory §2): id, desc, who, pri, due,
    // status, notes, assigned, recurrence, lastDoneAt, roadmapId, source,
    // deliveredAt, estHours, comments, recurDay. Headers are lowercased by
    // readSheet, so camelCase ones map via sheetToDb.
    spreadsheet: 'v1_ops', sheet: 'Tasks', table: 'actions',
    columns: ['action_id', 'title', 'description', 'owner_email', 'assigned_by',
      'due_date', 'source_type', 'source_id', 'series_id', 'status',
      'track_as_task'],
    sheetToDb: {
      title: 'desc',
      description: 'notes',
      owner_email: 'who',
      assigned_by: 'assigned',
      due_date: 'due',
      source_id: 'id',
      series_id: 'roadmapid',
    },
    upsertOn: 'action_id',
    require: ['action_id', 'title'],
  },
]

/**
 * Row transforms run on the RAW sheet row before mapRow (engine.ts:202).
 * 'Tasks' is generic — the guard keeps the key inert for any other
 * spreadsheet that happens to have a Tasks tab.
 */
export const ROW_TRANSFORMS: Record<
  string,
  (row: Record<string, unknown>, ctx: { spreadsheet: string; table: string; index: number }) => void
> = {
  Tasks: (row, ctx) => {
    if (ctx.spreadsheet !== 'v1_ops' || ctx.table !== 'actions') return
    const id = String(row.id ?? '').trim()
    // action_id has no sheetToDb entry — mapRow reads the synthetic cell.
    // 'v1-' prefix namespaces V1 ids away from core actions.action_id.
    row.action_id = 'v1-' + (id || 'row' + ctx.index)
    row.source_type = 'v1'
    row.track_as_task = true
    const st = String(row.status ?? '').trim()
    row.status = st || 'open'
  },
}

export const DECISIONS: string[] = [
  'v1_ops:Tasks (18 rows, the only task-shaped tab) -> actions; TaskOccurrences (352 rows, occurrence-shaped: taskId/dueDate/doneAt) is NOT actions-mapped — it belongs to an occurrences/tasks leaf, not this table',
  'action_id synthesized in ROW_TRANSFORMS as v1-<id> (tab id column present; prefix namespaces vs core actions.action_id); empty id falls back to v1-row<index>',
  'source_type=v1 and track_as_task=true are constant cells set by the transform; status defaults to open when blank and otherwise passes VERBATIM — the inventory lists no status value domain, so no vocab normalization was applied (verify on dry-run; V1 used free-text like done/closed)',
  'series_id<-roadmapid groups roadmap-linked tasks; pri/estHours/recurDay/lastDoneAt/deliveredAt/comments/recurrence/source have no actions column (action_task_details + TaskOccurrences are separate scope)',
  'owner_email<-who and assigned_by<-assigned pass verbatim — V1 stored display names here, not guaranteed emails; due_date<-due passes raw and Sheets display dates parse MDY (people-core hazard #3) — both flagged for the S05-01 dry run',
]
