/**
 * S06-05 — V1 ops workbook scheduling tabs -> sched_* mapping.
 *
 * Source: v1_ops `1hul-T…` "Dabdoob CX Operations — Database"
 * (specs/migration-remaining/decisions-v1-ops.md §"migrate: — scheduling").
 * These are the Scheduler.js stores ported from the `core` workbook — the
 * core precedent lives in mappings/queue-quality.ts (sched_* mappings +
 * schNotePack_/schLoadOffDays_/segments_json transforms). Tab names differ
 * (ShiftPlan vs sched_plan etc.) and headers differ (camelCase), so this
 * module re-declares the mappings with v1 sheetToDb pairs and sheet-keyed
 * transforms that replicate the core packing.
 *
 * Merge contract for S06-10 (engine.ts):
 *   1. Spread `MAPPINGS` into MODULE_MAPPINGS and `DECISIONS` into
 *      MAPPING_DECISIONS.
 *   2. Merge `ROW_TRANSFORMS` into the engine record — keys are the v1 tab
 *      names (ShiftPlan/ShiftOverrides/TeamLeads/TLOffDays/ShiftRequests),
 *      which do not collide with the core workbook's sched_* sheet keys;
 *      each fn self-guards on ctx.spreadsheet === 'v1_ops'.
 *
 * Inherited hazards (see v1-ops.ts / queue-quality.ts DECISIONS): `tl` /
 * `withTl` hold DISPLAY NAMES, not emails, into *_email columns; TeamLeads
 * is the name->email reference (5 TLs). sched_plan.segments_json is
 * reconstructed from budget columns, not original data.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import type { TableMapping } from '../engine'

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex')

/** S09-01: content-hash dedupe keys — '<prefix>'+sha1(identity cells joined
 *  '|'); positional fallback when every identity cell is empty. */
const dedupeKey_ = (prefix: string, index: number, cells: unknown[]): string => {
  if (cells.every((v) => String(v ?? '') === '')) return prefix + index
  return prefix + sha1(cells.map((v) => String(v ?? '')).join('|'))
}

export const MAPPINGS: TableMapping[] = [
  {
    // ShiftPlan hdr (probe): month,date,tl,shift,role,start,end,queueH,
    // peopleH,taskH,tasks,savedAt -> sched_plan. No natural key (S02-03) —
    // upsertOn dedupe_key minted 'v1-mig-'+sha1(month|tl|date|shift|variant)
    // by ROW_TRANSFORMS (S09-01; `tl` is the raw key sheetToDb maps to
    // tl_email — transforms run pre-mapRow on the raw sheet row).
    // wfh/variant land null (no v1 source cols).
    spreadsheet: 'v1_ops', sheet: 'ShiftPlan', table: 'sched_plan',
    columns: ['month', 'tl_email', 'date', 'shift', 'from', 'to', 'wfh',
      'segments_json', 'variant', 'submitted_by', 'submitted_at', 'imported_by',
      'dedupe_key'],
    sheetToDb: {
      tl_email: 'tl', from: 'start', to: 'end', submitted_at: 'savedat',
    },
    upsertOn: 'dedupe_key',
    require: ['tl_email', 'date'],
  },
  {
    // ShiftOverrides hdr: date,tl,shift,wfh,reason,setBy,setAt ->
    // sched_overrides. note = JSON {reason, wfh} packed by transform
    // (schNotePack_ precedent). Live DDL has no submitted_by/submitted_at
    // (007_queue.sql:118-122) — PM decision tl-8 NEEDS_USER (a): DROP the
    // audit columns; sheet setBy/setAt values are knowingly NOT migrated.
    spreadsheet: 'v1_ops', sheet: 'ShiftOverrides', table: 'sched_overrides',
    columns: ['tl_email', 'date', 'shift', 'note'],
    sheetToDb: { tl_email: 'tl' },
    upsertOn: 'tl_email,date',
    require: ['tl_email', 'date'],
  },
  {
    // TeamLeads hdr: name,email,startDate,endDate,note -> sched_team.
    // Real emails (unlike the tl display-name cols elsewhere). TRANSFORM:
    // extra_json = {start_date,end_date,note} — snake_case keys because the
    // ported reader (scheduler.ts:243) reads x.start_date; active=true when
    // enddate blank (core precedent).
    spreadsheet: 'v1_ops', sheet: 'TeamLeads', table: 'sched_team',
    columns: ['tl_email', 'name', 'active', 'extra_json'],
    sheetToDb: { tl_email: 'email' },
    upsertOn: 'tl_email',
    require: ['tl_email'],
  },
  {
    // TLOffDays hdr: tl,offDays,note,setBy,setAt,month -> sched_offdays.
    // TRANSFORM: date = '<month>:<offDays>' (schLoadOffDays_ format,
    // e.g. '2026-08:5,6'; blank month -> ':5,6' standing default).
    // Live DDL has only {tl_email,date} (007_queue.sql:114-117) — PM
    // decision tl-8 NEEDS_USER (a): DROP note/submitted_by/submitted_at;
    // sheet note/setBy/setAt values are knowingly NOT migrated.
    spreadsheet: 'v1_ops', sheet: 'TLOffDays', table: 'sched_offdays',
    columns: ['tl_email', 'date'],
    sheetToDb: { tl_email: 'tl' },
    upsertOn: 'tl_email,date',
    require: ['tl_email', 'date'],
  },
  {
    // ShiftRequests hdr: id,tl,type,subtype,dateFrom,dateTo,shift,withTl,
    // withShift,reason,status,requestedAt,decidedBy,decidedAt,note,
    // peerStatus,peerAt -> sched_requests. TRANSFORM (schNotePack_): the
    // sheet `note` holds the DECISION note -> decided_note; requester meta
    // packs into note JSON. submitted_by has no v1 source col -> null.
    spreadsheet: 'v1_ops', sheet: 'ShiftRequests', table: 'sched_requests',
    columns: ['request_id', 'type', 'from_email', 'to_email', 'date',
      'their_date', 'note', 'status', 'decided_by', 'decided_at',
      'decided_note', 'submitted_by', 'submitted_at'],
    sheetToDb: {
      request_id: 'id', from_email: 'tl', to_email: 'withtl',
      date: 'datefrom', their_date: 'dateto',
      decided_by: 'decidedby', decided_at: 'decidedat',
      submitted_at: 'requestedat',
    },
    upsertOn: 'request_id',
    require: ['request_id'],
  },
]

/** schTruthy_ equivalent for the packed wfh flag. */
const truthy_ = (v: unknown): boolean => {
  if (v === true) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'true' || s === 'yes' || s === '1'
}

type TransformCtx = { spreadsheet: string; table: string; index: number }
const guard_ = (ctx: TransformCtx, table: string) =>
  ctx.spreadsheet !== 'v1_ops' || ctx.table !== table

/**
 * Row transforms run on the RAW sheet row before mapRow (engine.ts:206-207).
 * Keys are v1 tab names — no collision with the core workbook's sched_*
 * sheet keys; each fn still self-guards on spreadsheet+table.
 */
export const ROW_TRANSFORMS: Record<
  string,
  (row: Record<string, unknown>, ctx: TransformCtx) => void
> = {
  // Rebuild segments_json from start + queueh/peopleh/taskh budgets
  // (sequential approximation — same as core sched_plan) and mint dedupe_key.
  ShiftPlan: (row, ctx) => {
    if (guard_(ctx, 'sched_plan')) return
    const num = (v: unknown) => { const n = Number(v); return isFinite(n) ? n : 0 }
    let h = num(row.start)
    const segs: { kind: string; from: number; to: number }[] = []
    const push = (kind: string, hours: number) => {
      if (hours > 0) { segs.push({ kind, from: h, to: h + hours }); h += hours }
    }
    push('queue', num(row.queueh))
    push('people', num(row.peopleh))
    push('task', num(row.taskh))
    if (segs.length) row.segments_json = JSON.stringify(segs)
    // S09-01: dedupe_key = 'v1-mig-'+sha1(month|tl_email|date|shift|variant)
    // matching the DDL dedupe group; `tl` is the raw sheet key that sheetToDb
    // maps to tl_email (transform runs pre-mapRow); variant has no v1 source
    // -> ''. Positional fallback when all identity cells are empty.
    if (row.dedupe_key === undefined || row.dedupe_key === null || row.dedupe_key === '')
      row.dedupe_key = dedupeKey_('v1-mig-', ctx.index, [
        row.month, row.tl, row.date, row.shift, row.variant,
      ])
  },
  // note = JSON {reason, wfh} (schNotePack_); setby/setat ride sheetToDb.
  ShiftOverrides: (row, ctx) => {
    if (guard_(ctx, 'sched_overrides')) return
    row.note = JSON.stringify({ reason: row.reason || '', wfh: truthy_(row.wfh) })
  },
  // extra_json packs startDate/endDate/note under the port's snake_case keys;
  // active defaults true when enddate blank (core sched_team precedent).
  TeamLeads: (row, ctx) => {
    if (guard_(ctx, 'sched_team')) return
    row.extra_json = JSON.stringify({
      start_date: row.startdate || '',
      end_date: row.enddate || '',
      note: row.note || '',
    })
    if (row.active === undefined || row.active === null || row.active === '') row.active = true
  },
  // date cell = '<month>:<offDays>' (schLoadOffDays_ format); blank month ->
  // ':<offDays>' standing default. offdays holds the day list ('5,6').
  TLOffDays: (row, ctx) => {
    if (guard_(ctx, 'sched_offdays')) return
    const off = String(row.offdays ?? '').trim()
    if (!off) return
    const month = String(row.month ?? '').trim().slice(0, 7)
    row.date = /^\d{4}-\d{2}$/.test(month) ? month + ':' + off : ':' + off
  },
  // sheet `note` = decision note -> decided_note (copied before overwrite);
  // requester meta packs into note JSON (snake_case keys, core precedent).
  ShiftRequests: (row, ctx) => {
    if (guard_(ctx, 'sched_requests')) return
    row.decided_note = row.note ?? ''
    row.note = JSON.stringify({
      subtype: row.subtype || '',
      shift: row.shift || '',
      with_shift: row.withshift || '',
      reason: row.reason || '',
      peer_status: row.peerstatus || '',
      peer_at: row.peerat || '',
    })
  },
}

export const DECISIONS: string[] = [
  'v1_ops:ShiftPlan (241 rows) -> sched_plan, upsertOn dedupe_key (v1-mig-+sha1(month|tl_email|date|shift|variant) minted by ROW_TRANSFORMS — no natural key, S02-03/S09-01); segments_json reconstructed from start+queueH/peopleH/taskH (approximation, core precedent); wfh/variant land null; FLAG tl=display name',
  'v1_ops:ShiftOverrides (127) -> sched_overrides, upsertOn tl_email,date; note=JSON{reason,wfh} via transform; PM decision tl-8 NEEDS_USER (a): submitted_by/submitted_at dropped (no live columns — 007_queue.sql:118-122), sheet setBy/setAt NOT migrated; FLAG tl=display name',
  'v1_ops:TeamLeads (6) -> sched_team, upsertOn tl_email; extra_json={start_date,end_date,note} snake_case to match the port reader (scheduler.ts), active=true when endDate blank; tl_email<-email are real emails',
  'v1_ops:TLOffDays (20) -> sched_offdays, upsertOn tl_email,date; date synthesized as \'<month>:<offDays>\' (schLoadOffDays_ format); PM decision tl-8 NEEDS_USER (a): note/submitted_by/submitted_at dropped (live DDL has only {tl_email,date} — 007_queue.sql:114-117), sheet note/setBy/setAt NOT migrated; FLAG tl=display name',
  'v1_ops:ShiftRequests (6) -> sched_requests, upsertOn request_id; decided_note<-raw note via transform (runs pre-mapRow, so sheetToDb cannot carry it — same mechanism as core sched_requests), note=JSON{subtype,shift,with_shift,reason,peer_status,peer_at} snake_case per core precedent; submitted_by has no v1 source -> null; FLAG tl/withTl=display names',
  'v1_ops:HourOverrides (1, header-only empty store) -> rejected per decisions-v1-ops.md; would-be holder sched_hour_overrides already mapped from the core workbook — no mapping emitted',
  'ROW_TRANSFORMS keys are v1 tab names (ShiftPlan etc.) — no collision with core sched_* sheet keys; each fn self-guards ctx.spreadsheet===\'v1_ops\' && table match',
]
