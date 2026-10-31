/**
 * ProdTph.js ported 1:1 — TPH (touches per hour) with per-hour, per-channel caps. The pure
 * rules keep the legacy names/signatures; store reads (prod_tph_* rows, agg_queue_now,
 * Maqsam Calls, Activities, Freshchat, agg_inflow_hourly, Config) are injected.
 */

import {
  dqAddDays_,
  dqSetting_,
  dqTzOffsetMin_,
  dqWallToUtc_,
  formatDate_,
  normEmail_,
  prodFileFor_,
  prodNameToEmail_,
  type Cfg,
  type SheetBookLike,
} from '../prod/adapters'
import { prodList_, prodNowIso_, prodReady_, prodSetting_, prodToday_ } from '../prod/engine'
import type { HeadcountRow } from '../prod/adapters'

export const TPH_SLOT_MIN = 15
export const TPH_SLOTS = 96
export const TPH_OFF = 'off'
export const TPH_JOB = 'jobTphHourly'
export const TPH_CALLS = 'calls'
export const TPH_TREND_MAX_DAYS = 28
export const TPH_HISTORY_DAYS = 7
export const TPH_STEPS = ['touches', 'cases_chats', 'cases_tickets', 'calls']
export const TPH_TIME_GUARD_MS = 270000
export const TPH_PAST_JOB = 'jobTphPastDays'
export const TPH_PAST_DAYS = 3
export const TPH_STALE_MS = 6 * 3600 * 1000

// =====================================================================
// Pure rules
// =====================================================================

/** tphHm_: 'HH:MM' -> minutes from 00:00 (24:00 allowed as end of day), or NaN. */
export function tphHm_(s: unknown): number {
  const m = /^(\d{1,2}):(\d\d)$/.exec(String(s || '').trim())
  if (!m) return NaN
  const v = Number(m[1]) * 60 + Number(m[2])
  return Number(m[2]) < 60 && v <= 1440 ? v : NaN
}

/** tphTaskSlots_: slots a task [startMin, endMin) fills: those it covers > half (8 of 15). */
export function tphTaskSlots_(startMin: number, endMin: number): number[] {
  const out: number[] = []
  if (!(endMin > startMin)) return out
  for (
    let s = Math.max(0, Math.floor(startMin / TPH_SLOT_MIN));
    s * TPH_SLOT_MIN < endMin && s < TPH_SLOTS;
    s++
  ) {
    const cover = Math.min(endMin, (s + 1) * TPH_SLOT_MIN) - Math.max(startMin, s * TPH_SLOT_MIN)
    if (cover * 2 > TPH_SLOT_MIN) out.push(s)
  }
  return out
}

/** tphParseSlot_: a stored slot value -> { primary, calls } ('internal+calls' = blended). */
export function tphParseSlot_(v: unknown): { primary: string; calls: boolean } {
  const p = String(v || '').split('+')
  return { primary: p[0], calls: p[0] !== TPH_CALLS && p.indexOf(TPH_CALLS, 1) !== -1 }
}

/** tphSlotValue_: { primary, calls } -> the stored value; the flag drops on 'calls'/'off'. */
export function tphSlotValue_(primary: string, calls: boolean): string {
  if (!primary) return calls ? TPH_CALLS : ''
  return calls && primary !== TPH_CALLS && primary !== TPH_OFF ? primary + '+' + TPH_CALLS : primary
}

export interface TphResolvedSlot {
  channel: string
  calls: boolean
  carried: boolean
}

/**
 * tphResolveSlots_: one agent's day. logged: { slot: stored value }. Returns { slot:
 * { channel, calls, carried } } for slots in [from, to). Carrying stops at 'off', until, or
 * outside shift ({ from, to } slots) when one is known.
 */
export function tphResolveSlots_(
  logged: Record<number | string, string>,
  from: number,
  to: number,
  until: number,
  shift?: { from: number; to: number } | null
): Record<number, TphResolvedSlot> {
  const out: Record<number, TphResolvedSlot> = {}
  let prev = ''
  for (let s = 0; s < to; s++) {
    const c = logged[s]
    if (c) prev = c
    const inShift = !shift || (s >= shift.from && s < shift.to)
    if (!inShift && !c) prev = ''
    if (s < from) continue
    if (c) {
      const v = tphParseSlot_(c)
      out[s] = { channel: v.primary, calls: v.calls, carried: false }
      continue
    }
    if (prev && tphParseSlot_(prev).primary !== TPH_OFF && s < until && inShift) {
      const w = tphParseSlot_(prev)
      out[s] = { channel: w.primary, calls: w.calls, carried: true }
    }
  }
  return out
}

/** tphCapMinutes_: minutes of slot s before :capWindowMin of its hour (55: 15, 15, 15, 10). */
export function tphCapMinutes_(s: number, capWindowMin: number): number {
  const q = s % 4
  return Math.max(0, Math.min(TPH_SLOT_MIN, capWindowMin - q * TPH_SLOT_MIN))
}

/** tphAutoCases_: automatic cases per hour from the captures { 'h|c': { stock, c0, c1 } }. */
export function tphAutoCases_(
  auto: Record<string, { stock: unknown; c0: unknown; c1: unknown }>,
  hours: number[],
  channels: string[]
): Record<string, number> {
  const out: Record<string, number> = {}
  channels.forEach((c) => {
    hours.forEach((h) => {
      const a = auto[h + '|' + c]
      if (!a || typeof a !== 'object') return
      const nx = auto[h + 1 + '|' + c]
      const end = nx && typeof nx === 'object' ? Number(nx.c0) : Number(a.c1)
      out[h + '|' + c] = (Number(a.stock) || 0) + Math.max(0, (end || 0) - (Number(a.c0) || 0))
    })
  })
  return out
}

/**
 * tphResolveCases_: cases per hour per channel. tl > rebuilt > auto; an hour with none
 * repeats the previous hour's value (carried) up to untilHour (exclusive).
 */
export function tphResolveCases_(
  tl: Record<string, unknown> | null,
  auto: Record<string, unknown> | null,
  hours: number[],
  channels: string[],
  untilHour: number,
  rebuilt?: Record<string, unknown> | null
): Record<string, { cases: number; source: 'tl' | 'rebuilt' | 'auto' | 'carried' }> {
  const out: Record<string, { cases: number; source: 'tl' | 'rebuilt' | 'auto' | 'carried' }> = {}
  const has = (m: Record<string, unknown> | null | undefined, k: string) =>
    m && m[k] !== undefined && m[k] !== null && m[k] !== '' && isFinite(Number(m[k]))
  channels.forEach((c) => {
    let prev: { cases: number; source: string } | null = null
    hours.forEach((h) => {
      const k = h + '|' + c
      if (has(tl, k)) prev = out[k] = { cases: Number(tl![k]), source: 'tl' }
      else if (has(rebuilt, k)) prev = out[k] = { cases: Number(rebuilt![k]), source: 'rebuilt' }
      else if (has(auto, k)) prev = out[k] = { cases: Number(auto![k]), source: 'auto' }
      else if (prev && h < untilHour) out[k] = { cases: prev.cases, source: 'carried' }
    })
  })
  return out
}

/**
 * tphCap_: caps of one hour on one channel. cap[e] = min(cases x minutes / total,
 * minutes / minutesPerCase, cases). limits[e] = 'share' | 'time' | 'cases'.
 */
export function tphCap_(
  cases: unknown,
  minutes: Record<string, unknown>,
  minutesPerCase: unknown
): { totalMin: number; caps: Record<string, number> | null; limits?: Record<string, string> } {
  const total = Object.keys(minutes).reduce((s, e) => s + (Number(minutes[e]) || 0), 0)
  if (cases === null || cases === undefined || !isFinite(Number(cases)))
    return { totalMin: total, caps: null }
  const n = Math.max(0, Number(cases))
  const per = Math.max(0.1, Number(minutesPerCase) || 3)
  const caps: Record<string, number> = {}
  const limits: Record<string, string> = {}
  Object.keys(minutes).forEach((e) => {
    const m = Number(minutes[e]) || 0
    if (!(total > 0)) {
      caps[e] = 0
      limits[e] = 'time'
      return
    }
    const share = (n * m) / total
    const time = m / per
    caps[e] = Math.min(share, time, n)
    limits[e] = n <= caps[e] ? 'cases' : time <= caps[e] ? 'time' : 'share'
  })
  return { totalMin: total, caps, limits }
}

export interface TphTableInput {
  hours: number[]
  channels: string[]
  grid: Record<string, Record<number, TphResolvedSlot>>
  cases: Record<string, { cases: number; source: string } | null>
  touches: Record<string, number> | null
  minutesPerCase: unknown
  capWindowMin: unknown
  callsFactor?: unknown
  callMinutes?: Record<string, [number, number]> | null
  callsKey?: string
}

export interface TphTableAgentRow {
  email: string
  minutes: number
  callsMin: number
  capMin: number
  cap: number | null
  touches: number | null
  tph: number | null
  pctRaw: number | null
  pctOfCap: number | null
  over: boolean
  limit: string
  reason: string
  name?: string
}

/** tphTable_ verbatim: per hour per channel — cases, agent minutes, cap and touches. */
export function tphTable_(inp: TphTableInput): {
  hour: number
  channel: string
  cases: number | null
  source: string
  totalCapMin: number | null
  agents: TphTableAgentRow[]
}[] {
  const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100)
  const win = Number(inp.capWindowMin) || 55
  const cf =
    inp.callsFactor === undefined || inp.callsFactor === null || inp.callsFactor === ''
      ? 1
      : Math.max(0, Math.min(1, Number(inp.callsFactor) || 0))
  const actual = inp.callMinutes || null
  const callsKey = inp.callsKey || TPH_CALLS
  const rows: {
    hour: number
    channel: string
    cases: number | null
    source: string
    totalCapMin: number | null
    agents: TphTableAgentRow[]
  }[] = []
  const touched: Record<string, string[]> = {}
  Object.keys(inp.touches || {}).forEach((k) => {
    const p = k.split('|')
    if (Number(inp.touches![k]) > 0) (touched[p[1] + '|' + p[2]] = touched[p[1] + '|' + p[2]] || []).push(p[0])
  })
  inp.hours.forEach((h) => {
    const per: Record<string, Record<string, { minutes: number; capRaw: number; blendCap: number; callsMin: number }>> = {}
    Object.keys(inp.grid).forEach((e) => {
      const g = inp.grid[e]
      for (let s = h * 4; s < h * 4 + 4; s++) {
        if (!g[s]) continue
        const m = ((per[e] = per[e] || {})[g[s].channel] = per[e][g[s].channel] || {
          minutes: 0,
          capRaw: 0,
          blendCap: 0,
          callsMin: 0,
        })
        const cm = tphCapMinutes_(s, win)
        m.minutes += TPH_SLOT_MIN
        m.capRaw += cm
        if (g[s].calls) {
          m.blendCap += cm
          m.callsMin += TPH_SLOT_MIN
        }
      }
    })
    const queue = (k: string) => k !== callsKey && inp.channels.indexOf(k) !== -1
    const capOf = (e: string, c: string) => {
      const m = per[e][c]
      if (!queue(c)) return m.capRaw
      if (!actual) return m.capRaw - m.blendCap * (1 - cf)
      const base = Object.keys(per[e]).reduce((t, k) => t + (queue(k) ? per[e][k].capRaw : 0), 0)
      const a = actual[e + '|' + h]
      const inWin = a ? Number(a[1]) || 0 : 0
      return base > 0 ? m.capRaw - (Math.min(inWin, base) * m.capRaw) / base : m.capRaw
    }
    inp.channels.forEach((c) => {
      const minutes: Record<string, number> = {}
      const capMin: Record<string, number> = {}
      const callsMin: Record<string, number> = {}
      Object.keys(per).forEach((e) => {
        if (!per[e][c]) return
        minutes[e] = per[e][c].minutes
        callsMin[e] = per[e][c].callsMin
        capMin[e] = Math.max(0, capOf(e, c))
      })
      const cs = inp.cases[h + '|' + c] || null
      const extra = (touched[h + '|' + c] || []).filter((e) => minutes[e] === undefined)
      if (!cs && !Object.keys(minutes).length && !extra.length) return
      const cap = tphCap_(cs ? cs.cases : null, capMin, inp.minutesPerCase)
      const agents = Object.keys(minutes)
        .concat(extra)
        .sort()
        .map((e) => {
          const logged = minutes[e] !== undefined
          const capE = cap.caps && logged ? cap.caps[e] : null
          const t = inp.touches ? Number(inp.touches[e + '|' + h + '|' + c]) || 0 : null
          const reason = !logged ? 'no_grid' : !cap.caps ? 'no_cases' : !capE ? 'zero_cap' : t === null ? 'pending' : ''
          const raw = t !== null && capE ? Math.round((t / capE) * 1000) / 10 : null
          return {
            email: e,
            minutes: logged ? minutes[e] : 0,
            callsMin: callsMin[e] || 0,
            capMin: logged ? r2(capMin[e])! : 0,
            cap: r2(capE),
            touches: t,
            tph: t === null || !logged ? null : r2((t * 60) / minutes[e]),
            pctRaw: raw,
            pctOfCap: raw === null ? null : Math.min(100, raw),
            over: raw !== null && t! > capE!,
            limit: cap.caps && logged ? cap.limits![e] : '',
            reason,
          }
        })
      rows.push({ hour: h, channel: c, cases: cs ? cs.cases : null, source: cs ? cs.source : '', totalCapMin: r2(cap.totalMin), agents })
    })
  })
  return rows
}

/** tphDayTotals_ verbatim: per agent, the day over every channel and hour of a table. */
export function tphDayTotals_(
  rows: { agents: TphTableAgentRow[] }[]
): {
  email: string
  minutes: number
  capMin: number
  touches: number | null
  tph: number | null
  scoredHours: number
  cap: number | null
  capTouches: number | null
  pctRaw: number | null
  pctOfCap: number | null
  overHours: number
  limits: { share: number; time: number; cases: number }
  name?: string
}[] {
  const r2 = (x: number) => Math.round(x * 100) / 100
  const by: Record<
    string,
    {
      email: string
      minutes: number
      capMin: number
      touches: number | null
      capTouches: number
      cap: number
      clipped: number
      scored: number
      overHours: number
      limits: { share: number; time: number; cases: number }
    }
  > = {}
  rows.forEach((r) => {
    r.agents.forEach((a) => {
      const o = (by[a.email] = by[a.email] || {
        email: a.email,
        minutes: 0,
        capMin: 0,
        touches: null,
        capTouches: 0,
        cap: 0,
        clipped: 0,
        scored: 0,
        overHours: 0,
        limits: { share: 0, time: 0, cases: 0 },
      })
      o.minutes += a.minutes || 0
      o.capMin += a.capMin || 0
      if (a.touches !== null) o.touches = (o.touches || 0) + a.touches
      if (a.pctRaw === null || a.pctRaw === undefined) return
      o.scored++
      o.cap += a.cap!
      o.capTouches += a.touches!
      o.clipped += Math.min(a.touches!, a.cap!)
      if (a.over) o.overHours++
      if ((o.limits as Record<string, number>)[a.limit] !== undefined) (o.limits as Record<string, number>)[a.limit]++
    })
  })
  return Object.keys(by)
    .sort()
    .map((e) => {
      const o = by[e]
      return {
        email: e,
        minutes: o.minutes,
        capMin: r2(o.capMin),
        touches: o.touches,
        tph: o.touches === null || !o.minutes ? null : r2((o.touches * 60) / o.minutes),
        scoredHours: o.scored,
        cap: o.scored ? r2(o.cap) : null,
        capTouches: o.scored ? o.capTouches : null,
        pctRaw: o.cap > 0 ? Math.round((o.capTouches / o.cap) * 1000) / 10 : null,
        pctOfCap: o.cap > 0 ? Math.round((o.clipped / o.cap) * 1000) / 10 : null,
        overHours: o.overHours,
        limits: o.limits,
      }
    })
}

/** tphCallVariance_: call minutes in hours where the grid shows no calls. */
export function tphCallVariance_(
  grid: Record<string, Record<number, TphResolvedSlot>>,
  callMinutes: Record<string, [number, number]> | null,
  hours: number[],
  callsKey: string
): { email: string; hour: number; callMin: number }[] {
  const out: { email: string; hour: number; callMin: number }[] = []
  if (!callMinutes) return out
  Object.keys(callMinutes).forEach((k) => {
    const p = k.split('|')
    const e = p[0]
    const h = Number(p[1])
    const total = Number(callMinutes[k][0]) || 0
    if (!total || hours.indexOf(h) === -1) return
    const g = grid[e] || {}
    for (let s = h * 4; s < h * 4 + 4; s++)
      if (g[s] && (g[s].calls || g[s].channel === callsKey)) return
    out.push({ email: e, hour: h, callMin: Math.round(total * 10) / 10 })
  })
  return out.sort((a, b) => a.hour - b.hour || a.email.localeCompare(b.email))
}

// ---------------------------------------------------------------- clock (bulk timestamps)

/**
 * tphClock_: dqParseTs_'s instant without two formatDate calls per value (offset cached per
 * 15-minute bucket — zones change offset on quarter hours). { ms, day, hour }. Same formats.
 */
export function tphClock_(tz: string): {
  ms: (v: unknown) => number | null
  day: (ms: number) => string
  hour: (ms: number) => number
} {
  const offs: Record<number, number> = {}
  const off = (ms: number) => {
    const k = Math.floor(ms / 900000)
    return k in offs ? offs[k] : (offs[k] = dqTzOffsetMin_(new Date(k * 900000), tz))
  }
  const shift = (ms: number) => new Date(ms + off(ms) * 60000)
  return {
    ms: (v: unknown) => {
      if (v === null || v === undefined || v === '') return null
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime()
      const s = String(v).trim()
      if (/T.*(Z|[+-]\d\d:?\d\d)$/.test(s)) {
        const t0 = new Date(s).getTime()
        return isNaN(t0) ? null : t0
      }
      let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/)
      let y: number, mo: number, d: number, h: number, mi: number, se: number, ap: string | undefined
      if (m) {
        y = +m[1]
        mo = +m[2]
        d = +m[3]
        h = +(m[4] || 0)
        mi = +(m[5] || 0)
        se = +(m[6] || 0)
        ap = m[7]
      } else {
        m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/)
        if (!m) return null
        mo = +m[1]
        d = +m[2]
        y = +m[3]
        h = +(m[4] || 0)
        mi = +(m[5] || 0)
        se = +(m[6] || 0)
        ap = m[7]
      }
      if (ap) {
        const pm = /p/i.test(ap)
        if (h === 12) h = pm ? 12 : 0
        else if (pm) h += 12
      }
      const guess = Date.UTC(y, mo - 1, d, h, mi, se)
      const o1 = off(guess)
      const t = guess - o1 * 60000
      const o2 = off(t)
      return o2 !== o1 ? guess - o2 * 60000 : t
    },
    day: (ms: number) => shift(ms).toISOString().slice(0, 10),
    hour: (ms: number) => shift(ms).getUTCHours(),
  }
}

/** tphFirstAtOrAfter_: index of the first value in col ([[v]]) at or after fromMs, -1. */
export function tphFirstAtOrAfter_(col: unknown[][], fromMs: number, clock: ReturnType<typeof tphClock_>): number {
  for (let i = 0; i < col.length; i++) {
    const t = clock.ms(col[i][0])
    if (t !== null && t >= fromMs) return i
  }
  return -1
}

/**
 * tphReadTail_: the tail of a tab — columns [firstCol, firstCol+nCols) from the first row
 * whose time (tsCol, in tz) is at or after fromMs, to the last row.
 */
export function tphReadTail_(
  ss: SheetBookLike,
  tab: string,
  firstCol: number,
  nCols: number,
  tsCol: number,
  fromMs: number,
  tz: string
): { rows: unknown[][]; skipped: number; total: number } {
  const sh = ss.getSheetByName(tab)
  if (!sh || sh.getLastRow() < 2) return { rows: [], skipped: 0, total: 0 }
  const n = sh.getLastRow() - 1
  const i = tphFirstAtOrAfter_(sh.getRange(2, tsCol, n, 1).getValues(), fromMs, tphClock_(tz))
  if (i === -1) return { rows: [], skipped: n, total: n }
  return { rows: sh.getRange(2 + i, firstCol, n - i, nCols).getValues(), skipped: i, total: n }
}

/** tphTid_: ticket id as text so 123, '123' and 123.0 match. */
export function tphTid_(v: unknown): string {
  const s = String(v === null || v === undefined ? '' : v).trim()
  return /^\d+(\.0+)?$/.test(s) ? String(Number(s)) : s
}

/** tphActIndex_: Activities rows -> { first, byId: { ticketId: [{ ms, status, group }] } }. */
export function tphActIndex_(
  acts: unknown[][] | null,
  actTz: string
): { first: number; byId: Record<string, { ms: number; status: string; group: string }[]> } | null {
  if (!acts) return null
  const clock = tphClock_(actTz)
  const low = (v: unknown) => String(v || '').trim().toLowerCase()
  const idx: { first: number; byId: Record<string, { ms: number; status: string; group: string }[]> } = {
    first: Infinity,
    byId: {},
  }
  acts.forEach((r) => {
    const ms = clock.ms(r[0])
    if (ms === null) return
    if (ms < idx.first) idx.first = ms
    const id = tphTid_(r[1])
    if (id)
      (idx.byId[id] = idx.byId[id] || []).push({
        ms,
        status: low(r[5]) === 'status' ? low(r[6]) : '',
        group: low(r[8]),
      })
  })
  Object.keys(idx.byId).forEach((k) => {
    idx.byId[k].sort((a, b) => a.ms - b.ms)
  })
  return idx
}

/** tphHourMs_: instant (ms) of hour h on date in tz; Kuwait has no DST. */
export function tphHourMs_(date: string, h: number, tz: string): number {
  const p = date.split('-').map(Number)
  return dqWallToUtc_(p[0], p[1], p[2], h, 0, 0, tz).getTime()
}

/** tphCallMinutesFromRows_ verbatim: 'Maqsam Calls' D..J -> { date: { 'email|hour': [min, inWindowMin] } }. */
export function tphCallMinutesFromRows_(
  rows: unknown[][],
  dates: string[],
  emails: Record<string, boolean>,
  states: unknown[],
  dataTz: string,
  bizTz: string,
  capWindowMin: unknown
): Record<string, Record<string, [number, number]>> {
  const want: Record<string, boolean> = {}
  dates.forEach((d) => {
    want[d] = true
  })
  const okState = ([] as unknown[]).concat(states || []).map((x) => String(x).trim().toLowerCase())
  const win = (Number(capWindowMin) || 55) * 60000
  const out: Record<string, Record<string, [number, number]>> = {}
  const inData = tphClock_(dataTz)
  const inBiz = tphClock_(bizTz)
  rows.forEach((r) => {
    if (String(r[5] || '').trim().toLowerCase() !== 'inbound') return
    if (okState.indexOf(String(r[4] || '').trim().toLowerCase()) === -1) return
    const email = String(r[3] || '').trim().toLowerCase()
    if (!emails[email]) return
    const s0 = inData.ms(r[0])
    if (s0 === null) return
    const start = new Date(s0)
    const j = Number(r[6])
    const e0 = j > 0 ? s0 + Math.round(j * 86400000) : inData.ms(r[1])
    const end = e0 === null ? null : new Date(e0)
    if (!end || end <= start) return
    // hour boundaries are whole UTC hours — true for whole-hour zones like Asia/Kuwait
    for (let t = start.getTime(); t < end.getTime(); ) {
      const hourStart = Math.floor(t / 3600000) * 3600000
      const next = Math.min(end.getTime(), hourStart + 3600000)
      const date = inBiz.day(t)
      if (want[date]) {
        const k = email + '|' + inBiz.hour(t)
        const day = (out[date] = out[date] || {})
        const v = (day[k] = day[k] || [0, 0])
        v[0] += (next - t) / 60000
        v[1] += Math.max(0, Math.min(next, hourStart + win) - t) / 60000
      }
      t = next
    }
  })
  Object.keys(out).forEach((d) => {
    Object.keys(out[d]).forEach((k) => {
      out[d][k] = out[d][k].map((x) => Math.round(x * 100) / 100) as [number, number]
    })
  })
  return out
}

/** tphCanEdit_: admin any day up to today; a TL today and tlDays back. */
export function tphCanEdit_(role: string, date: unknown, today: string, tlDays: unknown): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(String(date)) || String(date) > today) return false
  if (role === 'admin') return true
  return role === 'tl' && String(date) >= dqAddDays_(today, -(Number(tlDays) || 0))
}

/** tphGroupIndex_: { 'group name, lower case': channel key } for every channel's groups. */
export function tphGroupIndex_(channels: { key: string; groups?: unknown[] }[]): Record<string, string> {
  const idx: Record<string, string> = {}
  channels.forEach((c) => {
    ;([] as unknown[]).concat(c.groups || []).forEach((g) => {
      idx[String(g).trim().toLowerCase()] = c.key
    })
  })
  return idx
}

/** tphTouchFallback_: the channel a touch in an unlisted group counts on: 'internal' or ''. */
export function tphTouchFallback_(channels: { key: string }[]): string {
  return channels.some((c) => c.key === 'internal') ? 'internal' : ''
}

/**
 * tphTouchesFromRows_ verbatim: Activities rows -> { date: { 'email|hour|channel': distinct
 * tickets } } for `dates` (hour/date in bizTz). onTouch(row, email, hour, channel, ms) sees
 * each credited row (tphTouchList_ uses it).
 */
export function tphTouchesFromRows_(
  rows: unknown[][],
  dates: string[],
  nameToEmail: Record<string, string>,
  localTz: string,
  channels: { key: string; groups?: unknown[] }[],
  bizTz: string,
  onTouch?: (row: unknown[], email: string, hour: number, channel: string, ms: number) => void
): Record<string, Record<string, number>> {
  const want: Record<string, boolean> = {}
  dates.forEach((d) => {
    want[d] = true
  })
  const idx = tphGroupIndex_(channels)
  const fb = tphTouchFallback_(channels)
  const seen: Record<string, boolean> = {}
  const out: Record<string, Record<string, number>> = {}
  const inLocal = tphClock_(localTz)
  const inBiz = tphClock_(bizTz)
  rows.forEach((r) => {
    const ch = idx[String(r[8] || '').trim().toLowerCase()] || fb
    if (!ch || ch === TPH_CALLS || !r[1]) return
    const email = nameToEmail[String(r[2] || '').trim().toLowerCase()]
    const t = email ? inLocal.ms(r[0]) : null
    if (t === null) return
    const date = inBiz.day(t)
    if (!want[date]) return
    const k = email + '|' + inBiz.hour(t) + '|' + ch
    if (seen[date + k + '|' + r[1]]) return
    seen[date + k + '|' + r[1]] = true
    const day = (out[date] = out[date] || {})
    day[k] = (day[k] || 0) + 1
    if (onTouch) onTouch(r, email, inBiz.hour(t), ch, t)
  })
  return out
}

/** tphTouchList_ verbatim: one agent's credited touches on date in the given hours. */
export function tphTouchList_(
  rows: unknown[][],
  date: string,
  email: string,
  nameToEmail: Record<string, string>,
  localTz: string,
  channels: { key: string; groups?: unknown[] }[],
  bizTz: string,
  hours: number[]
): { touches: { ticket: string; time: string; hour: number; channel: string; status: string; group: string }[]; outside: number } {
  const act = tphActIndex_(rows, localTz)
  const list: ({ ms: number } & { ticket: string; time: string; hour: number; channel: string; status: string; group: string })[] = []
  let outside = 0
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
  tphTouchesFromRows_(rows, [date], nameToEmail, localTz, channels, bizTz, (r, e, h, ch, t) => {
    if (e !== email) return
    if (hours.indexOf(h) === -1) {
      outside++
      return
    }
    let st = String(r[5] || '').trim().toLowerCase() === 'status' ? String(r[6] || '').trim().toLowerCase() : ''
    if (!st)
      ((act && act.byId[tphTid_(r[1])]) || []).forEach((x) => {
        if (x.ms <= t && x.status) st = x.status
      })
    // minutes/seconds read in UTC — right for whole-hour zones (Kuwait)
    list.push({
      ms: t,
      ticket: tphTid_(r[1]),
      time: (h < 10 ? '0' : '') + h + new Date(t).toISOString().slice(13, 19),
      hour: h,
      channel: ch,
      status: cap(st),
      group: String(r[8] || '').trim(),
    })
  })
  list.sort((a, b) => a.ms - b.ms)
  list.forEach((x) => {
    delete (x as { ms?: number }).ms
  })
  return { touches: list, outside }
}

/** tphCasesFromQueue_ verbatim: agg_queue_now rows -> { channel: { stock, created } }. */
export function tphCasesFromQueue_(
  queueRows: Record<string, unknown>[],
  channels: { key: string; kind: string; groups?: unknown[] }[],
  ticketStatuses: unknown,
  chatExclude: unknown
): Record<string, { stock: number; created: number }> {
  const lower = (l: unknown) => ([] as unknown[]).concat((l as unknown[]) || []).map((s) => String(s).trim().toLowerCase())
  const st = lower(ticketStatuses)
  const ex = lower(chatExclude)
  const stale = (q: Record<string, unknown>) => q.stale === true || String(q.stale).toLowerCase() === 'true'
  const by = (q: Record<string, unknown>): Record<string, unknown> => {
    let b = q.by_status_json
    if (typeof b === 'string') {
      try {
        b = JSON.parse(b || '{}')
      } catch {
        b = {}
      }
    }
    return (b || {}) as Record<string, unknown>
  }
  const sumIn = (b: Record<string, unknown>, list: string[]) =>
    Object.keys(b).reduce((s, k) => s + (list.indexOf(k.trim().toLowerCase()) !== -1 ? Number(b[k]) || 0 : 0), 0)
  const out: Record<string, { stock: number; created: number }> = {}
  channels.forEach((c) => {
    if (c.kind === 'chat') {
      const q = queueRows.filter((x) => String(x.kind) === 'chat')[0]
      if (!q || stale(q)) return
      out[c.key] = {
        stock: Math.max(0, (Number(q.open) || 0) - sumIn(by(q), ex)),
        created: Number(q.created_today) || 0,
      }
      return
    }
    if (c.kind !== 'ticket') return
    const groups = lower(c.groups)
    const hit = queueRows.filter(
      (x) => String(x.kind) !== 'chat' && groups.indexOf(String(x.queue).trim().toLowerCase()) !== -1
    )
    if (!hit.length || hit.some(stale)) return
    out[c.key] = {
      stock: hit.reduce((s, q) => s + sumIn(by(q), st), 0),
      created: hit.reduce((s, q) => s + (Number(q.created_today) || 0), 0),
    }
  })
  return out
}

/** tphFoldCapture_: folds one capture into the hour's record: first sets stock+c0, all set c1. */
export function tphFoldCapture_(
  auto: Record<string, { stock: unknown; c0: unknown; c1: unknown }>,
  hour: number,
  got: Record<string, { stock: unknown; created: unknown }>
): number {
  let added = 0
  Object.keys(got).forEach((c) => {
    const k = hour + '|' + c
    if (!auto[k] || typeof auto[k] !== 'object') {
      auto[k] = { stock: got[c].stock, c0: got[c].created, c1: got[c].created }
      added++
    } else auto[k].c1 = got[c].created
  })
  return added
}

/** tphChatCases_ verbatim: chats from the Freshchat tab rows for `date` per hour. */
export function tphChatCases_(
  rows: unknown[][],
  date: string,
  hours: number[],
  dataTz: string,
  bizTz: string
): { cells: Record<number, { stock: number; new: number }> | null; reason: string } {
  const dayStart = tphHourMs_(date, 0, bizTz)
  const dayEnd = dayStart + 24 * 3600000
  const clock = tphClock_(dataTz)
  const conv: Record<string, { first: number; res: number | null; open: boolean; upd: number | null }> = {}
  let first = Infinity
  let onDay = false
  rows.forEach((r, i) => {
    let ms = clock.ms(r[0])
    if (ms === null) {
      const m = String(r[2] || '').match(/-(\d{12,14})$/)
      ms = m ? Number(m[1]) : null
    }
    if (ms === null) return
    const res = clock.ms(r[4])
    const blank = String(r[1] || '').trim() === ''
    const id = String(r[6] || r[2] || '') || '#' + i
    const c = (conv[id] = conv[id] || { first: ms, res: null, open: false, upd: null })
    c.first = Math.min(c.first, ms)
    if (res !== null) {
      if (c.res === null || res > c.res) c.res = res
    } else if (blank) c.open = true
    else {
      const u = clock.ms(r[3])
      if (u !== null && (c.upd === null || u > c.upd)) c.upd = u
    }
    first = Math.min(first, ms)
    if (ms >= dayStart && ms < dayEnd) onDay = true
  })
  if (!onDay) return { cells: null, reason: 'Freshchat tab has no chats initiated on ' + date }
  const cells: Record<number, { stock: number; new: number }> = {}
  hours.forEach((h) => {
    const a = tphHourMs_(date, h, bizTz)
    const t = a + 1800000
    let stock = 0
    let nw = 0
    Object.keys(conv).forEach((k) => {
      const c = conv[k]
      const end = c.res !== null ? c.res : c.open ? Infinity : c.upd
      if (end === null || c.first > t || end <= t) return
      if (c.first >= a) nw++
      else stock++
    })
    cells[h] = { stock, new: nw }
  })
  return {
    cells,
    reason:
      first > dayStart
        ? 'Freshchat tab starts at ' +
          new Date(first).toISOString() +
          ': chats opened before then and still open later are missing from the counts'
        : '',
  }
}

/** tphTicketCases_ verbatim: one ticket channel's cases rebuilt from the store + history. */
export function tphTicketCases_(
  tickets: {
    ticket_id: unknown
    status: unknown
    group_name: unknown
    created_at: unknown
    resolved_at: unknown
    closed_at: unknown
  }[],
  act: ReturnType<typeof tphActIndex_>,
  date: string,
  hours: number[],
  o: { groups: string[]; statuses: string[]; dataTz: string; bizTz: string; storeHasDate: boolean }
): { cells: Record<number, { stock: number; new: number }> | null; reason: string } {
  if (!o.storeHasDate)
    return { cells: null, reason: 'The ticket store has no tickets created on ' + date }
  const dayStart = tphHourMs_(date, 0, o.bizTz)
  const dayEnd = dayStart + 24 * 3600000
  const clock = tphClock_(o.dataTz)
  const low = (v: unknown) => String(v || '').trim().toLowerCase()
  const list: {
    id: string
    created: number
    done: number
    status: string
    group: string
    hist: { ms: number; status: string; group: string }[]
  }[] = []
  tickets.forEach((t) => {
    const c = clock.ms(t.created_at)
    if (c === null || c >= dayEnd) return
    const dn = [clock.ms(t.resolved_at), clock.ms(t.closed_at)].filter((x): x is number => x !== null)
    const id = tphTid_(t.ticket_id)
    list.push({
      id,
      created: c,
      done: dn.length ? Math.min.apply(null, dn) : Infinity,
      status: low(t.status),
      group: low(t.group_name),
      hist: (act && act.byId[id]) || [],
    })
  })
  const actFirst = act ? act.first : Infinity
  const covered = !!act && actFirst <= dayStart
  const groupAt = (x: (typeof list)[number], T: number): string => {
    let g = ''
    x.hist.forEach((h) => {
      if (h.ms < T && h.group) g = h.group
    })
    if (g) return g
    for (let i = 0; i < x.hist.length; i++) if (x.hist[i].group) return x.hist[i].group
    return x.group
  }
  const approx: Record<string, boolean> = {}
  const unknown: Record<string, boolean> = {}
  const statusAt = (x: (typeof list)[number], T: number): string | null => {
    if (covered) {
      let st: string | null = null
      let any = false
      x.hist.forEach((h) => {
        if (h.status) {
          any = true
          if (h.ms < T) st = h.status
        }
      })
      if (st !== null) return st
      if (!any) return x.status
      if (x.created >= actFirst) return 'open'
      unknown[x.id] = true
      return null
    }
    approx[x.id] = true
    if (x.done < T) return ''
    return x.done !== Infinity ? o.statuses[0] : x.status
  }
  const cells: Record<number, { stock: number; new: number }> = {}
  hours.forEach((h) => {
    const a = tphHourMs_(date, h, o.bizTz)
    const b = a + 3600000
    let stock = 0
    let nw = 0
    list.forEach((x) => {
      if (x.created >= a && x.created < b) {
        if (o.groups.indexOf(groupAt(x, x.created + 60000)) !== -1) nw++
        return
      }
      if (x.created >= a || o.groups.indexOf(groupAt(x, a)) === -1) return
      const st = statusAt(x, a)
      if (st && o.statuses.indexOf(st) !== -1) stock++
    })
    cells[h] = { stock, new: nw }
  })
  const why: string[] = []
  if (!act)
    why.push(
      "Activities tab could not be read: the open count uses each ticket's current status (" +
        Object.keys(approx).length +
        ' tickets)'
    )
  else if (!covered)
    why.push(
      'Activities tab starts ' +
        (isFinite(actFirst) ? new Date(actFirst).toISOString().slice(0, 10) : '(empty)') +
        ', after ' +
        date +
        ' began: the open count uses the current status for ' +
        Object.keys(approx).length +
        ' tickets'
    )
  if (Object.keys(unknown).length)
    why.push(
      Object.keys(unknown).length +
        ' older tickets with no status known at the hour start were left out of the open count'
    )
  return { cells, reason: why.join('; ') }
}

/** tphCallCases_: inbound calls from agg_inflow_hourly (channel 'call', every country). */
export function tphCallCases_(
  inflowRows: Record<string, unknown>[],
  date: string,
  hours: number[]
): { cells: Record<number, { stock: number; new: number }> | null; reason: string } {
  const by: Record<number, number> = {}
  let any = false
  inflowRows.forEach((r) => {
    if (String(r.channel) !== 'call' || String(r.date).slice(0, 10) !== date) return
    any = true
    by[Number(r.hour)] = (by[Number(r.hour)] || 0) + (Number(r.inflow) || 0)
  })
  if (!any)
    return {
      cells: null,
      reason: 'No inbound calls stored for ' + date + ' (agg_inflow_hourly keeps inflow_lookback_days)',
    }
  const cells: Record<number, { stock: number; new: number }> = {}
  hours.forEach((h) => {
    cells[h] = { stock: 0, new: by[h] || 0 }
  })
  return { cells, reason: '' }
}

/** tphRebuiltCases_: a stored 'rebuilt' row -> { 'hour|channel': stock + new }. */
export function tphRebuiltCases_(stored: { cells?: Record<string, { stock: unknown; new: unknown }> } | null): Record<string, number> {
  const out: Record<string, number> = {}
  const cells = (stored && stored.cells) || {}
  Object.keys(cells).forEach((k) => {
    out[k] = (Number(cells[k].stock) || 0) + (Number(cells[k].new) || 0)
  })
  return out
}

/** tphEligible_: { channel: [{ email, touches }] } from stored touch rows since sinceKey. */
export function tphEligible_(
  dayRows: { date: unknown; touches_json: unknown }[],
  sinceKey: string
): Record<string, { email: string; touches: number }[]> {
  const sum: Record<string, number> = {}
  dayRows.forEach((r) => {
    if (String(r.date) < sinceKey) return
    let m: Record<string, unknown> = {}
    try {
      m = typeof r.touches_json === 'string' ? JSON.parse(r.touches_json || '{}') : ((r.touches_json || {}) as Record<string, unknown>)
    } catch {
      m = {}
    }
    Object.keys(m).forEach((k) => {
      const p = k.split('|')
      const key = p[2] + '|' + p[0]
      sum[key] = (sum[key] || 0) + (Number(m[k]) || 0)
    })
  })
  const out: Record<string, { email: string; touches: number }[]> = {}
  Object.keys(sum).forEach((k) => {
    const p = k.split('|')
    ;(out[p[0]] = out[p[0]] || []).push({ email: p[1], touches: sum[k] })
  })
  Object.keys(out).forEach((c) => {
    out[c].sort((a, b) => b.touches - a.touches || a.email.localeCompare(b.email))
  })
  return out
}

/** tphCasesPart_: 'chats' = chat channels + Inbound calls; 'tickets' = ticket-group channels. */
export function tphCasesPart_(c: { key: string; kind: string }, part: string | undefined | null): boolean {
  const ticket = c.kind !== 'chat' && c.key !== TPH_CALLS
  return !part || (part === 'tickets' ? ticket : !ticket)
}

/** tphMergeRebuilt_ verbatim: stored rebuilt record with `keys` channels' cells replaced. */
export function tphMergeRebuilt_(
  old: { cells?: Record<string, unknown>; reasons?: Record<string, unknown> } | null,
  fresh: { cells: Record<string, unknown>; reasons: Record<string, unknown> },
  keys: string[]
): { cells: Record<string, unknown>; reasons: Record<string, unknown> } {
  const cells: Record<string, unknown> = {}
  const reasons: Record<string, unknown> = {}
  const mine = (k: string) => keys.indexOf(k.split('|').pop()!) !== -1
  Object.keys((old && old.cells) || {}).forEach((k) => {
    if (!mine(k)) cells[k] = old!.cells![k]
  })
  Object.keys((old && old.reasons) || {}).forEach((c) => {
    if (keys.indexOf(c) === -1) reasons[c] = old!.reasons![c]
  })
  Object.keys(fresh.cells).forEach((k) => {
    cells[k] = fresh.cells[k]
  })
  Object.keys(fresh.reasons).forEach((c) => {
    reasons[c] = fresh.reasons[c]
  })
  return { cells, reasons }
}

/** tphStaleSteps_ verbatim: which TPH_STEPS to rerun for one day. */
export function tphStaleSteps_(
  stamps: Record<string, string>,
  nowMs: number,
  maxAgeMs: number
): string[] {
  const stale = (iso: unknown) => {
    const t = iso ? new Date(String(iso)).getTime() : NaN
    return !(t > 0) || nowMs - t > maxAgeMs
  }
  return TPH_STEPS.filter((step) => stale(stamps[step.indexOf('cases_') === 0 ? 'cases' : step]))
}

/** tphDaySummary_ verbatim: team figures for one day of tphTable_ rows. */
export function tphDaySummary_(table: { hour: number; channel: string; cases: number | null; source: string; agents: TphTableAgentRow[] }[], callsKey: string): Record<string, unknown> {
  const r1 = (x: number) => Math.round(x * 10) / 10
  const r2 = (x: number) => Math.round(x * 100) / 100
  const s = {
    touches: null as number | null,
    outside: 0,
    minutes: 0,
    gridT: 0,
    minX: 0,
    gridTX: 0,
    zeroCapTouches: 0,
    cap: 0,
    clipped: 0,
    capT: 0,
    over: 0,
    overT: 0,
    missing: 0,
    covered: 0,
    carried: 0,
  }
  const onGrid: Record<string, number> = {}
  const scored: Record<string, number> = {}
  const overAgents: Record<string, number> = {}
  const agents: Record<string, number> = {}
  const hours: Record<number, { hour: number; cap: number; clipped: number; capT: number; over: number }> = {}
  table.forEach((r) => {
    let someone = false
    const hr = (hours[r.hour] = hours[r.hour] || { hour: r.hour, cap: 0, clipped: 0, capT: 0, over: 0 })
    r.agents.forEach((a) => {
      const t = a.touches
      if (t !== null && t !== undefined) s.touches = (s.touches || 0) + t
      if (a.reason === 'no_grid') {
        s.outside += t || 0
        return
      }
      if (a.minutes > 0) {
        someone = true
        agents[a.email] = 1
        onGrid[a.email + '|' + r.hour] = 1
        s.minutes += a.minutes
        s.gridT += t || 0
        if (r.channel !== callsKey) {
          s.minX += a.minutes
          s.gridTX += t || 0
        }
      }
      if (a.reason === 'zero_cap') s.zeroCapTouches += t || 0
      if (a.reason !== '' || a.cap === null || t === null || t === undefined) return
      scored[a.email + '|' + r.hour] = 1
      s.cap += a.cap
      s.clipped += Math.min(t, a.cap)
      s.capT += t
      hr.cap += a.cap
      hr.clipped += Math.min(t, a.cap)
      hr.capT += t
      if (a.over) {
        s.over++
        s.overT += t - a.cap
        overAgents[a.email] = 1
        hr.over++
      }
    })
    if (someone) {
      if (r.cases === null || r.cases === undefined) s.missing++
      else s.covered++
      if (r.source === 'carried') s.carried++
    }
  })
  const pct = (n: number, c: number) => (c > 0 ? r1((n / c) * 100) : null)
  const ready = s.touches !== null
  return {
    touches: s.touches,
    outside: s.outside,
    minutes: s.minutes,
    tph: ready && s.minutes ? r2((s.gridT * 60) / s.minutes) : null,
    tphExCalls: ready && s.minX ? r2((s.gridTX * 60) / s.minX) : null,
    cap: r2(s.cap),
    pct: pct(s.clipped, s.cap),
    pctRaw: pct(s.capT, s.cap),
    scored: Object.keys(scored).length,
    onGrid: Object.keys(onGrid).length,
    agents: Object.keys(agents).length,
    over: s.over,
    overAgents: Object.keys(overAgents).length,
    overTouches: r1(s.overT),
    zeroCapTouches: s.zeroCapTouches,
    missing: s.missing,
    covered: s.covered,
    carried: s.carried,
    hours: Object.keys(hours)
      .map(Number)
      .sort((x, y) => x - y)
      .map((h) => {
        const o = hours[h]
        return { hour: h, pct: pct(o.clipped, o.cap), pctRaw: pct(o.capT, o.cap), over: o.over }
      }),
  }
}

// ---------------------------------------------------------------- settings and seams

export interface TphChannel {
  key: string
  name: string
  kind: 'ticket' | 'chat' | 'manual'
  groups: string[]
}

/** tphChannels_: the configured tph_channels, normalised. */
export function tphChannels_(cfg: Cfg): TphChannel[] {
  const list = prodSetting_(cfg, 'tph_channels')
  return ([] as { key: unknown; name?: unknown; kind?: string; groups?: unknown[] }[])
    .concat((list as never[]) || [])
    .filter((c) => c && c.key && c.key !== TPH_OFF)
    .map((c) => ({
      key: String(c.key),
      name: String(c.name || c.key),
      kind: c.kind === 'chat' || c.kind === 'manual' ? c.kind : 'ticket',
      groups: ([] as unknown[]).concat(c.groups || []).map(String),
    }))
}

/** tphActivities_: non-queue activities a TL can log (never capped). */
export function tphActivities_(cfg: Cfg): { key: string; name: string }[] {
  return ([] as { key: unknown; name?: unknown }[])
    .concat((prodSetting_(cfg, 'tph_activities') as never[]) || [])
    .filter((a) => a && a.key && a.key !== TPH_OFF)
    .map((a) => ({ key: String(a.key), name: String(a.name || a.key) }))
}

/** tphKeys_: every key a slot or task may hold: channels, activities, 'off'. */
export function tphKeys_(cfg: Cfg): string[] {
  return tphChannels_(cfg)
    .map((c) => c.key)
    .concat(tphActivities_(cfg).map((a) => a.key), [TPH_OFF])
}

/** tphHours_: grid hours [from, to) of the day, Kuwait. */
export function tphHours_(cfg: Cfg): number[] {
  const v = ([] as unknown[]).concat((prodSetting_(cfg, 'tph_day_hours') as unknown[]) || [])
  const a = Math.max(0, Math.min(23, Math.floor(Number(v[0]) || 0)))
  const b = Math.max(a + 1, Math.min(24, Math.floor(Number(v[1]) || 24)))
  const out: number[] = []
  for (let h = a; h < b; h++) out.push(h)
  return out
}

/**
 * tphShifts_: seam for the WFM schedule (not linked): email -> { from, to } shift slots for
 * the date. Empty = no shift known. When linked, read a stored snapshot — inject it.
 */
export function tphShifts_(dateKey: string): Record<string, { from: number; to: number }> {
  void dateKey
  return {}
}

/** tphPeople_: every active agent; the caller's own team first. */
export function tphPeople_(
  user: { email: string },
  dir: { by: Record<string, { email: string; name: string; tlEmail: string | null; active: boolean; role: string }> }
): { email: string; name: string; tlEmail: string; mine: boolean }[] {
  return Object.keys(dir.by)
    .map((k) => dir.by[k])
    .filter((p) => p.active && (p.role === 'agent' || p.role === 'specialist'))
    .map((p) => ({ email: p.email, name: p.name, tlEmail: p.tlEmail || '', mine: p.tlEmail === user.email }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name))
}

export function tphJson_<T>(v: unknown, dflt: T): T {
  if (v && typeof v === 'object') return v as T
  try {
    return JSON.parse(String(v || ''))
  } catch {
    return dflt
  }
}

/** tphCheckDate_ verbatim: throws unless the caller may edit `date`. */
export function tphCheckDate_(user: { role: string }, date: unknown, cfg: Cfg, today?: number | Date): string {
  const d = String(date || '')
  const todayKey = prodToday_(cfg, today)
  if (!/^\d{4}-\d\d-\d\d$/.test(d)) throw new Error('Pick a date (yyyy-MM-dd).')
  if (d > todayKey) throw new Error('You can log today and earlier days, not ' + d + '.')
  const days = Number(prodSetting_(cfg, 'tph_tl_edit_days'))
  if (!tphCanEdit_(user.role, d, todayKey, days))
    throw new Error(d + ' is more than ' + days + ' days ago: only an admin can change it now.')
  return d
}

/** tphNowSlot_: the current slot (Kuwait/business zone) on today, so carrying stops at now. */
export function tphNowSlot_(cfg: Cfg, now?: number | Date): number {
  const tz = String(dqSetting_(cfg, 'business_tz'))
  const hm = formatDate_(now === undefined ? new Date() : new Date(now), tz, 'HH:mm').split(':')
  return Number(hm[0]) * 4 + Math.floor(Number(hm[1]) / TPH_SLOT_MIN)
}

/** tphCheckAgent_ verbatim: throws unless email is an active agent/specialist. */
export function tphCheckAgent_(
  dir: { person: (e: string) => { email: string; active: boolean; role: string } | null },
  email: unknown
): string {
  const p = dir.person(String(email))
  if (!p || !p.active || (p.role !== 'agent' && p.role !== 'specialist'))
    throw new Error('That person is not an active agent.')
  return p.email
}

/** tphCheckCalls_: throws unless the Inbound calls channel exists. */
export function tphCheckCalls_(cfg: Cfg): void {
  if (tphChannels_(cfg).map((c) => c.key).indexOf(TPH_CALLS) === -1)
    throw new Error('There is no Inbound calls channel (key "calls") in tph_channels.')
}

/** tphFlagCalls_ verbatim: sets/clears the calls flag on `slots` of one agent-day, in place. */
export function tphFlagCalls_(
  logged: Record<number | string, string>,
  src: Record<number | string, string>,
  slots: number[],
  on: boolean,
  tag: string
): void {
  const shown = tphResolveSlots_(logged, 0, TPH_SLOTS, TPH_SLOTS)
  slots.forEach((s) => {
    let primary = logged[s] ? tphParseSlot_(logged[s]).primary : shown[s] ? shown[s].channel : ''
    if (!on && primary === TPH_CALLS) primary = ''
    const v = tphSlotValue_(primary, on)
    if (v) {
      logged[s] = v
      src[s] = tag
    } else {
      delete logged[s]
      delete src[s]
    }
  })
}

/**
 * tphEditDay_ verbatim, store seam injected: writes one agent-day's slots.
 * io.upsertIn = dqUpsertIn_.
 */
export function tphEditDay_(
  user: { email: string },
  date: string,
  email: string,
  edit: (logged: Record<string, string>, src: Record<string, string>) => void,
  io: { prodRows: (name: string) => Record<string, unknown>[]; upsertIn: (t: string, cols: string[], rows: Record<string, unknown>[], y: null) => void },
  now?: number | Date
): number {
  const nowIso = prodNowIso_(now)
  const row =
    io.prodRows('prod_tph_days').filter((r) => r.date === date && normEmail_(r.agent_email) === email)[0] || {}
  const logged = tphJson_<Record<string, string>>(row.slots_json, {})
  const src = tphJson_<Record<string, string>>(row.sources_json, {})
  edit(logged, src)
  io.upsertIn(
    'prod_tph_days',
    ['date', 'agent_email'],
    [
      {
        date,
        agent_email: email,
        slots_json: JSON.stringify(logged),
        sources_json: JSON.stringify(src),
        by: user.email,
        at: nowIso,
      },
    ],
    null
  )
  return Object.keys(logged).length
}

/** tphLastAuto_: the newest automatic TPH build in refresh_log rows (injected). */
export function tphLastAuto_(refreshLogRows: Record<string, unknown>[]): { at: string; job: string; status: string; note: string } | null {
  try {
    const rows = refreshLogRows
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i]
      const job = String(r.job || '')
      const note = String(r.note || '')
      const daily =
        (job === 'prod_tph_touches' || job === 'prod_tph_calls' || job === 'prod_tph_cases_rebuilt') &&
        note.indexOf(' by ') === -1
      if (job !== 'prod_tph_auto' && !daily) continue
      const at = r.finished_at || r.started_at
      return {
        at: at instanceof Date ? at.toISOString() : String(at || ''),
        job: job === 'prod_tph_auto' ? TPH_PAST_JOB : 'jobProductivityDaily',
        status: String(r.status || ''),
        note: note.slice(0, 300),
      }
    }
  } catch {
    /* no log */
  }
  return null
}

// ---------------------------------------------------------------- tphDayCore_ / page shapes

export interface TphIo {
  cfg: Cfg
  prodRows: (name: string) => Record<string, unknown>[]
  /** tphShifts_ output for the date ({} when unlinked). */
  shifts?: Record<string, { from: number; to: number }>
  now?: number | Date
  upsert?: (t: string, cols: string[], rows: Record<string, unknown>[], y: number | null) => void
  upsertIn?: (t: string, cols: string[], rows: Record<string, unknown>[], y: number | null) => void
}

/**
 * tphDayCore_ verbatim: grid, cells, cases and the cap table for day d.
 * people = tphPeople_ output.
 */
export function tphDayCore_(
  d: string,
  today: string,
  hours: number[],
  keys: string[],
  people: { email: string }[],
  io: TphIo
): Record<string, unknown> {
  const from = hours[0] * 4
  const to = (hours[hours.length - 1] + 1) * 4
  const nowSlot = d === today ? tphNowSlot_(io.cfg, io.now) : TPH_SLOTS
  const shifts = io.shifts || tphShifts_(d)
  const days: Record<string, Record<string, unknown>> = {}
  io.prodRows('prod_tph_days').forEach((r) => {
    if (r.date === d) days[normEmail_(r.agent_email)] = r
  })
  const grid: Record<string, Record<number, TphResolvedSlot>> = {}
  const cells: Record<string, { c: string; calls: boolean; src: string }[]> = {}
  people.forEach((p) => {
    const row = days[p.email]
    const logged = tphJson_<Record<string, string>>(row && row.slots_json, {})
    const src = tphJson_<Record<string, string>>(row && row.sources_json, {})
    grid[p.email] = tphResolveSlots_(logged, from, to, nowSlot + 1, shifts[p.email])
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
  let autoRaw: Record<string, { stock: unknown; c0: unknown; c1: unknown }> = {}
  let autoAsOf = ''
  let reb: { cells?: Record<string, { stock: unknown; new: unknown }> } | null = null
  let rebAsOf = ''
  io.prodRows('prod_tph_cases').forEach((r) => {
    if (r.date !== d) return
    if (r.source === 'tl') tl = tphJson_(r.cases_json, {})
    if (r.source === 'auto') {
      autoRaw = tphJson_(r.cases_json, {})
      autoAsOf = String(r.at || '')
    }
    if (r.source === 'rebuilt') {
      reb = tphJson_(r.cases_json, {})
      rebAsOf = String(r.at || '')
    }
  })
  const auto = tphAutoCases_(autoRaw, hours, keys)
  const rebuilt = tphRebuiltCases_(reb)
  const untilHour = d === today ? Math.floor(nowSlot / 4) + 1 : 24
  const cases = tphResolveCases_(tl, auto, hours, keys, untilHour, rebuilt)
  const touchRows = io.prodRows('prod_tph_touches')
  const touchRow = touchRows.filter((r) => r.date === d)[0]
  const callRow = io.prodRows('prod_tph_calls').filter((r) => r.date === d)[0]
  const callMinutes = callRow ? tphJson_<Record<string, [number, number]>>(callRow.calls_json, {}) : null
  const table = tphTable_({
    hours,
    channels: keys,
    grid,
    cases,
    touches: touchRow ? tphJson_<Record<string, number>>(touchRow.touches_json, {}) : null,
    minutesPerCase: prodSetting_(io.cfg, 'tph_minutes_per_case'),
    capWindowMin: prodSetting_(io.cfg, 'tph_cap_window_min'),
    callsFactor: prodSetting_(io.cfg, 'tph_calls_minute_factor'),
    callMinutes,
  })
  return {
    from,
    nowSlot,
    shifts,
    grid,
    cells,
    tl,
    auto,
    autoAsOf,
    reb,
    rebAsOf,
    cases,
    touchRows,
    touchRow,
    callRow,
    callMinutes,
    table,
    hasCases: !!(reb || autoAsOf || Object.keys(tl).length),
  }
}

// ---------------------------------------------------------------- jobs (store seams)

/**
 * tphBuildTouches_ verbatim: touches per agent/hour/channel for `dates`, one row per date.
 * nameToEmail/headcount injected; writes through io.upsert.
 */
export function tphBuildTouches_(
  dates: string[],
  activityRows: unknown[][],
  io: TphIo & { upsert: NonNullable<TphIo['upsert']>; headcount?: HeadcountRow[] }
): number {
  if (!prodReady_(io.cfg) || !dates.length) return 0
  const by = tphTouchesFromRows_(
    activityRows,
    dates,
    prodNameToEmail_(io.headcount || []),
    String(dqSetting_(io.cfg, 'activity_local_tz')),
    tphChannels_(io.cfg),
    String(dqSetting_(io.cfg, 'business_tz'))
  )
  const now = prodNowIso_(io.now)
  io.upsert(
    'prod_tph_touches',
    ['date'],
    dates.map((d) => ({ date: d, touches_json: JSON.stringify(by[d] || {}), computed_at: now })),
    null
  )
  return dates.length
}

/** tphActivityTail_: Activities rows from `days` before date's start to the end of the tab. */
export function tphActivityTail_(
  date: string,
  days: number,
  cfg: Cfg,
  openSpreadsheet: (id: string) => SheetBookLike
): unknown[][] {
  const from = tphHourMs_(date, 0, String(dqSetting_(cfg, 'business_tz'))) - days * 86400000
  return tphReadTail_(
    openSpreadsheet(String(dqSetting_(cfg, 'fd_activity_ss_id'))),
    'Activities',
    1,
    10,
    1,
    from,
    String(dqSetting_(cfg, 'activity_local_tz'))
  ).rows
}

/** tphBuildCallMinutes_ verbatim: actual inbound call minutes per agent/hour for `dates`. */
export function tphBuildCallMinutes_(
  dates: string[],
  io: TphIo & { upsert: NonNullable<TphIo['upsert']>; headcount?: HeadcountRow[]; openSpreadsheet: (id: string) => SheetBookLike }
): number {
  if (!prodReady_(io.cfg) || !dates.length) return 0
  const emails: Record<string, boolean> = {}
  ;(io.headcount || []).forEach((p) => {
    if (p.email) emails[String(p.email).trim().toLowerCase()] = true
  })
  const months: Record<string, string[]> = {}
  dates.forEach((d) => {
    ;(months[d.slice(0, 7)] = months[d.slice(0, 7)] || []).push(d)
  })
  const by: Record<string, Record<string, [number, number]>> = {}
  const bizTz = String(dqSetting_(io.cfg, 'business_tz'))
  const dataTz = String(dqSetting_(io.cfg, 'data_tz'))
  Object.keys(months).forEach((m) => {
    const from = tphHourMs_(months[m].slice().sort()[0], 0, bizTz) - 86400000
    const rows = tphReadTail_(io.openSpreadsheet(prodFileFor_(m, io.cfg)), 'Maqsam Calls', 4, 7, 4, from, dataTz).rows
    const got = tphCallMinutesFromRows_(
      rows,
      months[m],
      emails,
      prodList_(io.cfg, 'tph_call_states'),
      dataTz,
      bizTz,
      prodSetting_(io.cfg, 'tph_cap_window_min')
    )
    Object.keys(got).forEach((d) => {
      by[d] = got[d]
    })
  })
  const now = prodNowIso_(io.now)
  io.upsert(
    'prod_tph_calls',
    ['date'],
    dates.map((d) => ({ date: d, calls_json: JSON.stringify(by[d] || {}), computed_at: now })),
    null
  )
  return dates.length
}

/**
 * tphBuildCases_ verbatim: rebuilds cases offered per hour for past `dates` from history.
 * Seams: openSpreadsheet (daily_report_ss_id Freshchat, fd_activity_ss_id Activities),
 * readTickets (dqReadLean_ equivalent), readInflow (agg_inflow_hourly per year), prodRows.
 */
export function tphBuildCases_(
  dates: string[],
  activityRows: unknown[][] | null,
  part: string | undefined,
  io: TphIo & {
    openSpreadsheet: (id: string) => SheetBookLike
    readTickets: (cols: string[], pick: (o: Record<string, unknown>) => boolean) => void
    readInflow: (year: number) => Record<string, unknown>[]
    upsertIn: NonNullable<TphIo['upsertIn']>
  }
): Record<string, { cells: Record<string, unknown>; reasons: Record<string, string> }> {
  if (!prodReady_(io.cfg) || !dates.length) return {}
  const bizTz = String(dqSetting_(io.cfg, 'business_tz'))
  const dataTz = String(dqSetting_(io.cfg, 'data_tz'))
  const channels = tphChannels_(io.cfg).filter((c) => tphCasesPart_(c, part))
  const hours = tphHours_(io.cfg)
  const low = (v: unknown) => String(v || '').trim().toLowerCase()
  const statuses = ([] as unknown[]).concat((prodSetting_(io.cfg, 'tph_ticket_statuses') as unknown[]) || []).map(low)
  const tch = channels.filter((c) => tphCasesPart_(c, 'tickets') && c.groups.length)
  const sorted = dates.slice().sort()
  const since = dqAddDays_(sorted[0], -1)
  const upto = dqAddDays_(sorted[sorted.length - 1], 1)
  const histFrom = tphHourMs_(sorted[0], 0, bizTz) - TPH_HISTORY_DAYS * 86400000
  let chats: unknown[][] | null = null
  let chatErr = ''
  if (channels.some((c) => c.kind === 'chat')) {
    try {
      chats = tphReadTail_(
        io.openSpreadsheet(String(dqSetting_(io.cfg, 'daily_report_ss_id'))),
        'Freshchat',
        1,
        7,
        1,
        histFrom,
        dataTz
      ).rows
      if (!chats.length) chatErr = 'Freshchat tab has no chats since ' + dqAddDays_(sorted[0], -TPH_HISTORY_DAYS)
    } catch (e) {
      chatErr = 'Freshchat tab could not be read: ' + (e as Error).message
    }
  }
  const tickets: Record<string, unknown>[] = []
  const storeDates: Record<string, boolean> = {}
  let act: ReturnType<typeof tphActIndex_> = null
  if (tch.length) {
    if (!activityRows)
      activityRows = tphActivityTail_(sorted[0], TPH_HISTORY_DAYS, io.cfg, io.openSpreadsheet)
    act = tphActIndex_(activityRows, String(dqSetting_(io.cfg, 'activity_local_tz')))
    const groups: Record<string, boolean> = {}
    const actIds: Record<string, boolean> = {}
    tch.forEach((c) => {
      c.groups.forEach((g) => {
        groups[low(g)] = true
      })
    })
    if (act)
      Object.keys(act.byId).forEach((id) => {
        if (act!.byId[id].some((h) => groups[h.group])) actIds[id] = true
      })
    io.readTickets(
      ['ticket_id', 'status', 'group_name', 'created_at', 'resolved_at', 'closed_at'],
      (o) => {
        const c = String(o.created_at).slice(0, 10)
        if (!c || c > upto) return false
        if (c >= since) storeDates[c] = true
        let id: string | undefined
        if (!groups[low(o.group_name)] && !actIds[(id = tphTid_(o.ticket_id))]) return false
        const done =
          [String(o.resolved_at || ''), String(o.closed_at || '')].filter(Boolean).sort()[0] || ''
        if (done && done.slice(0, 10) < since && !actIds[id || tphTid_(o.ticket_id)]) return false
        tickets.push(o)
        return false
      }
    )
  }
  let calls: Record<string, unknown>[] | null = null
  if (channels.some((c) => c.key === TPH_CALLS)) {
    calls = []
    sorted
      .map((d) => d.slice(0, 4))
      .filter((y, i, a) => a.indexOf(y) === i)
      .forEach((y) => {
        calls = calls!.concat(io.readInflow(Number(y)))
      })
  }
  const out: Record<string, { cells: Record<string, unknown>; reasons: Record<string, string> }> = {}
  sorted.forEach((d) => {
    const cells: Record<string, unknown> = {}
    const reasons: Record<string, string> = {}
    channels.forEach((c) => {
      let got: { cells: Record<number, { stock: number; new: number }> | null; reason: string }
      if (c.kind === 'chat')
        got =
          chats && chats.length
            ? tphChatCases_(chats, d, hours, dataTz, bizTz)
            : { cells: null, reason: chatErr || 'Freshchat tab is empty' }
      else if (c.key === TPH_CALLS) got = tphCallCases_(calls || [], d, hours)
      else if (c.groups.length)
        got = tphTicketCases_(tickets as never, act, d, hours, {
          groups: c.groups.map(low),
          statuses,
          dataTz,
          bizTz,
          storeHasDate: !!storeDates[d],
        })
      else got = { cells: null, reason: 'No Freshdesk groups set for this channel: enter its cases by hand' }
      if (got.reason) reasons[c.key] = got.reason
      if (got.cells)
        Object.keys(got.cells).forEach((h) => {
          cells[h + '|' + c.key] = got.cells![Number(h)]
        })
    })
    out[d] = { cells, reasons }
  })
  const keys = channels.map((c) => c.key)
  const now = prodNowIso_(io.now)
  const have: Record<string, { cells?: Record<string, unknown>; reasons?: Record<string, unknown> }> = {}
  io.prodRows('prod_tph_cases').forEach((r) => {
    if (r.source === 'rebuilt' && out[String(r.date)])
      have[String(r.date)] = tphJson_(r.cases_json, {})
  })
  io.upsertIn(
    'prod_tph_cases',
    ['date', 'source'],
    sorted.map((d) => ({
      date: d,
      source: 'rebuilt',
      cases_json: JSON.stringify(tphMergeRebuilt_(have[d], out[d], keys)),
      by: 'system',
      at: now,
    })),
    null
  )
  return out
}

// ---------------------------------------------------------------- capture + steps

/**
 * tphCaptureCases_ verbatim, seams injected: folds the fresh queue numbers into today's
 * 'auto' prod_tph_cases row. io.cachedLive = dqCachedLive_('agg_queue_now'); io.withLock optional.
 */
export function tphCaptureCases_(
  io: TphIo & {
    cachedLive: (name: string) => Record<string, unknown>[]
    upsertIn: NonNullable<TphIo['upsertIn']>
    withLock?: <T>(fn: () => T) => T
  }
): Record<string, unknown> {
  if (!prodReady_(io.cfg)) return { skipped: 'CC2 Productivity is not set up' }
  const tz = String(dqSetting_(io.cfg, 'business_tz'))
  const now = io.now === undefined ? new Date() : new Date(io.now)
  const date = formatDate_(now, tz, 'yyyy-MM-dd')
  const h = Number(formatDate_(now, tz, 'H'))
  const got = tphCasesFromQueue_(
    io.cachedLive('agg_queue_now') || [],
    tphChannels_(io.cfg),
    prodSetting_(io.cfg, 'tph_ticket_statuses'),
    prodSetting_(io.cfg, 'tph_chat_exclude_statuses')
  )
  if (!Object.keys(got).length) return { rowsOut: 0, note: date + ' ' + h + ':00 no fresh queue numbers' }
  const at = now.toISOString()
  const run = () => {
    const row =
      io.prodRows('prod_tph_cases').filter((r) => r.date === date && r.source === 'auto')[0] || {}
    const m = tphJson_<Record<string, { stock: unknown; c0: unknown; c1: unknown }>>(row.cases_json, {})
    const added = tphFoldCapture_(m, h, got)
    io.upsertIn(
      'prod_tph_cases',
      ['date', 'source'],
      [{ date, source: 'auto', cases_json: JSON.stringify(m), by: 'system', at }],
      null
    )
    return { rowsOut: added, note: date + ' ' + h + ':00 ' + JSON.stringify(got) }
  }
  return io.withLock ? io.withLock(run) : run()
}

/** tphDiagnoseTouchLines_ verbatim: why an agent's touches are low — pure, returns log lines. */
export function tphDiagnoseTouchLines_(
  rows: unknown[][],
  date: string,
  frag: unknown,
  nameToEmail: Record<string, string>,
  localTz: string,
  channels: { key: string; groups?: unknown[] }[],
  bizTz: string,
  headcount: { email?: string; name?: string; fdName?: string; fdId?: string }[] | null
): string[] {
  const idx = tphGroupIndex_(channels)
  const fb = tphTouchFallback_(channels)
  const inLocal = tphClock_(localTz)
  const inBiz = tphClock_(bizTz)
  const f = String(frag || '').trim().toLowerCase()
  const names: Record<string, number> = {}
  const groups: Record<string, { n: number; ids: Record<string, boolean>; ch: string }> = {}
  const unmapped: Record<string, number> = {}
  const mine: unknown[][] = []
  const raw: Record<string, { n: number; ids: Record<string, boolean> }> = {}
  const top = (o: Record<string, number>, n: number) =>
    Object.keys(o)
      .sort((a, b) => o[b] - o[a])
      .slice(0, n)
  rows.forEach((r) => {
    const t = inLocal.ms(r[0])
    if (t === null || inBiz.day(t) !== date) return
    const g = String(r[8] || '').trim()
    const gl = g.toLowerCase()
    if (!idx[gl]) unmapped[g || '(blank)'] = (unmapped[g || '(blank)'] || 0) + 1
    const n = String(r[2] || '').trim()
    if (/raw id/i.test(n)) {
      const rw = (raw[n] = raw[n] || { n: 0, ids: {} })
      rw.n++
      rw.ids[tphTid_(r[1])] = true
    }
    if (!f || n.toLowerCase().indexOf(f) === -1) return
    mine.push(r)
    names[n] = (names[n] || 0) + 1
    const gg = (groups[g || '(blank)'] = groups[g || '(blank)'] || {
      n: 0,
      ids: {},
      ch: idx[gl] || (fb ? fb + ' (fallback)' : 'UNMAPPED'),
    })
    gg.n++
    gg.ids[tphTid_(r[1])] = true
  })
  const credited = tphTouchesFromRows_(mine, [date], nameToEmail, localTz, channels, bizTz)[date] || {}
  const total = Object.keys(credited).reduce((s, k) => s + credited[k], 0)
  const cnt = (o: Record<string, { n: number }>) => {
    const m: Record<string, number> = {}
    Object.keys(o).forEach((k) => {
      m[k] = o[k].n
    })
    return m
  }
  const out = ['diagnoseTphTouches ' + date + ' "' + frag + '": ' + mine.length + ' rows, ' + total + ' touches credited']
  out.push('-- names (col C):')
  top(names, 10).forEach((n) => {
    out.push('  "' + n + '" x' + names[n] + ' -> ' + (nameToEmail[n.toLowerCase()] || 'NOT IN HEADCOUNT'))
  })
  out.push('-- groups (col I):')
  top(cnt(groups), 20).forEach((g) => {
    out.push('  "' + g + '" x' + groups[g].n + ', ' + Object.keys(groups[g].ids).length + ' tickets -> ' + groups[g].ch)
  })
  out.push('-- top unmapped groups, all agents:')
  top(unmapped, 15).forEach((g) => {
    out.push('  "' + g + '" x' + unmapped[g])
  })
  out.push('-- raw-id performers, all agents:')
  top(cnt(raw), 50).forEach((n) => {
    const need = (n.match(/raw id\s*(\S+)/i) || [])[1] || ''
    out.push(
      '  "' + n + '" x' + raw[n].n + ', ' + Object.keys(raw[n].ids).length + ' tickets, needs fdId ' +
        JSON.stringify(need) + ' -> ' + (nameToEmail[n.toLowerCase()] || 'NOT MAPPED')
    )
  })
  if (headcount) {
    out.push(
      '-- headcount: ' + headcount.length + ' entries, ' +
        headcount.filter((h) => String(h.fdId || '').trim()).length + ' with fdId'
    )
    headcount.forEach((h) => {
      if (!f || (String(h.name || '') + '|' + String(h.fdName || '')).toLowerCase().indexOf(f) === -1) return
      const id = String(h.fdId || '')
      out.push(
        '  match: ' + h.email + ' name ' + JSON.stringify(h.name) + ' fdName ' + JSON.stringify(h.fdName) +
          ' fdId ' + JSON.stringify(h.fdId) +
          ' -> raw-id name needed "unknown agent - raw id ' + id.toLowerCase() + '" ' +
          (nameToEmail['unknown agent - raw id ' + id.toLowerCase()] ? 'in map' : 'NOT IN MAP') +
          ', seen on date: ' +
          (Object.keys(raw).some((n) => n.toLowerCase() === 'unknown agent - raw id ' + id.trim().toLowerCase())
            ? 'yes'
            : 'no')
      )
    })
  }
  return out
}

// ---------------------------------------------------------------- past-day steps

/** tphPastDay_ verbatim: a past-day key or throw (today is computed tomorrow morning). */
export function tphPastDay_(date: unknown, cfg: Cfg, today?: number | Date): string {
  const d = String(date || '')
  if (!/^\d{4}-\d\d-\d\d$/.test(d) || d >= prodToday_(cfg, today))
    throw new Error('Pick a past day (yyyy-MM-dd): today is computed tomorrow morning.')
  return d
}

export type TphStep = 'touches' | 'cases_chats' | 'cases_tickets' | 'calls'

export interface TphStepIo extends TphIo {
  activityTail: (date: string, days: number) => unknown[][]
  buildTouches: (dates: string[], activityRows: unknown[][]) => unknown
  buildCallMinutes: (dates: string[]) => number
  buildCases: (dates: string[], activityRows: unknown[][] | null, part?: string) => Record<string, { cells: Record<string, unknown>; reasons: Record<string, string> }>
  logRun: (job: string, startedMs: number, status: string, info: Record<string, unknown>) => void
  nowMs?: number
}

/** tphRunStep_ verbatim, builds delegated to io: one step for one past day; logs its own run. */
export function tphRunStep_(
  d: string,
  step: string,
  by: string,
  io: TphStepIo
): Record<string, unknown> {
  const t = io.nowMs === undefined ? Date.now() : io.nowMs
  const out: Record<string, unknown> = { step, date: d }
  let job = ''
  let n: number | undefined
  try {
    if (step === 'touches') {
      job = 'prod_tph_touches'
      io.buildTouches([d], io.activityTail(d, 1))
      const row = io.prodRows('prod_tph_touches').filter((r) => r.date === d)[0]
      n = out.touchCells = Object.keys(tphJson_(row && row.touches_json, {})).length
    } else if (step === 'calls') {
      job = 'prod_tph_calls'
      n = io.buildCallMinutes([d])
    } else if (step === 'cases_chats' || step === 'cases_tickets') {
      job = 'prod_tph_cases_rebuilt'
      const got = io.buildCases([d], null, step === 'cases_tickets' ? 'tickets' : 'chats')[d] || { cells: {}, reasons: {} }
      n = out.casesRebuilt = Object.keys(got.cells).length
      out.casesReasons = got.reasons
    } else throw new Error('Unknown TPH step ' + step + '.')
  } catch (e) {
    if (job) io.logRun(job, t, 'error', { error: step + ' ' + d + ': ' + (e as Error).message })
    throw e
  }
  const ms = (io.nowMs === undefined ? Date.now() : io.nowMs) - t
  out.ms = ms
  io.logRun(job, t, 'ok', { rowsOut: n, note: 'TPH ' + step + ' ' + d + ' by ' + by + ' in ' + out.ms + ' ms' })
  return out
}

/** tphBuildPastDays_ verbatim, steps via tphRunStep_/io: rebuild the last TPH_PAST_DAYS stale days. */
export function tphBuildPastDays_(
  io: TphStepIo & { today?: number | Date }
): Record<string, unknown> {
  if (!prodReady_(io.cfg)) return { skipped: 'CC2 Productivity is not set up' }
  const t0 = io.nowMs === undefined ? Date.now() : io.nowMs
  const today = prodToday_(io.cfg, io.today)
  const done: string[] = []
  const failed: string[] = []
  const left: string[] = []
  for (let i = 1; i <= TPH_PAST_DAYS; i++) {
    const d = dqAddDays_(today, -i)
    const row = (name: string, pick?: (r: Record<string, unknown>) => boolean) =>
      io.prodRows(name).filter((r) => r.date === d && (!pick || pick(r)))[0]
    const touch = row('prod_tph_touches')
    const call = row('prod_tph_calls')
    const reb = row('prod_tph_cases', (r) => r.source === 'rebuilt')
    const steps = tphStaleSteps_(
      {
        touches: touch && String(touch.computed_at || ''),
        calls: call && String(call.computed_at || ''),
        cases: reb && String(reb.at || ''),
      },
      t0,
      TPH_STALE_MS
    )
    steps.forEach((step) => {
      if ((io.nowMs === undefined ? Date.now() : io.nowMs) - t0 > TPH_TIME_GUARD_MS) {
        left.push(d + ' ' + step)
        return
      }
      try {
        tphRunStep_(d, step, TPH_PAST_JOB, io)
        done.push(d + ' ' + step)
      } catch (err) {
        failed.push(d + ' ' + step + ': ' + (err as Error).message)
      }
    })
  }
  if (!done.length && !failed.length && !left.length) return { rowsOut: 0, note: 'nothing stale' }
  const note =
    'Built ' +
    (done.join(', ') || 'nothing') +
    (failed.length ? ' | failed ' + failed.join('; ') : '') +
    (left.length ? ' | left for next hour ' + left.join(', ') : '')
  io.logRun('prod_tph_auto', t0, failed.length ? 'error' : 'ok', { rowsOut: done.length, note, error: failed.join('; ') })
  return { rowsOut: done.length, note }
}
