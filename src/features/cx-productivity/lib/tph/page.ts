import { createAuthClient } from '@/lib/auth'
import { dqAddDays_, isTrue_, normEmail_, type Cfg } from '@/lib/prod/adapters'
import { prodSetting_, prodToday_ } from '@/lib/prod/engine'
import { describeDbError } from '@/lib/errors'
import {
  TPH_CALLS,
  TPH_OFF,
  TPH_PAST_JOB,
  TPH_SLOT_MIN,
  TPH_SLOTS,
  TPH_TREND_MAX_DAYS,
  tphAutoCases_,
  tphCallVariance_,
  tphCanEdit_,
  tphDaySummary_,
  tphDayTotals_,
  tphEligible_,
  tphParseSlot_,
  tphRebuiltCases_,
  tphResolveCases_,
  tphResolveSlots_,
  tphShifts_,
  tphTable_,
} from './index'

const PROD_JOB = 'jobProdDaily'

// The page-composition half of ProdTph.js: tphChannels_/tphActivities_/tphHours_/
// tphPeople_/tphShifts_/tphJson_/tphNowSlot_/tphDayCore_/getTphPage/getTphTrend/
// tphLastAuto_ — same response shapes, Supabase as the store.

export function tphChannels_(cfg: Cfg) {
  const list = (prodSetting_(cfg, 'tph_channels') || []) as { key: string; name?: string; kind?: string; groups?: unknown[] }[]
  return ([] as typeof list)
    .concat(list || [])
    .filter((c) => c && c.key && c.key !== TPH_OFF)
    .map((c) => ({
      key: String(c.key),
      name: String(c.name || c.key),
      kind: c.kind === 'chat' || c.kind === 'manual' ? c.kind : 'ticket',
      groups: ([] as string[]).concat((c.groups || []) as string[]).map(String),
    }))
}

export function tphActivities_(cfg: Cfg) {
  const list = (prodSetting_(cfg, 'tph_activities') || []) as { key: string; name?: string }[]
  return ([] as typeof list)
    .concat(list || [])
    .filter((a) => a && a.key && a.key !== TPH_OFF)
    .map((a) => ({ key: String(a.key), name: String(a.name || a.key) }))
}

export function tphHours_(cfg: Cfg): number[] {
  const v = ([] as unknown[]).concat((prodSetting_(cfg, 'tph_day_hours') || []) as unknown[])
  const a = Math.max(0, Math.min(23, Math.floor(Number(v[0]) || 0)))
  const b = Math.max(a + 1, Math.min(24, Math.floor(Number(v[1]) || 24)))
  const out: number[] = []
  for (let h = a; h < b; h++) out.push(h)
  return out
}

/** WFM seam — not linked yet, always {}. */
export function _tphShiftsUnused(): Record<string, unknown> {
  return {}
}

export function tphJson_<T>(v: unknown, dflt: T): T {
  if (v && typeof v === 'object') return v as T
  try {
    return JSON.parse(String(v || '')) as T
  } catch {
    return dflt
  }
}

export function tphNowSlot_(): number {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hh = Number(parts.find((p) => p.type === 'hour')?.value || 0)
  const mm = Number(parts.find((p) => p.type === 'minute')?.value || 0)
  return hh * 4 + Math.floor(mm / TPH_SLOT_MIN)
}

export interface TphPerson {
  email: string
  name: string
  tlEmail: string
  mine: boolean
}

export function tphPeople_(
  user: { email: string },
  dir: { by: Record<string, { email: string; name: string; tlEmail?: string; active?: boolean; role?: string }> }
): TphPerson[] {
  return Object.keys(dir.by)
    .map((k) => dir.by[k])
    .filter((p) => p.active && (p.role === 'agent' || p.role === 'specialist'))
    .map((p) => ({ email: p.email, name: p.name, tlEmail: p.tlEmail || '', mine: p.tlEmail === user.email }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name))
}

/* ---- store seams (prodRows_/dqReadTail_ over Supabase) ----------------- */

interface Row {
  [k: string]: unknown
}

export interface TphStore {
  cfg: Cfg
  dir: { by: Record<string, { email: string; name: string; tlEmail?: string; active?: boolean; role?: string }>
         name: (e: string) => string }
  days: Row[]        // prod_tph_days (all; filtered by date here)
  cases: Row[]       // prod_tph_cases
  touches: Row[]     // prod_tph_touches
  callsRows: Row[]   // prod_tph_calls
  tasks: Row[]       // prod_tph_tasks
  refreshLog: Row[]  // refresh_log tail
  /** Store reads that failed while assembling the store (missing table, ...). */
  storeErrors: string[]
}

export async function tphLoadStore_(): Promise<TphStore> {
  const supabase = await createAuthClient()
  const [cfgRes, rosterRes, daysRes, casesRes, touchesRes, callsRes, tasksRes, logRes] =
    await Promise.all([
      supabase.from('config').select('key, value'),
      supabase.from('roster').select('email, name, tl_email, role, active'),
      supabase.from('prod_tph_days').select('*').limit(20000),
      supabase.from('prod_tph_cases').select('*').limit(5000),
      supabase.from('prod_tph_touches').select('*').limit(5000),
      supabase.from('prod_tph_calls').select('*').limit(5000),
      supabase.from('prod_tph_tasks').select('*').limit(10000),
      supabase.from('refresh_log').select('*').order('started_at', { ascending: false }).limit(300),
    ])
  const storeErrors: string[] = []
  const mark = (table: string, res: { error: { message?: string } | null }) => {
    if (res.error) storeErrors.push(describeDbError(res.error, { table }).message)
  }
  mark('config', cfgRes)
  mark('roster', rosterRes)
  mark('prod_tph_days', daysRes)
  mark('prod_tph_cases', casesRes)
  mark('prod_tph_touches', touchesRes)
  mark('prod_tph_calls', callsRes)
  mark('prod_tph_tasks', tasksRes)
  mark('refresh_log', logRes)
  const cfg: Cfg = {}
  ;(cfgRes.data || []).forEach((r: { key: string; value: unknown }) => {
    cfg[r.key] = r.value
  })
  const by: TphStore['dir']['by'] = {}
  ;(rosterRes.data || []).forEach((r: { email: string; name: string; tl_email: string | null; role: string; active: boolean }) => {
    by[normEmail_(r.email)] = {
      email: normEmail_(r.email), name: r.name, tlEmail: r.tl_email || '', role: r.role, active: r.active,
    }
  })
  const dir = { by, name: (e: string) => by[normEmail_(e)]?.name || '' }
  return {
    cfg, dir,
    days: daysRes.data || [],
    cases: casesRes.data || [],
    touches: touchesRes.data || [],
    callsRows: callsRes.data || [],
    tasks: tasksRes.data || [],
    refreshLog: logRes.data || [],
    storeErrors,
  }
}

/* ---- tphDayCore_ -------------------------------------------------------- */

export function tphDayCore_(store: TphStore, d: string, today: string, hours: number[], keys: string[], people: TphPerson[]) {
  const from = hours[0] * 4
  const to = (hours[hours.length - 1] + 1) * 4
  const nowSlot = d === today ? tphNowSlot_() : TPH_SLOTS
  const shifts = tphShifts_(d)
  const days: Record<string, Row> = {}
  store.days.forEach((r) => {
    if (r.date === d) days[normEmail_(r.agent_email)] = r
  })
  const grid: Record<string, Record<number, { channel: string; calls: boolean; carried?: boolean } | null>> = {}
  const cells: Record<string, { c: string; calls: boolean; src: string }[]> = {}
  people.forEach((p) => {
    const row = days[p.email]
    const logged = tphJson_<Record<string, string>>(row && row.slots_json, {})
    const src = tphJson_<Record<string, string>>(row && row.sources_json, {})
    grid[p.email] = tphResolveSlots_(logged, from, to, nowSlot + 1, shifts[p.email] as never) as never
    cells[p.email] = []
    for (let s = from; s < to; s++) {
      const g = grid[p.email][s]
      cells[p.email].push(
        g
          ? { c: g.channel, calls: !!g.calls, src: g.carried ? 'carried' : String(src[s] || '').indexOf('task:') === 0 ? 'task' : 'grid' }
          : { c: '', calls: false, src: '' }
      )
    }
  })
  let tl: Record<string, unknown> = {}
  let autoRaw: Record<string, unknown> = {}
  let autoAsOf = ''
  let reb = null as { cells?: Record<string, { stock: unknown; new: unknown }>; reasons?: Record<string, string> } | null
  let rebAsOf = ''
  store.cases.forEach((r) => {
    if (r.date !== d) return
    if (r.source === 'tl') tl = tphJson_(r.cases_json, {})
    if (r.source === 'auto') { autoRaw = tphJson_(r.cases_json, {}); autoAsOf = String(r.at || '') }
    if (r.source === 'rebuilt') { reb = tphJson_(r.cases_json, {}); rebAsOf = String(r.at || '') }
  })
  const auto = tphAutoCases_(autoRaw as never, hours, keys)
  const rebuilt = tphRebuiltCases_(reb as never)
  const untilHour = d === today ? Math.floor(nowSlot / 4) + 1 : 24
  const cases = tphResolveCases_(tl, auto, hours, keys, untilHour, rebuilt as never)
  const touchRow = store.touches.filter((r) => r.date === d)[0]
  const callRow = store.callsRows.filter((r) => r.date === d)[0]
  const callMinutes = callRow ? tphJson_<Record<string, number>>(callRow.calls_json, {}) : null
  const table = tphTable_({
    hours, channels: keys, grid: grid as never, cases: cases as never,
    touches: touchRow ? tphJson_(touchRow.touches_json, null) : null,
    minutesPerCase: Number(prodSetting_(store.cfg, 'tph_minutes_per_case')),
    capWindowMin: Number(prodSetting_(store.cfg, 'tph_cap_window_min')),
    callsFactor: Number(prodSetting_(store.cfg, 'tph_calls_minute_factor')),
    callMinutes: callMinutes as never,
  })
  return { from, nowSlot, shifts, grid, cells, tl, auto, autoAsOf, reb, rebAsOf, cases,
    touchRow, callRow, callMinutes, table, hasCases: !!(reb || autoAsOf || Object.keys(tl).length) }
}

/* ---- tphLastAuto_ ------------------------------------------------------- */

export function tphLastAuto_(store: TphStore) {
  try {
    for (let i = 0; i < store.refreshLog.length; i++) {
      const r = store.refreshLog[i]
      const job = String(r.job || '')
      const note = String(r.note || '')
      const daily =
        (job === 'prod_tph_touches' || job === 'prod_tph_calls' || job === 'prod_tph_cases_rebuilt') &&
        note.indexOf(' by ') === -1
      if (job !== 'prod_tph_auto' && !daily) continue
      const at = r.finished_at || r.started_at
      return {
        at: at instanceof Date ? at.toISOString() : String(at || ''),
        job: job === 'prod_tph_auto' ? TPH_PAST_JOB : PROD_JOB,
        status: String(r.status || ''),
        note: note.slice(0, 300),
      }
    }
  } catch { /* no log */ }
  return null
}

/* ---- getTphPage --------------------------------------------------------- */

export function getTphPage(
  store: TphStore,
  user: { role: string; email: string },
  date: unknown
): Record<string, unknown> {
  const today = prodToday_(store.cfg)
  const d = /^\d{4}-\d\d-\d\d$/.test(String(date || '')) && String(date) <= today ? String(date) : today
  const channels = tphChannels_(store.cfg)
  const keys = channels.map((c) => c.key)
  const hours = tphHours_(store.cfg)
  const people = tphPeople_(user, store.dir)
  const x = tphDayCore_(store, d, today, hours, keys, people)
  const { cells, tl, auto, autoAsOf, reb, rebAsOf, cases, touchRow, callRow, callMinutes, grid, nowSlot } = x
  const table = x.table.map((r: { agents: { name?: string; email: string }[] }) => {
    r.agents.forEach((a) => { a.name = store.dir.name(a.email) })
    return r
  })
  const eligDays = Number(prodSetting_(store.cfg, 'tph_eligible_days') || 28)
  const elig = tphEligible_(store.touches as never, dqAddDays_(today, -eligDays))
  const tasks = store.tasks
    .filter((t) => t.date === d && !isTrue_(t.removed))
    .map((t) => ({
      taskId: String(t.task_id), email: normEmail_(t.agent_email), name: store.dir.name(t.agent_email as string),
      channel: tphParseSlot_(t.channel).primary, calls: tphParseSlot_(t.channel).calls,
      start: String(t.start), end: String(t.end), by: store.dir.name(t.by as string),
    }))
    .sort((a, b) => a.start.localeCompare(b.start))
  const tlDays = Number(prodSetting_(store.cfg, 'tph_tl_edit_days'))
  return {
    date: d, today, slotMin: TPH_SLOT_MIN, hours, firstSlot: x.from, nowSlot: d === today ? nowSlot : null,
    channels: channels.map((c) => ({ key: c.key, name: c.name, kind: c.kind, groups: c.groups })),
    activities: tphActivities_(store.cfg), off: TPH_OFF,
    agents: people, cells, tasks, table,
    cases: hours.map((h) => ({
      hour: h,
      byChannel: keys.reduce((m: Record<string, unknown>, k) => {
        const c = (cases as Record<string, { cases: number; source: string }>)[h + '|' + k]
        const rc = reb && reb.cells && reb.cells[h + '|' + k]
        m[k] = {
          cases: c ? c.cases : null, source: c ? c.source : '',
          tl: tl[h + '|' + k] === undefined || tl[h + '|' + k] === '' ? null : Number(tl[h + '|' + k]),
          auto: auto[h + '|' + k] === undefined ? null : auto[h + '|' + k],
          rebuilt: rc ? { stock: Number(rc.stock) || 0, new: Number(rc.new) || 0 } : null,
        }
        return m
      }, {}),
    })),
    eligible: channels.map((c) => ({
      channel: c.key,
      agents: ((elig as Record<string, { email: string; touches: number }[]>)[c.key] || []).map((a) => ({
        email: a.email, name: store.dir.name(a.email), touches: a.touches,
      })),
    })),
    eligibleDays: eligDays,
    minutesPerCase: Number(prodSetting_(store.cfg, 'tph_minutes_per_case')),
    callsFactor: Number(prodSetting_(store.cfg, 'tph_calls_minute_factor')),
    capWindowMin: Number(prodSetting_(store.cfg, 'tph_cap_window_min')),
    callsBasis: callRow ? 'actual' : 'estimate',
    callsAsOf: callRow ? String(callRow.computed_at || '') : '',
    callMinutes,
    callVariance: tphCallVariance_(grid as never, callMinutes as never, hours, TPH_CALLS).map((v: { email: string; name?: string }) => {
      v.name = store.dir.name(v.email); return v
    }),
    dayTotals: tphDayTotals_(table as never).map((t: { email: string; name?: string }) => {
      t.name = store.dir.name(t.email); return t
    }),
    rebuiltAsOf: rebAsOf, rebuiltReasons: (reb && reb.reasons) || {},
    hasCases: x.hasCases, autoAsOf,
    touchesReady: !!touchRow, touchesAsOf: touchRow ? String(touchRow.computed_at || '') : '',
    shiftsLinked: Object.keys(x.shifts).length > 0,
    canEdit: tphCanEdit_(user.role, d, today, tlDays), tlEditDays: tlDays,
    isAdmin: user.role === 'admin', lastAuto: tphLastAuto_(store),
    storeErrors: store.storeErrors || [],
  }
}

/* ---- getTphTrend -------------------------------------------------------- */

export function getTphTrend(
  store: TphStore,
  user: { role: string; email: string },
  from: unknown,
  to: unknown
): Record<string, unknown> {
  const today = prodToday_(store.cfg)
  const re = /^\d{4}-\d\d-\d\d$/
  const b = re.test(String(to || '')) && String(to) <= today ? String(to) : today
  let a = re.test(String(from || '')) && String(from) <= b ? String(from) : dqAddDays_(b, -6)
  if (a < dqAddDays_(b, -(TPH_TREND_MAX_DAYS - 1))) a = dqAddDays_(b, -(TPH_TREND_MAX_DAYS - 1))
  const hours = tphHours_(store.cfg)
  const keys = tphChannels_(store.cfg).map((c) => c.key)
  const people = tphPeople_(user, store.dir)
  const days: Record<string, unknown>[] = []
  for (let d = a; d <= b; d = dqAddDays_(d, 1)) {
    const x = tphDayCore_(store, d, today, hours, keys, people)
    const s = tphDaySummary_(x.table as never, TPH_CALLS) as Record<string, unknown>
    delete s.hours
    s.date = d
    s.touchesReady = !!x.touchRow
    s.hasCases = x.hasCases
    s.callsBasis = x.callRow ? 'actual' : 'estimate'
    days.push(s)
  }
  return { from: a, to: b, days }
}
