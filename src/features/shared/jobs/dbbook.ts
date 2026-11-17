/**
 * DB-backed workbook synthesis — rebuilds the legacy sheet grids
 * (`unknown[][]`, header row included, 1-based readers) entirely from the
 * mirror tables + config so engines and sheetBook() stay untouched.
 * Row 1 of every grid is a placeholder header: positional readers skip it.
 * Data rows ascend in source order (ts_ms). Missing tables read as an
 * empty sheet -> header-only grid.
 */
import 'server-only'

import { dqSetting_, dqWallToUtc_, prodDateKey_, type Cfg } from '@/features/shared/lib/adapters'
import { describeDbError, described } from '@/features/shared/lib/errors'
import { readAllPaged, type ReadAllPagedOptions } from '@/features/shared/platform/repo'
import { fdActivityCells_, freshchatCells_, maqsamCells_ } from './mirror-cells'

export interface DbBookCtx {
  cfg: Cfg
  sinceMs?: number
  month?: string | null
}

/** prodFileFor_ in reverse: month key whose productivity_files entry is `id`;
 * the fallback id (or no match) is ambiguous -> null. */
export function dbBookMonthForId_(id: string, cfg: Cfg): string | null {
  if (String(id) === String(dqSetting_(cfg, 'productivity_fallback_id'))) return null
  const files = (dqSetting_(cfg, 'productivity_files') || {}) as Record<string, unknown>
  for (const [month, fileId] of Object.entries(files)) {
    if (String(fileId) === String(id)) return month
  }
  return null
}

interface TsWindow {
  gte: number
  lt?: number
}

/** month set -> [month start, next month start) on ts_ms in data_tz;
 * else ts_ms >= sinceMs ?? 0. */
function windowFor_(ctx: DbBookCtx): TsWindow {
  if (ctx.month) {
    const dataTz = String(dqSetting_(ctx.cfg, 'data_tz'))
    const [y, m] = String(ctx.month).split('-').map(Number)
    const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
    return {
      gte: tphHourMs_(ctx.month + '-01', 0, dataTz),
      lt: tphHourMs_(next + '-01', 0, dataTz),
    }
  }
  return { gte: ctx.sinceMs ?? 0 }
}

function tsBuild_(w: TsWindow): NonNullable<ReadAllPagedOptions['build']> {
  return (q) => {
    const g = q.gte('ts_ms', w.gte)
    return w.lt === undefined ? g : g.lt('ts_ms', w.lt)
  }
}

function headerGrid_(labels: string[], rows: unknown[][]): unknown[][] {
  return [labels, ...rows]
}

/** Instant (ms) of hour h on date in tz — local twin of cx-productivity's
 * tphHourMs_ (shared/ cannot import feature modules; same dqWallToUtc_ math). */
function tphHourMs_(date: string, h: number, tz: string): number {
  const p = date.split('-').map(Number)
  return dqWallToUtc_(p[0], p[1], p[2], h, 0, 0, tz).getTime()
}

/** 'H:MM:SS' duration text -> seconds; anything else -> 0. */
function hmsToSec_(v: unknown): number {
  const m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(String(v ?? ''))
  if (!m) return 0
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

const MAQSAM_HEADER = ['', '', '', 'Started At', 'Ended At', 'Duration', 'Agent Email', 'Call State', 'Call Direction', 'Handling', 'Date', 'Handling Min']
const FRESHCHAT_HEADER = ['Initiated At', 'Status', 'Ref Key', 'Updated At', 'Resolved At', 'Channel', 'Conversation ID']
const ACTIVITIES_HEADER = ['Performed At', 'Ticket ID', 'Performer Name', 'Performer Type', 'Activity Type', 'Field Changed', 'New Value', 'Old Value', 'Group Name', '']

const MAQSAM_COLS = 'ts_ms,started_at,ended_at,duration,agent_email,state,direction,handling'
const FRESHCHAT_COLS = 'ts_ms,initiated_at,status,ref_key,updated_at,resolved_at,channel,conversation_id'
const ACTIVITIES_COLS = 'ts_ms,performed_at,ticket_id,performer_name,performer_type,activity_type,field_changed,new_value,old_value,group_name'

const QUALITY_HEADER = ['Agent Email', 'Call Date', 'Final Score']
const HEADCOUNT_HEADER = ['Employee ID', 'Name', '', 'Email', 'Freshdesk ID', 'Freshdesk Name', 'TL Name', 'TL Email']
const ASSUMPTIONS_HEADER = ['', '']
const AUX_EXC_HEADER = ['Agent Mail', 'Date', 'Aux', 'Duration']
const FD_AUX_HEADER = ['Agent Name', 'Status Name', 'Start Time', 'End Time', 'Email', 'Minutes', 'Date']

const QUALITY_COLS = 'agent_email,audit_date,score_final,score'
const HEADCOUNT_COLS = 'hr_id,name,email,freshdesk_id,freshdesk_name,tl_email'
const TRACKER_COLS = 'tracker_id,row_n,values'
const FD_AUX_COLS = 'cols'

type Row = Record<string, unknown>

/** missingOk_ equivalent: a missing store table reads as [] (header-only
 * grid); any other read error — timeout, 5xx, permission — throws a
 * described error so engines fail instead of computing on empty data. */
async function missingOk_(table: string, promise: Promise<Row[]>): Promise<Row[]> {
  try {
    return await promise
  } catch (e) {
    if (describeDbError(e, { table }).code === 'missing_store') return []
    throw described(e, { table })
  }
}

/** 'Maqsam Calls' — 12-cell rows ['','','', ...D..J mirror cells, K=date, L=handling decimal min].
 * handling stores fractional days -> *1440; absent -> 'H:MM:SS' duration fallback.
 * Ordered by ts_ms asc to match the sheet's append order the tail readers rely on. */
async function maqsamTab_(ctx: DbBookCtx): Promise<unknown[][]> {
  const rows = await missingOk_(
    'maqsam_calls',
    readAllPaged('maqsam_calls', {
      pk: 'ts_ms',
      columns: MAQSAM_COLS,
      build: tsBuild_(windowFor_(ctx)),
    })
  )
  return headerGrid_(
    MAQSAM_HEADER,
    rows.map((r) => {
      const started = Date.parse(String(r.started_at))
      const handling = Number(r.handling)
      const K = Number.isNaN(started) ? '' : new Date(started)
      const L = Number.isFinite(handling) ? handling * 1440 : hmsToSec_(r.duration) / 60
      return ['', '', '', ...maqsamCells_(r), K, L]
    })
  )
}

/** 'Freshchat' — 7-cell rows A..G, sinceMs bound on ts_ms. */
async function freshchatTab_(ctx: DbBookCtx): Promise<unknown[][]> {
  const rows = await missingOk_(
    'freshchat',
    readAllPaged('freshchat', {
      pk: 'ts_ms',
      columns: FRESHCHAT_COLS,
      build: tsBuild_({ gte: ctx.sinceMs ?? 0 }),
    })
  )
  return headerGrid_(FRESHCHAT_HEADER, rows.map((r) => freshchatCells_(r)))
}

/** 'Activities' — 10-cell rows A..J, sinceMs bound on ts_ms. */
async function activitiesTab_(ctx: DbBookCtx): Promise<unknown[][]> {
  const rows = await missingOk_(
    'fd_activities',
    readAllPaged('fd_activities', {
      pk: 'ts_ms',
      columns: ACTIVITIES_COLS,
      build: tsBuild_({ gte: ctx.sinceMs ?? 0 }),
    })
  )
  return headerGrid_(ACTIVITIES_HEADER, rows.map((r) => fdActivityCells_(r)))
}

/** 'Quality' — qa_audits A..C [email, audit_date text, score_final ?? score].
 * Month -> audit_date in [month, next month); else audit_date >= sinceMs date. */
async function qualityTab_(ctx: DbBookCtx): Promise<unknown[][]> {
  const build: NonNullable<ReadAllPagedOptions['build']> = (q) => {
    if (ctx.month) {
      const [y, m] = String(ctx.month).split('-').map(Number)
      const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
      return q.gte('audit_date', ctx.month + '-01').lt('audit_date', next + '-01')
    }
    if (ctx.sinceMs) {
      const tz = String(dqSetting_(ctx.cfg, 'data_tz')) || 'Africa/Cairo'
      const since = prodDateKey_(new Date(ctx.sinceMs), tz)
      if (since) return q.gte('audit_date', since)
    }
    return q
  }
  const rows = await missingOk_(
    'qa_audits',
    readAllPaged('qa_audits', { columns: QUALITY_COLS, build })
  )
  return headerGrid_(
    QUALITY_HEADER,
    rows.map((r) => [r.agent_email ?? '', r.audit_date ?? '', r.score_final ?? r.score ?? ''])
  )
}

/** 'Headcount' — roster A..H; tlName resolved once via an email->name map. */
async function headcountTab_(): Promise<unknown[][]> {
  const rows = await missingOk_('roster', readAllPaged('roster', { columns: HEADCOUNT_COLS }))
  const nameByEmail: Record<string, string> = {}
  for (const r of rows) {
    const e = String(r.email || '').trim().toLowerCase()
    if (e) nameByEmail[e] = String(r.name || '')
  }
  return headerGrid_(
    HEADCOUNT_HEADER,
    rows.map((r) => {
      const tlEmail = String(r.tl_email || '')
      const tlName = nameByEmail[tlEmail.trim().toLowerCase()] || ''
      return [
        r.hr_id || '', r.name || '', '', r.email || '',
        r.freshdesk_id || '', r.freshdesk_name || '', tlName, tlEmail,
      ]
    })
  )
}

/** 'Assumptions' — config prod_assumptions {mq,text,wa} -> B4/B5/B6 (grid rows 3/4/5, col B). */
function assumptionsTab_(ctx: DbBookCtx): unknown[][] {
  let a = dqSetting_(ctx.cfg, 'prod_assumptions')
  if (typeof a === 'string') {
    try {
      a = JSON.parse(a)
    } catch {
      a = undefined
    }
  }
  const m = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
  const grid: unknown[][] = [ASSUMPTIONS_HEADER]
  for (let i = 0; i < 6; i++) grid.push(['', ''])
  grid[3][1] = m.mq ?? ''
  grid[4][1] = m.text ?? ''
  grid[5][1] = m.wa ?? ''
  return grid
}

/** 'AUXes Exceptions' — tracker_records('aux_exceptions') values -> A..D, row_n order. */
async function auxExceptionsTab_(): Promise<unknown[][]> {
  const rows = await missingOk_(
    'tracker_records',
    readAllPaged('tracker_records', {
      pk: 'row_n',
      columns: TRACKER_COLS,
      build: (q) => q.eq('tracker_id', 'aux_exceptions'),
    })
  )
  return headerGrid_(
    AUX_EXC_HEADER,
    rows.map((r) => {
      const v = (r.values && typeof r.values === 'object' ? r.values : {}) as Record<string, unknown>
      return [v.agent_mail ?? '', v.date ?? '', v.aux ?? '', v.duration ?? '']
    })
  )
}

/** 'FD_AUX' — aux_spans.cols jsonb verbatim as the 7-cell row; table dropped by
 * 20261116175742 -> missingOk catch keeps the header-only grid. */
async function fdAuxTab_(ctx: DbBookCtx): Promise<unknown[][]> {
  const rows = await missingOk_(
    'aux_spans',
    readAllPaged('aux_spans', {
      pk: 'ts_ms',
      columns: FD_AUX_COLS,
      build: tsBuild_(windowFor_(ctx)),
    })
  )
  return headerGrid_(
    FD_AUX_HEADER,
    rows.map((r) => (Array.isArray(r.cols) ? (r.cols as unknown[]) : []))
  )
}

export async function dbBookTabCells_(tab: string, ctx: DbBookCtx): Promise<unknown[][]> {
  switch (tab) {
    case 'Maqsam Calls':
      return maqsamTab_(ctx)
    case 'Freshchat':
      return freshchatTab_(ctx)
    case 'Activities':
      return activitiesTab_(ctx)
    case 'Quality':
      return qualityTab_(ctx)
    case 'Headcount':
      return headcountTab_()
    case 'Assumptions':
      return assumptionsTab_(ctx)
    case 'AUXes Exceptions':
      return auxExceptionsTab_()
    case 'FD_AUX':
      return fdAuxTab_(ctx)
    default:
      throw new Error(`dbBookTabCells_: unknown tab '${tab}'`)
  }
}
