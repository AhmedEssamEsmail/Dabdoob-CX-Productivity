/**
 * Golden-oracle test helpers: run the legacy Apps Script function in node:vm
 * (scripts/oracle.mjs) and the ported TypeScript function on the same inputs, then prove
 * the outputs are identical — same value, same field order, same error.
 */
import { createOracle, baseFixtures as _baseFixtures } from '../../scripts/oracle.mjs'

/** The full legacy surface the ported engines can touch (helpers live across files). */
export const LEGACY_FILES = [
  'Config.js',
  'Repo.js',
  'Auth.js',
  'PeopleCore.js',
  'WorkCalendar.js',
  'Stores.js',
  'ProdCore.js',
  'ProdValidation.js',
  'productivity.js',
  'ProductivityApp.js',
  'ProdTph.js',
  'KpiPayout.js',
  'WorkCore.js',
  'QueueCore.js',
  'TlSnapshots.js',
]

let _oracle: ReturnType<typeof createOracle> | null = null
export function oracle() {
  if (!_oracle) _oracle = createOracle(LEGACY_FILES)
  return _oracle
}

/** Permissive fixture shape — tests add arbitrary keys and index sheets/tabs. */
export interface GoldenFixture {
  settings?: unknown
  spreadsheets?: Record<string, Record<string, unknown[][]>>
  data?: Record<string, unknown[][]>
  nowMs?: number
  [key: string]: unknown
}

/** Re-exported with the permissive shape. */
export function baseFixtures(over?: GoldenFixture): GoldenFixture {
  return _baseFixtures(over) as GoldenFixture
}

/** Calls the legacy function; returns { ok: value } or { err: message } — never throws. */
export function callLegacy(fn: string, args: unknown[] = [], fixtures: unknown = {}) {
  try {
    return { ok: json(oracle().call(fn, args, fixtures as object)) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}

/** Calls a port function with the same convention. */
export function callPort(fn: () => unknown) {
  try {
    return { ok: json(fn()) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}

/** JSON-normalises a result: Dates -> ISO, vm-realm objects -> plain host values. */
export function json<T>(v: T): T {
  return v === undefined ? (v as T) : JSON.parse(JSON.stringify(v))
}

/**
 * First difference between a and b, or null when identical (field order ignored — both
 * sides serialise with JSON.stringify, whose order is insertion order anyway; object KEY
 * order is preserved by JSON.stringify so a reordered-keyed object still compares equal
 * here. Stored strings (spans_json etc.) are compared as strings, so byte equality holds).
 */
export function diffPath(a: unknown, b: unknown, path = '$'): string | null {
  if (a === b) return null
  const ta = typeof a
  const tb = typeof b
  if (ta !== tb) return `${path}: type ${ta}!=${tb} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`
  if (a === null || b === null) return `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array/object mismatch`
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}.length: ${a.length} != ${b.length}`
    for (let i = 0; i < a.length; i++) {
      const d = diffPath(a[i], b[i], `${path}[${i}]`)
      if (d) return d
    }
    return null
  }
  if (ta === 'object') {
    const ka = Object.keys(a as object)
    const kb = Object.keys(b as object)
    const kaS = [...ka].sort()
    const kbS = [...kb].sort()
    if (kaS.join('|') !== kbS.join('|')) return `${path}: keys [${kaS}] != [${kbS}]`
    for (const k of ka) {
      const d = diffPath((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`)
      if (d) return d
    }
    return null
  }
  return `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`
}

/** Asserts legacy and port produced the same { ok } or { err } envelope. */
export function expectSame(portRes: { ok?: unknown; err?: string }, legacyRes: { ok?: unknown; err?: string }, label?: string) {
  const d = diffPath(legacyRes, portRes)
  if (d) throw new Error((label ? label + ' — ' : '') + 'oracle mismatch at ' + d)
}

/** Combined convenience: legacy fn vs port thunk, one call. */
export function same(fn: string, args: unknown[], portFn: () => unknown, fixtures: unknown = {}, label?: string) {
  expectSame(callPort(portFn), callLegacy(fn, args, fixtures), label || fn)
}

// ---------------------------------------------------------------- seeded rng

/** mulberry32 — deterministic stream for the randomized vectors. */
export function rng(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rint(r: () => number, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1))
}
export function rpick<T>(r: () => number, xs: T[]): T {
  return xs[Math.floor(r() * xs.length)]
}

// ---------------------------------------------------------------- sheet fixture

/** Host-side SheetBookLike over { tab: rows[][] } — same surface the oracle's fake sheets give. */
export function sheetBook(tabs: Record<string, unknown[][]>) {
  const range = (cells: unknown[][], r: number, c: number, nr: number, nc: number) => ({
    getValues() {
      const out: unknown[][] = []
      for (let i = 0; i < nr; i++) {
        const row = cells[r - 1 + i] || []
        const vals: unknown[] = []
        for (let j = 0; j < nc; j++) vals.push(c - 1 + j < row.length ? row[c - 1 + j] : '')
        out.push(vals)
      }
      return out
    },
    getValue() {
      const row = cells[r - 1] || []
      return row[c - 1]
    },
  })
  const mkSheet = (cells: unknown[][]) => ({
    getLastRow: () => cells.length,
    getLastColumn: () => cells.reduce((m, r) => Math.max(m, r.length), 0),
    getRange(a: string | number, b?: number, c?: number, d?: number) {
      if (typeof a === 'string') {
        const m = a.match(/^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/)
        if (!m) throw new Error('bad range: ' + a)
        const colOf = (s: string) => {
          let n = 0
          for (let i = 0; i < s.length; i++) n = n * 26 + (s.toUpperCase().charCodeAt(i) - 64)
          return n
        }
        const r0 = +m[2]
        const c0 = colOf(m[1])
        return range(cells, r0, c0, m[4] ? +m[4] - r0 + 1 : 1, m[3] ? colOf(m[3]) - c0 + 1 : 1)
      }
      return range(cells, a, b || 1, c ?? 1, d ?? 1)
    },
  })
  return {
    getSheetByName: (n: string) => (n in tabs ? mkSheet(tabs[n]) : null),
    getId: () => 'fixture',
  }
}

/** An openSpreadsheet seam over { ssId: { tab: rows } }. */
export function openSpreadsheet(spreadsheets: Record<string, Record<string, unknown[][]>>) {
  return (id: string) => sheetBook(spreadsheets[id] || {})
}
