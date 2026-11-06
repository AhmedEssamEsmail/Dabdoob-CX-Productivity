/**
 * Scheduler.js (Queue_deprecated) verbatim port onto the sched_* Postgres tables.
 *
 * The whole engine is ported: the weekly-block roster (one shift per Sun–Sat week,
 * PM never followed by AM, rotating rest pairs), the daily greedy fallback, the
 * duty allocation, the shared day plan, task placement, the hour grid, and the
 * commitments layer (1:1s / meetings). Server functions keep the legacy names and
 * return the legacy shapes; writes go through assertWritable() like every write.
 */

import { appendRow, db, findRow, newId } from '@/features/shared/platform/repo'

import { assistantOwnerEmail, pwDirectory, requireRole, type Directory } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { raisePopup, resolvePopups } from '@/features/shared/platform/popups'
import { wcReset } from '@/features/shared/platform/calendar'
import { InputError } from '@/features/shared/lib/api-error'
import { dqNum_ } from './index'
import { normEmail_, pwAddDays_, pwIso_, pwKwDate_, pwMs_, PW_KW_OFFSET_MS } from '@/features/shared/lib/adapters'

export const SCH_TABLES = {
  config: 'sched_config', team: 'sched_team', offdays: 'sched_offdays', overrides: 'sched_overrides',
  hourOverrides: 'sched_hour_overrides', requests: 'sched_requests', plan: 'sched_plan',
}
export const SCH_SHIFTS = { AM: { from: '09:30', to: '18:30' }, PM: { from: '13:00', to: '22:00' } }
const SCH_SHIFT_HOURS = 9

const SCH_VERSION = '2026.10.06-v2'
const SCH_DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SCH_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Defaults. Every one is overridable from sched_config (Scheduler settings, admin). */
const SCH_DEFAULTS: Record<string, string> = {
  shift_am_start: '09:30',
  shift_am_end: '18:30',
  shift_pm_start: '13:00',
  shift_pm_end: '22:00',
  shift_hours: '9', // clock length of a shift
  // No break block in the plan: the nine hours are scheduled in full. Set to 60 for an hour carved out.
  break_minutes: '0',
  working_days: '5', // per TL per week
  // How a PRIMARY cover (only or first TL on a slot) spends 8 productive hours.
  primary_queue_h: '7',
  primary_people_h: '1',
  primary_task_h: '1',
  // How a SECONDARY cover (the doubled-up TL) spends them.
  secondary_queue_h: '3',
  secondary_people_h: '3',
  secondary_task_h: '3',
  // 'calendar': no generic "1:1s" block is drawn; real 1:1s appear where they are booked and the
  // hours go to tasks. 'reserve': also set aside unbooked people time as an intention.
  people_source: 'calendar',
  // 'weekly': one shift for the whole Sun-Sat week, rotating. 'daily': the older greedy fill.
  shift_rotation: 'weekly',
  peak_days: '0,1,2,3,4,5,6',
  peak_shift: 'BALANCE',
  // PM finishing at 22:00 then AM at 09:30 leaves under 12 hours. Forbidden.
  forbid_pm_then_am: 'yes',
  consecutive_off: 'yes',
  wfh_max_per_week: '1',
  // How long a meeting blocks the timeline when the meeting record has no end time.
  meeting_minutes: '60',
}

const MONTH_RE_SCH = /^\d{4}-\d{2}$/

type Cfg = Record<string, unknown> & {
  _offDays?: Record<string, number[]>
  _offDates?: Record<string, boolean>
  _team?: SchTeamRow[]
  _variant?: number
  _today?: Date
}
interface SchTeamRow { name: string; email: string; display: string; start: string; end: string; note: string }
interface SchDay { key: string; dow: number; dom: number; date: Date }

async function table_(name: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await db().from(name).select('*')
  if (error && (error as { code?: string }).code === '42P01') return []
  if (error) throw new Error(error.message)
  return (data || []) as Record<string, unknown>[]
}

/** schDelete_: deletes every row matching pred. Returns how many went. */
async function schDelete_(name: string, pred: (r: Record<string, unknown>) => boolean): Promise<number> {
  const hits = (await table_(name)).filter(pred)
  for (const r of hits) await db().from(name).delete().eq('id', r.id)
  return hits.length
}

function schNum_(v: unknown, d: number): number {
  const n = Number(v)
  return isNaN(n) ? d : n
}

function schDate_(y: number, m: number, d: number): Date {
  return new Date(y, m, d)
}

/** yyyy-MM-dd of a local date — same as V1's Utilities.formatDate. */
function schKey_(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function schParse_(s: string): Date | null {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}

/** Every date in a month, as Date objects. */
function schMonthDays_(year: number, month0: number): Date[] {
  const out: Date[] = []
  const last = new Date(year, month0 + 1, 0).getDate()
  for (let d = 1; d <= last; d++) out.push(schDate_(year, month0, d))
  return out
}

function schMonthTag_(year: number, month0: number): string {
  return year + '-' + String(month0 + 1).padStart(2, '0')
}

function schMonthName_(year: number, month0: number): string {
  return SCH_MONTH_NAMES[month0] + ' ' + year
}

/** First hour slot of a shift: its start rounded up ('09:30' -> 10, '13:00' -> 13). */
function schHourOf_(hhmm: unknown): number {
  const m = String(hhmm || '').match(/^(\d{1,2}):?(\d{2})?/)
  if (!m) return 0
  return Math.ceil(parseInt(m[1], 10) + (parseInt(m[2] || '0', 10) / 60) - 1e-9)
}

/** 'HH:MM' as decimal hours, for drawing the true shift edges. */
function schDecimal_(hhmm: unknown): number {
  const m = String(hhmm || '').match(/^(\d{1,2}):?(\d{2})?/)
  return m ? parseInt(m[1], 10) + parseInt(m[2] || '0', 10) / 60 : 0
}

/** Any stored date-ish value to yyyy-MM-dd. */
function schDateKey_(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  return v instanceof Date ? pwKwDate_(v) : String(v).slice(0, 10)
}

/** A month cell to 'yyyy-MM' ('2026-10' text, or a full date). — kept for parity with V1. */

/** Productive hours in a shift, once the break is taken out. */
function schProductiveHours_(cfg: Cfg): number {
  return schNum_(cfg.shift_hours, 9) - schNum_(cfg.break_minutes, 60) / 60
}

/**
 * Weeks run Sunday -> Saturday.
 * 1 Jan 1970 was a Thursday, so +4 puts the boundary on Sunday.
 * The number is ABSOLUTE, not month-relative, so any rotation built on it carries on
 * across the month boundary instead of restarting.
 */
function schWeekIndex_(d: Date): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000 + 4) / 7)
}

function schVariantKey_(tag: string): string {
  return 'roster_variant_' + tag
}

function schVariant_(cfg: Cfg, tag: string): number {
  return Math.max(0, parseInt(String(cfg[schVariantKey_(tag)]), 10) || 0)
}

function monthOf(year: unknown, month: unknown): { tag: string; year: number; month0: number } {
  const y = schNum_(year, NaN)
  const m0 = schNum_(month, NaN)
  const mk = schMonthTag_(y, m0)
  if (!isFinite(y) || !isFinite(m0) || !MONTH_RE_SCH.test(mk)) throw new InputError('Give the month as year + month (0-based).')
  return { tag: mk, year: y, month0: m0 }
}

function daysInMonth(mk: string): SchDay[] {
  const [y, mo] = mk.split('-').map(Number)
  const n = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const out: SchDay[] = []
  for (let d = 1; d <= n; d++) {
    const date = schDate_(y, mo - 1, d)
    out.push({ key: schKey_(date), dow: date.getDay(), dom: d, date })
  }
  return out
}

// ---------------------------------------------------------------- config

/** Scheduler settings: defaults, then sched_config. Values are strings, as in V1. */
async function schCfg_(): Promise<Cfg> {
  const cfg: Cfg = {}
  Object.keys(SCH_DEFAULTS).forEach((k) => {
    cfg[k] = SCH_DEFAULTS[k]
  })
  ;(await table_(SCH_TABLES.config)).forEach((r) => {
    const k = String(r.key || '').trim()
    if (k && r.value !== '' && r.value !== null && r.value !== undefined) cfg[k] = String(typeof r.value === 'string' ? r.value : JSON.stringify(r.value)).replace(/^"|"$/g, '')
  })
  return cfg
}

async function schSetConfig_(key: string, value: unknown): Promise<void> {
  const v = String(value)
  const { data: ex } = await db().from(SCH_TABLES.config).select('key').eq('key', key).limit(1)
  if (ex && ex.length) await db().from(SCH_TABLES.config).update({ value: v }).eq('key', key)
  else await db().from(SCH_TABLES.config).insert({ key, value: v })
}

// ---------------------------------------------------------------- team (per month)

/**
 * Who is a team lead, and when. TLs are the active roster rows with role "tl", keyed by
 * email. sched_team adds an optional joining / leaving date per person (a lead who left in
 * August still worked August). Blank start = always here; blank end = still here.
 * The ported sched_team row keeps the dates inside extra_json.
 */
async function schLoadTeam_(): Promise<SchTeamRow[]> {
  const dir = await pwDirectory()
  const dates: Record<string, Record<string, unknown>> = {}
  ;(await table_(SCH_TABLES.team)).forEach((r) => {
    dates[normEmail_(r.tl_email ?? r.email)] = r
  })
  const out: SchTeamRow[] = []
  const seen: Record<string, boolean> = {}
  const add = (email: string) => {
    if (!email || seen[email]) return
    seen[email] = true
    const d = dates[email] || {}
    const x = (d.extra_json && typeof d.extra_json === 'object' ? d.extra_json : {}) as Record<string, unknown>
    out.push({
      name: email,
      email,
      display: dir.name(email),
      start: schDateKey_(x.start_date ?? d.start_date ?? ''),
      end: schDateKey_(x.end_date ?? d.end_date ?? ''),
      note: String(x.note ?? d.note ?? ''),
    })
  }
  dir.tls().forEach((p) => add(p.email))
  Object.keys(dates).forEach(add)
  return out.sort((a, b) => (a.display < b.display ? -1 : a.display > b.display ? 1 : 0))
}

/** Anyone whose dates overlap the month at all. */
function schActiveTLs_(team: SchTeamRow[], year: number, month0: number): string[] {
  const first = schKey_(schDate_(year, month0, 1))
  const last = schKey_(new Date(year, month0 + 1, 0))
  return team.filter((t) => (!t.start || t.start <= last) && (!t.end || t.end >= first)).map((t) => t.name)
}

/** Is this lead actually here on this date? Catches mid-month joins and exits. */
function schTlActiveOn_(team: SchTeamRow[] | undefined, name: string, dateKey: string): boolean {
  const t = (team || []).filter((x) => x.name === name)[0]
  if (!t) return false
  if (t.start && dateKey < t.start) return false
  if (t.end && dateKey > t.end) return false
  return true
}

// ---------------------------------------------------------------- fixed off days

/**
 * The sched_offdays `date` column carries either a per-date row ('yyyy-MM-dd') or a
 * weekly rest pair '<month>:d1,d2' (a blank month '<:d1,d2' is the standing default; a
 * month-tagged pair beats it). tl -> [dow, dow] for one month.
 */
async function schLoadOffDays_(monthTag: string): Promise<Record<string, number[]>> {
  const dflt: Record<string, number[]> = {}
  const exact: Record<string, number[]> = {}
  ;(await table_(SCH_TABLES.offdays)).forEach((r) => {
    const tl = normEmail_(r.tl_email)
    const cell = String(r.date ?? r.off_days ?? '').trim()
    const pm = cell.match(/^(\d{4}-\d{2})?:(\d(?:\s*,\s*\d)?)$/)
    if (!tl || !pm) return
    const days = pm[2].split(',').map((x) => parseInt(x, 10)).filter((n) => n >= 0 && n <= 6)
    if (!days.length) return
    const m = pm[1] || ''
    if (!m) dflt[tl] = days
    else if (m === monthTag) exact[tl] = days
  })
  const out: Record<string, number[]> = {}
  Object.keys(dflt).forEach((k) => {
    out[k] = dflt[k]
  })
  Object.keys(exact).forEach((k) => {
    out[k] = exact[k]
  })
  return out
}

/** Per-date off rows ('yyyy-MM-dd') — kept working alongside the pair format. */
async function schLoadOffDates_(): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  ;(await table_(SCH_TABLES.offdays)).forEach((r) => {
    const tl = normEmail_(r.tl_email)
    const d = schDateKey_(r.date)
    if (tl && /^\d{4}-\d{2}-\d{2}$/.test(d)) out[tl + '|' + d] = true
  })
  return out
}

// ---------------------------------------------------------------- overrides and requests

/** The wfh / reason flags are packed into the note column as JSON (plain text still reads as the reason). */
function schNoteMeta_(note: unknown): { wfh: boolean; reason: string; meta: Record<string, unknown> } {
  const s = String(note || '')
  if (s.startsWith('{')) {
    try {
      const m = JSON.parse(s) as Record<string, unknown>
      return { wfh: m.wfh === true || String(m.wfh).toLowerCase() === 'yes' || String(m.wfh).toLowerCase() === 'true', reason: String(m.reason || ''), meta: m }
    } catch {
      /* plain text */
    }
  }
  return { wfh: false, reason: s, meta: {} }
}

function schNotePack_(meta: Record<string, unknown>): string {
  return JSON.stringify(meta)
}

/** Manual changes and approved requests, keyed date -> tl -> {shift, wfh, reason}. */
async function schLoadOverrides_(): Promise<Record<string, Record<string, { shift: string; wfh: boolean; reason: string }>>> {
  const out: Record<string, Record<string, { shift: string; wfh: boolean; reason: string }>> = {}
  const add = (date: unknown, tl: unknown, shift: string, wfh: boolean, reason: unknown) => {
    const k = schDateKey_(date)
    const who = normEmail_(tl)
    if (!k || !who) return
    out[k] = out[k] || {}
    out[k][who] = { shift, wfh: !!wfh, reason: String(reason || '') }
  }
  ;(await table_(SCH_TABLES.overrides)).forEach((r) => {
    const meta = schNoteMeta_(r.note ?? r.reason)
    add(r.date, r.tl_email, String(r.shift || '').toUpperCase(), meta.wfh || r.wfh === true || String(r.wfh).toLowerCase() === 'yes' || String(r.wfh).toLowerCase() === 'true', meta.reason)
  })
  // Approved requests become overrides too.
  ;(await table_(SCH_TABLES.requests))
    .filter((r) => String(r.status) === 'Approved')
    .forEach((r) => {
      const meta = schNoteMeta_(r.note).meta
      const type = String(r.type || '').toLowerCase()
      const from = schParse_(schDateKey_(r.date ?? r.date_from))
      if (!from) return
      const to = schParse_(schDateKey_(r.their_date ?? r.date_to ?? r.date ?? r.date_from)) || from
      const tl = r.tl_email ?? r.from_email
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const k = schKey_(d)
        if (type === 'offday') return // handled by the off-days table, not here
        if (type === 'leave') add(k, tl, 'LEAVE', false, meta.subtype || 'Leave')
        else if (type === 'wfh') add(k, tl, String(meta.shift ?? r.shift ?? '').toUpperCase() || 'PM', true, 'WFH')
        else if (type === 'swap') {
          // A swap is two moves: each lead takes the other's assignment.
          add(k, tl, String(meta.shift ?? r.shift ?? 'OFF').toUpperCase(), false, 'Swap with ' + (r.with_email ?? r.to_email))
          add(k, r.with_email ?? r.to_email, String(meta.with_shift ?? r.with_shift ?? 'OFF').toUpperCase(), false, 'Swap with ' + tl)
        }
      }
    })
  return out
}

/** date|tl|hour -> { kind, label }. Hand-edited hours win over the generated layout. */
async function schLoadHourOverrides_(): Promise<Record<string, { kind: string; label: string }>> {
  const out: Record<string, { kind: string; label: string }> = {}
  ;(await table_(SCH_TABLES.hourOverrides)).forEach((r) => {
    const d = schDateKey_(r.date)
    const tl = normEmail_(r.tl_email)
    const h = parseInt(String(r.hour), 10)
    if (!d || !tl || isNaN(h)) return
    out[d + '|' + tl + '|' + h] = { kind: String(r.kind || ''), label: String(r.label || '') }
  })
  return out
}

// ---------------------------------------------------------------- tasks from the TL tasks tab

interface SchTask { id: string; desc: string; who: string; estHours: number; due: string; startKey: string; pri: string; status: string; recurrence: string; recurDay: string }

/**
 * V2 TL tasks in the shape V1's task placement reads. A task has one owner (email), an
 * estimate, a start and a deadline; there is no recurrence. done -> Done, dropped -> Cancelled.
 */
async function schLoadTasks_(): Promise<SchTask[]> {
  const actions = (await table_('actions')).filter((a) => a.track_as_task === true || String(a.track_as_task).toLowerCase() === 'true')
  const details: Record<string, Record<string, unknown>> = {}
  ;(await table_('action_task_details')).forEach((d) => {
    details[String(d.action_id)] = d
  })
  const PRI: Record<string, string> = { P1: 'High', P2: 'Medium', P3: 'Low' }
  const out: SchTask[] = []
  actions.forEach((a) => {
    const d = details[String(a.action_id)]
    if (!d) return
    const st = String(a.status || 'open')
    out.push({
      id: String(a.action_id), desc: String(a.title || ''), who: normEmail_(a.owner_email),
      estHours: schNum_(d.est_hours, 0), due: pwKwDate_(d.deadline_at), startKey: pwKwDate_(d.start_at),
      pri: PRI[String(d.priority)] || 'Medium',
      status: st === 'done' ? 'Done' : st === 'dropped' ? 'Cancelled' : 'Open',
      recurrence: '', recurDay: '',
    })
  })
  return out
}

// ---------------------------------------------------------------- 1:1s, meetings and My day

interface SchCommit { kind: string; title: string }

/**
 * What is already booked, by Kuwait date | tl | hour -> { kind: 'oneonone' | 'meeting', title }.
 * Sources, in order of preference for a clash: the 1:1 schedule, meeting series the lead
 * chairs or belongs to, and, for the My day owner only, their own calendar (busy blocks —
 * no default calendar exists in the port, so that layer is skipped).
 */
async function schCommitments_(year: number, month0: number, tlNames: string[], cfg: Cfg): Promise<Record<string, SchCommit>> {
  const byKey: Record<string, SchCommit> = {}
  if (!tlNames.length) return byKey
  const dir = await pwDirectory()
  const fromKey = pwAddDays_(schKey_(schDate_(year, month0, 1)), -1)
  const toKey = pwAddDays_(schKey_(new Date(year, month0 + 1, 0)), 1)
  const isTl: Record<string, boolean> = {}
  tlNames.forEach((t) => {
    isTl[t] = true
  })

  const put = (email: string, startMs: number, endMs: number, kind: string, title: string) => {
    if (!isTl[email] || isNaN(startMs)) return
    if (!(endMs > startMs)) endMs = startMs + 3600000
    const date = pwKwDate_(startMs)
    if (date < fromKey || date > toKey) return
    const first = Math.floor((startMs + PW_KW_OFFSET_MS) / 3600000)
    const last = Math.ceil((endMs + PW_KW_OFFSET_MS) / 3600000) - 1
    for (let hh = first; hh <= Math.min(last, first + 12); hh++) {
      const stamp = new Date(hh * 3600000)
      const key = stamp.toISOString().slice(0, 10) + '|' + email + '|' + stamp.getUTCHours()
      if (!byKey[key] || (kind === 'oneonone' && byKey[key].kind !== 'oneonone')) byKey[key] = { kind, title }
    }
  }

  ;(await table_('one_on_one_schedule'))
    .filter((s) => ['scheduled', 'held', 'held_late'].indexOf(String(s.status)) !== -1)
    .forEach((s) => {
      const start = pwMs_(s.scheduled_at)
      const end = start + schNum_(s.duration_min, 30) * 60000
      put(normEmail_(s.manager_email), start, end, 'oneonone', '1:1 · ' + dir.name(String(s.report_email)))
      put(normEmail_(s.report_email), start, end, 'oneonone', '1:1 · ' + dir.name(String(s.manager_email)))
    })

  const series: Record<string, Record<string, unknown>> = {}
  ;(await table_('meeting_series')).forEach((s) => {
    series[String(s.series_id)] = s
  })
  const members: Record<string, string[]> = {}
  ;(await table_('meeting_series_members')).forEach((m) => {
    ;(members[String(m.series_id)] = members[String(m.series_id)] || []).push(normEmail_(m.email))
  })
  const meetMs = schNum_(cfg.meeting_minutes, 60) * 60000
  ;(await table_('meetings'))
    .filter((m) => String(m.status) !== 'cancelled')
    .forEach((m) => {
      const s = series[String(m.series_id)]
      if (!s) return
      const who = (members[String(m.series_id)] || []).concat([normEmail_(s.chair_email)])
      ;[pwMs_(m.next_meeting_at), String(m.status) === 'closed' ? NaN : pwMs_(m.held_at)].forEach((ms) => {
        if (isNaN(ms)) return
        who.forEach((e) => put(e, ms, ms + meetMs, 'meeting', String(s.title || 'Meeting')))
      })
    })

  // My day: the owner's own calendar. The port has no CalendarApp default calendar, so
  // only the 1:1 / meeting layers feed the timeline (the owner check is kept for parity).
  void (await assistantOwnerEmail())
  return byKey
}

// ---------------------------------------------------------------- roster, floor cover, duty allocation, task placement (V1, copied)

/**
 * Rest days are a consecutive block within the Sun-Saturday week.
 *
 * If the manager has fixed a lead's off-days, those are used every week — that is a
 * standing arrangement and should not drift. Anyone left on 'auto' gets a block that
 * walks forward each week, so nobody permanently draws the unpopular pair, and the
 * starting offsets are spread so the blocks do not all land on the same days.
 */
function schRestPlanner_(cfg: Cfg, workDays: number): (tlIdx: number, tl: string, day: Date) => boolean {
  const offLen = 7 - workDays
  const fixed = cfg._offDays || {}
  const offDates = cfg._offDates || {}
  return function (tlIdx: number, tl: string, day: Date): boolean {
    const dow = day.getDay()
    if (offDates[tl + '|' + schKey_(day)]) return true
    const f = fixed[tl]
    if (f && f.length) return f.indexOf(dow) !== -1
    const start = (tlIdx * offLen + schWeekIndex_(day) + (cfg._variant ?? 0)) % 7
    for (let k = 0; k < offLen; k++) if ((start + k) % 7 === dow) return true
    return false
  }
}

interface SchRosterSlot { AM: string[]; PM: string[]; OFF: string[]; WFH: Record<string, boolean> }
interface SchRoster { plan: Record<string, SchRosterSlot>; exceptions: Record<string, unknown>[] }
interface SchOvrMap { [date: string]: { [tl: string]: { shift: string; wfh: boolean; reason: string } } }

function schBuildRoster_(tls: string[], days: Date[], cfg: Cfg, overrides: SchOvrMap): SchRoster {
  return String(cfg.shift_rotation || 'weekly').toLowerCase() === 'daily'
    ? schRosterDaily_(tls, days, cfg, overrides)
    : schRosterWeekly_(tls, days, cfg, overrides)
}

/**
 * WEEKLY BLOCKS — the default. A lead is given one home shift per Sun–Saturday week and
 * works it on every day they are in. PM IS NEVER FOLLOWED BY AM. Verbatim port.
 */
function schRosterWeekly_(tls: string[], days: Date[], cfg: Cfg, overrides: SchOvrMap): SchRoster {
  const workDays = schNum_(cfg.working_days, 5)
  const offLen = Math.max(1, 7 - workDays)
  const noPmAm = String(cfg.forbid_pm_then_am || 'yes').toLowerCase() !== 'no'
  const isOffDay = schRestPlanner_(cfg, workDays)

  const plan: Record<string, SchRosterSlot> = {}
  const exceptions: Record<string, unknown>[] = []
  const shiftCount: Record<string, { AM: number; PM: number }> = {}
  const movedOff: Record<string, number> = {}
  const primaryCount: Record<string, number> = {}
  tls.forEach((t) => {
    shiftCount[t] = { AM: 0, PM: 0 }
    movedOff[t] = 0
    primaryCount[t] = 0
  })

  const weekHome: Record<number, Record<string, string>> = {}
  const weekRest: Record<number, Record<string, number>> = {}
  const yesterdayShift: Record<string, string> = {}

  const amWindow = (wk: number, roll: string[]) => {
    const n = roll.length
    const cycle = Math.floor(wk / n)
    const seats = n % 2 === 0 ? n / 2 : ((cycle % 2) + 2) % 2 === 0 ? Math.ceil(n / 2) : Math.floor(n / 2)
    const take = Math.max(1, Math.min(n, seats))
    const start = (((wk + (cfg._variant ?? 0)) % n) + n) % n
    const set: Record<string, boolean> = {}
    for (let i = 0; i < take; i++) set[roll[(start + i) % n]] = true
    return set
  }

  const planWeek = (wk: number, day: Date) => {
    const win = amWindow(wk, tls)
    const home: Record<string, string> = {}
    const rest: Record<string, number> = {}
    tls.forEach((t) => {
      home[t] = win[t] ? 'AM' : 'PM'
    })
    tls.forEach((t) => {
      if (home[t] !== 'AM' || !noPmAm) return
      if (yesterdayShift[t] !== 'PM') return // came off a rest day: nothing to do
      if (day.getDay() === 0) rest[t] = 0 // full week: rest Sunday onward
      else home[t] = 'PM' // partial week: defer the move
    })
    weekHome[wk] = home
    weekRest[wk] = rest
    return home
  }

  const homeShift = (tl: string, day: Date): string => {
    const wk = schWeekIndex_(day)
    const home = weekHome[wk] || planWeek(wk, day)
    if (home[tl]) return home[tl]
    if (noPmAm && yesterdayShift[tl] === 'PM') return 'PM'
    return shiftCount[tl].AM <= shiftCount[tl].PM ? 'AM' : 'PM'
  }

  // Roster the WHOLE weeks the month sits inside, then hand back only the month.
  const first = days[0]
  const last = days[days.length - 1]
  const span: Date[] = []
  for (let i = -first.getDay(); i < days.length + (6 - last.getDay()); i++) {
    span.push(schDate_(first.getFullYear(), first.getMonth(), first.getDate() + i))
  }
  const inMonth: Record<string, boolean> = {}
  days.forEach((d) => {
    inMonth[schKey_(d)] = true
  })

  span.forEach((day) => {
    const key = schKey_(day)
    plan[key] = { AM: [], PM: [], OFF: [], WFH: {} }

    const ov = (overrides && overrides[key]) || {}
    const slot: Record<string, string[]> = { AM: [], PM: [] }
    const forced: Record<string, boolean> = {}

    homeShift(tls[0], day)
    const restThisWeek = weekRest[schWeekIndex_(day)] || {}

    const available = tls.filter((t) => {
      if (cfg._team && !schTlActiveOn_(cfg._team, t, key)) return false
      const o = ov[t]
      if (o && (o.shift === 'OFF' || o.shift === 'LEAVE')) return false
      if (o && (o.shift === 'AM' || o.shift === 'PM')) return true // forced on
      const start = restThisWeek[t]
      if (start !== undefined) {
        for (let k = 0; k < offLen; k++) if ((start + k) % 7 === day.getDay()) return false
        return true
      }
      return !isOffDay(tls.indexOf(t), t, day)
    })

    available.forEach((t) => {
      const o = ov[t]
      if (o && (o.shift === 'AM' || o.shift === 'PM')) {
        slot[o.shift].push(t)
        forced[t] = true
        if (o.wfh) plan[key].WFH[t] = true
        if (noPmAm && o.shift === 'AM' && yesterdayShift[t] === 'PM') {
          exceptions.push({ date: key, tl: t, shift: 'AM', why: 'Set by hand onto AM after a PM day — less than 12 hours rest' })
        }
      }
    })

    available.forEach((t) => {
      if (forced[t]) return
      let want = homeShift(t, day)
      if (want === 'AM' && noPmAm && yesterdayShift[t] === 'PM') want = 'PM'
      slot[want].push(t)
    })

    const repair = (empty: string) => {
      const from = empty === 'AM' ? 'PM' : 'AM'
      if (slot[empty].length || slot[from].length < 2) return
      const eligible = (t: string) => !forced[t] && !(empty === 'AM' && noPmAm && yesterdayShift[t] === 'PM')
      const pool = slot[from].filter(eligible)
      if (!pool.length) return
      pool.sort((a, b) => movedOff[a] - movedOff[b] || shiftCount[a][empty as 'AM' | 'PM'] - shiftCount[b][empty as 'AM' | 'PM'] || (a < b ? -1 : 1))
      const pick = pool[0]
      slot[from].splice(slot[from].indexOf(pick), 1)
      slot[empty].push(pick)
      movedOff[pick]++
      exceptions.push({ date: key, tl: pick, shift: empty, why: 'Moved off their ' + from + ' block — nobody else was on ' + empty })
    }
    repair('AM')
    repair('PM')

    ;['AM', 'PM'].forEach((s) => {
      if (!slot[s].length) {
        const blocked = s === 'AM' && noPmAm && tls.some((t) => available.indexOf(t) !== -1 && yesterdayShift[t] === 'PM')
        exceptions.push({ date: key, shift: s, why: blocked ? 'Nobody can open ' + s + ' — everyone in today worked PM last night' : 'Nobody available to cover' })
      }
    })

    ;['AM', 'PM'].forEach((s) => {
      slot[s].sort((a, b) => primaryCount[a] - primaryCount[b] || (a < b ? -1 : 1))
      if (slot[s].length) primaryCount[slot[s][0]]++
      slot[s].forEach((t) => {
        plan[key][s as 'AM' | 'PM'].push(t)
        shiftCount[t][s as 'AM' | 'PM']++
      })
    })

    tls.forEach((t) => {
      if (plan[key].AM.indexOf(t) === -1 && plan[key].PM.indexOf(t) === -1) {
        plan[key].OFF.push(t)
        yesterdayShift[t] = 'OFF'
      } else {
        yesterdayShift[t] = plan[key].AM.indexOf(t) !== -1 ? 'AM' : 'PM'
      }
    })
  })

  const monthPlan: Record<string, SchRosterSlot> = {}
  Object.keys(plan).forEach((k) => {
    if (inMonth[k]) monthPlan[k] = plan[k]
  })
  return { plan: monthPlan, exceptions: exceptions.filter((e) => inMonth[String(e.date)]) }
}

/** DAILY GREEDY — the original strategy, kept behind `shift_rotation: 'daily'`. Verbatim port. */
function schRosterDaily_(tls: string[], days: Date[], cfg: Cfg, overrides: SchOvrMap): SchRoster {
  const workDays = schNum_(cfg.working_days, 5)
  const peakSet = String(cfg.peak_days || '').split(',').map((x) => parseInt(x, 10)).filter((n) => !isNaN(n))
  const peakPref = String(cfg.peak_shift || 'BALANCE').toUpperCase()
  const noPmAm = String(cfg.forbid_pm_then_am || 'yes').toLowerCase() !== 'no'
  const isOffDay = schRestPlanner_(cfg, workDays)

  const plan: Record<string, SchRosterSlot> = {}
  const exceptions: Record<string, unknown>[] = []
  const shiftCount: Record<string, { AM: number; PM: number }> = {}
  tls.forEach((t) => {
    shiftCount[t] = { AM: 0, PM: 0 }
  })
  const yesterdayShift: Record<string, string> = {}

  days.forEach((day, dayIdx) => {
    const key = schKey_(day)
    plan[key] = { AM: [], PM: [], OFF: [], WFH: {} }

    const ov = (overrides && overrides[key]) || {}
    const available = tls.filter((t, i) => {
      if (cfg._team && !schTlActiveOn_(cfg._team, t, key)) return false
      const o = ov[t]
      if (o && (o.shift === 'OFF' || o.shift === 'LEAVE')) return false
      if (o && (o.shift === 'AM' || o.shift === 'PM')) return true // forced on
      return !isOffDay(i, t, day)
    })

    const assign = (tl: string, shift: 'AM' | 'PM', wfh: boolean) => {
      plan[key][shift].push(tl)
      shiftCount[tl][shift]++
      if (wfh) plan[key].WFH[tl] = true
    }

    available.forEach((t) => {
      const o = ov[t]
      if (o && (o.shift === 'AM' || o.shift === 'PM')) assign(t, o.shift as 'AM' | 'PM', o.wfh)
    })

    const canTakeAM = (t: string) => !(noPmAm && yesterdayShift[t] === 'PM')
    const free = () => available.filter((t) => plan[key].AM.indexOf(t) === -1 && plan[key].PM.indexOf(t) === -1)

    if (!plan[key].AM.length) {
      const pool = free().filter(canTakeAM).sort((a, b) => shiftCount[a].AM - shiftCount[b].AM)
      if (pool.length) assign(pool[0], 'AM', false)
      else {
        const fallback = free().sort((a, b) => shiftCount[a].AM - shiftCount[b].AM)[0]
        if (fallback) {
          assign(fallback, 'AM', false)
          exceptions.push({ date: key, tl: fallback, shift: 'AM', why: 'Worked PM the previous day — less than 12 hours rest' })
        } else {
          exceptions.push({ date: key, shift: 'AM', why: 'Nobody available to cover' })
        }
      }
    }
    if (!plan[key].PM.length) {
      const pool = free().sort((a, b) => shiftCount[a].PM - shiftCount[b].PM)
      if (pool.length) assign(pool[0], 'PM', false)
      else exceptions.push({ date: key, shift: 'PM', why: 'Nobody available to cover' })
    }

    if (peakSet.indexOf(day.getDay()) !== -1) {
      const spare = free()
      if (spare.length) {
        let shift: 'AM' | 'PM' = peakPref === 'AM' || peakPref === 'PM' ? (peakPref as 'AM' | 'PM') : dayIdx % 2 ? 'AM' : 'PM'
        let pool = spare.filter((t) => shift !== 'AM' || canTakeAM(t))
        if (!pool.length) {
          shift = shift === 'AM' ? 'PM' : 'AM'
          pool = spare
        }
        pool.sort((a, b) => shiftCount[a][shift] - shiftCount[b][shift])
        if (pool.length) assign(pool[0], shift, false)
      }
    }

    tls.forEach((t) => {
      if (plan[key].AM.indexOf(t) === -1 && plan[key].PM.indexOf(t) === -1) {
        plan[key].OFF.push(t)
        yesterdayShift[t] = 'OFF'
      } else {
        yesterdayShift[t] = plan[key].AM.indexOf(t) !== -1 ? 'AM' : 'PM'
      }
    })
  })

  return { plan, exceptions }
}

/** The clock hours one shift occupies. AM 09:30–18:30 is 10…18. */
function schShiftHours_(shift: string, cfg: Cfg): number[] {
  const startH = schHourOf_(shift === 'AM' ? cfg.shift_am_start : cfg.shift_pm_start)
  const n = schNum_(cfg.shift_hours, 9)
  const hours: number[] = []
  for (let i = 0; i < n; i++) hours.push(startH + i)
  return hours
}

interface SchAlloc { shift?: string; queue: number; people: number; task: number; productive?: number; breakH?: number; offQueueHours?: number[]; soleHours?: number[] }

/** What one lead's shift asks for, before the floor gets a say. Verbatim port. */
function schAllocate_(role: string, cfg: Cfg): SchAlloc {
  const productive = schProductiveHours_(cfg)
  const p = role === 'primary'
  const q = schNum_(p ? cfg.primary_queue_h : cfg.secondary_queue_h, p ? 7 : 3)
  let people = schNum_(p ? cfg.primary_people_h : cfg.secondary_people_h, p ? 1 : 3)
  let task = schNum_(p ? cfg.primary_task_h : cfg.secondary_task_h, p ? 1 : 3)
  const over = q + people + task - productive
  if (over > 0) {
    const fromTask = Math.min(task, over)
    task -= fromTask
    people -= Math.min(people, over - fromTask)
  }
  return { queue: q, people, task, productive }
}

/**
 * Decides one whole day for the whole team at once: a running count of who is still on
 * the queue, so an hour is only spent when another lead is still on it. Verbatim port.
 */
function schDayPlan_(roster: { tl: string; shift: string; role: string }[], cfg: Cfg): Record<string, SchAlloc> {
  const breakH = Math.round(schNum_(cfg.break_minutes, 60) / 60)
  const leads = (roster || []).map((r) => {
    const a = schAllocate_(r.role, cfg)
    return {
      tl: r.tl,
      shift: r.shift,
      role: r.role,
      hours: schShiftHours_(r.shift, cfg),
      want: { break: breakH, people: Math.round(a.people), task: Math.round(a.task) },
      offQueue: [] as number[],
    }
  })
  const onQueue: Record<number, number> = {}
  leads.forEach((L) => L.hours.forEach((h) => {
    onQueue[h] = (onQueue[h] || 0) + 1
  }))
  const order = leads.slice().sort((a, b) => (a.role === 'secondary' ? 0 : 1) - (b.role === 'secondary' ? 0 : 1))
  order.forEach((L) => {
    let want = L.want.break + L.want.people + L.want.task
    for (let i = L.hours.length - 1; i >= 0 && want > 0; i--) {
      const h = L.hours[i]
      if ((onQueue[h] || 0) <= 1) continue
      onQueue[h]--
      L.offQueue.push(h)
      want--
    }
    L.offQueue.sort((a, b) => a - b)
  })
  const out: Record<string, SchAlloc> = {}
  leads.forEach((L) => {
    let n = L.offQueue.length
    const gBreak = Math.min(L.want.break, n)
    n -= gBreak
    const gPeople = Math.min(L.want.people, n)
    n -= gPeople
    const gTask = Math.min(L.want.task, n)
    out[L.tl] = {
      shift: L.shift,
      queue: L.hours.length - gBreak - gPeople - gTask,
      people: gPeople,
      task: gTask,
      breakH: gBreak,
      offQueueHours: L.offQueue,
      soleHours: L.hours.filter((h) => (onQueue[h] || 0) <= 1 && L.offQueue.indexOf(h) === -1),
    }
  })
  return out
}

/** Every date's day plan, keyed date -> tl -> allocation. */
function schDayPlans_(plan: Record<string, SchRosterSlot>, days: Date[], cfg: Cfg): Record<string, Record<string, SchAlloc>> {
  const out: Record<string, Record<string, SchAlloc>> = {}
  days.forEach((day) => {
    const key = schKey_(day)
    const slot = plan[key] || { AM: [], PM: [], OFF: [], WFH: {} }
    const roster: { tl: string; shift: string; role: string }[] = []
    ;['AM', 'PM'].forEach((shift) => {
      ;(slot[shift as 'AM' | 'PM'] || []).forEach((tl, idx) => {
        roster.push({ tl, shift, role: idx === 0 ? 'primary' : 'secondary' })
      })
    })
    out[key] = schDayPlan_(roster, cfg)
  })
  return out
}

/** Spreads each open task's estimated hours across the owner's task capacity. Verbatim port. */
function schPlaceTasks_(
  plan: Record<string, SchRosterSlot>,
  days: Date[],
  cfg: Cfg,
  tasks: SchTask[],
  dayPlans: Record<string, Record<string, SchAlloc>>,
): { placements: Record<string, unknown>[]; problems: Record<string, unknown>[]; capacityLeft: Record<string, number> } {
  const capacity: Record<string, number> = {}
  days.forEach((day) => {
    const key = schKey_(day)
    const byTL = dayPlans[key] || {}
    Object.keys(byTL).forEach((tl) => {
      capacity[tl + '|' + key] = (capacity[tl + '|' + key] || 0) + (byTL[tl].task || 0)
    })
  })

  const today = schParse_(schKey_(cfg._today || new Date()))
  const PRI: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

  const demands: { task: SchTask; dueKey: string; recurring: boolean }[] = []
  tasks
    .filter((t) => t.status !== 'Cancelled')
    .filter((t) => schNum_(t.estHours, 0) > 0)
    .forEach((t) => {
      // V2 TL tasks do not recur (schRecurrenceDates_ is empty), so only the one-off path remains.
      if (t.status !== 'Done') demands.push({ task: t, dueKey: schDateKey_(t.due) || '', recurring: false })
    })

  demands.sort((a, b) => {
    const p = (PRI[a.task.pri] === undefined ? 1 : PRI[a.task.pri]) - (PRI[b.task.pri] === undefined ? 1 : PRI[b.task.pri])
    if (p) return p
    return String(a.dueKey || '9999').localeCompare(String(b.dueKey || '9999'))
  })

  const placements: Record<string, unknown>[] = []
  const problems: Record<string, unknown>[] = []

  demands.forEach((dm) => {
    const t = dm.task
    const tl = String(t.who || '').trim()
    const need = schNum_(t.estHours, 0)
    const due = dm.dueKey ? schParse_(dm.dueKey) : null
    if (!tl) {
      problems.push({ kind: 'unassigned', task: t.desc, why: 'No team lead assigned' })
      return
    }
    const window = days.filter((d) => {
      if (due && d > due) return false
      if (!dm.recurring && today && d < today) return false
      if (!dm.recurring && t.startKey && schKey_(d) < t.startKey) return false
      return (capacity[tl + '|' + schKey_(d)] || 0) > 0
    })
    if (dm.recurring) window.reverse()

    let left = need
    let onTheDay = 0
    window.forEach((d) => {
      if (left <= 0) return
      const k = tl + '|' + schKey_(d)
      const take = Math.min(capacity[k], left)
      if (take <= 0) return
      capacity[k] -= take
      left -= take
      if (schKey_(d) === dm.dueKey) onTheDay += take
      placements.push({
        taskId: t.id, desc: t.desc, tl, date: schKey_(d), hours: Math.round(take * 10) / 10,
        pri: t.pri, due: dm.dueKey || '', recurring: !!dm.recurring,
      })
    })

    if (dm.recurring && need > 0 && onTheDay <= 0.05) {
      const anchorDay = schParse_(dm.dueKey)
      problems.push({
        kind: 'moved', task: t.desc, tl,
        why: 'Falls on ' + (anchorDay ? SCH_DOW_NAMES[anchorDay.getDay()] + ' ' + dm.dueKey : dm.dueKey) + ', but ' + tl + ' has no task time that day — the hours were booked earlier instead',
      })
    }
    if (left > 0.05) {
      problems.push({
        kind: 'shortfall', task: t.desc, tl,
        why: 'Short by ' + Math.round(left * 10) / 10 + 'h ' + (dm.recurring ? 'for the ' + dm.dueKey + ' run' : 'before ' + (dm.dueKey || 'no deadline')) + ' — needs ' + need + 'h, only ' + Math.round((need - left) * 10) / 10 + 'h available',
      })
    }
  })

  return { placements, problems, capacityLeft: capacity }
}

/**
 * Turns a shift's duty hours into clock hours. Hours the day plan freed (offQueueHours)
 * take, in order: break, people work, task time. Verbatim port.
 */
function schHourGrid_(cell: SchCell | undefined, cfg: Cfg, bookedPeopleH: number): Record<number, { kind: string; label: string; booked?: boolean; manual?: boolean; meeting?: boolean }> {
  if (!cell || cell.shift === 'OFF') return {}
  const startH = schHourOf_(cell.start)
  const clock = schNum_(cfg.shift_hours, 9)
  const breakH = schNum_(cfg.break_minutes, 60) / 60

  const calendarOnly = String(cfg.people_source || 'calendar').toLowerCase() !== 'reserve'
  const booked = Math.min(schNum_(bookedPeopleH, 0), cell.people || 0)
  const peopleLeft = calendarOnly ? 0 : Math.max((cell.people || 0) - booked, 0)
  const freed = calendarOnly ? cell.people || 0 : booked

  const taskLabels: string[] = []
  ;(cell.tasks || []).forEach((t: { desc: string; hours: number }) => {
    for (let i = 0; i < Math.round(t.hours); i++) taskLabels.push(t.desc)
  })

  const away: { kind: string; label: string }[] = []
  for (let i = 0; i < Math.round(breakH); i++) away.push({ kind: 'break', label: 'Break' })
  for (let i = 0; i < Math.round(peopleLeft); i++) away.push({ kind: 'people', label: '1:1s / CTLs' })
  for (let i = 0; i < Math.round((cell.task || 0) + freed); i++) away.push({ kind: 'task', label: taskLabels.shift() || 'Assigned task time' })

  const out: Record<number, { kind: string; label: string }> = {}
  for (let i = 0; i < clock; i++) out[startH + i] = { kind: 'queue', label: 'Queue management' }
  const spend = (cell.offQueueHours || []).slice().sort((a: number, b: number) => a - b)
  for (let i = 0; i < Math.min(spend.length, away.length); i++) out[spend[i]] = away[i]
  return out
}

// ---------------------------------------------------------------- the plan

interface SchCell {
  shift: string; role?: string; start?: string; end?: string
  queue?: number; people?: number; task?: number
  offQueueHours?: number[]; soleHours?: number[]
  manual: boolean; reason: string; wfh?: boolean; leave?: boolean
  tasks?: { desc: string; hours: number; pri: string }[]
}

interface SchPlan {
  year: number; month: number; monthName: string; tag: string
  tls: string[]; names: Record<string, string>
  days: { key: string; dow: number; dom: number }[]
  grid: Record<string, Record<string, SchCell>>; totals: Record<string, Record<string, number>>
  gaps: Record<string, unknown>[]; problems: Record<string, unknown>[]; exceptions: Record<string, unknown>[]
  config: Cfg; productiveHours: number; variant: number; version: string
  roster?: Record<string, SchRosterSlot>
}

/**
 * Builds a whole month. Read-only: computes and returns, writes nothing.
 * `variant` turns the roster rotation (0 = V1's roster).
 */
async function schBuildPlan_(year: number, month0: number, variant: number, today?: Date): Promise<SchPlan> {
  const cfg = await schCfg_()
  const tag = schMonthTag_(year, month0)
  const team = await schLoadTeam_()
  const tls = schActiveTLs_(team, year, month0)
  if (!tls.length) {
    throw new InputError('No team leads are active in ' + schMonthName_(year, month0) + '. Add them under People & holidays (role team lead).')
  }
  const days = schMonthDays_(year, month0)
  cfg._offDays = await schLoadOffDays_(tag)
  cfg._offDates = await schLoadOffDates_()
  cfg._team = team
  cfg._variant = variant
  cfg._today = today || new Date()
  const overrides = await schLoadOverrides_()
  const roster = schBuildRoster_(tls, days, cfg, overrides)
  const plan = roster.plan
  const tasks = await schLoadTasks_()
  const dayPlans = schDayPlans_(plan, days, cfg)
  const placed = schPlaceTasks_(plan, days, cfg, tasks, dayPlans)

  const byTL: Record<string, Record<string, SchCell>> = {}
  tls.forEach((t) => {
    byTL[t] = {}
  })
  days.forEach((day) => {
    const key = schKey_(day)
    const slot = plan[key] || ({ AM: [], PM: [], OFF: [], WFH: {} } as SchRosterSlot)
    ;['AM', 'PM'].forEach((shift) => {
      ;(slot[shift as 'AM' | 'PM'] || []).forEach((tl, idx) => {
        const role = idx === 0 ? 'primary' : 'secondary'
        const a = (dayPlans[key] || {})[tl] || schAllocate_(role, cfg)
        const ovr = (overrides[key] || {})[tl]
        byTL[tl][key] = {
          shift, role,
          start: shift === 'AM' ? String(cfg.shift_am_start) : String(cfg.shift_pm_start),
          end: shift === 'AM' ? String(cfg.shift_am_end) : String(cfg.shift_pm_end),
          queue: a.queue, people: a.people, task: a.task,
          offQueueHours: a.offQueueHours || [], soleHours: a.soleHours || [],
          manual: !!ovr, reason: ovr ? ovr.reason : '',
          wfh: !!(slot.WFH && slot.WFH[tl]),
          tasks: [],
        }
      })
    })
    ;(slot.OFF || []).forEach((tl) => {
      const ovr = (overrides[key] || {})[tl]
      byTL[tl][key] = { shift: 'OFF', manual: !!ovr, reason: ovr ? ovr.reason : '', leave: !!(ovr && ovr.shift === 'LEAVE') }
    })
  })

  ;(placed.placements as { tl: string; date: string; desc: string; hours: number; pri: string }[]).forEach((pl) => {
    const cell = byTL[pl.tl] && byTL[pl.tl][pl.date]
    if (cell && cell.shift !== 'OFF') (cell.tasks as { desc: string; hours: number; pri: string }[]).push({ desc: pl.desc, hours: pl.hours, pri: pl.pri })
  })

  // A slot with nobody on it is the thing to shout about: fold the roster's reason onto
  // the gap and drop the duplicate exception, as V1 does.
  const gapWhy: Record<string, string> = {}
  roster.exceptions.forEach((e) => {
    if (!e.tl && e.date && e.shift) gapWhy[String(e.date) + '|' + String(e.shift)] = String(e.why || '')
  })
  const gaps: Record<string, unknown>[] = []
  days.forEach((day) => {
    const key = schKey_(day)
    const slot = plan[key] || { AM: [], PM: [], OFF: [], WFH: {} }
    ;['AM', 'PM'].forEach((shift) => {
      if (!(slot[shift as 'AM' | 'PM'] || []).length) gaps.push({ date: key, shift, why: gapWhy[key + '|' + shift] || '' })
    })
  })
  const exceptions = roster.exceptions.filter((e) => !(!e.tl && e.date && e.shift))

  const totals: Record<string, Record<string, number>> = {}
  tls.forEach((tl) => {
    let shifts = 0
    let am = 0
    let pm = 0
    let queue = 0
    let people = 0
    let task = 0
    days.forEach((day) => {
      const c = byTL[tl][schKey_(day)]
      if (!c || c.shift === 'OFF') return
      shifts++
      if (c.shift === 'AM') am++
      else pm++
      queue += c.queue || 0
      people += c.people || 0
      task += c.task || 0
    })
    totals[tl] = { shifts, am, pm, queue, people, task: Math.round(task * 10) / 10 }
  })

  const dir = await pwDirectory()
  const names: Record<string, string> = {}
  tls.forEach((t) => {
    names[t] = dir.name(t)
  })
  const publicCfg: Cfg = {}
  Object.keys(cfg).forEach((k) => {
    if (k.charAt(0) !== '_') publicCfg[k] = cfg[k]
  })

  return {
    year, month: month0, monthName: schMonthName_(year, month0), tag,
    tls, names,
    days: days.map((d) => ({ key: schKey_(d), dow: d.getDay(), dom: d.getDate() })),
    grid: byTL, totals,
    gaps, problems: placed.problems, exceptions,
    config: publicCfg, productiveHours: schProductiveHours_(cfg),
    variant, version: SCH_VERSION,
    roster: plan,
  }
}

/**
 * The hour-by-hour timeline for the whole month: per lead per day, a list of segments
 * (from, to, kind, label), plus how many leads are rostered and on the queue each hour.
 * Layering, lowest to highest: generated -> booked 1:1 / meeting -> hand edit.
 */
async function schBuildTimeline_(plan: SchPlan): Promise<Record<string, unknown>> {
  const cfg = plan.config
  const axisFrom = Math.floor(schDecimal_(cfg.shift_am_start))
  const axisTo = Math.ceil(schDecimal_(cfg.shift_pm_end))
  const hours: number[] = []
  for (let h = axisFrom; h < axisTo; h++) hours.push(h)

  const byKey = await schCommitments_(plan.year, plan.month, plan.tls, cfg)
  const hourOvr = await schLoadHourOverrides_()
  const conflicts: Record<string, unknown>[] = []
  const rows: Record<string, unknown>[] = []
  const coverage: Record<string, { rostered: number[]; onQueue: number[] }> = {}
  const oneOnOne: Record<string, { booked: number; budget: number }> = {}
  plan.tls.forEach((tl) => {
    oneOnOne[tl] = { booked: 0, budget: 0 }
  })

  plan.days.forEach((day) => {
    const rostered = hours.map(() => 0)
    const onQueue = hours.map(() => 0)
    plan.tls.forEach((tl) => {
      const cell = (plan.grid[tl] || {})[day.key]
      if (!cell || cell.shift === 'OFF') return
      let booked1on1 = 0
      hours.forEach((h) => {
        const m = byKey[day.key + '|' + tl + '|' + h]
        if (m && m.kind === 'oneonone') booked1on1++
      })
      const grid = schHourGrid_(cell, cfg, booked1on1)
      hours.forEach((h) => {
        const m = byKey[day.key + '|' + tl + '|' + h]
        const isOneOnOne = m && m.kind === 'oneonone'
        if (m) {
          const soloThisHour = (cell.soleHours || []).indexOf(h) !== -1
          if (grid[h] && grid[h].kind === 'queue' && soloThisHour) {
            conflicts.push({ date: day.key, tl, hour: h, title: m.title, shift: cell.shift, oneonone: !!isOneOnOne })
          }
          grid[h] = isOneOnOne ? { kind: 'people', label: m.title, booked: true } : { kind: 'meeting', label: m.title, meeting: true }
        }
        const o = hourOvr[day.key + '|' + tl + '|' + h]
        if (o) grid[h] = { kind: o.kind, label: o.label, manual: true }
      })

      const segs: Record<string, unknown>[] = []
      hours.forEach((h, i) => {
        const c = grid[h] as { kind: string; label: string; booked?: boolean; manual?: boolean } | undefined
        if (!c) return
        rostered[i]++
        if (c.kind === 'queue') onQueue[i]++
        if (c.kind === 'people') oneOnOne[tl].budget++
        if (c.booked) oneOnOne[tl].booked++
        const last = segs[segs.length - 1] as { to: number; kind: string; label: string; booked: boolean; manual: boolean } | undefined
        if (last && last.to === h && last.kind === c.kind && last.label === c.label && !!last.booked === !!c.booked && !!last.manual === !!c.manual) {
          last.to = h + 1
        } else {
          segs.push({ from: h, to: h + 1, kind: c.kind, label: c.label, booked: !!c.booked, manual: !!c.manual })
        }
      })
      rows.push({
        tl, date: day.key, dow: day.dow, shift: cell.shift, role: cell.role, wfh: !!cell.wfh,
        from: schDecimal_(cell.start), to: schDecimal_(cell.end), segments: segs,
      })
    })
    coverage[day.key] = { rostered, onQueue }
  })

  return { hours, rows, coverage, oneOnOne, conflicts }
}

/** Management information is stripped here, not hidden in the browser. */
function schForRole_(full: { plan: SchPlan; timeline: Record<string, unknown> }, isAdmin: boolean): { plan: SchPlan; timeline: Record<string, unknown> } {
  if (isAdmin) return full
  const plan = { ...full.plan, gaps: [] as Record<string, unknown>[], problems: [] as Record<string, unknown>[], exceptions: [] as Record<string, unknown>[] }
  const timeline = { ...full.timeline, conflicts: [] as Record<string, unknown>[] }
  return { plan, timeline }
}

/** How many TL-days differ in shift between two plans. */
function schChangedCells_(a: { plan: SchPlan }, b: { plan: SchPlan }): number {
  let n = 0
  a.plan.tls.forEach((tl) => {
    a.plan.days.forEach((d) => {
      const x = (a.plan.grid[tl] || {})[d.key]
      const y = (b.plan.grid[tl] || {})[d.key]
      if ((x && x.shift) !== (y && y.shift)) n++
    })
  })
  return n
}

async function schBuildFull_(year: number, month0: number, variant: number): Promise<{ plan: SchPlan; timeline: Record<string, unknown> }> {
  const plan = await schBuildPlan_(year, month0, variant)
  return { plan, timeline: await schBuildTimeline_(plan) }
}

// ---------------------------------------------------------------- public: the plan

/**
 * The month plan plus its hour timeline, in one call.
 *   payload.fresh      re-read every input (a table edited by hand)
 *   payload.reshuffle  admin: step to the next roster variant (the Regenerate button)
 *   payload.original   admin: back to variant 0, V1's roster
 * A reshuffle returns `regen` = { from, to, changed, note } so the browser can say what happened.
 */
export async function schedulerPlan(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  const isAdmin = user.role === 'admin'
  const p = payload || {}
  const now = new Date()
  const year = schNum_(p.year, now.getFullYear())
  const month0 = schNum_(p.month, now.getMonth())
  const tag = schMonthTag_(year, month0)

  let regen: Record<string, unknown> | null = null
  if (p.reshuffle || p.original) {
    await requireRole(['admin'])
    const v0 = schVariant_(await schCfg_(), tag)
    const before = await schBuildFull_(year, month0, v0)
    let v = v0
    let after = before
    let note = ''
    if (p.original) {
      v = 0
      after = v0 === 0 ? before : await schBuildFull_(year, month0, 0)
    } else {
      // Try the next variants until one differs from what is showing without leaving a
      // slot uncovered that the current plan covers. The rotations repeat eventually.
      let found = false
      for (let i = 1; i <= 28 && !found; i++) {
        const cand = await schBuildFull_(year, month0, v0 + i)
        if ((cand.plan.gaps as unknown[]).length <= (before.plan.gaps as unknown[]).length && schChangedCells_(before, cand) > 0) {
          v = v0 + i
          after = cand
          found = true
        }
      }
      if (!found) note = 'No other arrangement keeps every shift covered, so the roster stays as it is.'
    }
    if (v !== v0) await schSetConfig_(schVariantKey_(tag), v)
    regen = { from: v0, to: v, changed: schChangedCells_(before, after), note }
  }

  const full = await schBuildFull_(year, month0, schVariant_(await schCfg_(), tag))
  const out = schForRole_(full, isAdmin)
  return { me: { email: user.email, name: user.name, role: user.role }, plan: out.plan as unknown as Record<string, unknown>, timeline: out.timeline, regen }
}

/** Writes the month's plan so other pages (working hours, reminders) can read it. Admin only; the server recomputes, it never trusts a posted grid. */
export async function schedulerSave(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const p = payload || {}
  const now = new Date()
  const year = schNum_(p.year, now.getFullYear())
  const month0 = schNum_(p.month, now.getMonth())
  const tag = schMonthTag_(year, month0)
  const plan = await schBuildPlan_(year, month0, schVariant_(await schCfg_(), tag))
  const timeline = (await schBuildTimeline_(plan)) as { rows: Record<string, unknown>[] }
  const tlRows: Record<string, Record<string, unknown>> = {}
  timeline.rows.forEach((r) => {
    tlRows[String(r.tl) + '|' + String(r.date)] = r
  })
  const savedRows: Record<string, unknown>[] = []
  plan.tls.forEach((tl) => {
    plan.days.forEach((d) => {
      const c = plan.grid[tl][d.key]
      if (!c) return
      // OFF and LEAVE are saved too: the working calendar must tell a rest day from a day with no plan.
      const off = c.shift === 'OFF'
      const r = tlRows[tl + '|' + d.key]
      savedRows.push({
        month: tag, date: d.key, tl_email: tl, shift: off ? (c.leave ? 'LEAVE' : 'OFF') : c.shift,
        from: off ? '' : String(r ? r.from : c.start), to: off ? '' : String(r ? r.to : c.end),
        wfh: !!c.wfh,
        segments_json: r ? r.segments : [],
        variant: plan.variant, submitted_by: user.email, submitted_at: new Date().toISOString(),
      })
    })
  })
  await db().from(SCH_TABLES.plan).delete().eq('month', tag)
  if (savedRows.length) {
    const { error } = await db().from(SCH_TABLES.plan).insert(savedRows)
    if (error) throw new Error(error.message)
  }
  wcReset()
  return { saved: savedRows.length, month: tag }
}

// ---------------------------------------------------------------- public: settings and team

export async function schedulerSettings(): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const team = await schLoadTeam_()
  return { config: await schCfg_(), defaults: SCH_DEFAULTS, team, shifts: SCH_SHIFTS, shiftHours: SCH_SHIFT_HOURS }
}

export async function schedulerSaveSettings(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const cfg = (payload || {}).config || payload || {}
  for (const k of Object.keys(cfg)) {
    if (!(k in SCH_DEFAULTS)) continue // whitelist
    await schSetConfig_(k, String((cfg as Record<string, unknown>)[k]))
  }
  void user
  return { saved: true }
}

/** Joining / leaving date for one lead (a blank date clears it). Also keeps the legacy `rows` bulk shape working. */
export async function schedulerSaveTeamDates(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const p = payload || {}
  if (Array.isArray(p.rows)) {
    for (const r of p.rows as Record<string, unknown>[]) {
      const ex = await findRow(SCH_TABLES.team, 'tl_email', normEmail_(r.tl_email ?? r.tlEmail))
      if (ex) await db().from(SCH_TABLES.team).update(r).eq('id', ex.id)
      else await db().from(SCH_TABLES.team).insert({ tl_email: normEmail_(r.tl_email ?? r.tlEmail), ...r })
    }
    return { saved: (p.rows as unknown[]).length }
  }
  const email = normEmail_(p.email)
  if (!email) throw new InputError('Which team lead?')
  const start = String(p.startDate || '').slice(0, 10)
  const end = String(p.endDate || '').slice(0, 10)
  if (start && end && end < start) throw new InputError('The leaving date is before the joining date.')
  await schDelete_(SCH_TABLES.team, (r) => normEmail_(r.tl_email ?? r.email) === email)
  if (start || end || p.note) {
    const dir = await pwDirectory()
    await db().from(SCH_TABLES.team).insert({ tl_email: email, name: dir.name(email), active: true, extra_json: { start_date: start, end_date: end, note: String(p.note || '') } })
  }
  void user
  return { saved: true }
}

// ---------------------------------------------------------------- public: off days

export async function schedulerOffDays(year: unknown, month: unknown): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const now = new Date()
  const y = schNum_(year, now.getFullYear())
  const m0 = schNum_(month, now.getMonth())
  const tag = schMonthTag_(y, m0)
  const fixed = await schLoadOffDays_(tag)
  const team = await schLoadTeam_()
  const tls = schActiveTLs_(team, y, m0)
  const dir = await pwDirectory()
  const coverage = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const off = tls.filter((t) => (fixed[t] || []).indexOf(dow) !== -1).length
    const unset = tls.filter((t) => !(fixed[t] || []).length).length
    return { dow, name: SCH_DOW_NAMES[dow], off, availableIfFixed: tls.length - off, unset }
  })
  const names: Record<string, string> = {}
  tls.forEach((t) => {
    names[t] = dir.name(t)
  })
  return {
    tls, names, offDays: fixed, dowNames: SCH_DOW_NAMES, coverage, monthTag: tag,
    monthName: schMonthName_(y, m0),
    month: tag, days: daysInMonth(tag),
    pairs: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: d + ',' + ((d + 1) % 7), label: SCH_DOW_NAMES[d] + ' + ' + SCH_DOW_NAMES[(d + 1) % 7] })),
  }
}

/** One lead's rest days: two CONSECUTIVE days (Saturday+Sunday counts, the week wraps). Blank hands them back to the rotation. The bulk `offdays`/`rows` shape still works. */
export async function schedulerSaveOffDays(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const p = payload || {}
  if (Array.isArray(p.offdays) || Array.isArray(p.rows)) {
    const mk = monthOf(p.year, p.month).tag
    const offs = (p.offdays || p.rows || []) as Record<string, unknown>[]
    const existing = (await table_(SCH_TABLES.offdays)).filter((r) => String(r.date || '').startsWith(mk))
    for (const o of offs) {
      const tl = normEmail_(o.tl_email ?? o.tlEmail)
      const date = String(o.date || '')
      if (!tl || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InputError('An off day needs a team lead and a yyyy-MM-dd date.')
      const cur = existing.filter((r) => normEmail_(r.tl_email) === tl && String(r.date) === date)[0]
      if (cur) await db().from(SCH_TABLES.offdays).update({ tl_email: tl, date }).eq('id', cur.id)
      else await db().from(SCH_TABLES.offdays).insert({ tl_email: tl, date })
    }
    return { saved: offs.length }
  }
  const tl = normEmail_(p.tl)
  if (!tl) throw new InputError('Which team lead?')
  const raw = String(p.offDays || '').trim()
  if (raw) {
    const days = raw.split(',').map((x) => parseInt(x, 10))
    if (days.length !== 2 || days.some((n) => isNaN(n) || n < 0 || n > 6)) throw new InputError('Pick exactly two days.')
    const gap = Math.abs(days[0] - days[1])
    if (gap !== 1 && gap !== 6) throw new InputError('The two rest days must be next to each other.')
  }
  const month = String(p.month || '').trim() // blank = the standing default
  const cell = month + ':' + raw
  await schDelete_(SCH_TABLES.offdays, (r) => {
    if (normEmail_(r.tl_email) !== tl) return false
    const m = String(r.date || '').match(/^(\d{4}-\d{2})?:(\d)/)
    return m ? (m[1] || '') === month : false
  })
  if (raw) await db().from(SCH_TABLES.offdays).insert({ tl_email: tl, date: cell })
  wcReset()
  void user
  return { saved: true }
}

// ---------------------------------------------------------------- public: overrides

/** Manager sets a specific day for a specific lead. Blank shift removes the override. */
export async function schedulerSetOverride(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const p = payload || {}
  const date = String(p.date || '').slice(0, 10)
  const tl = normEmail_(p.tl ?? p.tl_email ?? p.tlEmail)
  if (!date || !tl) throw new InputError('Need a date and a team lead.')
  const shift = String(p.shift || '').toUpperCase()
  if (['AM', 'PM', 'OFF', 'LEAVE', ''].indexOf(shift) === -1) throw new InputError('Unknown shift.')
  await schDelete_(SCH_TABLES.overrides, (r) => schDateKey_(r.date) === date && normEmail_(r.tl_email) === tl)
  if (shift) await db().from(SCH_TABLES.overrides).insert({ tl_email: tl, date, shift, note: schNotePack_({ reason: p.reason ?? p.note ?? '', wfh: !!p.wfh }) })
  void user
  return { saved: true }
}

/** What a lead is doing in an hour (or a block of hours). Blank kind hands them back to the generator. The single-hour `hour`/`clear` shape still works. */
export async function schedulerSetHourOverride(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const p = payload || {}
  const date = String(p.date || '').slice(0, 10)
  const tl = normEmail_(p.tl ?? p.tl_email ?? p.tlEmail)
  if (p.hour !== undefined && p.hourFrom === undefined) {
    const hour = dqNum_(p.hour)
    if (!tl || !date || !isFinite(hour)) throw new InputError('Give the team lead, day and hour.')
    const existing = (await table_(SCH_TABLES.hourOverrides)).filter(
      (r) => normEmail_(r.tl_email) === tl && schDateKey_(r.date) === date && dqNum_(r.hour) === hour,
    )[0]
    if (p.clear) {
      if (existing) await db().from(SCH_TABLES.hourOverrides).delete().eq('id', existing.id)
      return { ok: true, cleared: true }
    }
    const row = { tl_email: tl, date, hour, kind: String(p.kind || 'task'), label: String(p.label || '') }
    if (existing) await db().from(SCH_TABLES.hourOverrides).update(row).eq('id', existing.id)
    else await db().from(SCH_TABLES.hourOverrides).insert(row)
    return { ok: true }
  }
  const from = parseInt(String(p.hourFrom), 10)
  const to = isNaN(parseInt(String(p.hourTo), 10)) ? from : parseInt(String(p.hourTo), 10)
  if (!date || !tl || isNaN(from)) throw new InputError('Need a date, a team lead and an hour.')
  if (to < from) throw new InputError('The end hour is before the start hour.')
  const kind = String(p.kind || '').toLowerCase()
  if (['queue', 'people', 'task', 'break', ''].indexOf(kind) === -1) throw new InputError('Unknown activity.')
  await schDelete_(SCH_TABLES.hourOverrides, (r) => {
    const h = parseInt(String(r.hour), 10)
    return schDateKey_(r.date) === date && normEmail_(r.tl_email) === tl && h >= from && h <= to
  })
  if (kind) {
    const label = p.label || (kind === 'queue' ? 'Queue management' : kind === 'people' ? '1:1s / CTLs' : kind === 'break' ? 'Break' : 'Assigned task time')
    const rows: Record<string, unknown>[] = []
    for (let h = from; h <= to; h++) rows.push({ tl_email: tl, date, hour: h, kind, label: String(label) })
    await db().from(SCH_TABLES.hourOverrides).insert(rows)
  }
  void user
  return { saved: true }
}

// ---------------------------------------------------------------- public: requests

function schRequestOut_(r: Record<string, unknown>, user: { email: string }, dir: Directory): Record<string, unknown> {
  const meta = schNoteMeta_(r.note).meta
  const typ = String(r.type || '').toLowerCase()
  const withEmail = normEmail_(r.with_email ?? r.to_email)
  return {
    id: String(r.request_id), tl: normEmail_(r.tl_email ?? r.from_email), tlName: dir.name(String(r.tl_email ?? r.from_email ?? '')),
    type: typ, subtype: String(meta.subtype ?? r.subtype ?? ''),
    dateFrom: schDateKey_(r.date ?? r.date_from), dateTo: schDateKey_(r.their_date ?? r.date_to),
    shift: String(meta.shift ?? r.shift ?? ''),
    withTl: withEmail, withName: withEmail ? dir.name(withEmail) : '', withShift: String(meta.with_shift ?? r.with_shift ?? ''),
    reason: String(meta.reason ?? r.reason ?? ''), status: String(r.status || ''), peerStatus: String(meta.peer_status ?? r.peer_status ?? ''),
    requestedAt: pwIso_(r.submitted_at), decidedBy: String(r.decided_by || ''), decidedAt: pwIso_(r.decided_at), note: String(r.decided_note ?? r.note_decision ?? ''),
    needsMyAnswer: typ === 'swap' && String(r.status) === 'Awaiting peer' && withEmail === user.email,
  }
}

/** swap/time-off requests visible to this caller. */
export async function schedulerRequests(): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  const dir = await pwDirectory()
  let rows = await table_(SCH_TABLES.requests)
  if (user.role !== 'admin') rows = rows.filter((r) => normEmail_(r.tl_email ?? r.from_email) === user.email || normEmail_(r.with_email ?? r.to_email) === user.email)
  rows.sort((a, b) => pwMs_(b.submitted_at) - pwMs_(a.submitted_at))
  return { role: user.role, me: user.email, rows: rows.map((r) => schRequestOut_(r, user, dir)), requests: rows }
}

/** Files a request. Validation happens here, not in the browser. */
export async function schedulerSubmitRequest(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const p = payload || {}
  const type = String(p.type || '').toLowerCase()
  const tl = user.role === 'admin' ? normEmail_(p.tl ?? p.tl_email ?? p.tlEmail) || user.email : user.email
  if (!tl) throw new InputError('No team lead on the request.')
  if (['wfh', 'swap', 'leave', 'offday', 'time_off'].indexOf(type) === -1) throw new InputError('Unknown request type.')
  const dateFrom = String(p.dateFrom ?? p.date ?? '').slice(0, 10)
  const dateTo = String(p.dateTo ?? p.their_date ?? p.theirDate ?? p.dateFrom ?? p.date ?? '').slice(0, 10)
  if (!dateFrom) throw new InputError('Pick a date.')
  const from = schParse_(dateFrom)
  const to = schParse_(dateTo || dateFrom) || from
  if (!from) throw new InputError('That date is not valid.')
  if (to && to < from) throw new InputError('The end date is before the start date.')

  if (type === 'wfh') {
    // Cap per week, counting only what is already approved or waiting.
    const cap = schNum_((await schCfg_()).wfh_max_per_week, 1)
    const already = (await table_(SCH_TABLES.requests))
      .filter((r) => normEmail_(r.tl_email ?? r.from_email) === tl && String(r.type).toLowerCase() === 'wfh' && ['Approved', 'Pending'].indexOf(String(r.status)) !== -1)
      .filter((r) => {
        const d2 = schParse_(schDateKey_(r.date ?? r.date_from))
        return d2 && schWeekIndex_(d2) === schWeekIndex_(from)
      }).length
    if (already >= cap) throw new InputError('Working from home is limited to ' + cap + ' day per week, and you already have one that week.')
  }
  const withTl = normEmail_(p.withTl ?? p.with_tl ?? p.to_email ?? p.toEmail)
  if (type === 'swap') {
    if (!withTl) throw new InputError('Choose who you are swapping with.')
    if (withTl === tl) throw new InputError('You cannot swap with yourself.')
  }
  // An off-day change is a request: the pair is carried in `shift` as "d1,d2" and only
  // takes effect when the CX Manager approves it.
  if (type === 'offday') {
    const days = String(p.shift || '').split(',').map((x) => parseInt(x, 10))
    if (days.length !== 2 || days.some((n) => isNaN(n) || n < 0 || n > 6)) throw new InputError('Choose which two days you are asking for.')
    const gap = Math.abs(days[0] - days[1])
    if (gap !== 1 && gap !== 6) throw new InputError('The two rest days must be next to each other.')
  }
  const id = newId('R')
  const row = {
    request_id: id, type: type === 'time_off' ? 'leave' : type,
    from_email: tl, to_email: withTl, date: dateFrom, their_date: dateTo || dateFrom,
    note: schNotePack_({ subtype: p.subtype || '', shift: type === 'offday' ? String(p.shift) : String(p.shift || '').toUpperCase(), with_shift: String(p.withShift || '').toUpperCase(), reason: p.reason ?? p.note ?? '', peer_status: type === 'swap' ? 'Pending' : '', peer_at: '' }),
    // Swaps wait on the other lead first: the manager should not arbitrate what the two have not agreed.
    status: type === 'swap' ? 'Awaiting peer' : 'Pending',
    decided_by: '', decided_at: null, decided_note: '',
  }
  await appendRow(SCH_TABLES.requests, row, user.email)
  if (type === 'swap' && withTl) {
    await raisePopup({ recipient: withTl, kind: 'sched_swap', ref: id, title: user.name + ' wants to swap a shift', body: dateFrom + ' for ' + dateTo + (p.reason ? ' — ' + String(p.reason) : ''), link: '#/scheduler' }, user.email)
  }
  return { requestId: id }
}

/** The other half of a swap agrees or declines. Only the named counterparty may answer. */
export async function schedulerRespondToSwap(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['tl', 'admin'])
  await assertWritable()
  const p = payload || {}
  const id = String(p.id ?? p.request_id ?? p.requestId)
  const r = await findRow(SCH_TABLES.requests, 'request_id', id)
  if (!r) throw new InputError('Request not found.', 404)
  if (String(r.type).toLowerCase() !== 'swap') throw new InputError('That request is not a swap.')
  if (String(r.status) !== 'Awaiting peer') throw new InputError('That swap is no longer waiting on you.')
  const dir = await pwDirectory()
  if (user.role !== 'admin' && user.email !== normEmail_(r.with_email ?? r.to_email)) throw new InputError('Only ' + dir.name(String(r.with_email ?? r.to_email ?? '')) + ' can answer this swap.')
  const accept = p.accept === true || String(p.accept) === 'true'
  const meta = schNoteMeta_(r.note).meta
  meta.peer_status = accept ? 'Accepted' : 'Declined'
  meta.peer_at = new Date().toISOString()
  await db().from(SCH_TABLES.requests).update({ status: accept ? 'Pending' : 'Declined by peer', note: schNotePack_(meta) }).eq('request_id', r.request_id)
  await resolvePopups('sched_swap', String(r.request_id), user.email)
  return { ok: true, status: accept ? 'Pending' : 'Declined by peer' }
}

/**
 * Approve or reject. Only the CX Manager decides. A working-from-home day is refused
 * unless somebody else is physically on that shift: the floor is never left empty.
 */
export async function schedulerDecide(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const p = payload || {}
  const id = String(p.id ?? p.request_id ?? p.requestId)
  const r = await findRow(SCH_TABLES.requests, 'request_id', id)
  if (!r) throw new InputError('Request not found.', 404)
  const ok = p.decision !== undefined ? String(p.decision).toLowerCase() === 'approve' : p.approve === true || String(p.approve) === 'true'
  const type = String(r.type || '').toLowerCase()
  const meta = schNoteMeta_(r.note).meta
  const dir = await pwDirectory()

  if (ok && type === 'swap' && String(meta.peer_status ?? r.peer_status) !== 'Accepted') {
    throw new InputError('Cannot approve yet: ' + dir.name(String(r.with_email ?? r.to_email ?? '')) + ' has not agreed to this swap.')
  }
  if (ok && type === 'wfh') {
    const from = schParse_(schDateKey_(r.date ?? r.date_from))
    if (from) {
      const tag = schMonthTag_(from.getFullYear(), from.getMonth())
      const cfg = await schCfg_()
      cfg._offDays = await schLoadOffDays_(tag)
      cfg._offDates = await schLoadOffDates_()
      cfg._team = await schLoadTeam_()
      cfg._variant = schVariant_(cfg, tag)
      const roster = schBuildRoster_(schActiveTLs_(cfg._team, from.getFullYear(), from.getMonth()), schMonthDays_(from.getFullYear(), from.getMonth()), cfg, await schLoadOverrides_())
      const slot = roster.plan[schKey_(from)] || { AM: [], PM: [], OFF: [], WFH: {} }
      const shift = String(meta.shift ?? r.shift ?? '').toUpperCase() || 'PM'
      const tlEmail = normEmail_(r.tl_email ?? r.from_email)
      if (!(slot[shift as 'AM' | 'PM'] || []).filter((t) => t !== tlEmail).length) {
        throw new InputError('Cannot approve: nobody else is on the ' + shift + ' shift that day, so the floor would be empty.')
      }
    }
  }
  // Approving an off-day request applies it, for the month the request falls in.
  if (ok && type === 'offday') {
    const d = schParse_(schDateKey_(r.date ?? r.date_from))
    if (d) await schedulerSaveOffDays({ tl: r.tl_email ?? r.from_email, offDays: String(meta.shift ?? r.shift ?? ''), month: schMonthTag_(d.getFullYear(), d.getMonth()), note: 'Approved request ' + id })
  }
  await db()
    .from(SCH_TABLES.requests)
    .update({ status: ok ? 'Approved' : 'Rejected', decided_by: user.email, decided_at: new Date().toISOString(), decided_note: String(p.note ?? '').slice(0, 500) })
    .eq('request_id', r.request_id)
  await resolvePopups('sched_swap', String(r.request_id), user.email)
  return { ok: true, status: ok ? 'Approved' : 'Rejected' }
}

/**
 * Takes a pasted roster ("name or email, date, shift" per line, comma or tab separated)
 * and writes it in as overrides. Validates every row first: a half-applied import is worse
 * than a rejected one.
 */
export async function schedulerImport(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  await requireRole(['admin'])
  await assertWritable()
  const p = payload || {}
  const text = String(p.text || '').trim()
  if (!text) throw new InputError('Nothing to import.')
  const team = await schLoadTeam_()
  const find = (s: string) => {
    const q = String(s).trim().toLowerCase()
    const hit = team.filter((t) => t.email === q || t.display.toLowerCase() === q)[0]
    return hit ? hit.name : ''
  }
  const rows: { who: string; date: string; shift: string }[] = []
  const errors: string[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim()
    if (!raw) return
    const parts = raw.split(/\t|,/).map((x) => x.trim()).filter((x) => x !== '')
    if (parts.length < 3) {
      errors.push('Line ' + (i + 1) + ': expected name, date, shift')
      return
    }
    const who = find(parts[0])
    const date = parts[1].slice(0, 10)
    const shift = parts[2].toUpperCase()
    if (!who) {
      errors.push('Line ' + (i + 1) + ': "' + parts[0] + '" is not a team lead (team: ' + team.map((t) => t.display).join(', ') + ')')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push('Line ' + (i + 1) + ': "' + parts[1] + '" is not a date (use YYYY-MM-DD)')
      return
    }
    if (['AM', 'PM', 'OFF', 'LEAVE'].indexOf(shift) === -1) {
      errors.push('Line ' + (i + 1) + ': "' + parts[2] + '" must be AM, PM, OFF or LEAVE')
      return
    }
    rows.push({ who, date, shift })
  })
  if (errors.length) {
    throw new InputError(errors.length + ' problem' + (errors.length === 1 ? '' : 's') + ', nothing imported:\n' + errors.slice(0, 10).join('\n') + (errors.length > 10 ? '\n…and ' + (errors.length - 10) + ' more' : ''))
  }
  if (!rows.length) throw new InputError('No usable rows found.')
  // One delete pass and one append for the whole paste.
  const keyOf = (date: string, tl: string) => date + '|' + normEmail_(tl)
  const incoming: Record<string, { who: string; date: string; shift: string }> = {}
  rows.forEach((r) => {
    incoming[keyOf(r.date, r.who)] = r
  })
  await schDelete_(SCH_TABLES.overrides, (r) => !!incoming[keyOf(schDateKey_(r.date), String(r.tl_email))])
  await db().from(SCH_TABLES.overrides).insert(
    Object.keys(incoming).map((k) => {
      const r = incoming[k]
      return { tl_email: normEmail_(r.who), date: r.date, shift: r.shift, note: schNotePack_({ reason: 'Imported', wfh: false }) }
    }),
  )
  return { imported: Object.keys(incoming).length }
}

/** setupSchedulerTables: DDL lives in migrations/007; kept as the legacy no-op probe. */
export async function setupSchedulerTables(): Promise<Record<string, unknown>> {
  await requireRole(['admin'])
  const found: Record<string, boolean> = {}
  for (const t of Object.values(SCH_TABLES)) {
    const { error } = await db().from(t).select('id').limit(1)
    found[t] = !error
  }
  return { tables: found }
}

/** importOctober2026Shifts verbatim: one-off, applies the October 2026 shifts (same as pasting them into Settings > Import). Safe to run twice: it replaces the same days. */
export async function importOctober2026Shifts(): Promise<Record<string, unknown>> {
  const lines = [
    'Menna Mekawy, 2026-10-01, AM',
    'Menna Mekawy, 2026-10-02, AM',
    'Menna Mekawy, 2026-10-03, PM',
    'Menna Mekawy, 2026-10-04, OFF',
    'Menna Mekawy, 2026-10-05, OFF',
    'Menna Mekawy, 2026-10-06, PM',
    'Menna Mekawy, 2026-10-07, PM',
    'Menna Mekawy, 2026-10-08, PM',
    'Menna Mekawy, 2026-10-09, PM',
    'Menna Mekawy, 2026-10-10, PM',
    'Menna Mekawy, 2026-10-11, OFF',
    'Menna Mekawy, 2026-10-12, OFF',
    'Ahmed Naguib, 2026-10-09, OFF',
    'Ahmed Naguib, 2026-10-10, OFF',
    'Ahmed Naguib, 2026-10-11, AM',
    'Ahmed Naguib, 2026-10-12, AM',
    'Ahmed Naguib, 2026-10-13, AM',
    'Ahmed Naguib, 2026-10-14, AM',
    'Ahmed Naguib, 2026-10-15, AM',
    'Ahmed Naguib, 2026-10-16, OFF',
    'Ahmed Naguib, 2026-10-17, OFF',
    'Ahmed Naguib, 2026-10-18, AM',
    'Ahmed Naguib, 2026-10-19, AM',
    'Ahmed Naguib, 2026-10-20, AM',
    'Ahmed Naguib, 2026-10-21, AM',
    'Ahmed Naguib, 2026-10-22, AM',
    'Ahmed Naguib, 2026-10-23, OFF',
    'Ahmed Naguib, 2026-10-24, OFF',
    'Ahmed Naguib, 2026-10-25, PM',
    'Ahmed Naguib, 2026-10-26, PM',
    'Ahmed Naguib, 2026-10-27, PM',
    'Ahmed Naguib, 2026-10-28, PM',
    'Ahmed Naguib, 2026-10-29, PM',
    'Ahmed Naguib, 2026-10-30, OFF',
    'Ahmed Naguib, 2026-10-31, OFF',
  ]
  return schedulerImport({ text: lines.join('\n') })
}
