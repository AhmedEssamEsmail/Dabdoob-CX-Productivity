/**
 * Shared helpers ported 1:1 from original_deprecated (ProdCore.js, Stores.js, Config.js,
 * PeopleCore.js, Auth.js, Repo.js): date/time-zone math, the SheetLike seam the sheet-reading
 * functions keep, and the settings seam that replaces getConfig_/dqSetting_/prodSetting_.
 *
 * Seam rule: every place the legacy code reads a Config setting or a sheet, the port takes
 * it as an argument. `Cfg` is the settings map (already parsed values — what the oracle gets
 * from the Config tab); sheet-reading functions take a `SheetLike`/`SheetTabLike` handle.
 * Function names keep the trailing underscore so golden tests map 1:1 to the oracle.
 */

// ---------------------------------------------------------------- settings seams

/** The parsed settings map (configAll_ equivalent): key -> already-parsed value. */
export type Cfg = Record<string, unknown>

/** Config.js getConfig_: the stored value unless absent or ''. */
export function getConfig_(cfg: Cfg, key: string, fallback: unknown): unknown {
  return key in cfg && cfg[key] !== '' ? cfg[key] : fallback
}

/** Config.js parseConfigValue_ verbatim: sheets strings -> natural types. */
export function parseConfigValue_(raw: unknown): unknown {
  if (raw === '' || raw === null || raw === undefined) return ''
  if (typeof raw !== 'string') return raw
  const s = raw.trim()
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (/^[[{]/.test(s)) {
    try {
      return JSON.parse(s)
    } catch {
      return raw
    }
  }
  return raw
}

/** Stores.js DQ_SETTINGS defaults — only the keys the ported code reads. Verbatim values. */
export const DQ_SETTINGS: Record<string, unknown> = {
  business_tz: 'Asia/Kuwait',
  data_tz: 'Africa/Cairo',
  activity_local_tz: 'Asia/Kuwait',
  productivity_files: {},
  productivity_fallback_id: '1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI',
  fd_activity_ss_id: '1Fc6VCk8bLmy8ZUMCeBDPHvu7dMWDtONn6CRd9H_aHzM',
  daily_report_ss_id: '1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4',
  checkin_slots: ['09:30', '13:00', '18:30', '22:00'],
  checkin_slot_names: { '09:30': 'Start of day', '13:00': 'PM shift start', '18:30': 'End of overlap', '22:00': 'End of day' },
  checkin_read_delay_min: 20,
  checkin_open_before_min: 15,
  checkin_due_after_min: 30,
  aging_bands_h: [4, 12, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240],
  our_queue_text: ['customer support'],
  queue_excluded_text: ['gift card'],
  inflow_excluded_groups: ['FreshChat', 'Inbound Calls Documentation', 'Ops Qatar - Gift cards', 'Ops Kuwait - Gift cards'],
  cx_freshdesk_ids_extra: [],
  freshdesk_domain: 'dabdoobapp.freshdesk.com',
  days_off_default: [],
  days_off_by_country: {},
}

/** Stores.js dqSetting_: Config value, else the DQ_SETTINGS default, else ''. */
export function dqSetting_(cfg: Cfg, key: string): unknown {
  const d = DQ_SETTINGS[key]
  return getConfig_(cfg, key, d !== undefined ? d : '')
}

// ---------------------------------------------------------------- tiny helpers (verbatim)

/** Auth.js normEmail_. */
export function normEmail_(e: unknown): string {
  return String(e || '').trim().toLowerCase()
}

/** Repo.js isTrue_. */
export function isTrue_(v: unknown): boolean {
  return v === true || String(v).toLowerCase() === 'true'
}

/** Stores.js dqAddDays_: yyyy-MM-dd key arithmetic on calendar dates (no zone). */
export function dqAddDays_(key: string, n: number): string {
  const p = key.split('-')
  const t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n))
  return t.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------- time zone engine
// Utilities.formatDate is replaced by Intl (same IANA zones). The patterns used by the
// ported code: 'yyyy-MM-dd', 'yyyy-MM', 'yyyy', 'Z', 'HH:mm', 'H'.

/** Utilities.formatDate's zone parts for an instant (hourCycle h23 = 00-23). */
export function tzParts(ms: number, tz: string): Record<string, string> {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts: Record<string, string> = {}
  dtf.formatToParts(new Date(ms)).forEach((p) => {
    parts[p.type] = p.value
  })
  return parts
}

/** Zone offset of `tz` at instant ms, in minutes (e.g. Kuwait -> 180). */
export function tzOffsetMin(ms: number, tz: string): number {
  const p = tzParts(ms, tz)
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((wall - ms) / 60000)
}

/** Utilities.formatDate subset: yyyy MM dd HH H mm ss Z. */
export function formatDate_(d: Date | number, tz: string, pattern: string): string {
  const ms = typeof d === 'number' ? d : d.getTime()
  const p = tzParts(ms, tz)
  const off = tzOffsetMin(ms, tz)
  const sign = off < 0 ? '-' : '+'
  const abs = Math.abs(off)
  const z = sign + ('0' + Math.floor(abs / 60)).slice(-2) + ('0' + (abs % 60)).slice(-2)
  return String(pattern)
    .replace(/yyyy/g, p.year)
    .replace(/MM/g, p.month)
    .replace(/dd/g, p.day)
    .replace(/HH/g, p.hour)
    .replace(/mm/g, p.minute)
    .replace(/ss/g, p.second)
    .replace(/\bH\b/g, String(+p.hour))
    .replace(/Z/g, z)
}

/** ProdCore.js dqTzOffsetMin_ verbatim (Utilities.formatDate 'Z' -> signed minutes). */
export function dqTzOffsetMin_(date: Date, tz: string): number {
  const z = formatDate_(date, tz, 'Z') // e.g. +0300
  const sign = z.charAt(0) === '-' ? -1 : 1
  return sign * (Number(z.substr(1, 2)) * 60 + Number(z.substr(3, 2)))
}

/** ProdCore.js dqWallToUtc_: wall-clock in tz -> instant. Two passes handle a DST change. */
export function dqWallToUtc_(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s || 0)
  const off = dqTzOffsetMin_(new Date(guess), tz)
  let t = guess - off * 60000
  const off2 = dqTzOffsetMin_(new Date(t), tz)
  if (off2 !== off) t = guess - off2 * 60000
  return new Date(t)
}

/**
 * ProdCore.js dqParseTs_ verbatim: Date objects, ISO with Z/offset, or wall-clock text in `tz`:
 * yyyy-MM-dd H:mm[:ss][ AM|PM], MM-dd-yyyy H:mm:ss and M/d/yyyy H:mm:ss. null when unparseable.
 */
export function dqParseTs_(v: unknown, tz: string): Date | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const s = String(v).trim()
  if (/T.*(Z|[+-]\d\d:?\d\d)$/.test(s)) {
    const d0 = new Date(s)
    return isNaN(d0.getTime()) ? null : d0
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
  return dqWallToUtc_(y, mo, d, h, mi, se, tz)
}

/** ProdCore.js dqDateKey_: business date key in cfg.business_tz (or an explicit tz). */
export function dqDateKey_(date: Date, cfgOrTz?: Cfg | string): string {
  const tz =
    typeof cfgOrTz === 'string' ? cfgOrTz : String(dqSetting_(cfgOrTz || {}, 'business_tz'))
  return formatDate_(date, tz, 'yyyy-MM-dd')
}

/** ProdCore.js prodDateKey_ (V1 toDateKey_): date key in the script zone (Africa/Cairo). */
export function prodDateKey_(d: unknown, scriptTz = 'Africa/Cairo'): string | null {
  if (!d) return null
  const dd = d instanceof Date ? d : new Date(d as string | number)
  if (isNaN(dd.getTime())) return null
  return formatDate_(dd, scriptTz, 'yyyy-MM-dd')
}

// ---------------------------------------------------------------- sheet seam

/** Minimal read surface the ported readers use (the oracle's fake sheets satisfy it). */
export interface SheetRangeLike {
  getValues(): unknown[][]
  getValue?(): unknown
}

export interface SheetTabLike {
  getLastRow(): number
  getLastColumn?(): number
  getRange(row: number, col: number, nRows: number, nCols: number): SheetRangeLike
}

export interface SheetBookLike {
  getSheetByName(name: string): SheetTabLike | null
  getId?(): string
  insertSheet?(name: string): SheetTabLike
}

/** ProdCore.js prodReadCols_: columns [firstCol, firstCol+nCols) below the header row. */
export function prodReadCols_(
  ss: SheetBookLike,
  sheetName: string,
  firstCol: number,
  nCols: number,
  headerRow?: number
): unknown[][] {
  const sh = ss.getSheetByName(sheetName)
  const hr = headerRow || 1
  if (!sh || sh.getLastRow() <= hr) return []
  return sh.getRange(hr + 1, firstCol, sh.getLastRow() - hr, nCols).getValues()
}

/** ProdCore.js prodFileFor_: the month workbook id from productivity_files, else the fallback. */
export function prodFileFor_(monthKey: string, cfg: Cfg): string {
  const files = dqSetting_(cfg, 'productivity_files') || {}
  return String(
    (files as Record<string, unknown>)[monthKey] || dqSetting_(cfg, 'productivity_fallback_id')
  )
}

export interface HeadcountRow {
  employeeId: string
  name: string
  email: string
  fdId: string
  fdName: string
  tlName: string
  tlEmail: string
}

/** ProdCore.js prodHeadcountRows_: Headcount tab (A..H) -> roster rows with an email. */
export function prodHeadcountRows_(ss: SheetBookLike): HeadcountRow[] {
  return prodReadCols_(ss, 'Headcount', 1, 8, 1)
    .map((r) => ({
      employeeId: String(r[0] || '').trim(),
      name: String(r[1] || '').trim(),
      email: String(r[3] || '').trim().toLowerCase(),
      fdId: String(r[4] || '').trim(),
      fdName: String(r[5] || '').trim(),
      tlName: String(r[6] || '').trim(),
      tlEmail: String(r[7] || '').trim().toLowerCase(),
    }))
    .filter((h) => h.email)
}

/**
 * ProdCore.js dqHeadcount_: the roster when synced, else the month file's Headcount.
 * The 1 h script cache is a per-execution detail; callers pass the roster directly.
 * `roster` = dqRosterPeople_() output or null; `openSpreadsheet`/`month` used when absent.
 */
export function dqHeadcount_(
  roster: (HeadcountRow | RosterPerson)[] | null,
  openSpreadsheet: (id: string) => SheetBookLike,
  cfg: Cfg,
  month: string
): (HeadcountRow | RosterPerson)[] {
  if (roster) return roster
  try {
    return prodHeadcountRows_(openSpreadsheet(prodFileFor_(month, cfg)))
  } catch {
    return []
  }
}

/** ProdCore.js prodNameToEmail_: Employee Name and Freshdesk Name both map to the email. */
export function prodNameToEmail_(headcount: { name?: string; fdName?: string; fdId?: string; email: string }[]): Record<string, string> {
  const map: Record<string, string> = {}
  headcount.forEach((h) => {
    if (h.name) map[h.name.toLowerCase()] = h.email
    if (h.fdName) map[h.fdName.toLowerCase()] = h.email
    // Activities logs some performers as "Unknown Agent - raw id <Freshdesk id>"
    if (h.fdId) map['unknown agent - raw id ' + h.fdId.toLowerCase()] = h.email
  })
  return map
}

/** Roster table row (readTable_ object) as dqRosterPeople_ sees it. */
export interface RosterRow {
  email?: unknown
  name?: unknown
  tl_email?: unknown
  freshdesk_id?: unknown
  freshdesk_name?: unknown
  maqsam_name?: unknown
  source?: unknown
  [k: string]: unknown
}

/** dqRosterPeople_ person shape — the Headcount fields it fills (no employeeId). */
export interface RosterPerson {
  email: string
  name: string
  fdId: string
  fdName: string
  maqsamName: string
  tlEmail: string
  tlName: string
}

/**
 * ProdCore.js dqRosterPeople_ verbatim: roster rows in the Headcount shape, or null when the
 * roster has not been synced (no tab, or no hct rows). `rosterRows` = readTable_('Roster')
 * or null when the tab does not exist.
 */
export function dqRosterPeople_(rosterRows: RosterRow[] | null): RosterPerson[] | null {
  if (rosterRows === null) return null
  const rows = rosterRows.filter((r) => r.source === 'hct')
  if (!rows.length) return null
  const nameOf: Record<string, string> = {}
  rows.forEach((r) => {
    nameOf[normEmail_(r.email)] = String(r.name || '')
  })
  return rows.map((r) => {
    const tl = normEmail_(r.tl_email)
    return {
      email: normEmail_(r.email),
      name: String(r.name || ''),
      fdId: String(r.freshdesk_id || ''),
      fdName: String(r.freshdesk_name || ''),
      maqsamName: String(r.maqsam_name || ''),
      tlEmail: tl,
      tlName: nameOf[tl] || '',
    }
  })
}

// ---------------------------------------------------------------- Stores.js read helpers (verbatim)

/** Stores.js dqNormCell_: Dates become ISO, or yyyy-MM-dd for *_date / date columns. */
export function dqNormCell_(h: string, v: unknown, scriptTz = 'Africa/Cairo'): unknown {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    if (h === 'date' || h === 'week' || /_date$/.test(h)) return formatDate_(v, scriptTz, 'yyyy-MM-dd')
    if (h === 'month') return formatDate_(v, scriptTz, 'yyyy-MM')
    return v.toISOString()
  }
  return v
}

/** Stores.js dqKeyPart_. */
export function dqKeyPart_(h: string, v: unknown): string {
  const vv = dqNormCell_(h, v)
  return vv === null || vv === undefined ? '' : String(vv)
}

/** Stores.js dqIsTextCol_. */
export function dqIsTextCol_(h: string): boolean {
  return (
    /(_at|_date|_id|_key|_json)$/.test(h) ||
    ['date', 'slot', 'week', 'month', 'period', 'email', 'tl_email', 'agent_email'].indexOf(h) !== -1
  )
}

/** Stores.js dqNum_. */
export function dqNum_(v: unknown): number {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

/**
 * productivity.js prodActivityKey_ (kept here to break the engine/validation import cycle):
 * dedupe key for an Activities row — ticket, performer, field, new value, UTC minute.
 */
export function prodActivityKey_(r: unknown[], localTz: string): string {
  const t = dqParseTs_(r[0], localTz)
  const minute = t ? Math.floor(t.getTime() / 60000) : String(r[0])
  return [r[1], String(r[2] || '').trim().toLowerCase(), r[5], r[6], minute].join('')
}

/** Stores.js dqYearNow_. */
export function dqYearNow_(cfg: Cfg): number {
  return Number(formatDate_(new Date(), String(dqSetting_(cfg, 'business_tz')), 'yyyy'))
}

// ---------------------------------------------------------------- PeopleCore.js Kuwait helpers (verbatim)

export const PW_KW_OFFSET_MS = 3 * 3600 * 1000
export const PW_DAY_MS = 24 * 3600 * 1000

/** PeopleCore.js pwStr_. */
export function pwStr_(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.charAt(0) === "'" ? s.slice(1) : s
}

/** PeopleCore.js pwMs_: a string with no zone is Kuwait time. */
export function pwMs_(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number') return v
  const s = pwStr_(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(s + 'T00:00:00+03:00')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return Date.parse(s + (s.length === 16 ? ':00' : '') + '+03:00')
  }
  return Date.parse(s)
}

/** PeopleCore.js pwIso_. */
export function pwIso_(v: unknown): string {
  const ms = pwMs_(v)
  return isNaN(ms) ? '' : new Date(ms).toISOString()
}

/** PeopleCore.js pwKwDate_: yyyy-MM-dd in Kuwait for an instant. */
export function pwKwDate_(v: unknown): string {
  const ms = pwMs_(v)
  return isNaN(ms) ? '' : new Date(ms + PW_KW_OFFSET_MS).toISOString().slice(0, 10)
}

/** PeopleCore.js pwKwTime_. */
export function pwKwTime_(v: unknown): string {
  const ms = pwMs_(v)
  return isNaN(ms) ? '' : new Date(ms + PW_KW_OFFSET_MS).toISOString().slice(11, 16)
}

/** PeopleCore.js pwDateOnly_. */
export function pwDateOnly_(v: unknown): string {
  const s = pwStr_(v).trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return pwKwDate_(s)
}

/** PeopleCore.js pwAt_: instant of a Kuwait wall-clock time on a date. */
export function pwAt_(dateStr: string, hhmm: string): number {
  return Date.parse(dateStr + 'T' + hhmm + ':00+03:00')
}

/** PeopleCore.js pwDow_. */
export function pwDow_(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay()
}

/** PeopleCore.js pwAddDays_. */
export function pwAddDays_(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** PeopleCore.js pwToday_. */
export function pwToday_(nowMs?: number): string {
  return pwKwDate_(nowMs === undefined ? Date.now() : nowMs)
}

// ---------------------------------------------------------------- PeopleCore.js directory (verbatim)

export interface DirectoryPerson {
  email: string
  name: string
  role: string
  tlEmail: string | null
  active: boolean
  position: string
  specialist?: boolean
}

export interface Directory {
  by: Record<string, DirectoryPerson>
  admins: string[]
  person(e: string): DirectoryPerson | null
  name(e: string): string
  managerOf(e: string): string | null
  agentsOf(tl: string): DirectoryPerson[]
  tls(): DirectoryPerson[]
}

/**
 * PeopleCore.js pwDirectory_ verbatim: roster rows (readTable_('Roster') objects) + the
 * admin_emails config value -> the directory { by, admins, person, name, managerOf }.
 */
export function pwDirectory_(rosterRows: RosterRow[], adminEmailsCfg: unknown): Directory {
  const admins = String(adminEmailsCfg || '').split(',').map(normEmail_).filter(String)
  const by: Record<string, DirectoryPerson> = {}
  rosterRows.forEach((r) => {
    const e = normEmail_(r.email)
    if (!e) return
    const active =
      r.active === '' || r.active === true || String(r.active).toLowerCase() === 'true'
    by[e] = {
      email: e,
      name: String(r.name || e),
      role: String(r.role || ''),
      tlEmail: normEmail_(r.tl_email) || null,
      active,
      position: String(r.position || ''),
    }
  })
  admins.forEach((a) => {
    if (by[a]) by[a].role = 'admin'
    else by[a] = { email: a, name: a, role: 'admin', tlEmail: null, active: true, position: '' }
  })
  return {
    by,
    admins,
    person: function (e: string) {
      return by[normEmail_(e)] || null
    },
    name: function (e: string) {
      const p = by[normEmail_(e)]
      return p ? p.name : String(e || '')
    },
    managerOf: function (e: string) {
      const p = by[normEmail_(e)]
      if (!p) return null
      if (p.role === 'agent' || p.role === 'specialist') return p.tlEmail
      if (p.role === 'tl') return admins[0] || null
      return null
    },
    agentsOf: function (tl: string) {
      const t = normEmail_(tl)
      return Object.keys(by)
        .map((k) => by[k])
        .filter((p) => (p.role === 'agent' || p.role === 'specialist') && p.active && p.tlEmail === t)
    },
    tls: function () {
      return Object.keys(by)
        .map((k) => by[k])
        .filter((p) => p.role === 'tl' && p.active)
    },
  }
}

/** PeopleCore.js pwIsManagerOf_: admin, or the email's direct manager. */
export function pwIsManagerOf_(
  user: { role: string; email: string },
  email: string,
  dir: Directory
): boolean {
  if (user.role === 'admin') return true
  return !!email && dir.managerOf(email) === user.email
}
