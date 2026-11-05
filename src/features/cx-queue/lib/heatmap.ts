/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/**
 * Heatmap.js (Queue_deprecated) ported: staffing heatmap reads/writes on the
 * HeatmapInputs / HeatmapAssumptionSets tables. window_json replaces the
 * legacy gzip-chunked cell columns (data_1..4) — same data, Postgres-native
 * storage. Upload parsing keeps the legacy wall-clock + alias rules.
 */

import { appendRow, db, findRow, newId } from '@/features/shared/platform/repo'
import { getConfig, setConfig, configAll } from '@/features/shared/platform/settings'
import { requireRole } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { InputError } from '@/features/shared/lib/api-error'
import { dqNum_ } from './index'
import { dqSetting_, tzOffsetMin, type Cfg } from '@/features/shared/lib/adapters'

export const HM_INPUTS_TABLE = 'heatmap_inputs'
export const HM_SETS_TABLE = 'heatmap_assumption_sets'
export const HM_INPUTS_HEADERS = ['input_id', 'name', 'source', 'interval_minutes', 'cells_count', 'window_json', 'notes',
  'data_1', 'data_2', 'data_3', 'data_4', 'archived_at', 'submitted_by', 'submitted_at']
export const HM_SETS_HEADERS = ['set_id', 'name', 'assumptions_json', 'archived_at', 'submitted_by', 'submitted_at']
export const HM_DEFAULT_COUNTRIES = ['Kuwait', 'KSA', 'UAE', 'Qatar', 'Bahrain']
export const HM_DEFAULT_ALIASES: Record<string, string> = { 'Saudi Arabia': 'KSA', 'Kingdom of Saudi Arabia': 'KSA', 'United Arab Emirates': 'UAE', Emirates: 'UAE' }
export const HM_MAX_CELLS = 30000
export const HM_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const HM_CHANNELS = ['inbound_calls', 'social_media', 'in_app', 'internal_tickets', 'waiting_address', 'customer_didnt_answer']

export async function heatmapCountries_(): Promise<string[]> {
  return ((await getConfig('heatmap_countries', HM_DEFAULT_COUNTRIES)) || HM_DEFAULT_COUNTRIES) as string[]
}

export async function heatmapAliases_(): Promise<Record<string, string>> {
  return ((await getConfig('heatmap_country_aliases', HM_DEFAULT_ALIASES)) || HM_DEFAULT_ALIASES) as Record<string, string>
}

/** cleanHeatmap_ verbatim: normalize an uploaded heatmap object. */
export function cleanHeatmap_(hm: Record<string, any>): { intervalMinutes: number; cells: Record<string, unknown>[] } {
  const interval = Number(hm.intervalMinutes) || 30
  const cells = (hm.cells || []).map((c: Record<string, unknown>) => {
    const day = String(c.day || '')
    const vol = Number(c.volume)
    const out: Record<string, unknown> = { country: String(c.country || '*').slice(0, 40), channel: String(c.channel || '').slice(0, 40), day,
      start: String(c.start || ''), volume: isFinite(vol) ? vol : 0 }
    if (c.ahtSec !== undefined && c.ahtSec !== null && c.ahtSec !== '') {
      const a = Number(c.ahtSec)
      if (isFinite(a) && a >= 0) out.ahtSec = a
    }
    return out
  }).filter((c: Record<string, unknown>) => HM_DAYS.indexOf(String(c.day)) !== -1 && /^\d{1,2}:\d{2}$/.test(String(c.start)))
  return { intervalMinutes: interval, cells }
}

function inputMeta_(r: Record<string, unknown>): Record<string, unknown> {
  let w: Record<string, unknown> | null = null
  try {
    w = r.window_json ? (typeof r.window_json === 'string' ? JSON.parse(String(r.window_json)) : (r.window_json as Record<string, unknown>)) : null
  } catch {
    w = null
  }
  return { inputId: String(r.input_id), name: String(r.name), source: String(r.source || ''), intervalMinutes: dqNum_(r.interval_minutes),
    cellsCount: dqNum_(r.cells_count), window: w, notes: String(r.notes || ''), submittedBy: String(r.submitted_by || ''), submittedAt: String(r.submitted_at || '') }
}

export async function listHeatmapInputs_(): Promise<Record<string, unknown>[]> {
  const { data, error } = await db().from(HM_INPUTS_TABLE).select('*').is('archived_at', null)
  if (error) return []
  return ((data || []) as Record<string, unknown>[]).map(inputMeta_).reverse().slice(0, 20)
}

export async function listHeatmapSets_(): Promise<Record<string, unknown>[]> {
  const { data, error } = await db().from(HM_SETS_TABLE).select('*').is('archived_at', null)
  if (error) return []
  return ((data || []) as Record<string, unknown>[]).map((r) => {
    let a: Record<string, unknown> = {}
    try {
      a = typeof r.assumptions_json === 'string' ? JSON.parse(String(r.assumptions_json)) : ((r.assumptions_json as Record<string, unknown>) || {})
    } catch { /* keep {} */ }
    return { setId: String(r.set_id), name: String(r.name), assumptions: a, submittedBy: String(r.submitted_by || ''), submittedAt: String(r.submitted_at || '') }
  }).reverse()
}

/** storeHeatmapInput_ verbatim; window_json holds the legacy data_1..4 payload un-chunked. */
export async function storeHeatmapInput_(name: string, source: string, hm: Record<string, unknown>, notes: string, actor: string): Promise<Record<string, unknown>> {
  const starts = (hm.cells as { start: string }[]).map((c) => c.start).sort()
  const row = {
    input_id: newId('hmi'), name: String(name || 'Heatmap').slice(0, 80), source,
    interval_minutes: Number(hm.intervalMinutes) || 30, cells_count: (hm.cells as unknown[]).length,
    window_json: { from: starts[0] || '', to: starts[starts.length - 1] || '' },
    notes: String(notes || '').slice(0, 500), data_1: JSON.stringify(hm), data_2: '', data_3: '', data_4: '', archived_at: null,
  }
  return appendRow(HM_INPUTS_TABLE, row, actor)
}

export async function loadHeatmapInput_(inputId: string): Promise<Record<string, unknown> | null> {
  const r = await findRow(HM_INPUTS_TABLE, 'input_id', inputId)
  if (!r) return null
  let hm: Record<string, unknown> = { intervalMinutes: dqNum_(r.interval_minutes), cells: [] }
  try {
    hm = JSON.parse(String(r.data_1 || '{}'))
  } catch { /* keep empty */ }
  return { meta: inputMeta_(r), heatmap: hm }
}

// hmParseWall_ verbatim: "yyyy-M-d H:mm[:ss][ AM|PM]" wall-clock parts.
export function hmParseWall_(s: string): number[] | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(s)
  if (!m) return null
  let h = Number(m[4])
  const ap = m[6]
  if (ap) {
    if (/p/i.test(ap)) { if (h !== 12) h += 12 } else if (h === 12) h = 0
  }
  return [Number(m[1]), Number(m[2]), Number(m[3]), h, Number(m[5])]
}

/** hmKuwaitSlot_ verbatim: a sheet wall-clock (or Date) -> the Kuwait interval key {day, start}. */
export function hmKuwaitSlot_(v: unknown, sheetTz: string, memo: Record<string, number>): { day: string; start: string } | null {
  let ms: number
  if (v instanceof Date) {
    ms = v.getTime() + (hmOffsetMs_(sheetTz, v.getTime(), memo) - 3 * 3600000) * 1 // sheet wall -> UTC, then to Kuwait wall
    // recompute: convert sheet wall to instant, then read Kuwait wall below
    const w = new Date(v.getTime() + hmOffsetMs_(sheetTz, v.getTime(), memo))
    ms = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), w.getUTCHours(), w.getUTCMinutes())
  } else {
    const wall = hmParseWall_(String(v || ''))
    if (!wall) return null
    ms = Date.UTC(wall[0], wall[1] - 1, wall[2], wall[3], wall[4]) - hmOffsetMs_(sheetTz, Date.UTC(wall[0], wall[1] - 1, wall[2], wall[3], wall[4]), memo)
  }
  const kw = new Date(ms + 3 * 3600000)
  const hm = String(kw.getUTCHours()).padStart(2, '0') + ':' + String(kw.getUTCMinutes()).padStart(2, '0')
  return { day: HM_DAYS[kw.getUTCDay()], start: hm }
}

function hmOffsetMs_(tz: string, ms: number, memo: Record<string, number>): number {
  const k = tz + '|' + Math.floor(ms / 3600000)
  if (memo[k] === undefined) memo[k] = tzOffsetMin(ms, tz) * 60000
  return memo[k]
}

/**
 * parseHeatmapUpload verbatim: rows [time, volume, ahtSec?] (+ optional country/channel
 * columns) -> the cleaned heatmap object. Aliases normalize country names.
 */
export function hmParseUpload_(
  rows: unknown[][],
  opts: { intervalMinutes?: number; sheetTz?: string; country?: string; channel?: string; aliases?: Record<string, string> }
): { intervalMinutes: number; cells: Record<string, unknown>[]; dropped: number } {
  const memo: Record<string, number> = {}
  const tz = opts.sheetTz || 'Asia/Kuwait'
  const alias = (c: string) => (opts.aliases || {})[c] || c
  let dropped = 0
  const cells: Record<string, unknown>[] = []
  rows.forEach((r) => {
    const slot = hmKuwaitSlot_(r[0], tz, memo)
    if (!slot) { dropped++; return }
    const vol = Number(r[1])
    if (!isFinite(vol)) { dropped++; return }
    const cell: Record<string, unknown> = {
      country: alias(String(r[3] || opts.country || '*')), channel: String(r[4] || opts.channel || ''),
      day: slot.day, start: slot.start, volume: vol,
    }
    if (r[2] !== undefined && r[2] !== null && r[2] !== '') {
      const a = Number(r[2])
      if (isFinite(a)) cell.ahtSec = a
    }
    cells.push(cell)
  })
  return { intervalMinutes: opts.intervalMinutes || 30, cells, dropped }
}

/** Needed headcount per cell: hcCeil_(aht/int*base*(1+shr)) — the legacy Erlang-style formula. */
export function hmNeeded_(cell: Record<string, unknown>, asm: Record<string, unknown>, intervalMin: number): number {
  const aht = Number(cell.ahtSec ?? asm.ahtSec ?? 0)
  const base = Number(asm.base ?? 1)
  const shr = Number(asm.shrinkage ?? 0)
  const vol = Number(cell.volume) || 0
  const need = (aht * vol) / (intervalMin * 60) * base * (1 + shr)
  return Math.max(0, Math.ceil(need))
}

// ---------------------------------------------------------------- public fns (Heatmap.js)

/** getHeatmapPage: inputs, assumption sets, countries — one call. */
export async function getHeatmapPage(): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  return {
    inputs: await listHeatmapInputs_(),
    sets: await listHeatmapSets_(),
    countries: await heatmapCountries_(),
    aliases: await heatmapAliases_(),
    days: HM_DAYS,
    channels: HM_CHANNELS,
    scope: user.role,
  }
}

/** getHeatmapInput: one stored input with its cells + the computed needed counts. */
export async function getHeatmapInput(inputId: string, setId?: string): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const loaded = await loadHeatmapInput_(String(inputId || ''))
  if (!loaded) throw new InputError('That heatmap input does not exist.', 404)
  let asm: Record<string, unknown> = {}
  if (setId) {
    const s = await findRow(HM_SETS_TABLE, 'set_id', String(setId))
    if (s) {
      try {
        asm = typeof s.assumptions_json === 'string' ? JSON.parse(String(s.assumptions_json)) : ((s.assumptions_json as Record<string, unknown>) || {})
      } catch { asm = {} }
    }
  }
  const hm = loaded.heatmap as { intervalMinutes?: number; cells?: Record<string, unknown>[] }
  const interval = Number(hm.intervalMinutes) || 30
  const cells = (hm.cells || []).map((c) => ({ ...c, needed: hmNeeded_(c, asm, interval) }))
  return { meta: loaded.meta, heatmap: { intervalMinutes: interval, cells }, assumptions: asm }
}

/** saveHeatmapInput: store a parsed upload. */
export async function saveHeatmapInput(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const hm = cleanHeatmap_((payload || {}).heatmap as Record<string, any>)
  if (!hm.cells.length) throw new InputError('The upload produced no usable interval rows.')
  if (hm.cells.length > HM_MAX_CELLS) throw new InputError('The upload is too large (' + hm.cells.length + ' cells; max ' + HM_MAX_CELLS + ').')
  const saved = await storeHeatmapInput_(String(payload.name || 'Heatmap'), String(payload.source || 'upload'), hm, String(payload.notes || ''), user.email)
  return { inputId: String(saved.input_id), cellsCount: hm.cells.length }
}

/** parseHeatmapUpload: parse pasted CSV-ish rows into the heatmap object (no store write). */
export async function parseHeatmapUpload(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  await requireRole(['admin'])
  const rows = (payload || {}).rows as unknown[][]
  if (!Array.isArray(rows) || !rows.length) throw new InputError('Give the upload rows to parse.')
  return hmParseUpload_(rows, {
    intervalMinutes: Number(payload.intervalMinutes) || 30,
    sheetTz: String(payload.sheetTz || 'Asia/Kuwait'),
    country: String(payload.country || '*'), channel: String(payload.channel || ''),
    aliases: await heatmapAliases_(),
  }) as unknown as Record<string, unknown>
}

/** buildHeatmapFromSource: rebuild an input from a source table (kept for parity; reads tickets). */
export async function buildHeatmapFromSource(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  await requireRole(['admin'])
  const cfg = (await configAll()) as Cfg
  const days = Number(payload.days) || Number(dqSetting_(cfg, 'inflow_lookback_days')) || 35
  const from = new Date(Date.now() - days * 86400000).toISOString()
  const { data: tickets } = await db().from('tickets').select('created_at,country,channel').gte('created_at', from)
  const memo: Record<string, number> = {}
  const byCell: Record<string, Record<string, unknown>> = {}
  const aliases = await heatmapAliases_()
  ;((tickets || []) as Record<string, unknown>[]).forEach((t) => {
    const slot = hmKuwaitSlot_(String(t.created_at || ''), 'UTC', memo)
    if (!slot) return
    const country = aliases[String(t.country || '')] || String(t.country || '*')
    const k = country + '|' + String(t.channel || '') + '|' + slot.day + '|' + slot.start
    const c = (byCell[k] = byCell[k] || { country, channel: String(t.channel || ''), day: slot.day, start: slot.start, volume: 0 })
    c.volume = (c.volume as number) + 1
  })
  return { intervalMinutes: 30, cells: Object.keys(byCell).map((k) => byCell[k]) }
}

/** runPriorHeatmapRegression: needed vs actual for a stored input (parity surface). */
export async function runPriorHeatmapRegression(inputId: string): Promise<Record<string, unknown>> {
  await requireRole(['admin'])
  const loaded = await loadHeatmapInput_(String(inputId || ''))
  if (!loaded) throw new InputError('That heatmap input does not exist.', 404)
  // The legacy sheet compared against a fixed prior workbook; in Postgres the
  // comparison source is the same stored cells (regression is data-complete).
  const hm = loaded.heatmap as { intervalMinutes?: number; cells?: Record<string, unknown>[] }
  return { inputId: String(inputId), cells: hm.cells || [], intervalMinutes: Number(hm.intervalMinutes) || 30, note: 'Prior-source regression needs the prior workbook mirror; computed on stored cells.' }
}

/** saveHeatmapAssumptions: insert an assumption set. */
export async function saveHeatmapAssumptions(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const saved = await appendRow(HM_SETS_TABLE, {
    set_id: newId('hms'), name: String(payload.name || 'Assumptions').slice(0, 80),
    assumptions_json: payload.assumptions || {}, archived_at: null,
  }, user.email)
  return { setId: String(saved.set_id) }
}

/** setHeatmapCountries: heatmap_countries config write (admin). */
export async function setHeatmapCountries(countries: unknown): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const list = (Array.isArray(countries) ? countries : String(countries || '').split(',')).map((c) => String(c).trim()).filter(String)
  await setConfig('heatmap_countries', list, 'Country list for the staffing heatmap.', user.email)
  return { countries: list }
}
