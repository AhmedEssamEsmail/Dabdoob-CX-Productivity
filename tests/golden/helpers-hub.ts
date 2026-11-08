/**
 * Hub golden tests: a second oracle over Command_Center_V2_deprecated (the hub app)
 * plus a fixture builder that feeds the SAME data to the oracle's sheet fakes and
 * to the ported supabase reads (tests/golden/hub-fakes.ts).
 *
 *   const r = same2('getHomePage', [], hubFx, () => getHomePage())
 */
import { createOracle } from '../../scripts/parity/oracle.mjs'
import { hubSetTables, hubSetUser, hubDbReset } from './hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'
import { callLegacy, callPort, expectSame, json } from './helpers-oracle'
import type { GoldenFixture } from './helpers-oracle'

/** The legacy files a Hub page calls reach (verbatim). */
export const V2_FILES = [
  'Config.js',
  'Repo.js',
  'Auth.js',
  'ViewAs.js',
  'Options.js',
  'Popups.js',
  'Stores.js',
  'PeopleCore.js',
  'WorkCore.js',
  'QueueCore.js',
  'ProdCore.js',
  'WorkCalendar.js',
  'Aggregates.js',
  'Health.js',
  'HomeCards.js',
  'RosterSync.js',
  'Apps.js',
  'Assistant.js',
  'Code.js',
  'Mailer.js',
  'Notify.js',
]

let _o: ReturnType<typeof createOracle> | null = null
export function hubOracle() {
  if (!_o) _o = createOracle(V2_FILES)
  return _o
}

/** Legacy Core tab -> Postgres table name (only names that differ are listed). */
const TAB_TO_TABLE: Record<string, string> = {
  Roster: 'roster',
  ViewAs: 'view_as',
  Options: 'options',
  Popups: 'popups',
  Health: 'health',
  MailLog: 'mail_log',
  FollowUpDone: 'follow_up_done',
  queue_status_submissions: 'queue_submissions',
  aging_flags: 'dq_aging_flags',
}

/** Tables that live in a V2 store (not the Core book) on the GAS side. */
const LIVE_STORE = 'live-store'

export interface HubFx {
  /** Config key -> value; non-strings are stored as JSON (settingsToConfig). */
  settings?: Record<string, unknown>
  /** Supabase-shaped row objects keyed by the PORT table name (see TAB_TO_TABLE). */
  tables?: Record<string, Record<string, unknown>[]>
  userEmail?: string
  effectiveUserEmail?: string
  nowMs?: number
  scriptTz?: string
  /** Legacy Script Properties (DQ_LAST_* etc). */
  props?: Record<string, string>
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

/**
 * Installs fx on both sides: returns the oracle fixtures (settings -> Config tab,
 * port tables re-split into Core tabs + live-store tabs) and fills hubDb.
 */
export function hubInstall(fx: HubFx): GoldenFixture {
  hubDbReset()
  cacheClear() // the oracle's __reset__ drops per-execution memos; so does this
  hubSetUser(fx.userEmail || 'admin@dabdoob.com')
  const tables = fx.tables || {}
  const portTables: Record<string, Record<string, unknown>[]> = { ...tables }
  portTables.config = configRowsOf(fx.settings || {})
  // dq_last_* stand-ins for the Script-Property stamps (hbEvidence_ reads config).
  Object.keys(fx.props || {}).forEach((k) => {
    if (k.indexOf('DQ_LAST_') === 0)
      portTables.config.push({ key: 'dq_last_' + k.slice(8), value: fx.props![k], description: '', updated_by: 'oracle', updated_at: '' })
  })
  hubSetTables(portTables)

  const data: Record<string, unknown[][]> = {}
  const live: Record<string, unknown[][]> = {}
  const STORE_NAMES = new Set([
    'aging_open_tickets',
    'agg_queue_now',
    'agg_snapshots_today',
    'agg_inflow_daily',
    'agg_inflow_weekly',
    'agg_inflow_monthly',
    'agg_agent_perf',
    'agg_agent_daily',
    'refresh_log',
    'esc_seen',
    'tickets',
    'sc_months',
  ])
  Object.keys(tables).forEach((name) => {
    const rows = tables[name]
    const legacyName = Object.keys(TAB_TO_TABLE).find((t) => TAB_TO_TABLE[t] === name) || name
    if (STORE_NAMES.has(name)) live[legacyName] = objectsToRows(rows)
    else data[legacyName] = objectsToRows(rows)
  })
  return {
    settings: fx.settings,
    data,
    spreadsheets: { [LIVE_STORE]: live },
    props: fx.props,
    userEmail: fx.userEmail,
    effectiveUserEmail: fx.effectiveUserEmail,
    nowMs: fx.nowMs,
    scriptTz: fx.scriptTz,
  }
}

/** Calls the V2 legacy function in the hub oracle. */
export function hubCall(fn: string, args: unknown[] = [], fx: GoldenFixture = {}) {
  try {
    return { ok: json(hubOracle().call(fn, args, fx)) }
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

/** Reads a Core tab as objects inside the oracle (fresh reset against these fixtures). */
export function hubTable(name: string, fx: GoldenFixture = {}): Record<string, unknown>[] {
  return hubOracle().table(name, fx) as Record<string, unknown>[]
}

/**
 * Reads a data tab INSIDE the vm WITHOUT resetting — for post-write assertions
 * (the oracle writes to its own in-vm copies, not the host's fixture arrays).
 */
export function hubSheetRows(name: string): Record<string, unknown>[] {
  return JSON.parse(hubOracle().eval(`JSON.stringify(readTable_(${JSON.stringify(name)}))`)) as Record<string, unknown>[]
}

export function hubWrites(): { fn: string; args: unknown[] }[] {
  return hubOracle().writes()
}

export { callLegacy, callPort, expectSame, json }
