/**
 * Who works when — port of original_deprecated/WorkCalendar.js plus the
 * calendar-dependent helpers of PeopleCore.js / WorkCore.js (pwIsWorkingDate_,
 * pwAddWorkingDays_, pwWorkingDaysBetween_, pwWorkingHours_, pwFreeHours_).
 *
 * For each day it combines, in this order:
 *   1. a public holiday in the person's based-in country (roster based_in_country
 *      + the `holidays` table) -> { working: false, reason: 'holiday' }
 *   2. team leads: the TL schedule behind wcTlScheduleSource() — an adapter
 *      interface reading the tlp/shift tables (`tl_shift_plan`, `tl_off_days`,
 *      `team_leads`, the live `tlp_shifts`; V2 scheduler tables
 *      `sched_plan`/`sched_offdays` win where they have a row).
 *        ShiftPlan row AM/PM      -> working on that shift
 *        ShiftPlan row OFF/LEAVE  -> { working: false, reason: 'off' }
 *        no row, TLOffDays weekday-> off
 *        no row, not an off day   -> working, shift from config tl_shifts (default AM), estimated
 *   3. everyone else: no fixed days off by default (agent days off are
 *      rotational), overridable per country and per person (dqDaysOffFor_:
 *      roster days_off, then config days_off_by_country, then days_off_default).
 *
 * Days are Kuwait dates (yyyy-MM-dd). State is cached ~60 s in-memory.
 */

import 'server-only'

import { db, cacheGet, cachePut, cacheRemove } from './repo'
import { getConfig, dqSetting } from './settings'
import { normEmail } from './identity'
import {
  pwMs, pwKwDate, pwKwTime, pwDateOnly, pwAt, pwDow, pwAddDays, pwToday, PW_DAY_MS,
} from './time'

export const WC_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WC_DEFAULT_DAYS_OFF: string[] = [] // agent days off are rotational: no fixed default
const DQ_WEEKDAYS = WC_WEEKDAYS

export interface WorkingDay {
  date: string
  working: boolean
  reason: 'off' | 'holiday' | null
  shift: string | null
  estimated: boolean
}

export interface TlSchedule {
  /** 'email|yyyy-MM-dd' -> 'AM'|'PM'|'OFF'|'LEAVE' */
  shifts: Record<string, string>
  /** 'email|yyyy-MM' or 'email|' -> weekday numbers off */
  offDays: Record<string, number[]>
}

interface WcState {
  roster: Record<string, Record<string, unknown>>
  holidays: Record<string, string>
  tl: TlSchedule | null
  hours: Record<string, { hours: number; estimated: boolean; days: { date: string; hours: number }[] }>
}

const WC_STATE_TTL_S = 60

/** Drop the cached state (wcReset_) — tests, or after an admin edits days off / holidays. */
export function wcReset(): void {
  cacheRemove('wc_state_v1')
}

function wcStateCached(): WcState | null {
  const hit = cacheGet('wc_state_v1')
  return hit ? (JSON.parse(hit) as WcState) : null
}

async function wcState(): Promise<WcState> {
  const hit = wcStateCached()
  if (hit) return hit
  const roster: Record<string, Record<string, unknown>> = {}
  try {
    const { data } = await db().from('roster').select('email,role,days_off,based_in_country')
    ;(data || []).forEach((r) => {
      const e = normEmail(r.email)
      if (e) roster[e] = r as Record<string, unknown>
    })
  } catch {
    /* no roster: everyone works the default pattern */
  }
  const st: WcState = { roster, holidays: await dqHolidayIndex(), tl: null, hours: {} }
  cacheRemove('wc_tl_sched_v1')
  cachePut('wc_state_v1', JSON.stringify(st), WC_STATE_TTL_S)
  return st
}

// ---------- days off and public holidays (the Engineer A rules from WorkCalendar.js) ----------

const DQ_HOLIDAYS_TABLE = 'holidays'

/** "Fri,Sat" / ["Fri","Sat"] -> ['Fri','Sat'] in week order; throws on anything else (dqParseDaysOff_). */
export function dqParseDaysOff(v: unknown): string[] {
  if (v === '' || v === null || v === undefined) return []
  const list = Array.isArray(v) ? v : String(v).split(',')
  const out: string[] = []
  list.forEach((d) => {
    let k = String(d).trim().slice(0, 3)
    k = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()
    if (!k) return
    if (DQ_WEEKDAYS.indexOf(k) === -1) {
      throw new Error('Days off are weekday names (Sun to Sat), not "' + d + '".')
    }
    if (out.indexOf(k) === -1) out.push(k)
  })
  if (out.length > 7) throw new Error('A week has only seven days.')
  return DQ_WEEKDAYS.filter((d) => out.indexOf(d) !== -1)
}

/**
 * Days off for a person (dqDaysOffFor_): their own days_off, else their
 * based-in country's days_off_by_country entry, else days_off_default.
 */
export async function dqDaysOffFor(person: Record<string, unknown> | null | undefined): Promise<string[]> {
  const own = dqParseDaysOff(person && person.days_off)
  if (own.length) return own
  const byCountry = ((await dqSetting('days_off_by_country')) || {}) as Record<string, unknown>
  const c = person && person.based_in_country ? byCountry[String(person.based_in_country)] : null
  if (c) return dqParseDaysOff(c)
  return dqParseDaysOff(await dqSetting('days_off_default'))
}

/** Active holidays as { 'Country|yyyy-MM-dd': name } (dqHolidayIndex_). */
export async function dqHolidayIndex(): Promise<Record<string, string>> {
  const idx: Record<string, string> = {}
  try {
    const { data, error } = await db().from(DQ_HOLIDAYS_TABLE).select('country, date, name, deleted_at')
    if (error) return idx
    ;(data || []).forEach((h) => {
      if (h.deleted_at) return
      const d = String(h.date).slice(0, 10)
      idx[String(h.country).trim().toLowerCase() + '|' + d] = String(h.name)
    })
  } catch {
    /* no holidays table: nobody is on holiday */
  }
  return idx
}

export function dqIsHoliday(country: unknown, dateKey: string, index?: Record<string, string>): boolean {
  if (!country) return false
  const idx = index || {}
  return !!idx[String(country).trim().toLowerCase() + '|' + dateKey]
}

/** True when dateKey is a day off or a public holiday for this roster person (dqIsOffDay_). */
export async function dqIsOffDay(
  person: Record<string, unknown> | null | undefined,
  dateKey: string,
  holidayIndex?: Record<string, string>
): Promise<boolean> {
  const p = dateKey.split('-')
  const dow = DQ_WEEKDAYS[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()]
  const idx = holidayIndex || (await dqHolidayIndex())
  return (await dqDaysOffFor(person)).indexOf(dow) !== -1 || dqIsHoliday(person && person.based_in_country, dateKey, idx)
}

export function wcIsHoliday(row: Record<string, unknown> | null | undefined, date: string, st: WcState): boolean {
  const c = row && String(row.based_in_country || '').trim().toLowerCase()
  return !!c && !!st.holidays[c + '|' + date]
}

/** Weekday names off for a roster row (wcDaysOff_), falling back to none (rotational days off). */
async function wcDaysOff(row: Record<string, unknown> | null | undefined): Promise<string[]> {
  try {
    return await dqDaysOffFor(row || {})
  } catch {
    /* malformed override: fall through to the default */
  }
  const d = await getConfig('days_off_default', WC_DEFAULT_DAYS_OFF)
  return Array.isArray(d) ? (d as string[]) : String(d).split(',')
}

/**
 * The calendar for one person (getWorkingCalendar_), one entry per date from
 * fromDate to toDate inclusive:
 *   { date, working, reason: 'off'|'holiday'|null, shift: 'AM'|'PM'|null, estimated }
 * email may be blank: the default pattern with no holidays.
 */
export async function getWorkingCalendar(
  email: string,
  fromDate: string,
  toDate: string
): Promise<WorkingDay[]> {
  const st = await wcState()
  email = normEmail(email)
  const row = email ? st.roster[email] : null
  const role = row ? String(row.role || '') : ''
  const isTl = role === 'tl'
  const tl = isTl ? await wcTlSchedule(st) : null
  const off = await wcDaysOff(row)
  const tlShifts = (await getConfig('tl_shifts', {})) as Record<string, unknown>
  const defaultShift = isTl ? (tlShifts && tlShifts[email] ? String(tlShifts[email]).toUpperCase() : 'AM') : null
  const out: WorkingDay[] = []
  let d = pwDateOnly(fromDate)
  const last = pwDateOnly(toDate)
  let guard = 0
  while (d && d <= last && guard++ < 800) {
    const dow = pwDow(d)
    let day: WorkingDay = { date: d, working: true, reason: null, shift: defaultShift, estimated: true }
    const planned = tl ? tl.shifts[email + '|' + d] : undefined
    const tlOff = tl ? wcTlOffDays(tl, email, d) : null
    if (wcIsHoliday(row, d, st)) {
      day = { date: d, working: false, reason: 'holiday', shift: null, estimated: false }
    } else if (planned !== undefined) {
      day =
        planned === 'AM' || planned === 'PM'
          ? { date: d, working: true, reason: null, shift: planned, estimated: false }
          : { date: d, working: false, reason: 'off', shift: null, estimated: false }
    } else if (tlOff) {
      if (tlOff.indexOf(dow) !== -1) {
        day = { date: d, working: false, reason: 'off', shift: null, estimated: false }
      }
    } else if (off.indexOf(WC_WEEKDAYS[dow]) !== -1) {
      day = { date: d, working: false, reason: 'off', shift: null, estimated: true }
    }
    out.push(day)
    d = pwAddDays(d, 1)
  }
  return out
}

/** One day for one person (wcDay_). */
export async function wcDay(email: string, date: string): Promise<WorkingDay> {
  return (await getWorkingCalendar(email, date, date))[0]
}

// ---------------------------------------------------------------- TL schedule source (adapter)

let wcTlInflight: Promise<TlSchedule> | null = null

function wcTlSchedule(st: WcState): Promise<TlSchedule> {
  if (st.tl) return Promise.resolve(st.tl)
  if (!wcTlInflight) {
    wcTlInflight = wcTlScheduleSource().then(
      (s) => {
        wcTlInflight = null
        return s
      },
      (e) => {
        wcTlInflight = null
        throw e
      }
    )
  }
  return wcTlInflight.then((s) => (st.tl = s))
}

/** TLOffDays weekdays for a TL on a date: the month's row beats the standing default (wcTlOffDays_). */
function wcTlOffDays(tl: TlSchedule, email: string, date: string): number[] | null {
  const month = tl.offDays[email + '|' + date.slice(0, 7)]
  return month || tl.offDays[email + '|'] || null
}

/**
 * THE ONLY reader of the TL schedule (wcTlScheduleSource_): the `tl_shift_plan`
 * (month,date,tl,shift), `tl_off_days` (month,tl,off_days "5,6" weekday numbers)
 * and `team_leads` (name,email) tables — the ported V1 CX Ops tabs — layered with
 * V2's own scheduler tables `sched_plan` / `sched_offdays` where they have a row.
 * Read-only, best-effort: missing tables mean no planned schedule.
 * Replaceable: setTlScheduleSource() swaps in another source (tests, V2 scheduler).
 */
export type TlScheduleSource = () => Promise<TlSchedule>

let tlScheduleSourceImpl: TlScheduleSource = defaultTlScheduleSource

export function setTlScheduleSource(fn: TlScheduleSource | null): void {
  tlScheduleSourceImpl = fn || defaultTlScheduleSource
  wcReset()
}

export async function wcTlScheduleSource(): Promise<TlSchedule> {
  return tlScheduleSourceImpl()
}

async function readIfPresent(table: string): Promise<Record<string, unknown>[]> {
  try {
    const { data, error } = await db().from(table).select('*')
    if (error) return []
    return (data || []) as Record<string, unknown>[]
  } catch {
    return []
  }
}

const EMPTY_SCHEDULE: TlSchedule = { shifts: {}, offDays: {} }

/**
 * The TL schedule readers, layered: the legacy V1 tabs (wcTlScheduleSourceV1_),
 * then the live `tlp_shifts` table (migrations/003), then V2's own scheduler
 * tables (schSavedSource_ equivalent) — later layers win where they have a row.
 */
async function defaultTlScheduleSource(): Promise<TlSchedule> {
  const hit = cacheGet('wc_tl_sched_v1')
  if (hit) {
    try {
      return JSON.parse(hit) as TlSchedule
    } catch {
      /* rebuild */
    }
  }
  const merged: TlSchedule = { shifts: {}, offDays: {} }
  const srcs: (TlSchedule | null)[] = [await wcTlScheduleSourceV1(), await tlpShiftsSource(), await schedSavedSource()]
  srcs.forEach((src) => {
    if (!src) return
    Object.keys(src.shifts).forEach((k) => {
      merged.shifts[k] = src.shifts[k]
    })
    Object.keys(src.offDays).forEach((k) => {
      merged.offDays[k] = src.offDays[k]
    })
  })
  cachePut('wc_tl_sched_v1', JSON.stringify(merged), 600)
  return merged
}

async function wcTlScheduleSourceV1(): Promise<TlSchedule> {
  const cacheHit = cacheGet('wc_v1_tl')
  if (cacheHit) {
    try {
      return JSON.parse(cacheHit) as TlSchedule
    } catch {
      /* rebuild */
    }
  }
  const [teamLeads, shiftPlan, tlOffDays] = await Promise.all([
    readIfPresent('team_leads'),
    readIfPresent('tl_shift_plan'),
    readIfPresent('tl_off_days'),
  ])
  if (!teamLeads.length && !shiftPlan.length && !tlOffDays.length) return EMPTY_SCHEDULE
  const emailOf: Record<string, string> = {}
  teamLeads.forEach((r) => {
    const n = String(r.name || '').trim().toLowerCase()
    const e = normEmail(r.email)
    if (n && e) emailOf[n] = e
  })
  const who = (v: unknown): string => {
    const s = String(v || '').trim()
    if (s.indexOf('@') !== -1) return normEmail(s)
    return emailOf[s.toLowerCase()] || ''
  }
  const out: TlSchedule = { shifts: {}, offDays: {} }
  const from = pwAddDays(pwToday(), -120)
  const to = pwAddDays(pwToday(), 120)
  shiftPlan.forEach((r) => {
    const e = who(r.tl)
    const d = pwDateOnly(r.date)
    if (!e || !d || d < from || d > to) return
    out.shifts[e + '|' + d] = String(r.shift || '').trim().toUpperCase()
  })
  tlOffDays.forEach((r) => {
    const e = who(r.tl)
    const days = String(r.off_days || r.offDays || '')
      .split(',')
      .map((x) => parseInt(x, 10))
      .filter((n) => n >= 0 && n <= 6)
    if (!e || !days.length) return
    const m = String(r.month || '').trim().slice(0, 7)
    out.offDays[e + '|' + (/^\d{4}-\d{2}$/.test(m) ? m : '')] = days
  })
  cachePut('wc_v1_tl', JSON.stringify(out), 600)
  return out
}

/**
 * The live `tlp_shifts` table (migrations/003): one row per TL per date with the
 * actual shift_start / shift_end instants. Classified into AM / PM by the Kuwait
 * start hour (AM 09:30, PM 13:00); days without a row fall through to the
 * weekday-off / default-shift logic like an unplanned day.
 */
async function tlpShiftsSource(): Promise<TlSchedule | null> {
  const rows = await readIfPresent('tlp_shifts')
  if (!rows.length) return null
  const out: TlSchedule = { shifts: {}, offDays: {} }
  rows.forEach((r) => {
    const e = normEmail(r.tl_email || r.email)
    const d = pwDateOnly(r.date)
    const startMs = pwMs(r.shift_start)
    if (!e || !d || isNaN(startMs)) return
    const hour = Number(pwKwTime(startMs).slice(0, 2))
    out.shifts[e + '|' + d] = hour < 12 ? 'AM' : 'PM'
  })
  return out
}

/**
 * V2's own scheduler tables (schSavedSource_ equivalent): `sched_plan`
 * (email|tl, date, shift) and `sched_offdays` (email|tl, month?, off_days).
 * Returns null when neither table exists — V1 alone drives the calendar.
 */
async function schedSavedSource(): Promise<TlSchedule | null> {
  const [plan, offDays] = await Promise.all([readIfPresent('sched_plan'), readIfPresent('sched_offdays')])
  if (!plan.length && !offDays.length) return null
  const out: TlSchedule = { shifts: {}, offDays: {} }
  plan.forEach((r) => {
    const e = normEmail(r.tl || r.email)
    const d = pwDateOnly(r.date)
    if (!e || !d) return
    out.shifts[e + '|' + d] = String(r.shift || '').trim().toUpperCase()
  })
  offDays.forEach((r) => {
    const e = normEmail(r.tl || r.email)
    const days = String(r.off_days || r.offDays || '')
      .split(',')
      .map((x) => parseInt(x, 10))
      .filter((n) => n >= 0 && n <= 6)
    if (!e || !days.length) return
    const m = String(r.month || '').trim().slice(0, 7)
    out.offDays[e + '|' + (/^\d{4}-\d{2}$/.test(m) ? m : '')] = days
  })
  return out
}

// ---------------------------------------------------------------- working days (PeopleCore.js)

/** True when `date` is a working day for `email` (blank email = the default pattern) — pwIsWorkingDate_. */
export async function pwIsWorkingDate(email: string, date: string): Promise<boolean> {
  return (await wcDay(email, date)).working
}

/** The date n working days (for `email`) after dateStr. n = 0 returns dateStr (pwAddWorkingDays_). */
export async function pwAddWorkingDays(email: string, dateStr: string, n: number): Promise<string> {
  if (!(n > 0)) return dateStr
  const span = n * 2 + 14
  let from = pwAddDays(dateStr, 1)
  for (let tries = 0; tries < 6; tries++) {
    const cal = await getWorkingCalendar(email, from, pwAddDays(from, span - 1))
    for (const day of cal) {
      if (day.working && --n === 0) return day.date
    }
    from = pwAddDays(from, span)
  }
  return pwAddDays(dateStr, n) // nobody works for months: fall back to calendar days
}

/** Working days for `email` strictly after `from`, up to and including `to` (pwWorkingDaysBetween_). */
export async function pwWorkingDaysBetween(email: string, from: string, to: string): Promise<number> {
  if (!(to > from)) return 0
  return (await getWorkingCalendar(email, pwAddDays(from, 1), to)).filter((d) => d.working).length
}

// ---------------------------------------------------------------- working hours (WorkCore.js)

function pwShiftDefs(): Record<string, { start: string; end: string }> {
  return { AM: { start: '09:30', end: '18:30' }, PM: { start: '13:00', end: '22:00' } }
}

async function pwShiftDefsCfg(): Promise<Record<string, { start: string; end: string }>> {
  const d = await getConfig('shift_defs', null)
  return d && typeof d === 'object' && !Array.isArray(d)
    ? (d as Record<string, { start: string; end: string }>)
    : pwShiftDefs()
}

async function pwBreakHours(): Promise<number> {
  const b = Number(await getConfig('shift_break_hours', 1))
  return b >= 0 && b < 4 ? b : 1
}

/** Paid working hours on one calendar day inside [fromMs, toMs] (pwDayHours_). */
export function pwDayHours(
  day: WorkingDay,
  fromMs: number,
  toMs: number,
  shiftDefs: Record<string, { start: string; end: string }>,
  breakHours: number
): number {
  if (!day.working || !day.shift) return 0
  const def = shiftDefs[day.shift]
  if (!def) return 0
  const s = pwAt(day.date, def.start)
  let e = pwAt(day.date, def.end)
  if (e <= s) e += PW_DAY_MS
  const lenH = (e - s) / 3600000
  const ov = Math.max(0, Math.min(e, toMs) - Math.max(s, fromMs)) / 3600000
  return lenH > 0 ? (ov * (lenH - breakHours)) / lenH : 0
}

export interface WorkingHours {
  hours: number
  estimated: boolean
  days: { date: string; hours: number }[]
}

/**
 * Working hours between two instants, from the person's working calendar
 * (pwWorkingHours_): days off and holidays give 0. A working day with no known
 * shift (an agent) counts as the AM shift. Results memoized within the cached
 * state like the legacy per-execution memo.
 */
export async function pwWorkingHours(email: string, startMs: number, endMs: number): Promise<WorkingHours> {
  if (!(endMs > startMs)) return { hours: 0, estimated: false, days: [] }
  const st = await wcState()
  const key = email + '|' + startMs + '|' + endMs
  if (st.hours[key]) {
    const h = st.hours[key]
    return { hours: h.hours, estimated: h.estimated, days: h.days }
  }
  const shiftDefs = await pwShiftDefsCfg()
  const breakHours = await pwBreakHours()
  const out: WorkingHours = { hours: 0, estimated: false, days: [] }
  ;(await getWorkingCalendar(email, pwKwDate(startMs), pwKwDate(endMs))).forEach((dayIn) => {
    let day = dayIn
    if (day.working && !day.shift) {
      day = { date: day.date, working: true, shift: 'AM', estimated: day.estimated, reason: day.reason }
    }
    const h = pwDayHours(day, startMs, endMs, shiftDefs, breakHours)
    if (h > 0) {
      if (day.estimated) out.estimated = true
      out.days.push({ date: day.date, hours: h })
    }
    out.hours += h
  })
  st.hours[key] = out
  return { hours: out.hours, estimated: out.estimated, days: out.days }
}

/**
 * Free task hours for one window after the owner's other open tasks take theirs,
 * earliest-first (pwFreeHours_). others: [{ startMs, endMs, remaining }].
 */
export async function pwFreeHours(
  email: string,
  startMs: number,
  endMs: number,
  others: { startMs: number; endMs: number; remaining: number }[]
): Promise<number> {
  const capacity: Record<string, number> = {}
  const full = async (date: string): Promise<number> => {
    if (!(date in capacity)) {
      capacity[date] = (await pwWorkingHours(email, pwAt(date, '00:00'), pwAt(pwAddDays(date, 1), '00:00'))).hours
    }
    return capacity[date]
  }
  const sorted = others.slice().sort((a, b) => a.endMs - b.endMs || a.startMs - b.startMs)
  for (const o of sorted) {
    let left = o.remaining
    for (const day of (await pwWorkingHours(email, o.startMs, o.endMs)).days) {
      if (left <= 0) break
      const take = Math.min(left, day.hours, await full(day.date))
      capacity[day.date] = (await full(day.date)) - take
      left -= take
    }
  }
  let free = 0
  for (const day of (await pwWorkingHours(email, startMs, endMs)).days) {
    free += Math.min(day.hours, Math.max(0, await full(day.date)))
  }
  return free
}
