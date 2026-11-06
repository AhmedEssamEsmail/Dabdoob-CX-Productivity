/**
 * Desk golden-test oracle: runs Desk_deprecated verbatim in node:vm
 * (scripts/oracle.mjs) while the cx-desk ports run against the hub-fakes
 * supabase/auth doubles. deskInstall() feeds BOTH sides the same rows:
 *
 *   - Core tabs (roster, view_as, options, popups, health, mail_log, actions,
 *     action_task_details, action_updates) -> oracle data tabs / port tables.
 *   - V2 'live' stores (tlp_*, mail_*, kpi_*_log) -> oracle 'live-store' tabs
 *     / port tables of the same name.
 *   - gmailThreads: the fake Gmail.Users.Threads inside the vm; the port side
 *     reads the same threads through setGmailReadAdapter (the mdThreads_ seam).
 *
 * Each golden test file opts in with:
 *   vi.mock('@/features/shared/lib/supabase', async () =>
 *     (await import('./hub-fakes')).supabaseModule())
 *   vi.mock('@/features/shared/lib/auth', async () =>
 *     (await import('./hub-fakes')).authModule())
 */
import { vi } from 'vitest'
import { createOracle } from '../../scripts/oracle.mjs'
import { hubDbReset, hubSetTables, hubSetUser } from './hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'
import { viewAsResetCaches } from '@/features/shared/platform/viewas'
import { hbReset } from '@/features/shared/platform/health'
import { setGmailReadAdapter } from '@/features/shared/platform/mail'
import { expectSame, json } from './helpers-oracle'
import type { GoldenFixture } from './helpers-oracle'

/**
 * The legacy files a Desk call can reach (verbatim). Shared files resolve to the
 * same text in every *_deprecated dir; MailDesk.js / TlPerformance.js / KpiLogs.js
 * exist only in Desk_deprecated, which legacyFile() finds automatically.
 */
export const DESK_FILES = [
  'Config.js',
  'Repo.js',
  'Auth.js',
  'ViewAs.js',
  'Options.js',
  'Popups.js',
  'PeopleCore.js',
  'WorkCalendar.js',
  'Stores.js',
  'Health.js',
  'TlSnapshots.js',
  'KpiPayout.js',
  'Mailer.js',
  'MailDesk.js',
  'TlPerformance.js',
  'KpiLogs.js',
]

let _o: ReturnType<typeof createOracle> | null = null
export function deskOracle() {
  if (!_o) {
    _o = createOracle(DESK_FILES)
    // Utilities.base64Encode is not faked by the oracle prelude; MailDesk's
    // mdHeaderValue_ / mdReplyMime_ need it (UTF-8, same bytes as Buffer).
    _o.eval(`Utilities.base64Encode = function (s) {
      var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      var bytes = unescape(encodeURIComponent(String(s)));
      var out = '', i = 0;
      while (i < bytes.length) {
        var c1 = bytes.charCodeAt(i++), c2 = i < bytes.length ? bytes.charCodeAt(i++) : NaN, c3 = i < bytes.length ? bytes.charCodeAt(i++) : NaN;
        var e1 = c1 >> 2, e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
        var e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
        var e4 = isNaN(c3) ? 64 : (c3 & 63);
        out += B64.charAt(e1) + B64.charAt(e2) + (e3 === 64 ? '=' : B64.charAt(e3)) + (e4 === 64 ? '=' : B64.charAt(e4));
      }
      return out;
    };
    Utilities.Charset = { UTF_8: 'UTF-8' };
    // Gmail.Users.Threads (the mdThreads_ seam): fixtures.gmailThreads drives it.
    Gmail.Users.Threads = {
      list: function (u, o) {
        var ts = (__FIXTURES__.gmailThreads || []);
        return { threads: ts.map(function (t) { return { id: t.id }; }) };
      },
      get: function (u, id) {
        var t = (__FIXTURES__.gmailThreads || []).filter(function (x) { return String(x.id) === String(id); })[0];
        return { messages: (t && t.messages) || [] };
      }
    };
    // '@@fn:__fn_isOurs__' arg seam: reads fixtures.oursEmails (a list of lower-cased addresses).
    globalThis.__fn_isOurs__ = function (e) {
      var xs = (__FIXTURES__.oursEmails) || [];
      return xs.indexOf(String(e).trim().toLowerCase()) !== -1;
    };
    // Deterministic Math.random: newId_() ids match the port, whose calls run with
    // vi.spyOn(Math, 'random') pinned to the same constant (see portCall below).
    Math.random = function () { return 0.123456; };`)
  }
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
}

/** Tables that live in the V2 'live' store (CC2 Live) on the GAS side. */
const LIVE_STORE = 'live-store'
const STORE_NAMES = new Set([
  'tlp_shifts',
  'tlp_queue_daily',
  'tlp_team',
  'tlp_area_metrics',
  'tlp_perf_daily',
  'tlp_perf_weekly',
  'tlp_resp_ratings',
  'tlp_kb',
  'tlp_otd',
  'tlp_ticket_exclusions',
  'mail_sla',
  'mail_approvals',
  'mail_approval_log',
  'kpi_behaviour_log',
  'kpi_leave_log',
  'kpi_ol_cases',
  'refresh_log',
])

export interface DeskFx {
  /** Config key -> value; non-strings are stored as JSON (settingsToConfig). */
  settings?: Record<string, unknown>
  /** Rows keyed by the PORT table name (Core tabs mapped back via TAB_TO_TABLE). */
  tables?: Record<string, Record<string, unknown>[]>
  userEmail?: string
  effectiveUserEmail?: string
  nowMs?: number
  scriptTz?: string
  /** Legacy Script Properties (DQ_LAST_* etc.). */
  props?: Record<string, string>
  /** Extra spreadsheets (ssId -> tab -> rows) beyond the live store. */
  spreadsheets?: Record<string, Record<string, unknown[][]>>
  /**
   * Explicit header order per table (needed for EMPTY Core tabs: a tab that
   * holds only a header row still hands its schema to appendRows_/updateRow_,
   * while objectsToRows([]) cannot know one).
   */
  headers?: Record<string, string[]>
  /** Gmail threads for mdThreads_: { id, messages: [Gmail API message shape] }. */
  gmailThreads?: { id: string; messages: Record<string, unknown>[] }[]
  /** Address list for the '@@fn:__fn_isOurs__' pure ctx seam. */
  oursEmails?: string[]
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

/** rows of objects -> rows[][] with header (sheet cells; '' for missing). hint supplies the schema for empty tables. */
function objectsToRows(rows: Record<string, unknown>[], hint?: string[]): unknown[][] {
  const headers = hint && hint.length ? [...hint] : headersOf(rows)
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (headers.indexOf(k) === -1) headers.push(k) }))
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
 * port tables re-split into Core tabs + live-store tabs) and fills hubDb. Also
 * wires the port's Gmail read adapter to fx.gmailThreads (null clears it).
 */
export function deskInstall(fx: DeskFx): GoldenFixture {
  hubDbReset()
  cacheClear() // the oracle's __reset__ drops per-execution memos; so does this
  viewAsResetCaches()
  hbReset()
  hubSetUser(fx.userEmail === undefined ? 'admin@dabdoob.com' : fx.userEmail)
  const tables = fx.tables || {}
  const portTables: Record<string, Record<string, unknown>[]> = { ...tables }
  // The V2 'live' store resolves through getConfig_('ss_live_id') -> a fixture spreadsheet.
  const settings: Record<string, unknown> = { ss_live_id: LIVE_STORE, ...(fx.settings || {}) }
  portTables.config = configRowsOf(settings)
  // dq_last_* stand-ins for the Script-Property stamps (dqLastRun reads config).
  Object.keys(fx.props || {}).forEach((k) => {
    if (k.indexOf('DQ_LAST_') === 0) {
      portTables.config.push({ key: 'dq_last_' + k.slice(8), value: fx.props![k], description: '', updated_by: 'oracle', updated_at: '' })
    }
  })
  hubSetTables(portTables)

  const data: Record<string, unknown[][]> = {}
  const live: Record<string, unknown[][]> = {}
  Object.keys(tables).forEach((name) => {
    if (name === 'config') return // the Config tab comes from fx.settings via settingsToConfig
    const rows = tables[name]
    const legacyName = Object.keys(TAB_TO_TABLE).find((t) => TAB_TO_TABLE[t] === name) || name
    const hint = (fx.headers || {})[name] || (fx.headers || {})[legacyName]
    if (STORE_NAMES.has(name)) live[legacyName] = objectsToRows(rows, hint)
    else data[legacyName] = objectsToRows(rows, hint)
  })
  const spreadsheets: Record<string, Record<string, unknown[][]>> = { ...(fx.spreadsheets || {}) }
  spreadsheets[LIVE_STORE] = { ...(spreadsheets[LIVE_STORE] || {}), ...live }

  // The port-side Gmail read adapter, fed by the same fixture object.
  const threads = fx.gmailThreads || []
  setGmailReadAdapter(
    threads.length
      ? {
          async listMessages(_q: string, maxResults: number) {
            const stubs: { id: string }[] = []
            threads.forEach((t) => t.messages.forEach((m) => stubs.push({ id: String(m.id) })))
            return stubs.slice(0, maxResults)
          },
          async getMessage(id: string) {
            for (const t of threads) {
              const m = t.messages.filter((x) => String(x.id) === String(id))[0]
              if (m) return m as never
            }
            return { id, internalDate: '', payload: { headers: [] } } as never
          },
          async getAttachment() {
            return { data: '' }
          },
        }
      : null,
  )

  return {
    settings,
    data,
    spreadsheets,
    props: fx.props,
    userEmail: fx.userEmail,
    effectiveUserEmail: fx.effectiveUserEmail,
    nowMs: fx.nowMs,
    scriptTz: fx.scriptTz,
    gmailThreads: fx.gmailThreads,
    oursEmails: fx.oursEmails,
  }
}

/** Calls the Desk legacy function in the desk oracle. */
export function deskCall(fn: string, args: unknown[] = [], fx: GoldenFixture = {}) {
  try {
    return { ok: json(deskOracle().call(fn, args, fx)) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}

/** Async callPort for the ported server functions. Math.random is pinned to the same constant the oracle vm uses, so newId() ids match byte-for-byte. */
export async function portCall(fn: () => unknown | Promise<unknown>) {
  const spy = vi.spyOn(Math, 'random').mockReturnValue(0.123456)
  try {
    return { ok: json(await fn()) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  } finally {
    spy.mockRestore()
  }
}

/** One call: legacy fn vs port thunk on the same desk fixtures. */
export async function deskSame(fn: string, args: unknown[], fx: DeskFx, portFn: () => unknown | Promise<unknown>, label?: string) {
  const fixture = deskInstall(fx)
  const legacyRes = deskCall(fn, args, fixture)
  const portRes = await portCall(portFn)
  expectSame(portRes, legacyRes, label || fn)
  return { legacy: legacyRes, port: portRes }
}

/** Reads a V2 store INSIDE the vm WITHOUT resetting — post-write assertions. */
export function deskStore(name: string): Record<string, unknown>[] {
  return JSON.parse(
    deskOracle().eval(`JSON.stringify(dqReadObjects_(${JSON.stringify(name)}, null, { missingOk: true }))`),
  ) as Record<string, unknown>[]
}

/** Reads a data tab INSIDE the vm WITHOUT resetting (post-write state). */
export function deskTable(name: string): Record<string, unknown>[] {
  return JSON.parse(deskOracle().eval(`JSON.stringify(readTable_(${JSON.stringify(name)}))`)) as Record<string, unknown>[]
}

/** Raw tab cells INSIDE the vm (post-write): rows[][] including the header row. */
export function deskSheetCells(ssId: string, tab: string): unknown[][] {
  return JSON.parse(
    deskOracle().eval(
      `JSON.stringify(((__FIXTURES__.spreadsheets||{})[${JSON.stringify(ssId)}]||{})[${JSON.stringify(tab)}]||[])`,
    ),
  ) as unknown[][]
}

export function deskWrites(): { fn: string; args: unknown[] }[] {
  return deskOracle().writes()
}

/** Reads a config key inside the vm WITHOUT resetting (post-write state). */
export function deskConfig(key: string): unknown {
  return JSON.parse(deskOracle().eval(`JSON.stringify(getConfig_(${JSON.stringify(key)}, ''))`))
}

/** Script properties inside the vm WITHOUT resetting (dqMarkRun_ writes DQ_LAST_* here). */
export function deskProps(): Record<string, string> {
  return JSON.parse(deskOracle().eval('JSON.stringify(__PROPS__)')) as Record<string, string>
}
