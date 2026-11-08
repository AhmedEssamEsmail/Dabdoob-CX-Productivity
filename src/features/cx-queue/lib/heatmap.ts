/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/**
 * Heatmap.js (Queue_deprecated) verbatim: the page payload, stored inputs,
 * upload unpacking, the raw-tabs build, assumption sets and the country list.
 * The staffing engine itself lives in lib/heatmap-engine.ts and runs in the
 * browser like the legacy bundle did — this file only supplies its inputs
 * and stores what people save.
 *
 * Storage adaptation: legacy gzip+base64-chunked the heatmap JSON across
 * data_1..data_4 sheet cells; here the same JSON sits in data_1 unchunked
 * (Postgres text has no cell limit). window_json keeps hm.window verbatim.
 * Pack/unpack are therefore hmPack_/hmUnpack_ instead of packHeatmap_/
 * unpackHeatmap_.
 *
 * Clock: raw timestamps are Africa/Cairo wall-clock; intervals are
 * Asia/Kuwait (UTC+3, no DST). Conversion uses the Cairo offset at that
 * instant (tzOffsetMin, memoised per hour) — hmOffsetMs_ verbatim.
 */

import 'server-only'
import { inflateRawSync } from 'node:zlib'
import { appendRow, db, findRow, newId } from '@/features/shared/platform/repo'
import { getConfig, setConfig } from '@/features/shared/platform/settings'
import { requireRole } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { InputError } from '@/features/shared/lib/api-error'
import { formatDate_, tzOffsetMin, type SheetBookLike } from '@/features/shared/lib/adapters'
import { fetchWorkbookTabs, sheetBook } from '@/features/shared/jobs/sheets'

export const HM_INPUTS_TABLE = 'heatmap_inputs'
export const HM_INPUTS_HEADERS = ['input_id', 'name', 'source', 'interval_minutes', 'cells_count', 'window_json', 'notes',
  'data_1', 'data_2', 'data_3', 'data_4', 'archived_at', 'submitted_by', 'submitted_at']
export const HM_SETS_TABLE = 'heatmap_assumption_sets'
export const HM_SETS_HEADERS = ['set_id', 'name', 'assumptions_json', 'archived_at', 'submitted_by', 'submitted_at']
export const HM_PRIOR_SHEET_ID = '1k63DAtnuHPQmLMVh29HgYbkoVO6QMSaLYItsoxwlfSM'
export const HM_DEFAULT_COUNTRIES = ['Kuwait', 'KSA', 'UAE', 'Qatar', 'Bahrain']
export const HM_DEFAULT_ALIASES: Record<string, string> = { 'Saudi Arabia': 'KSA', 'Kingdom of Saudi Arabia': 'KSA', 'United Arab Emirates': 'UAE', Emirates: 'UAE' }
export const HM_MAX_CELLS = 30000
export const HM_KUWAIT_OFFSET_MS = 3 * 3600 * 1000
export const HM_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const HM_CHANNELS = ['inbound_calls', 'social_media', 'in_app', 'internal_tickets', 'waiting_address', 'customer_didnt_answer']
const HM_ALWAYS_EXCLUDED_GROUPS = ['freshchat', 'inbound calls documentation']

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** heatmapCountries_ verbatim: config heatmap_countries, else the defaults. */
export async function heatmapCountries_(): Promise<string[]> {
  const v = (await getConfig('heatmap_countries', HM_DEFAULT_COUNTRIES)) as unknown
  return Array.isArray(v) && v.length ? v.map(String) : HM_DEFAULT_COUNTRIES.slice()
}

/** heatmapAliases_ verbatim: config heatmap_country_aliases, else the defaults. */
export async function heatmapAliases_(): Promise<Record<string, string>> {
  const v = (await getConfig('heatmap_country_aliases', HM_DEFAULT_ALIASES)) as unknown
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : HM_DEFAULT_ALIASES
}

// ---------------------------------------------------------------------------
// Storage of inputs (the legacy gzip chunks -> one JSON column)
// ---------------------------------------------------------------------------

/** packHeatmap_ stand-in: the whole heatmap as one JSON string in data_1. */
function hmPack_(obj: unknown): string {
  return JSON.stringify(obj)
}

/** unpackHeatmap_ stand-in: null when data_1 is empty, else the parsed JSON. */
function hmUnpack_(row: Record<string, unknown>): Record<string, unknown> | null {
  const json = String(row.data_1 || '')
  if (!json) return null
  return JSON.parse(json)
}

/** inputMeta_ verbatim: {id, name, source, intervalMinutes, cells, window, notes, by, at}. */
export function inputMeta_(r: Record<string, unknown>): Record<string, unknown> {
  let w: Record<string, unknown> | null = null
  try {
    w = r.window_json ? (typeof r.window_json === 'string' ? JSON.parse(String(r.window_json)) : (r.window_json as Record<string, unknown>)) : null
  } catch {
    w = null
  }
  return {
    id: String(r.input_id), name: String(r.name), source: String(r.source),
    intervalMinutes: Number(r.interval_minutes) || 30, cells: Number(r.cells_count) || 0,
    window: w, notes: String(r.notes || ''), by: String(r.submitted_by || ''), at: String(r.submitted_at || ''),
  }
}

/** cleanHeatmap_ verbatim: validates a heatmap from the browser, returns a clean copy. */
export function cleanHeatmap_(hm: Record<string, any>): { intervalMinutes: number; cells: Record<string, unknown>[]; window: unknown } {
  if (!hm || !Array.isArray(hm.cells)) throw new InputError('The heatmap has no cells.')
  if (hm.cells.length > HM_MAX_CELLS) throw new InputError('Too many cells (' + hm.cells.length + '). Keep it under ' + HM_MAX_CELLS + '.')
  const interval = Number(hm.intervalMinutes) || 30
  if ([15, 30, 60].indexOf(interval) === -1) throw new InputError('Intervals must be 15, 30 or 60 minutes.')
  const cells = hm.cells.map((c: Record<string, unknown>, i: number) => {
    const day = String(c.day || '')
    if (HM_DAYS.indexOf(day) === -1) throw new InputError('Row ' + (i + 1) + ': day must be Sun..Sat.')
    if (!/^\d{2}:\d{2}$/.test(String(c.start))) throw new InputError('Row ' + (i + 1) + ': interval must look like 09:30.')
    const vol = Number(c.volume)
    if (!isFinite(vol) || vol < 0) throw new InputError('Row ' + (i + 1) + ': volume must be a number of 0 or more.')
    const out: Record<string, unknown> = {
      country: String(c.country || '*').slice(0, 40), channel: String(c.channel || '').slice(0, 40), day,
      start: String(c.start), volume: vol,
    }
    if (c.ahtSec !== undefined && c.ahtSec !== null && c.ahtSec !== '') {
      const a = Number(c.ahtSec)
      if (!isFinite(a) || a <= 0 || a > 7200) throw new InputError('Row ' + (i + 1) + ': handling time must be 1-7200 seconds.')
      out.ahtSec = a
    }
    if (!out.channel) throw new InputError('Row ' + (i + 1) + ': channel is missing.')
    return out
  })
  return { intervalMinutes: interval, cells, window: hm.window || null }
}

/** storeHeatmapInput_ verbatim (returns inputMeta_ of the stored row). */
export async function storeHeatmapInput_(name: string, source: string, hm: Record<string, any>, notes: string, actor: string): Promise<Record<string, unknown>> {
  const row = {
    input_id: newId('hmi'), name: String(name || 'Heatmap').slice(0, 80), source,
    interval_minutes: hm.intervalMinutes, cells_count: (hm.cells as unknown[]).length,
    window_json: hm.window ? JSON.stringify(hm.window) : '',
    notes: String(notes || '').slice(0, 2000), data_1: hmPack_(hm), data_2: '', data_3: '', data_4: '', archived_at: null,
  }
  const stored = await appendRow(HM_INPUTS_TABLE, row, actor)
  return inputMeta_(stored)
}

/** loadHeatmapInput_ verbatim: one stored input -> {meta, heatmap}; archived/missing throws. */
export async function loadHeatmapInput_(inputId: string): Promise<{ meta: Record<string, unknown>; heatmap: Record<string, unknown> | null }> {
  const r = await findRow(HM_INPUTS_TABLE, 'input_id', inputId)
  if (!r || r.archived_at) throw new Error('That heatmap is no longer available.')
  return { meta: inputMeta_(r), heatmap: hmUnpack_(r) }
}

/** listHeatmapInputs_ verbatim: newest 20 non-archived inputs. */
export async function listHeatmapInputs_(): Promise<Record<string, unknown>[]> {
  const { data, error } = await db().from(HM_INPUTS_TABLE).select('*').is('archived_at', null)
  if (error) return []
  return ((data || []) as Record<string, unknown>[]).map(inputMeta_).reverse().slice(0, 20)
}

/** listHeatmapSets_ verbatim: {id, name, assumptions, by, at}, newest first. */
export async function listHeatmapSets_(): Promise<Record<string, unknown>[]> {
  const { data, error } = await db().from(HM_SETS_TABLE).select('*').is('archived_at', null)
  if (error) return []
  return ((data || []) as Record<string, unknown>[]).map((r) => {
    let a: Record<string, unknown> = {}
    try {
      a = typeof r.assumptions_json === 'string' ? JSON.parse(String(r.assumptions_json)) : ((r.assumptions_json as Record<string, unknown>) || {})
    } catch {
      a = {}
    }
    return { id: String(r.set_id), name: String(r.name), assumptions: a, by: String(r.submitted_by || ''), at: String(r.submitted_at || '') }
  }).reverse()
}

// ---------------------------------------------------------------------------
// Raw tabs -> heatmap (format C), Cairo wall-clock -> Kuwait intervals
// ---------------------------------------------------------------------------

function hmPad_(n: number): string {
  return (n < 10 ? '0' : '') + n
}

/** hmOffsetMs_ verbatim: offset of tz from UTC in ms at instant ms, memoised per UTC hour. */
function hmOffsetMs_(tz: string, ms: number, memo: Record<string, number>): number {
  const k = tz + '|' + Math.floor(ms / 3600000)
  if (memo[k] === undefined) memo[k] = tzOffsetMin(ms, tz) * 60000
  return memo[k]
}

/** hmParseWall_ verbatim: 'YYYY-MM-DD HH:MM[:SS][ AM]' or 'M/D/YYYY H:MM[:SS][ AM]' -> [y, m, d, h, mi] or null. */
export function hmParseWall_(s: unknown): number[] | null {
  const str = String(s || '').trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(str)
  let y: number, mo: number, d: number, h: number, mi: number, ap: string | undefined
  if (m) {
    y = +m[1]; mo = +m[2]; d = +m[3]; h = +m[4]; mi = +m[5]; ap = m[6]
  } else {
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(str)
    if (!m) return null
    mo = +m[1]; d = +m[2]; y = +m[3]; h = +m[4]; mi = +m[5]; ap = m[6]
  }
  if (ap) {
    ap = ap.toUpperCase()
    if (ap === 'PM' && h < 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  return [y, mo, d, h, mi]
}

/**
 * hmKuwaitSlot_ verbatim: a raw timestamp cell -> {date, dow, min} in Kuwait.
 * Date cells are first read back as wall-clock in the SOURCE sheet's zone,
 * then treated as Cairo (the data's clock), so a sheet in another zone
 * cannot shift them.
 */
export function hmKuwaitSlot_(v: unknown, sheetTz: string, memo: Record<string, number>): { date: string; dow: number; min: number } | null {
  let wall: number[] | null
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    const w = new Date(v.getTime() + hmOffsetMs_(sheetTz, v.getTime(), memo))
    wall = [w.getUTCFullYear(), w.getUTCMonth() + 1, w.getUTCDate(), w.getUTCHours(), w.getUTCMinutes()]
  } else {
    wall = hmParseWall_(v)
  }
  if (!wall || wall[0] < 2000) return null
  const asUtc = Date.UTC(wall[0], wall[1] - 1, wall[2], wall[3], wall[4])
  const off = hmOffsetMs_('Africa/Cairo', asUtc - 2 * 3600000, memo)
  const kw = new Date(asUtc - off + HM_KUWAIT_OFFSET_MS)
  return {
    date: kw.getUTCFullYear() + '-' + hmPad_(kw.getUTCMonth() + 1) + '-' + hmPad_(kw.getUTCDate()),
    dow: kw.getUTCDay(),
    min: kw.getUTCHours() * 60 + kw.getUTCMinutes(),
  }
}

/** normHeader_ (Repo.js): case-insensitive, whitespace collapsed. */
function normHeader_(h: unknown): string {
  return String(h == null ? '' : h).replace(/\s+/g, ' ').trim().toLowerCase()
}

/** hmReadTab_ verbatim: a tab's header row + only the wanted columns. cols: {key: [header alternatives]}. */
function hmReadTab_(ss: SheetBookLike, tabName: string, cols: Record<string, string[]>, required?: string[]): { rows: unknown[][]; idx: Record<string, number> } | null {
  const sh = ss.getSheetByName(tabName)
  if (!sh) return null
  const lastRow = sh.getLastRow()
  const lastCol = sh.getLastColumn ? sh.getLastColumn() : 0
  if (lastRow < 2 || !lastCol) return { rows: [], idx: {} }
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(normHeader_)
  const idx: Record<string, number> = {}
  Object.keys(cols).forEach((k) => {
    for (let i = 0; i < cols[k].length; i++) {
      const p = headers.indexOf(normHeader_(cols[k][i]))
      if (p !== -1) {
        idx[k] = p
        return
      }
    }
  })
  ;(required || []).forEach((k) => {
    if (idx[k] === undefined) throw new InputError('Tab ' + tabName + ' has no "' + cols[k][0] + '" column.')
  })
  const maxIdx = Math.max.apply(null, Object.keys(idx).map((k) => idx[k]))
  return { rows: sh.getRange(2, 1, lastRow - 1, maxIdx + 1).getValues(), idx }
}

function hmStr_(row: unknown[], idx: Record<string, number>, k: string): string {
  return idx[k] === undefined ? '' : String(row[idx[k]] == null ? '' : row[idx[k]]).trim()
}

/** hmFreshchatChannel_ verbatim: Freshchat "Channel" -> social_media or in_app. */
function hmFreshchatChannel_(raw: unknown): string {
  const c = String(raw || '').toLowerCase()
  if (/^ig_|instagram|facebook|^fb_|social|whatsapp|tiktok|twitter/.test(c)) return 'social_media'
  return 'in_app'
}

/**
 * buildHeatmapFromRawTabs_ verbatim: {intervalMinutes, cells, window, notes}
 * from a workbook holding the raw tabs (Maqsam, Freshchat, Freshdesk, WA;
 * Excluded Groups optional). Reads through the prefetched SheetBookLike;
 * getSpreadsheetTimeZone is absent there so the sheetTz falls back to
 * Africa/Cairo exactly like the legacy guard (values arrive as formatted
 * strings anyway, so sheetTz only matters for real Date cells).
 */
export function buildHeatmapFromRawTabs_(ss: SheetBookLike & { getSpreadsheetTimeZone?: () => string }, opts: Record<string, any>): Record<string, any> {
  const L = Number(opts.intervalMinutes) || 30
  const tz = ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : 'Africa/Cairo'
  const memo: Record<string, number> = {}
  const counts: Record<string, number> = {}
  const notes: string[] = []
  const used: Record<string, number> = {}
  let minD: string | null = null
  let maxD: string | null = null

  function add(country: string, channel: string, ts: unknown): boolean {
    const s = hmKuwaitSlot_(ts, tz, memo)
    if (!s) return false
    if ((opts.from && s.date < String(opts.from)) || (opts.to && s.date > String(opts.to))) return false
    if (!minD || s.date < minD) minD = s.date
    if (!maxD || s.date > maxD) maxD = s.date
    const slot = Math.floor(s.min / L) * L
    const key = (country || '*') + '|' + channel + '|' + s.dow + '|' + slot
    counts[key] = (counts[key] || 0) + 1
    used[channel] = (used[channel] || 0) + 1
    return true
  }

  const mq = hmReadTab_(ss, 'Maqsam', { ts: ['Start time'], dir: ['Call direction'], state: ['Call state'], country: ['Country'] }, ['ts'])
  if (mq) {
    let outOfHours = 0
    mq.rows.forEach((r) => {
      if (mq.idx.dir !== undefined && !/inbound/i.test(hmStr_(r, mq.idx, 'dir'))) return
      if (/out\s*of\s*hours/i.test(hmStr_(r, mq.idx, 'state'))) {
        outOfHours++
        return
      }
      add(hmStr_(r, mq.idx, 'country'), 'inbound_calls', r[mq.idx.ts])
    })
    if (outOfHours) notes.push(outOfHours + ' calls marked Out Of Hours were left out of staffed demand.')
  } else notes.push('No Maqsam tab: no call volume.')

  const fc = hmReadTab_(ss, 'Freshchat', { ts: ['Initiated At'], channel: ['Channel'], bot: ['Bot conversation flag'], status: ['Status'], country: ['Country'] }, ['ts'])
  if (fc) {
    let bots = 0
    fc.rows.forEach((r) => {
      const country = hmStr_(r, fc.idx, 'country')
      if (/^exclude/i.test(country) || (/^yes$/i.test(hmStr_(r, fc.idx, 'bot')) && /bot/i.test(hmStr_(r, fc.idx, 'status')))) {
        bots++
        return
      }
      add(country, hmFreshchatChannel_(hmStr_(r, fc.idx, 'channel')), r[fc.idx.ts])
    })
    if (bots) notes.push(bots + ' bot-only chats left out.')
  } else notes.push('No Freshchat tab: no chat volume.')

  const excluded: Record<string, boolean> = {}
  HM_ALWAYS_EXCLUDED_GROUPS.forEach((g) => {
    excluded[g] = true
  })
  const eg = hmReadTab_(ss, 'Excluded Groups', { group: ['Group name'], flag: ['In/excluded', 'In/Excluded', 'Status'] })
  if (eg && eg.idx.group !== undefined) {
    eg.rows.forEach((r) => {
      if (/^ex/i.test(hmStr_(r, eg.idx, 'flag'))) excluded[normHeader_(hmStr_(r, eg.idx, 'group'))] = true
    })
  }
  const fd = hmReadTab_(ss, 'Freshdesk', { ts: ['Created date'], group: ['Group name'], check: ['Group Check'], country: ['Country'] }, ['ts'])
  if (fd) {
    fd.rows.forEach((r) => {
      if (excluded[normHeader_(hmStr_(r, fd.idx, 'group'))]) return
      if (/exclu|^out$/i.test(hmStr_(r, fd.idx, 'check'))) return
      add(hmStr_(r, fd.idx, 'country'), 'internal_tickets', r[fd.idx.ts])
    })
    notes.push('Internal escalations: requester-not-in-CX and open-on-CX are not in the raw tab, so only excluded groups were removed.')
  } else notes.push('No Freshdesk tab: no internal escalations.')

  if (opts.includeWaitingAddress !== false) {
    const wa = hmReadTab_(ss, 'WA', { ts: ['invoice_creation_date'], confirmed: ['Address Confirmed3'], didnt: ["Customer Didn't Answer3", 'Customer Didnt Answer3'], country: ['Country_Name'] }, ['ts'])
    if (wa) {
      wa.rows.forEach((r) => {
        const country = hmStr_(r, wa.idx, 'country')
        if (Number(hmStr_(r, wa.idx, 'confirmed')) === 1) add(country, 'waiting_address', r[wa.idx.ts])
        if (Number(hmStr_(r, wa.idx, 'didnt')) === 1) add(country, 'customer_didnt_answer', r[wa.idx.ts])
      })
    }
  }

  const lo = (opts.from as string) || minD
  const hi = (opts.to as string) || maxD
  const occ = [0, 0, 0, 0, 0, 0, 0]
  if (lo && hi) {
    for (let t = Date.parse(lo + 'T00:00:00Z'); t <= Date.parse(hi + 'T00:00:00Z'); t += 86400000) occ[new Date(t).getUTCDay()]++
  }
  const cells = Object.keys(counts).map((k) => {
    const p = k.split('|')
    const slot = Number(p[3])
    return {
      country: p[0], channel: p[1], day: HM_DAYS[Number(p[2])], start: hmPad_(Math.floor(slot / 60)) + ':' + hmPad_(slot % 60),
      volume: occ[Number(p[2])] ? Math.round((counts[k] / occ[Number(p[2])]) * 1000) / 1000 : 0,
    }
  })
  const weeks = Math.min.apply(null, occ)
  return {
    intervalMinutes: L, cells, notes, events: used,
    window: {
      from: lo, to: hi, weeks,
      occurrencesPerWeekday: HM_DAYS.reduce((o: Record<string, number>, d, i) => {
        o[d] = occ[i]
        return o
      }, {}),
      note: weeks < 4
        ? 'Fewer than 4 weeks: usable for intra-day shape and rough level only, not for peaks or seasonality.'
        : 'Shape and level usable; still no seasonality (Ramadan, month-end, campaigns) unless the window spans it.',
    },
  }
}

// ---------------------------------------------------------------------------
// .xlsx unpacking (node zlib + minimal XML walk): first sheet -> rows of strings
// ---------------------------------------------------------------------------

function hmColIndex_(ref: string): number {
  const letters = String(ref).replace(/[0-9]/g, '')
  let n = 0
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64)
  return n - 1
}

/** XML entities (&amp; last so &amp;lt; stays literal text, like XmlService). */
function hmXmlUnesc_(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

/** Utilities.unzip stand-in: name -> bytes for every stored/deflated entry. */
function hmUnzip_(bytes: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>()
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new InputError('This .xlsx could not be opened. Save it again from Excel or Sheets.')
  const count = bytes.readUInt16LE(eocd + 10)
  let p = bytes.readUInt32LE(eocd + 16)
  for (let e = 0; e < count; e++) {
    if (p + 46 > bytes.length || bytes.readUInt32LE(p) !== 0x02014b50) break
    const method = bytes.readUInt16LE(p + 10)
    const compSize = bytes.readUInt32LE(p + 20)
    const nameLen = bytes.readUInt16LE(p + 28)
    const extraLen = bytes.readUInt16LE(p + 30)
    const commentLen = bytes.readUInt16LE(p + 32)
    const localOff = bytes.readUInt32LE(p + 42)
    const name = bytes.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    if (localOff + 30 <= bytes.length && bytes.readUInt32LE(localOff) === 0x04034b50) {
      const lhNameLen = bytes.readUInt16LE(localOff + 26)
      const lhExtraLen = bytes.readUInt16LE(localOff + 28)
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen
      const raw = bytes.subarray(dataStart, Math.min(bytes.length, dataStart + compSize))
      try {
        out.set(name, method === 8 ? inflateRawSync(raw) : method === 0 ? Buffer.from(raw) : Buffer.alloc(0))
      } catch {
        out.set(name, Buffer.alloc(0))
      }
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** hmXlsxRows_ verbatim: first sheet -> rows of strings (shared strings resolved). */
export function hmXlsxRows_(bytes: Buffer): string[][] {
  const files = hmUnzip_(bytes)
  const sheet = files.get('xl/worksheets/sheet1.xml')
  if (!sheet) throw new InputError('This .xlsx has no first sheet. Save it again from Excel or Sheets.')
  const shared: string[] = []
  const sst = files.get('xl/sharedStrings.xml')
  if (sst) {
    const xml = sst.toString('utf8')
    for (const m of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      let text = ''
      for (const t of m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += hmXmlUnesc_(t[1])
      shared.push(text)
    }
  }
  const xml = sheet.toString('utf8')
  const rows: string[][] = []
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rAttr = /\br="(\d+)"/.exec(rm[1])
    const rIdx = (rAttr ? Number(rAttr[1]) : rows.length + 1) - 1
    const line: string[] = []
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+\d+)"/.exec(cm[1])
      const col = ref ? hmColIndex_(ref[1]) : line.length
      const type = /\bt="([^"]+)"/.exec(cm[1])
      const inner = cm[2] || ''
      const vm = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)
      let text = ''
      if (type && type[1] === 's') text = shared[Number(vm ? vm[1] : 0)] || ''
      else if (type && type[1] === 'inlineStr') {
        const tm = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(inner)
        text = tm ? hmXmlUnesc_(tm[1]) : ''
      } else text = vm ? hmXmlUnesc_(vm[1]) : ''
      while (line.length < col) line.push('')
      line[col] = text
    }
    while (rows.length < rIdx) rows.push([])
    rows[rIdx] = line
    if (rows.length > 5000) throw new InputError('The file has more than 5,000 rows. Upload one heatmap per file.')
  }
  return rows
}

/**
 * Utilities.parseCsv stand-in (the browser's rn parser, same semantics):
 * quotes, escaped quotes, embedded commas and newlines.
 */
export function hmParseCsv_(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** getHeatmapPage verbatim: settings, saved sets, recent inputs and the chosen (or latest) input's cells. */
export async function getHeatmapPage(inputId?: string): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  const inputs = await listHeatmapInputs_()
  const chosen = inputId ? inputs.filter((i) => i.id === inputId)[0] : inputs[0]
  const current = chosen ? await loadHeatmapInput_(String(chosen.id)) : null
  return {
    countries: await heatmapCountries_(), aliases: await heatmapAliases_(), sets: await listHeatmapSets_(), inputs,
    current, canAdmin: user.role === 'admin',
  }
}

/** saveHeatmapInput verbatim: stores a heatmap the browser parsed from an upload (formats A/B). */
export async function saveHeatmapInput(name: unknown, source: unknown, heatmap: unknown): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const src = String(source || 'upload')
  if (['upload_long', 'upload_wide', 'upload'].indexOf(src) === -1) throw new InputError('Unknown heatmap source.')
  const hm = cleanHeatmap_(heatmap as Record<string, any>)
  const meta = await storeHeatmapInput_(String(name || ''), src, hm, '', user.email)
  return { meta, heatmap: hm }
}

/** parseHeatmapUpload verbatim: .xlsx -> rows (first sheet). CSV is parsed in the browser; this accepts it too. */
export async function parseHeatmapUpload(fileName: unknown, base64: unknown): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const name = String(fileName || '').toLowerCase()
  const b64 = String(base64 || '')
  if (b64.length > 8 * 1024 * 1024) throw new InputError('The file is larger than 6 MB. Upload one heatmap per file.')
  const bytes = Buffer.from(b64, 'base64')
  if (/\.csv$/.test(name)) return { rows: hmParseCsv_(bytes.toString('utf8')) }
  if (/\.xlsx$/.test(name)) return { rows: hmXlsxRows_(bytes) }
  throw new InputError('Upload a .csv or .xlsx file.')
}

/** buildHeatmapFromSource verbatim (admin): builds a heatmap from a spreadsheet holding the raw tabs. */
export async function buildHeatmapFromSource(spreadsheetId?: unknown, opts?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const id = String(spreadsheetId || (await getConfig('heatmap_source_spreadsheet_id', '')) || '')
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(id)) throw new InputError('Paste the id of the spreadsheet that holds the raw tabs.')
  const tabs = await fetchWorkbookTabs(id, ['Maqsam', 'Freshchat', 'Freshdesk', 'WA', 'Excluded Groups'])
  const hm = buildHeatmapFromRawTabs_(sheetBook(tabs, id), opts || {})
  if (!hm.cells.length) throw new InputError('No usable rows were found in the raw tabs.')
  const meta = await storeHeatmapInput_(
    'Raw tabs ' + (hm.window.from || '') + ' to ' + (hm.window.to || ''), 'raw_tabs',
    { intervalMinutes: hm.intervalMinutes, cells: hm.cells, window: hm.window }, hm.notes.join(' '), user.email
  )
  return { meta, heatmap: { intervalMinutes: hm.intervalMinutes, cells: hm.cells, window: hm.window } }
}

/**
 * runPriorHeatmapRegression verbatim (admin): the skipped September regression.
 * Reads the prior sheet, rebuilds the volume heatmap from its raw tabs, stores
 * it as an input, and returns the outcome tab (HeatMap A1:BB51) so the page
 * compares the two with the engine. Throws the Sheets-credentials error when
 * the service account is absent — the legacy openSpreadsheet_ failure.
 */
export async function runPriorHeatmapRegression(): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const tabs = await fetchWorkbookTabs(HM_PRIOR_SHEET_ID, ['Maqsam', 'Freshchat', 'Freshdesk', 'WA', 'Excluded Groups', 'HeatMap', 'Heatmap'])
  const ss = sheetBook(tabs, HM_PRIOR_SHEET_ID)
  const hm = buildHeatmapFromRawTabs_(ss, { intervalMinutes: 30 })
  const tab = ss.getSheetByName('HeatMap') || ss.getSheetByName('Heatmap')
  const outcome = tab
    ? tab.getRange(1, 1, 51, 54).getValues().map((r) => r.map((v) => (v instanceof Date ? formatDate_(v, 'Africa/Cairo', 'HH:mm') : String(v))))
    : []
  const meta = await storeHeatmapInput_(
    'Prior heatmap 03-Sep-2026 (rebuilt from raw tabs)', 'prior_sheet',
    { intervalMinutes: hm.intervalMinutes, cells: hm.cells, window: hm.window }, hm.notes.join(' '), user.email
  )
  return {
    meta, heatmap: { intervalMinutes: hm.intervalMinutes, cells: hm.cells, window: hm.window },
    outcomeRows: outcome, notes: hm.notes, events: hm.events,
  }
}

/** getHeatmapInput verbatim: one stored input -> {meta, heatmap}. */
export async function getHeatmapInput(inputId: unknown): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  return loadHeatmapInput_(String(inputId || ''))
}

/** saveHeatmapAssumptions verbatim: saves the current assumption overrides under a name; returns the set list. */
export async function saveHeatmapAssumptions(name: unknown, assumptions: unknown): Promise<Record<string, unknown>[]> {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const n = String(name || '').replace(/\s+/g, ' ').trim()
  if (!n) throw new InputError('Name the assumption set.')
  if (n.length > 60) throw new InputError('Keep the name under 60 characters.')
  if (!assumptions || typeof assumptions !== 'object' || Array.isArray(assumptions)) throw new InputError('Nothing to save.')
  const json = JSON.stringify(assumptions)
  if (json.length > 40000) throw new InputError('These assumptions are too large to save.')
  await appendRow(HM_SETS_TABLE, { set_id: newId('hms'), name: n, assumptions_json: json, archived_at: null }, user.email)
  return listHeatmapSets_()
}

/** setHeatmapCountries verbatim (admin): the editable country list and alias table. */
export async function setHeatmapCountries(countries: unknown, aliases: unknown): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const seen: Record<string, boolean> = {}
  const list = (Array.isArray(countries) ? countries : [])
    .map((c) => String(c || '').replace(/\s+/g, ' ').trim())
    .filter((c) => {
      if (!c || c === '*' || c.length > 40 || seen[c.toLowerCase()]) return false
      seen[c.toLowerCase()] = true
      return true
    })
  if (!list.length) throw new InputError('Keep at least one country.')
  const al: Record<string, string> = {}
  Object.keys((aliases || {}) as Record<string, unknown>).forEach((k) => {
    const from = String(k).trim()
    const to = String((aliases as Record<string, unknown>)[k] || '').trim()
    if (from && to && list.indexOf(to) !== -1) al[from] = to
  })
  await setConfig('heatmap_countries', list, 'Countries offered in the heatmap filter (editable).', user.email)
  await setConfig('heatmap_country_aliases', al, 'Raw country spellings mapped to the heatmap country list.', user.email)
  return { countries: list, aliases: al }
}
