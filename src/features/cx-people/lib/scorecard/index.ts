/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim WorkCore.js port:
   sheet/JSON rows are dynamic records; `any` is the honest shape here. */
/**
 * WorkCore.js pure parts ported 1:1 — the scorecard aggregate/derive/rank math and the
 * task-hours fit helpers. Data seams (sc_daily rows, behaviour rows, the working calendar,
 * Config) arrive as arguments; names keep the trailing underscore.
 */

import { dqAddDays_, dqKeyPart_, dqNormCell_, dqSetting_, getConfig_, normEmail_, pwAt_, pwAddDays_, pwDateOnly_, pwIso_, pwKwDate_, pwMs_, pwToday_, PW_DAY_MS, type Cfg } from '@/features/shared/lib/adapters'
import { kpiPayout_ } from '../kpi'

// ---------------------------------------------------------------- tasks read helpers

export function pwIsOpenStatus_(s: unknown): boolean {
  return s === 'open' || s === 'blocked'
}

/** pwOpenSeriesActions_: open (open or blocked) actions in a series — the carry-forward list. */
export function pwOpenSeriesActions_(
  seriesId: unknown,
  allActions: Record<string, any>[]
): Record<string, any>[] {
  return allActions.filter(
    (a) => String(a.series_id) === String(seriesId) && pwIsOpenStatus_(String(a.status || 'open'))
  )
}

/** pwPrevMonth_. */
export function pwPrevMonth_(month: string): string {
  let y = Number(month.slice(0, 4))
  let m = Number(month.slice(5, 7)) - 1
  if (m < 1) {
    y--
    m = 12
  }
  return y + '-' + (m < 10 ? '0' : '') + m
}

export function d0num_(v: unknown): number | null {
  return v === '' || v === undefined || v === null ? null : Number(v)
}

export function pwFit_(est: number, free: number): 'fits' | 'does_not_fit' | 'tight' {
  if (!(est > 0)) return 'fits'
  if (est > free) return 'does_not_fit'
  if (est > 0.8 * free) return 'tight'
  return 'fits'
}

export function pwLatestPercent_(updates: Record<string, any>[]): number {
  for (let i = updates.length - 1; i >= 0; i--) {
    if (updates[i].percent_complete !== '' && updates[i].percent_complete !== undefined)
      return Number(updates[i].percent_complete) || 0
  }
  return 0
}

export function pwRound1_(n: number): number {
  return Math.round(n * 10) / 10
}

// ---------------------------------------------------------------- working hours (calendar seam)

export interface WorkingDay {
  date: string
  working: boolean
  shift?: string | null
  estimated?: boolean
}

/** pwBreakHours_: the configured shift break (0..4 h, default 1). */
export function pwBreakHours_(cfg: Cfg): number {
  const b = Number(getConfig_(cfg, 'shift_break_hours', 1))
  return b >= 0 && b < 4 ? b : 1
}

/** pwShiftDefs_: configured shifts, else the AM/PM Kuwait defaults. */
export function pwShiftDefs_(cfg: Cfg): Record<string, { start: string; end: string }> {
  const d = getConfig_(cfg, 'shift_defs', null)
  return d && typeof d === 'object'
    ? (d as Record<string, { start: string; end: string }>)
    : { AM: { start: '09:30', end: '18:30' }, PM: { start: '13:00', end: '22:00' } }
}

/** pwDayHours_: paid working hours on one calendar day inside [fromMs, toMs]. */
export function pwDayHours_(day: WorkingDay, fromMs: number, toMs: number, cfg: Cfg): number {
  if (!day.working || !day.shift) return 0
  const def = pwShiftDefs_(cfg)[day.shift]
  if (!def) return 0
  const s = pwAt_(day.date, def.start)
  let e = pwAt_(day.date, def.end)
  if (e <= s) e += PW_DAY_MS
  const lenH = (e - s) / 3600000
  const ov = Math.max(0, Math.min(e, toMs) - Math.max(s, fromMs)) / 3600000
  return lenH > 0 ? (ov * (lenH - pwBreakHours_(cfg))) / lenH : 0
}

/**
 * pwWorkingHoursRaw_: working hours between two instants from the person's working calendar
 * (getWorkingCalendar_'s output, injected). A working day with no known shift counts as AM.
 */
export function pwWorkingHoursRaw_(
  calendarDays: WorkingDay[],
  cfg: Cfg,
  _email: string,
  startMs: number,
  endMs: number
): { hours: number; estimated: boolean; days: { date: string; hours: number }[] } {
  const out: { hours: number; estimated: boolean; days: { date: string; hours: number }[] } = {
    hours: 0,
    estimated: false,
    days: [],
  }
  calendarDays.forEach((day0) => {
    let day = day0
    if (day.working && !day.shift) day = { date: day.date, working: true, shift: 'AM', estimated: day.estimated }
    const h = pwDayHours_(day, startMs, endMs, cfg)
    if (h > 0) {
      if (day.estimated) out.estimated = true
      out.days.push({ date: day.date, hours: h })
    }
    out.hours += h
  })
  return out
}

/**
 * pwWorkingHours_: the cached wrapper — the per-execution memo is a GAS detail; callers pass
 * the calendar for the window (getWorkingCalendar_(email, pwKwDate_(startMs), pwKwDate_(endMs))).
 */
export function pwWorkingHours_(
  calendarDays: WorkingDay[],
  cfg: Cfg,
  email: string,
  startMs: number,
  endMs: number
): { hours: number; estimated: boolean; days: { date: string; hours: number }[] } {
  if (!(endMs > startMs)) return { hours: 0, estimated: false, days: [] }
  const hit = pwWorkingHoursRaw_(calendarDays, cfg, email, startMs, endMs)
  return { hours: hit.hours, estimated: hit.estimated, days: hit.days }
}

/**
 * pwFreeHours_: free task hours for one window after the owner's other open tasks take theirs,
 * earliest-first. `calendarFor(dateRange)` supplies each day's hours: callers pass a function
 * returning the calendar days covering a window (getWorkingCalendar_ output).
 */
export function pwFreeHours_(
  calendarFor: (fromDate: string, toDate: string) => WorkingDay[],
  cfg: Cfg,
  email: string,
  startMs: number,
  endMs: number,
  others: { startMs: number; endMs: number; remaining: number }[]
): number {
  const capacity: Record<string, number> = {}
  const full = (date: string) => {
    if (!(date in capacity))
      capacity[date] = pwWorkingHours_(
        calendarFor(date, pwAddDays_(date, 1)),
        cfg,
        email,
        pwAt_(date, '00:00'),
        pwAt_(pwAddDays_(date, 1), '00:00')
      ).hours
    return capacity[date]
  }
  others
    .slice()
    .sort((a, b) => a.endMs - b.endMs || a.startMs - b.startMs)
    .forEach((o) => {
      let left = o.remaining
      pwWorkingHours_(calendarFor(pwKwDate_(o.startMs), pwKwDate_(o.endMs)), cfg, email, o.startMs, o.endMs).days.forEach(
        (day) => {
          if (left <= 0) return
          const take = Math.min(left, day.hours, full(day.date))
          capacity[day.date] = full(day.date) - take
          left -= take
        }
      )
    })
  let free = 0
  pwWorkingHours_(calendarFor(pwKwDate_(startMs), pwKwDate_(endMs)), cfg, email, startMs, endMs).days.forEach((day) => {
    free += Math.min(day.hours, Math.max(0, full(day.date)))
  })
  return free
}

// ---------------------------------------------------------------- scorecard math

export interface ScBucket {
  days: number
  inbTarget: number
  inbAchieved: number
  txtTarget: number
  txtAchieved: number
  waTarget: number
  waAchieved: number
  audits: number
  scoreXaudits: number
}

export function scBucket_(days?: number): ScBucket {
  return {
    days: days || 0,
    inbTarget: 0,
    inbAchieved: 0,
    txtTarget: 0,
    txtAchieved: 0,
    waTarget: 0,
    waAchieved: 0,
    audits: 0,
    scoreXaudits: 0,
  }
}

export function scAdd_(a: ScBucket, r: Record<string, number>): void {
  a.days += r.matrix_day
  a.inbTarget += r.inb_target
  a.inbAchieved += r.inb_achieved
  a.txtTarget += r.txt_target
  a.txtAchieved += r.txt_achieved
  a.waTarget += r.wa_target
  a.waAchieved += r.wa_achieved
  a.audits += r.audits
  a.scoreXaudits += r.score_x_audits
}

export function scRound1_(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * scDerive_ verbatim: a = the bucket, f = { passed, failed, excluded }, b = behaviour
 * { found, cases, details } (found:false = unknown, 0 points), k = { olCases,
 * leaveIneligible, probationMonth }. overall = kpiPayout_ total.
 */
export function scDerive_(
  a: ScBucket,
  f: { passed: number; failed: number; excluded: number } | null,
  b: { found: boolean; cases: number; details: unknown[] } | null,
  k: { olCases?: number; leaveIneligible?: boolean; probationMonth?: number } | null
): Record<string, unknown> {
  const pctOrNull = (num: number, den: number) => (den > 0 ? scRound1_((num / den) * 100) : null)
  const totalTarget = a.inbTarget + a.txtTarget + a.waTarget
  const totalAchieved = a.inbAchieved + a.txtAchieved + a.waAchieved
  const prod = pctOrNull(totalAchieved, totalTarget)
  const qual = a.audits > 0 ? scRound1_(a.scoreXaudits / a.audits) : null

  const fc = f || { passed: 0, failed: 0, excluded: 0 }
  const fcrDen = fc.passed + fc.failed
  const fcrPct = fcrDen > 0 ? scRound1_((fc.passed / fcrDen) * 100) : null

  const bh = b || { found: false, cases: 0, details: [] }
  const behav = bh.found ? (bh.cases > 0 ? 0 : 100) : null

  const kc = k || {}
  const kpi = kpiPayout_({
    prod,
    qual,
    fcr: fcrPct,
    behaviorKnown: behav !== null,
    behaviorCases: bh.cases || 0,
    olCases: kc.olCases || 0,
    leaveIneligible: !!kc.leaveIneligible,
    probationMonth: kc.probationMonth || 0,
  })

  return {
    days: a.days || 0,
    inbTarget: scRound1_(a.inbTarget),
    inbAchieved: scRound1_(a.inbAchieved),
    inbProd: pctOrNull(a.inbAchieved, a.inbTarget),
    txtTarget: scRound1_(a.txtTarget),
    txtAchieved: scRound1_(a.txtAchieved),
    txtProd: pctOrNull(a.txtAchieved, a.txtTarget),
    waTarget: scRound1_(a.waTarget),
    waAchieved: scRound1_(a.waAchieved),
    waProd: pctOrNull(a.waAchieved, a.waTarget),
    totalTarget: scRound1_(totalTarget),
    totalAchieved: scRound1_(totalAchieved),
    prod,
    audits: a.audits,
    qual,
    fcrPassed: fc.passed,
    fcrFailed: fc.failed,
    fcrExcluded: fc.excluded,
    fcr: fcrPct,
    behavior: behav,
    behaviorCases: bh.cases || 0,
    behaviorDetails: bh.details || [],
    overall: kpi.total,
    kpi,
  }
}

export function scEmail_(v: unknown): string {
  return String(v || '').trim().toLowerCase()
}

export function scNum_(v: unknown): number {
  if (v === '' || v === null || v === undefined) return 0
  const n = Number(String(v).replace('%', '').trim())
  return isNaN(n) ? 0 : n
}

/** scNumRow_: number rows from sc_daily (cells may be text) into numbers. */
export function scNumRow_(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    month: String(o.month),
    date: String(o.date),
    email: scEmail_(o.email),
    name: String(o.name || ''),
  }
  ;[
    'matrix_day',
    'inb_target',
    'inb_achieved',
    'txt_target',
    'txt_achieved',
    'wa_target',
    'wa_achieved',
    'audits',
    'score_x_audits',
    'fcr_passed',
    'fcr_failed',
    'fcr_excluded',
  ].forEach((k) => {
    out[k] = scNum_(o[k])
  })
  return out
}

/** scRank_ (V1): best first, agents with no score at the bottom, ties by name. */
export function scRank_<T extends { overall: number | null; name: string; rank?: number | null }>(rows: T[]): T[] {
  rows.sort((a, b) => {
    if (a.overall === null && b.overall === null) return a.name.localeCompare(b.name)
    if (a.overall === null) return 1
    if (b.overall === null) return -1
    return b.overall - a.overall || a.name.localeCompare(b.name)
  })
  rows.forEach((r, i) => {
    r.rank = r.overall === null ? null : i + 1
  })
  return rows
}

/** scCasesInRange_: behaviour cases counting in [from, to]: dated by date; undated by month. */
export function scCasesInRange_<T extends { date?: unknown; month?: unknown; email?: unknown }>(
  cases: T[],
  from: string,
  to: string
): T[] {
  const fm = from.slice(0, 7)
  const tm = to.slice(0, 7)
  return cases.filter((c) => {
    const d = String(c.date || '')
    if (d) return d >= from && d <= to
    return String(c.month) >= fm && String(c.month) <= tm
  })
}

/** scDayRows_: one agent's day-by-day rows (newest first), scored like the period. */
export function scDayRows_(
  daily: Record<string, any>[],
  cases: { email?: unknown; date?: unknown; note?: unknown }[],
  bhvFound: boolean,
  email: string,
  kctx?: (email: string) => { olCases?: number; leaveIneligible?: boolean; probationMonth?: number } | null
): Record<string, any>[] {
  // A day uses the agent's probation bands; OL and leave adjustments are monthly.
  const dayK = kctx ? { probationMonth: kctx(email)?.probationMonth } : null
  const byDate: Record<string, { date: unknown; note: unknown }[]> = {}
  cases.forEach((c) => {
    if (c.email === email && c.date) (byDate[String(c.date)] = byDate[String(c.date)] || []).push({ date: c.date, note: c.note })
  })
  return daily
    .filter((r) => r.email === email && r.matrix_day)
    .map((r) => {
      const a = scBucket_(1)
      scAdd_(a, r)
      a.days = 1
      const hits = byDate[r.date] || []
      const d = scDerive_(
        a,
        { passed: r.fcr_passed, failed: r.fcr_failed, excluded: r.fcr_excluded },
        bhvFound ? { found: true, cases: hits.length, details: hits } : null,
        dayK
      )
      d.date = r.date
      return d
    })
    .sort((a, b) => (String(a.date) < String(b.date) ? 1 : String(a.date) > String(b.date) ? -1 : 0))
}

/**
 * scAggregate_ verbatim: period ranking — daily numeric rows + behaviour cases + who map.
 * kctx: email -> { olCases, leaveIneligible, probationMonth } or null.
 */
export function scAggregate_(
  daily: Record<string, any>[],
  cases: { email?: unknown; date?: unknown; note?: unknown }[],
  bhvFound: boolean,
  who: Record<string, { name?: string; tlName?: string; tlEmail?: string }>,
  kctx?: (email: string) => { olCases?: number; leaveIneligible?: boolean; probationMonth?: number } | null
): Record<string, any>[] {
  const acc: Record<string, { name: string; b: ScBucket }> = {}
  const fcr: Record<string, { passed: number; failed: number; excluded: number }> = {}
  daily.forEach((r) => {
    const f = (fcr[r.email] = fcr[r.email] || { passed: 0, failed: 0, excluded: 0 })
    f.passed += r.fcr_passed
    f.failed += r.fcr_failed
    f.excluded += r.fcr_excluded
    if (!r.matrix_day) return
    const a = (acc[r.email] = acc[r.email] || { name: r.name, b: scBucket_(0) })
    if (!a.name && r.name) a.name = r.name
    scAdd_(a.b, r)
  })
  const cs: Record<string, { cases: number; details: { date: string; note: string }[] }> = {}
  cases.forEach((c) => {
    const e = (cs[String(c.email)] = cs[String(c.email)] || { cases: 0, details: [] })
    e.cases++
    e.details.push({ date: String(c.date || ''), note: String(c.note || '') })
  })
  const rows = Object.keys(acc).map((email) => {
    const p = who[email] || {}
    const hit = cs[email]
    const d = scDerive_(
      acc[email].b,
      fcr[email],
      bhvFound ? { found: true, cases: hit ? hit.cases : 0, details: hit ? hit.details : [] } : null,
      kctx ? kctx(email) : null
    ) as Record<string, unknown> & { email: string; name: string; tlName: string; tlEmail: string; overall: number | null; rank?: number | null }
    d.email = email
    d.name = p.name || acc[email].name || email
    d.tlName = p.tlName || ''
    d.tlEmail = p.tlEmail || ''
    return d
  })
  return scRank_(rows)
}

// ---------------------------------------------------------------- month bookkeeping (pure parts)

export function scMonthsOf_(from: string, to: string): string[] {
  const out: string[] = []
  let m = from.slice(0, 7)
  const end = to.slice(0, 7)
  while (m <= end && out.length < 60) {
    out.push(m)
    let y = Number(m.slice(0, 4))
    let n = Number(m.slice(5, 7)) + 1
    if (n > 12) {
      y++
      n = 1
    }
    m = y + '-' + (n < 10 ? '0' : '') + n
  }
  return out
}

/** scSources_: the productivity_files map (object) or {}. */
export function scSources_(cfg: Cfg): Record<string, unknown> {
  const files = dqSetting_(cfg, 'productivity_files')
  return files && typeof files === 'object' && !Array.isArray(files)
    ? (files as Record<string, unknown>)
    : {}
}

/** scWorkbookFor_: the workbook for a month: its own entry, else the fallback. */
export function scWorkbookFor_(month: string, cfg: Cfg): { id: string; fallback: boolean } {
  const files = scSources_(cfg)
  if (files[month]) return { id: String(files[month]), fallback: false }
  return { id: String(dqSetting_(cfg, 'productivity_fallback_id') || ''), fallback: true }
}

/** scMonthView_ verbatim: an sc_months row + workbook ref -> the page's month status. */
export function scMonthView_(
  month: string,
  r: Record<string, unknown> | undefined,
  src: { id: string; fallback: boolean } | null
): Record<string, unknown> {
  const rr = r || {}
  const yes = (v: unknown) => v === 1 || v === '1' || v === true || String(v).toLowerCase() === 'true'
  return {
    month,
    workbookId: src ? src.id : String(rr.workbook_id || ''),
    usingFallback: src ? src.fallback : false,
    title: String(rr.title || ''),
    refreshedAt: String(rr.refreshed_at || ''),
    refreshedBy: String(rr.refreshed_by || ''),
    status: String(rr.status || (rr.month ? '' : 'never')),
    error: String(rr.error || ''),
    matrixRows: scNum_(rr.matrix_rows),
    agents: scNum_(rr.agents),
    firstDate: String(rr.first_date || ''),
    lastDate: String(rr.last_date || ''),
    skippedRows: scNum_(rr.skipped_rows),
    fcrRows: scNum_(rr.fcr_rows),
    fcrDated: yes(rr.fcr_dated),
    fcrNote: String(rr.fcr_note || ''),
    behaviourFound: yes(rr.behaviour_found),
    behaviourCases: scNum_(rr.behaviour_cases),
    behaviourNote: String(rr.behaviour_note || ''),
  }
}

/** scMonthRows_: sc_months rows keyed by month. */
export function scMonthRows_(rows: Record<string, any>[]): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  rows.forEach((r) => {
    out[String(r.month)] = r
  })
  return out
}

/** scNotes_ verbatim: the scorecard's data-quality notes from the month views. */
export function scNotes_(months: string[], views: Record<string, any>[]): string[] {
  const notes: string[] = []
  const readable = views.filter((v) => v.status === 'ok')
  months.forEach((m) => {
    const v = views.filter((x) => x.month === m)[0]
    if (!v || v.status === 'never' || v.status === '')
      notes.push("No data has been loaded for " + m + ". An admin can set that month's workbook under Admin and press Refresh.")
    else if (v.status === 'error') notes.push(m + ': the last refresh failed. ' + v.error)
  })
  if (readable.length && !readable.some((v) => v.fcrRows > 0 || v.fcrNote === '')) {
    notes.push(
      'The FCR tab could not be read' +
        (readable[0].fcrNote ? ' (' + readable[0].fcrNote + ')' : '') +
        '; FCR counts as 0 points (incomplete), it is not re-weighted.'
    )
  }
  if (readable.some((v) => v.fcrRows > 0 && !v.fcrDated))
    notes.push('The FCR tab has no date column, so FCR covers a whole month, not the selected days.')
  if (readable.length && !readable.some((v) => v.behaviourFound)) {
    notes.push(
      "The workbook's business behaviour log was not found" +
        (readable[0].behaviourNote ? ' (' + readable[0].behaviourNote + ')' : '') +
        '; Behaviour comes from the manual behaviour log only.'
    )
  }
  return notes
}

/**
 * scLoad_ verbatim, seams injected: daily/cases/views read from the caller's stores.
 * io: { readRange(name, from, to) -> row objects; behaviourLogRows; monthRows();
 *       monthsOf(from,to); workbookFor(month) }.
 */
export function scLoad_(
  io: {
    readRange: (name: string, from: string, to: string) => Record<string, any>[]
    behaviourLogRows: Record<string, any>[]
    monthRows: () => Record<string, Record<string, unknown>>
    workbookFor: (month: string) => { id: string; fallback: boolean }
  },
  range: { from: string; to: string }
): { daily: Record<string, any>[]; cases: Record<string, any>[]; views: Record<string, any>[]; months: string[]; bhvFound: boolean } {
  const daily = io
    .readRange('sc_daily', range.from, range.to)
    .map(scNumRow_)
    .filter((r) => String(r.date) >= range.from && String(r.date) <= range.to)
  const seen: Record<string, boolean> = {}
  const manual = io.behaviourLogRows
    .filter((c) => !c.removed_at)
    .map((c) => {
      const d = String(c.date || '').slice(0, 10)
      return { month: d.slice(0, 7), date: d, email: c.email, note: String(c.note || '') }
    })
  let cases = io
    .readRange('sc_behaviour', range.from, range.to)
    .concat(manual)
    .map((c) => ({
      month: String(c.month),
      date: String(c.date || ''),
      email: scEmail_(c.email),
      note: String(c.note || ''),
    }))
    .filter((c) => {
      const k = c.email + '|' + c.date + '|' + c.note
      if (seen[k]) return false
      return (seen[k] = true)
    })
  cases = scCasesInRange_(cases, range.from, range.to)
  const all = io.monthRows()
  const months = scMonthsOf_(range.from, range.to)
  const views = months.map((m) => scMonthView_(m, all[m], io.workbookFor(m)))
  return { daily, cases, views, months, bhvFound: true }
}

/** pwScoreMonths_: this month to date and last month from one scLoad_ of both. */
export function pwScoreMonths_(
  io: Parameters<typeof scLoad_>[0],
  who: Record<string, { name?: string; tlName?: string; tlEmail?: string }>,
  today: string,
  kctx?: (email: string) => { olCases?: number; leaveIneligible?: boolean; probationMonth?: number } | null
): Record<string, unknown> {
  const cur = today.slice(0, 7)
  const prev = pwPrevMonth_(cur)
  const d = scLoad_(io, { from: prev + '-01', to: today })
  const month = (m: string, from: string, to: string) => {
    const view = d.views.filter((v) => v.month === m)[0]
    const found = d.bhvFound
    const daily = d.daily.filter((r) => r.date >= from && r.date <= to)
    const cases = scCasesInRange_(d.cases, from, to)
    return {
      month: m,
      from,
      to,
      status: view ? String(view.status || 'never') : 'never',
      rows: scAggregate_(daily, cases, found, who, kctx),
      days: (email: string) => scDayRows_(daily, cases, found, email, kctx),
    }
  }
  return {
    current: month(cur, cur + '-01', today),
    previous: month(prev, prev + '-01', dqAddDays_(cur + '-01', -1)),
    notes: scNotes_([cur], d.views),
  }
}

/** pwScoreOut_: one person's figures for a month, without score or rank. */
export function pwScoreOut_(m: { month: string; from: string; to: string; rows: Record<string, any>[] }, email: string): Record<string, unknown> | null {
  const r = m.rows.filter((x) => x.email === email)[0]
  if (!r) return null
  return {
    month: m.month,
    from: m.from,
    to: m.to,
    prod: r.prod,
    inbProd: r.inbProd,
    txtProd: r.txtProd,
    waProd: r.waProd,
    inbAchieved: r.inbAchieved,
    inbTarget: r.inbTarget,
    txtAchieved: r.txtAchieved,
    txtTarget: r.txtTarget,
    waAchieved: r.waAchieved,
    waTarget: r.waTarget,
    qual: r.qual,
    audits: r.audits,
    fcr: r.fcr,
    fcrPassed: r.fcrPassed,
    fcrFailed: r.fcrFailed,
    behaviorKnown: r.behavior !== null,
    behaviorCases: r.behavior !== null ? r.behaviorCases : 0,
    behaviorDetails: r.behavior !== null ? r.behaviorDetails : [],
    days: r.days,
  }
}

// ---------------------------------------------------------------- action/task views (pure mappers)

/** pwActionOut_: the client shape of an action row. */
export function pwActionOut_(a: Record<string, unknown>, dir: { name: (e: string) => string }): Record<string, unknown> {
  return {
    actionId: String(a.action_id),
    title: String(a.title),
    description: String(a.description || ''),
    ownerEmail: normEmail_(a.owner_email),
    ownerName: dir.name(String(a.owner_email)),
    assignedBy: normEmail_(a.assigned_by),
    dueDate: pwDateOnly_(a.due_date),
    sourceType: String(a.source_type),
    sourceId: String(a.source_id || ''),
    seriesId: String(a.series_id || ''),
    topic: String(a.topic || ''),
    status: String(a.status || 'open'),
    outcomeNote: String(a.outcome_note || ''),
    closedAt: pwIso_(a.closed_at),
    visibility: String(a.visibility || 'shared'),
    trackAsTask: a.track_as_task === true || String(a.track_as_task).toLowerCase() === 'true',
    carryCount: Number(a.carry_count) || 0,
    sourceDeleted: !!a.source_deleted_at,
    createdAt: pwIso_(a.submitted_at),
  }
}

export function pwUpdateOut_(u: Record<string, unknown>, dir: { name: (e: string) => string }): Record<string, unknown> {
  return {
    updateId: String(u.update_id),
    actionId: String(u.action_id),
    kind: String(u.kind) === 'file' ? 'file' : 'status',
    note: String(u.note || ''),
    percent: u.percent_complete === '' || u.percent_complete === undefined ? null : Number(u.percent_complete),
    rag: String(u.rag || ''),
    nextStep: String(u.next_step || ''),
    fileId: String(u.drive_file_id || ''),
    fileName: String(u.file_name || ''),
    fileUrl: u.drive_file_id ? 'https://drive.google.com/file/d/' + u.drive_file_id + '/view' : '',
    plannedMilestoneId: String(u.planned_milestone_id || ''),
    by: normEmail_(u.submitted_by),
    byName: dir.name(String(u.submitted_by)),
    at: pwIso_(u.submitted_at),
  }
}
