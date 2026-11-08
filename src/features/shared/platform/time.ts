/**
 * Pure helpers — no datastore, no Next.js, no I/O.
 *
 * 1. Kuwait time helpers (original_deprecated/PeopleCore.js). Shift times and every
 *    "same day" rule are Asia/Kuwait (UTC+3, no DST), so a fixed offset is exact.
 * 2. WorkCore.js pure helpers (status checks, fit, rounding, number parsing).
 * 3. QueueCore.js group-name helpers (dqGroupKey_ / dqInList_ / dqNameHasText_).
 */

import 'server-only'

// ---------------------------------------------------------------- time (Asia/Kuwait)

export const PW_KW_OFFSET_MS = 3 * 3600 * 1000
export const PW_DAY_MS = 24 * 3600 * 1000
export const KUWAIT_TZ = 'Asia/Kuwait'
export const DATA_TZ = 'Africa/Cairo'

/** Writes a date/time string as text so a sheet never turns it into a local-time Date (pwTxt_). */
export function pwTxt(s: unknown): string {
  return s === '' || s === null || s === undefined ? '' : "'" + String(s)
}

export function pwStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.charAt(0) === "'" ? s.slice(1) : s
}

/**
 * Milliseconds for a stored or client value (pwMs_). A string with no zone
 * ("2026-10-08T14:00", from <input type=datetime-local>) is Kuwait time.
 */
export function pwMs(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number') return v
  const s = pwStr(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(s + 'T00:00:00+03:00')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return Date.parse(s + (s.length === 16 ? ':00' : '') + '+03:00')
  }
  return Date.parse(s)
}

export function pwIso(v: unknown): string {
  const ms = pwMs(v)
  return isNaN(ms) ? '' : new Date(ms).toISOString()
}

/** yyyy-MM-dd in Kuwait for an instant (pwKwDate_). */
export function pwKwDate(v: unknown): string {
  const ms = pwMs(v)
  return isNaN(ms) ? '' : new Date(ms + PW_KW_OFFSET_MS).toISOString().slice(0, 10)
}

/** HH:mm in Kuwait for an instant (pwKwTime_). */
export function pwKwTime(v: unknown): string {
  const ms = pwMs(v)
  return isNaN(ms) ? '' : new Date(ms + PW_KW_OFFSET_MS).toISOString().slice(11, 16)
}

/**
 * A stored business date back to yyyy-MM-dd (pwDateOnly_). Accepts the text we
 * write, and a Date a sheet may have parsed it into.
 */
export function pwDateOnly(v: unknown): string {
  const s = pwStr(v).trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return pwKwDate(s)
}

/** Instant of a Kuwait wall-clock time on a date (pwAt_). */
export function pwAt(dateStr: string, hhmm: string): number {
  return Date.parse(dateStr + 'T' + hhmm + ':00+03:00')
}

export function pwDow(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay()
}

export function pwAddDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function pwToday(nowMs?: number): string {
  return pwKwDate(nowMs === undefined ? Date.now() : nowMs)
}

/** dqAddDays_: whole days between two yyyy-MM-dd keys, done on calendar dates. */
export function dqAddDays(key: string, n: number): string {
  const p = key.split('-')
  const t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n))
  return t.toISOString().slice(0, 10)
}

/** pwPrevMonth_: 'yyyy-MM' of the month before the given one. */
export function pwPrevMonth(month: string): string {
  let y = Number(month.slice(0, 4))
  let m = Number(month.slice(5, 7)) - 1
  if (m < 1) {
    y--
    m = 12
  }
  return y + '-' + (m < 10 ? '0' : '') + m
}

// ---------------------------------------------------------------- WorkCore pure helpers

/** pwIsOpenStatus_: an action still needs work. */
export function pwIsOpenStatus(s: string): boolean {
  return s === 'open' || s === 'blocked'
}

export interface ActionLike {
  series_id?: unknown
  status?: unknown
}

/** Open (open or blocked) actions in a series — the carry-forward list (pwOpenSeriesActions_). */
export function pwOpenSeriesActions<T extends ActionLike>(seriesId: unknown, allActions: T[]): T[] {
  return allActions.filter(
    (a) => String(a.series_id) === String(seriesId) && pwIsOpenStatus(String(a.status || 'open'))
  )
}

/** pwFit_: does the estimate fit the free hours. */
export function pwFit(est: number, free: number): 'fits' | 'does_not_fit' | 'tight' {
  if (!(est > 0)) return 'fits'
  if (est > free) return 'does_not_fit'
  if (est > 0.8 * free) return 'tight'
  return 'fits'
}

export function pwRound1(n: number): number {
  return Math.round(n * 10) / 10
}

export const scRound1 = pwRound1

/** pwLatestPercent_: last non-empty percent_complete wins. */
export function pwLatestPercent(updates: { percent_complete?: unknown }[]): number {
  for (let i = updates.length - 1; i >= 0; i--) {
    const u = updates[i]
    if (u.percent_complete !== '' && u.percent_complete !== undefined) {
      return Number(u.percent_complete) || 0
    }
  }
  return 0
}

/** d0num_: '' / null / undefined -> null, else Number. */
export function d0num(v: unknown): number | null {
  return v === '' || v === undefined || v === null ? null : Number(v)
}

/** scNum_: cell text ('85%', '') -> number, unparsable -> 0. */
export function scNum(v: unknown): number {
  if (v === '' || v === null || v === undefined) return 0
  const n = Number(String(v).replace('%', '').trim())
  return isNaN(n) ? 0 : n
}

export function scEmail(v: unknown): string {
  return String(v || '').trim().toLowerCase()
}

const SC_NUM_KEYS = [
  'matrix_day', 'inb_target', 'inb_achieved', 'txt_target', 'txt_achieved',
  'wa_target', 'wa_achieved', 'audits', 'score_x_audits',
  'fcr_passed', 'fcr_failed', 'fcr_excluded',
] as const

/** scNumRow_: a sc_daily object (cells may be text) into numbers. */
export function scNumRow(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    month: String(o.month),
    date: String(o.date),
    email: scEmail(o.email),
    name: String(o.name || ''),
  }
  SC_NUM_KEYS.forEach((k) => {
    out[k] = scNum(o[k])
  })
  return out
}

// ---------------------------------------------------------------- QueueCore group-name helpers

/**
 * dqGroupKey_: group-name key — case, extra spaces and spaces around "-" ignored
 * ("Ops Qatar -Gift cards" = "ops qatar - gift cards").
 */
export function dqGroupKey(name: unknown): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[‐-―]/g, '-') // U+2010-U+2015 dash variants
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function dqInList(name: unknown, list: unknown[] | null | undefined): boolean {
  const k = dqGroupKey(name)
  return (list || []).some((v) => dqGroupKey(v) === k)
}

/** dqNameHasText_: the group name contains any of the words (case-insensitive). */
export function dqNameHasText(name: unknown, words: unknown): boolean {
  const k = dqGroupKey(name)
  const list = Array.isArray(words) ? words : String(words || '').split(',')
  return list.some((w) => {
    const t = dqGroupKey(w)
    return t !== '' && k.indexOf(t) !== -1
  })
}
