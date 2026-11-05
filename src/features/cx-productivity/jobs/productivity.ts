/**
 * ProductivityApp.js job ports: the daily Agents Activity import and the whole
 * daily chain, run against a JobEnv (Supabase + prefetched sheets + Gmail read
 * adapter). The legacy globals become env seams; every function keeps its
 * legacy name and skip / throw semantics.
 */

import {
  dqAddDays_,
  dqDateKey_,
  dqSetting_,
  prodNameToEmail_,
} from '@/lib/prod/adapters'
import {
  prodAutoAccept_,
  prodComputeDates_,
  prodDetectDates_,
  prodNowIso_,
  prodReady_,
  prodSetting_,
  prodToday_,
} from '@/lib/prod/engine'
import { prodHeaderCols_, prodIntervalsFromRows_, type ProdIntervalsOpts } from '@/lib/prod/validation'
import { tphBuildCallMinutes_, tphBuildCases_, tphBuildTouches_ } from '@/lib/tph'
import { syncAllMirrors } from './mirrors'
import type { GmailReadAdapter } from '@/lib/platform/mail'
import { prodCsvRows_ } from './csv'
import type { JobEnv, Row } from './env'
import { dqStep_ } from './steps'
import { DAILY_REPORT_TABS } from './sheets'

/** subject:"Agents Activity" has:attachment — the daily snapshot email. */
export const PROD_MAIL_QUERY = 'subject:"Agents Activity" has:attachment'
/** The config key that plays PROD_MAIL_PROP (prodLastMail_). */
export const PROD_MAIL_PROP = 'prod_last_mail'

export const PROD_SOURCE_COLS = {
  name: { names: ['agent name', 'agent'], fallback: 0 },
  status: { names: ['status name', 'status'], fallback: 1 },
  start: { names: ['start time', 'start'], fallback: 2 },
  end: { names: ['end time', 'end'], fallback: 3 },
}

// ---------------------------------------------------------------- mail import

interface GmailPayloadPart {
  filename?: string
  body?: { attachmentId?: string; data?: string }
  parts?: GmailPayloadPart[]
}

/** prodFirstAttachment_ verbatim (depth first). */
export function prodFirstAttachment_(p: GmailPayloadPart | null | undefined): GmailPayloadPart | null {
  if (!p) return null
  if (p.filename && p.body && (p.body.attachmentId || p.body.data)) return p
  for (let i = 0; p.parts && i < p.parts.length; i++) {
    const hit = prodFirstAttachment_(p.parts[i])
    if (hit) return hit
  }
  return null
}

/** prodLatestActivityMail_ verbatim over the injected read adapter. */
export async function prodLatestActivityMail_(
  gmail: GmailReadAdapter
): Promise<{ id: string; ms: number; csv: string } | null> {
  const list = await gmail.listMessages(PROD_MAIL_QUERY, 1)
  const hit = list && list[0]
  if (!hit) return null
  const msg = await gmail.getMessage(String(hit.id))
  const part = prodFirstAttachment_(msg.payload as GmailPayloadPart)
  let data: unknown = ''
  if (part) {
    if (part.body?.data) data = part.body.data
    else data = (await gmail.getAttachment(String(msg.id), String(part.body?.attachmentId))).data
  }
  // Utilities.base64DecodeWebSafe: the service hands back base64url text (or bytes already).
  const bytes = typeof data === 'string' ? Buffer.from(data, 'base64url') : Buffer.from(data as Uint8Array)
  return {
    id: String(msg.id),
    ms: Number(msg.internalDate),
    csv: data && bytes.length ? bytes.toString('utf8') : '',
  }
}

/** prodIntervalOpts_ verbatim, over env.cfg / env.headcount. */
export function prodIntervalOpts_(env: JobEnv, cols: ProdIntervalsOpts['cols'], source: string): ProdIntervalsOpts {
  return {
    cols,
    tz: String(prodSetting_(env.cfg, 'prod_activity_tz')),
    statusMap: (prodSetting_(env.cfg, 'prod_status_map') as Record<string, string>) || {},
    nameToEmail: prodNameToEmail_(env.headcount),
    source,
    dateKey: (d: unknown) => dqDateKeyOrNull_(d, env),
  }
}

/** prodDateKey_ with the run's cfg (script tz -> business tz, like the legacy default). */
function dqDateKeyOrNull_(d: unknown, env: JobEnv): string | null {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null
  return dqDateKey_(d, env.cfg)
}

export interface SnapshotResult {
  skipped?: string
  dates?: string[]
  rowsOut?: number
  note?: string
}

/**
 * prodSnapshotIntervals_ verbatim (LockService aside — cron does not overlap
 * runs): the newest Agents Activity email's CSV -> prod_intervals, replacing
 * the dates it holds. Never imports the same email twice; skips a stale email;
 * throws, writing nothing, when the email has no readable row.
 */
export async function prodSnapshotIntervals_(env: JobEnv): Promise<SnapshotResult> {
  if (!prodReady_(env.cfg)) return { skipped: 'CC2 Productivity is not set up: run setupProductivity' }
  if (!env.gmail) return { skipped: 'gmail adapter not configured' }
  await env.ensureHeadcount()
  const mail = await prodLatestActivityMail_(env.gmail)
  if (!mail) return { skipped: 'no new email: none matches ' + PROD_MAIL_QUERY }
  const day = dqDateKey_(new Date(mail.ms), env.cfg)
  const last = env.lastMail()
  if (last.id === mail.id)
    return {
      skipped: 'no new email: the newest Agents Activity email (' + day + ') was imported at ' + last.importedAt,
    }
  const rows = prodCsvRows_(mail.csv)
  const res = prodIntervalsFromRows_(
    rows.slice(1),
    prodIntervalOpts_(env, prodHeaderCols_(rows[0] || [], PROD_SOURCE_COLS) as unknown as ProdIntervalsOpts['cols'], 'email')
  )
  if (!res.intervals.length)
    throw new Error(
      'The Agents Activity email of ' +
        day +
        ' has no readable row (' +
        Math.max(rows.length - 1, 0) +
        ' rows, ' +
        res.unparsed +
        ' without agent, status or readable start / end time). Nothing was changed.'
    )
  const dates = Object.keys(
    res.intervals.reduce((m: Record<string, boolean>, iv) => {
      m[iv.date as string] = true
      return m
    }, {})
  ).sort()
  const want = dqAddDays_(prodToday_(env.cfg, env.today), -1)
  if (dates[dates.length - 1] < want)
    return {
      skipped:
        'no new email: the newest Agents Activity email (' +
        day +
        ') holds ' +
        dates[0] +
        '..' +
        dates[dates.length - 1] +
        ', not ' +
        want,
    }
  const w = env.replaceIntervals(dates, res.intervals)
  env.setLastMail({ id: mail.id, ms: mail.ms, importedAt: prodNowIso_(env.now), dates })
  return {
    dates,
    rowsOut: w.added,
    note:
      'Email of ' +
      day +
      ': ' +
      (rows.length - 1) +
      ' rows read, ' +
      w.added +
      ' intervals added on ' +
      dates.join(', ') +
      ' (' +
      w.removed +
      ' replaced), ' +
      res.unparsed +
      ' unreadable rows. Statuses: ' +
      Object.keys(res.statuses).sort().join(', ') +
      (res.unmatched.length ? '. Names not on the roster: ' + res.unmatched.slice(0, 10).join(', ') : ''),
  }
}

// ---------------------------------------------------------------- flag analytics

/**
 * prodAggregateFlags_ verbatim: aggregates flag data for `date` into
 * prod_flag_analytics (keyed on date + agent_email). Returns
 * { rowsOut, date }, or { skipped } when the store is not set up.
 */
export function prodAggregateFlags_(env: JobEnv, date: string): { rowsOut?: number; date?: string; skipped?: string } {
  if (!prodReady_(env.cfg)) return { skipped: 'CC2 Productivity is not set up' }
  const flags = env.prodRows('prod_flags').filter((f) => String(f.date) === date)
  const byAgent: Record<
    string,
    { total: number; auto: number; min: number; cases: number; rawStatuses: Record<string, number>; suggestedStatuses: Record<string, number> }
  > = {}

  flags.forEach((f) => {
    const email = f.agent_email
    if (!byAgent[String(email)]) {
      byAgent[String(email)] = { total: 0, auto: 0, min: 0, cases: 0, rawStatuses: {}, suggestedStatuses: {} }
    }
    const a = byAgent[String(email)]
    a.total++
    if (f.decision === 'auto') a.auto++
    a.min += Number(f.flagged_min) || 0
    a.cases += Number(f.distinct_cases) || 0
    a.rawStatuses[String(f.raw_status)] = (a.rawStatuses[String(f.raw_status)] || 0) + 1
    a.suggestedStatuses[String(f.suggested_status)] = (a.suggestedStatuses[String(f.suggested_status)] || 0) + 1
  })

  const rows: Row[] = []
  Object.keys(byAgent).forEach((email) => {
    const data = byAgent[email]
    const mostRaw = Object.keys(data.rawStatuses).reduce((a, b) => (data.rawStatuses[a] > data.rawStatuses[b] ? a : b))
    const mostSuggested = Object.keys(data.suggestedStatuses).reduce((a, b) =>
      data.suggestedStatuses[a] > data.suggestedStatuses[b] ? a : b
    )
    rows.push({
      date,
      agent_email: email,
      total_flags: data.total,
      auto_accepted: data.auto,
      total_flagged_min: data.min,
      avg_cases_per_flag: data.total > 0 ? data.cases / data.total : 0,
      most_common_raw_status: mostRaw,
      most_common_suggested_status: mostSuggested,
    })
  })

  env.upsert('prod_flag_analytics', ['date', 'agent_email'], rows, null)
  return { rowsOut: rows.length, date }
}

// ---------------------------------------------------------------- shared steps

/** The 'prod_flags' step body: detect for `dates`, auto-accept pending flags in
 *  manual mode, refresh_log the counts. Also used by the flag-detection route. */
export async function prodFlagsStep_(env: JobEnv, dates: string[]): Promise<{ flagged: number; added: number; voided: number; cases?: number; intervals?: number }> {
  const t = Date.now()
  await env.ensureIntervals(dates)
  await env.ensureHeadcount()
  const det = prodDetectDates_(dates, await env.activityRows(), env as never)
  // Only call prodAutoAccept_ in manual mode (autoAccept = false)
  const autoAccept = prodSetting_(env.cfg, 'prod_flag_auto_accept')
  let auto: { rowsOut?: number } | null = null
  if (!autoAccept) auto = prodAutoAccept_(env as never)
  const note =
    'Dates ' +
    dates.join(', ') +
    ': ' +
    det.added +
    ' new flags' +
    (autoAccept ? ' auto-accepted' : '') +
    ', ' +
    det.voided +
    ' voided' +
    (auto && auto.rowsOut ? ', ' + auto.rowsOut + ' auto-accepted (pending).' : '.')
  env.logRun('prod_flags', t, 'ok', { rowsOut: det.added, note })
  return det
}

/** The 'prod_flag_analytics' step body. Also used by the analytics-aggregation route. */
export async function prodFlagAnalyticsStep_(env: JobEnv, dates: string[]): Promise<number> {
  const t = Date.now()
  let totalRows = 0
  for (const d of dates) totalRows += prodAggregateFlags_(env, d).rowsOut as number
  env.logRun('prod_flag_analytics', t, 'ok', { rowsOut: totalRows, note: dates.join(', ') })
  return totalRows
}

/** The 'productivity' step body: prodComputeDates_ over `dates` (layers + rollup).
 *  Also used by the daily-layers route. */
export async function prodComputeStep_(env: JobEnv, dates: string[]): Promise<number> {
  const t = Date.now()
  await env.prefetchMonthBooks(dates)
  const n = prodComputeDates_(dates, await env.activityRows(), env as never)
  env.logRun('productivity', t, 'ok', { rowsOut: n, note: dates.join(', ') })
  return n
}

/** The 'prod_tph_cases_rebuilt' step body. */
export async function prodTphCasesRebuiltStep_(env: JobEnv, dates: string[]): Promise<number> {
  const t = Date.now()
  await env.prefetchTables(['tickets', 'agg_inflow_hourly'])
  await env.prefetchWorkbook(String(dqSetting_(env.cfg, 'daily_report_ss_id')), DAILY_REPORT_TABS)
  const got = tphBuildCases_(dates, await env.activityRows(), undefined, env as never)
  const n = Object.keys(got).reduce((s, d) => s + Object.keys(got[d].cells).length, 0)
  const why = Object.keys(got)
    .map((d) => {
      const r = got[d].reasons
      return Object.keys(r)
        .map((c) => d + ' ' + c + ': ' + r[c])
        .join('; ')
    })
    .filter(Boolean)
  env.logRun('prod_tph_cases_rebuilt', t, 'ok', {
    rowsOut: n,
    note: dates.join(', ') + (why.length ? ' | ' + why.join(' | ') : ''),
  })
  return n
}

// ---------------------------------------------------------------- daily chain

/**
 * prodDailySteps_ verbatim, each legacy dqStep_ kept: snapshot -> flags ->
 * flag analytics -> productivity (layers) -> TPH touches -> TPH calls ->
 * TPH cases rebuilt. A step that throws is logged/beaten and the chain moves on.
 * Returns the per-step results for the route's response.
 */
export async function prodDailySteps_(env: JobEnv): Promise<Record<string, unknown>> {
  const started = Date.now()
  const out: Record<string, unknown> = {}
  out.mirror_sync = await dqStep_(env, 'mirror_sync', async () => {
    const t = Date.now()
    const results = await syncAllMirrors(env.cfg)
    const errors = Object.values(results).filter((r) => 'error' in r)
    const rows = Object.values(results).reduce((n, r) => n + ('written' in r ? r.written : 0), 0)
    env.logRun('mirror_sync', t, errors.length ? 'error' : 'ok', {
      rowsOut: rows,
      note: errors.length ? errors.map((r) => ('error' in r ? r.error : '')).join(' | ') : 'all mirrors ok',
    })
    return results
  })
  const snap = await dqStep_(env, 'prod_snapshot', () => prodSnapshotIntervals_(env))
  out.prod_snapshot = snap
  if (snap && !snap.skipped) env.logRun('prod_snapshot', started, 'ok', { rowsOut: snap.rowsOut, note: snap.note })
  const today = prodToday_(env.cfg, env.today)
  const recent = [dqAddDays_(today, -2), dqAddDays_(today, -1)]
  const detectDates = () =>
    (((snap && snap.dates) || []) as string[])
      .concat(recent)
      .filter((d, i, a) => a.indexOf(d) === i)
      .sort()

  out.prod_flags = await dqStep_(env, 'prod_flags', () => prodFlagsStep_(env, detectDates()))
  out.prod_flag_analytics = await dqStep_(env, 'prod_flag_analytics', () => prodFlagAnalyticsStep_(env, detectDates()))
  out.productivity = await dqStep_(env, 'productivity', () =>
    prodComputeStep_(
      env,
      recent
        .concat(prodReady_(env.cfg) ? env.takeDirty() : [])
        .filter((d, i, a) => a.indexOf(d) === i)
        .sort()
    )
  )

  out.prod_tph_touches = await dqStep_(env, 'prod_tph_touches', async () => {
    const t = Date.now()
    await env.ensureHeadcount()
    const n = tphBuildTouches_(recent, await env.activityRows(), env as never)
    env.logRun('prod_tph_touches', t, 'ok', { rowsOut: n, note: recent.join(', ') })
    return n
  })

  out.prod_tph_calls = await dqStep_(env, 'prod_tph_calls', async () => {
    const t = Date.now()
    await env.ensureHeadcount()
    await env.prefetchMonthBooks(recent)
    const n = tphBuildCallMinutes_(recent, env as never)
    env.logRun('prod_tph_calls', t, 'ok', { rowsOut: n, note: recent.join(', ') })
    return n
  })

  out.prod_tph_cases_rebuilt = await dqStep_(env, 'prod_tph_cases_rebuilt', () => prodTphCasesRebuiltStep_(env, recent))
  // Stores that failed to load (missing table, read error) are surfaced rather
  // than reading as honest empties — they make every dependent step compute zeros.
  const tableErrors = env.tableErrors || {}
  if (Object.keys(tableErrors).length) out.tableErrors = { ...tableErrors }
  return out
}

/** jobProductivityDaily verbatim: the trigger entry point. */
export async function jobProductivityDaily(env: JobEnv): Promise<Record<string, unknown>> {
  try {
    return await prodDailySteps_(env)
  } finally {
    await env.hbFlush()
  }
}
