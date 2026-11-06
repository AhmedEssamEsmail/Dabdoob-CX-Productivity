/**
 * Operations golden-test oracle: runs Operations_deprecated/Trackers.js verbatim
 * in node:vm (scripts/oracle.mjs) while the cx-operations port runs against the
 * hub-fakes supabase/auth doubles. opsInstall() feeds BOTH sides the same rows:
 *
 *   - Registry + shared tables (trackers, tracker_fields, options, roster,
 *     view_as, tracker_records) -> oracle data tabs (Trackers, TrackerFields,
 *     Options, Roster, ViewAs) / port tables of the same name.
 *   - External tracker data -> a DEEP COPY of spreadsheets goes to the oracle's
 *     fake sheets; a second copy feeds the fake TrackerIo (setTrackerSheetIo),
 *     so neither side sees the other's writes. Date cells are authored as
 *     '@@ms:<ms>' markers (the oracle revives them as Dates; the io converts
 *     them for the port).
 *   - Native tracker records -> tracker_records rows for the port, mirrored as
 *     one tab per native tracker inside the oracle's trackers spreadsheet
 *     (props.CC_TRACKERS_SPREADSHEET_ID, or '__data__' when unset).
 *
 * Each golden test file opts in with:
 *   vi.mock('@/features/shared/lib/supabase', async () =>
 *     (await import('./hub-fakes')).supabaseModule())
 *   vi.mock('@/features/shared/lib/auth', async () =>
 *     (await import('./hub-fakes')).authModule())
 */
import { createOracle } from '../../scripts/oracle.mjs'
import { hubDb, hubDbReset, hubSetTables, hubSetUser } from './hub-fakes'
import { cacheClear, toCellValue } from '@/features/shared/platform/repo'
import { viewAsResetCaches } from '@/features/shared/platform/viewas'
import { mapTrackerColumns_, setTrackerSheetIo } from '@/features/cx-operations/lib/trackers'
import type { Tracker, TrackerIo } from '@/features/cx-operations/lib/trackers'
import { expectSame, json } from './helpers-oracle'
import type { GoldenFixture } from './helpers-oracle'

/** The legacy files an Operations call can reach (verbatim). */
export const OPS_FILES = ['Config.js', 'Repo.js', 'Auth.js', 'ViewAs.js', 'Options.js', 'PeopleCore.js', 'WorkCalendar.js', 'Stores.js', 'Trackers.js']

let _o: ReturnType<typeof createOracle> | null = null
export function opsOracle() {
  if (!_o) _o = createOracle(OPS_FILES)
  return _o
}

/** Legacy Core tab -> Postgres table name (only names that differ are listed). */
const TAB_TO_TABLE: Record<string, string> = {
  Trackers: 'trackers',
  TrackerFields: 'tracker_fields',
  Options: 'options',
  Roster: 'roster',
  ViewAs: 'view_as',
}

export interface OpsFx {
  /** Config key -> value; non-strings are stored as JSON (settingsToConfig). */
  settings?: Record<string, unknown>
  /** Rows keyed by the PORT table name (data tabs mapped back via TAB_TO_TABLE). */
  tables?: Record<string, Record<string, unknown>[]>
  /** Port table names that do not exist (supabase would error on .from). */
  missingTables?: string[]
  /** ssId -> tab -> rows[][] (external tracker sheets + the trackers spreadsheet). */
  spreadsheets?: Record<string, Record<string, unknown[][]>>
  userEmail?: string
  effectiveUserEmail?: string
  nowMs?: number
  scriptTz?: string
  /** Legacy Script Properties (CC_TRACKERS_SPREADSHEET_ID for native trackers). */
  props?: Record<string, string>
  [key: string]: unknown
}

/** Union of a row set's keys, first-seen order — the header row the oracle tab needs. */
function headersOf(rows: Record<string, unknown>[]): string[] {
  const out: string[] = []
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      if (out.indexOf(k) === -1) out.push(k)
    })
  })
  return out
}

/** rows of objects -> rows[][] with header (sheet cells; '' for missing). */
function objectsToRows(rows: Record<string, unknown>[]): unknown[][] {
  const headers = headersOf(rows)
  return [headers, ...rows.map((r) => headers.map((h) => (h in r ? r[h] : '')))]
}

/** Config settings -> config table rows (the setConfig_ storage shape). */
function configRowsOf(settings: Record<string, unknown>): Record<string, unknown>[] {
  return Object.keys(settings || {}).map((k) => ({
    key: k,
    value: typeof settings[k] === 'string' ? settings[k] : JSON.stringify(settings[k]),
    description: '',
    updated_by: 'oracle',
    updated_at: '',
  }))
}

/** '@@ms:<n>' markers read back as Dates for the port side (mirrors __rebind__). */
function revive(v: unknown): unknown {
  if (typeof v === 'string' && v.indexOf('@@ms:') === 0) return new Date(Number(v.slice(5)))
  return v
}

/**
 * The fake sheet io (D-GOOGLE contract): mirrors a Google Sheets adapter over
 * { spreadsheetId: { tab: rows[][] } }. headers() is the trimmed header row
 * padded to the sheet's last column (getRange(1,headerRow,..,lastCol));
 * lines() every data row in header order; appendHeaders lands at the first
 * blank-tail position; append writes the same mapped cells writeTrackerRow_
 * does (toCellValue applied, blanks elsewhere).
 */
export function mkSheetIo(tabs: Record<string, Record<string, unknown[][]>>) {
  const appended: { tracker: string; rec: { recordId: string; submittedBy: string; submittedAt: string; values: Record<string, unknown> }; row: number }[] = []
  const tabRows = (t: Tracker): unknown[][] | null => {
    const book = tabs[String(t.spreadsheetId)]
    return book && t.tab in book ? book[String(t.tab)] : null
  }
  const lastCol = (t: Tracker) => (tabRows(t) || []).reduce((m, r) => Math.max(m, r.length), 0)
  const headerList = (t: Tracker): string[] => {
    const rows = tabRows(t)
    if (!rows) throw new Error('The tab "' + t.tab + '" of ' + t.name + ' is missing. Ask an admin to check the source sheet.')
    const hr = (t.headerRow || 1) - 1
    const h = rows[hr] || []
    const n = lastCol(t)
    const out: string[] = []
    for (let i = 0; i < n; i++) out.push(String(i < h.length ? h[i] : '').trim())
    return out
  }
  const io: TrackerIo = {
    async headers(t) {
      return headerList(t)
    },
    async lines(t) {
      const rows = tabRows(t) || []
      const hs = headerList(t)
      const start = t.headerRow || 1
      const out: unknown[][] = []
      for (let i = start; i < rows.length; i++) {
        const r = rows[i]
        const line: unknown[] = []
        for (let c = 0; c < hs.length; c++) line.push(revive(c < r.length ? r[c] : ''))
        out.push(line)
      }
      return out
    },
    async appendHeaders(t, missing) {
      const rows = tabRows(t)
      if (!rows) throw new Error('The tab "' + t.tab + '" of ' + t.name + ' is missing. Ask an admin to check the source sheet.')
      let headers = headerList(t)
      let lastUsed = headers.length
      while (lastUsed > 0 && !headers[lastUsed - 1]) lastUsed--
      const hr = (t.headerRow || 1) - 1
      while (rows.length <= hr) rows.push([])
      const hrow = rows[hr]
      for (let i = 0; i < missing.length; i++) hrow[lastUsed + i] = missing[i]
      headers = headers.slice(0, lastUsed).concat(missing)
      return headers
    },
    async append(t, rec) {
      const rows = tabRows(t)
      if (!rows) throw new Error('The tab "' + t.tab + '" of ' + t.name + ' is missing. Ask an admin to check the source sheet.')
      const headers = headerList(t)
      const map = mapTrackerColumns_(t, headers)
      const row = new Array(headers.length).fill('')
      t.fields.forEach((f) => {
        const c = map.cols[f.id]
        if (c !== undefined && f.id in rec.values) row[c] = toCellValue(rec.values[f.id])
      })
      if (map.sys.record_id >= 0) row[map.sys.record_id] = toCellValue(rec.recordId)
      if (map.sys.submitted_by >= 0) row[map.sys.submitted_by] = toCellValue(rec.submittedBy)
      if (map.sys.submitted_at >= 0) row[map.sys.submitted_at] = toCellValue(rec.submittedAt)
      // writeTrackerRow_ appends at max(getLastRow, headerRow) + 1.
      while (rows.length < (t.headerRow || 1)) rows.push([])
      rows.push(row)
      appended.push({ tracker: t.id, rec, row: rows.length })
      return rows.length
    },
    async maxFormattedId(t, format) {
      const rows = tabRows(t) || []
      const headers = headerList(t)
      const map = mapTrackerColumns_(t, headers)
      const colIdx = map.sys.record_id
      const re = new RegExp('^' + format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{n\\}', '(\\d+)') + '$', 'i')
      let max = 0
      if (colIdx >= 0) {
        rows.slice(t.headerRow || 1).forEach((r) => {
          const m = re.exec(String(r[colIdx] || '').trim())
          if (m) max = Math.max(max, Number(m[1]))
        })
      }
      return max
    },
  }
  return { io, appended }
}

/** Installs fx on both sides; returns the oracle fixtures and the sheet io double. */
export function opsInstall(fx: OpsFx): { fixture: GoldenFixture; sheetIo: ReturnType<typeof mkSheetIo> } {
  hubDbReset()
  cacheClear()
  viewAsResetCaches()
  hubSetUser(fx.userEmail === undefined ? 'admin@dabdoob.com' : fx.userEmail)
  const tables = fx.tables || {}
  const portTables: Record<string, Record<string, unknown>[]> = { ...tables }
  portTables.config = configRowsOf(fx.settings || {})
  hubSetTables(portTables)
  ;(fx.missingTables || []).forEach((t) => {
    hubDb.missing.add(t)
    delete hubDb.tables[t]
  })

  const data: Record<string, unknown[][]> = {}
  Object.keys(tables).forEach((name) => {
    const legacyName = Object.keys(TAB_TO_TABLE).find((t) => TAB_TO_TABLE[t] === name)
    if (legacyName) data[legacyName] = objectsToRows(tables[name])
  })
  // Each side gets its own copy of the sheet cells — neither sees the other's writes.
  const sheetIo = mkSheetIo(deepCells(fx.spreadsheets || {}))
  setTrackerSheetIo(sheetIo.io)
  return {
    fixture: {
      settings: fx.settings,
      data,
      spreadsheets: deepCells(fx.spreadsheets || {}),
      props: fx.props,
      userEmail: fx.userEmail,
      effectiveUserEmail: fx.effectiveUserEmail,
      nowMs: fx.nowMs,
      scriptTz: fx.scriptTz,
    },
    sheetIo,
  }
}

function deepCells<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

/** Calls the Operations legacy function in the ops oracle. */
export function opsCall(fn: string, args: unknown[] = [], fx: GoldenFixture = {}) {
  try {
    return { ok: json(opsOracle().call(fn, args, fx)) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}

/** Async callPort for the ported server functions. */
export async function portCall(fn: () => unknown | Promise<unknown>) {
  try {
    return { ok: json(await fn()) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}

/** One call: legacy fn vs port thunk on the same ops fixtures. */
export async function opsSame(fn: string, args: unknown[], fx: OpsFx, portFn: () => unknown | Promise<unknown>, label?: string) {
  const { fixture } = opsInstall(fx)
  const legacyRes = opsCall(fn, args, fixture)
  const portRes = await portCall(portFn)
  expectSame(portRes, legacyRes, label || fn)
  return { legacy: legacyRes, port: portRes }
}

/** Reads a data tab INSIDE the vm WITHOUT resetting (post-write state). */
export function opsTable(name: string): Record<string, unknown>[] {
  return JSON.parse(opsOracle().eval(`JSON.stringify(readTable_(${JSON.stringify(name)}))`)) as Record<string, unknown>[]
}

/** Raw tab cells INSIDE the vm (post-write): rows[][] including the header row. */
export function opsSheetCells(ssId: string, tab: string): unknown[][] {
  return JSON.parse(
    opsOracle().eval(
      `JSON.stringify(((__FIXTURES__.spreadsheets||{})[${JSON.stringify(ssId)}]||{})[${JSON.stringify(tab)}]||[])`,
    ),
  ) as unknown[][]
}

/** The option lists inside the vm WITHOUT resetting (post-write state). */
export function opsOptions(): Record<string, string[]> {
  return JSON.parse(opsOracle().eval('JSON.stringify(allOptions_())')) as Record<string, string[]>
}

/** Script properties inside the vm (DQ_LAST_* stamps, tracker ss id). */
export function opsProp(key: string): unknown {
  return JSON.parse(opsOracle().eval(`JSON.stringify(PropertiesService.getScriptProperties().getProperty(${JSON.stringify(key)}))`))
}

export function opsWrites(): { fn: string; args: unknown[] }[] {
  return opsOracle().writes()
}

export { expectSame, json }
