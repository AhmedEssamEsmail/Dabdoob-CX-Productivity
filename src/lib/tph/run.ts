import { createAuthClient } from '@/lib/auth'
import { dqAddDays_ } from '@/lib/prod/adapters'
import { prodNowIso_, prodSetting_, prodToday_ } from '@/lib/prod/engine'
import { prodNameToEmail_ } from '@/lib/prod/adapters'
import {
  TPH_CALLS,
  TPH_HISTORY_DAYS,
  tphActIndex_,
  tphCallCases_,
  tphCallMinutesFromRows_,
  tphCasesPart_,
  tphChatCases_,
  tphHourMs_,
  tphMergeRebuilt_,
  tphTicketCases_,
  tphTid_,
  tphTouchesFromRows_,
} from './index'
import { tphChannels_, tphHours_, tphJson_, type TphStore } from './page'

/* ProdTph.js run side: tphPastDay_/tphActivityTail_/tphBuildTouches_/
   tphBuildCallMinutes_/tphBuildCases_/tphRunStep_ — the same four steps over the
   Supabase mirrors of the GAS stores (fd_activities rows = Activities sheet cols,
   tickets, prod_tph_*). dqLogRun_ → a refresh_log insert. */

export function tphPastDay_(store: TphStore, date: unknown): string {
  const d = String(date || '')
  const today = prodToday_(store.cfg)
  if (!/^\d{4}-\d\d-\d\d$/.test(d)) throw new Error('Pick a day (yyyy-MM-dd).')
  if (d >= today) throw new Error(`Rebuild runs on past days, not ${d}.`)
  if (d < dqAddDays_(today, -60)) throw new Error('That is more than 60 days ago.')
  return d
}

/** tphActivityTail_: fd_activities rows in the window, as 10-col row arrays. */
async function tphActivityTail_(store: TphStore, date: string, days: number): Promise<unknown[][]> {
  const supabase = await createAuthClient()
  const from = tphHourMs_(date, 0, 'Asia/Kuwait') - days * 86400000
  const { data, error } = await supabase
    .from('fd_activities')
    .select('cols')
    .gte('ts_ms', from)
    .order('ts_ms', { ascending: true })
    .limit(50000)
  if (error) throw new Error(error.message)
  return (data || []).map((r: { cols: unknown[] }) => r.cols)
}

async function dqLogRun_(job: string, t0: number, status: string, info: Record<string, unknown>) {
  try {
    const supabase = await createAuthClient()
    await supabase.from('refresh_log').insert({
      job,
      status,
      rows_out: info.rowsOut ?? null,
      note: String(info.note || info.error || ''),
      started_at: new Date(t0).toISOString(),
      finished_at: new Date().toISOString(),
    })
  } catch { /* logging must not break the step */ }
}

async function tphBuildTouches_(store: TphStore, dates: string[], activityRows: unknown[][]) {
  if (!dates.length) return 0
  const headcount = Object.values(store.dir.by).map((p) => ({ name: p.name, fdName: '', fdId: '', email: p.email }))
  const by = tphTouchesFromRows_(
    activityRows, dates, prodNameToEmail_(headcount), 'Asia/Kuwait',
    tphChannels_(store.cfg), 'Asia/Kuwait'
  ) as Record<string, unknown>
  const now = prodNowIso_()
  const supabase = await createAuthClient()
  await supabase.from('prod_tph_touches').upsert(
    dates.map((d) => ({ date: d, touches_json: JSON.stringify(by[d] || {}), computed_at: now })),
    { onConflict: 'date' }
  )
  return dates.length
}

/** tphBuildCallMinutes_ verbatim: Maqsam Calls rows per month -> prod_tph_calls. */
async function tphBuildCallMinutes_(store: TphStore, dates: string[]) {
  if (!dates.length) return 0
  const emails: Record<string, boolean> = {}
  Object.values(store.dir.by).forEach((p) => {
    if (p.email) emails[String(p.email).trim().toLowerCase()] = true
  })
  const months: Record<string, string[]> = {}
  dates.forEach((d) => {
    ;(months[d.slice(0, 7)] = months[d.slice(0, 7)] || []).push(d)
  })
  const by: Record<string, unknown> = {}
  const bizTz = 'Asia/Kuwait'
  const dataTz = 'Asia/Kuwait'
  const supabase = await createAuthClient()
  for (const m of Object.keys(months)) {
    const from = tphHourMs_(months[m].slice().sort()[0], 0, bizTz) - 86400000
    const { data } = await supabase.from('maqsam_calls').select('cols').gte('ts_ms', from).limit(50000)
    const rows = (data || []).map((r: { cols: unknown[] }) => r.cols)
    const got = tphCallMinutesFromRows_(
      rows, months[m], emails,
      ([] as unknown[]).concat((prodSetting_(store.cfg, 'tph_call_states') || []) as unknown[]),
      dataTz, bizTz, prodSetting_(store.cfg, 'tph_cap_window_min')
    ) as Record<string, unknown>
    Object.keys(got).forEach((d) => (by[d] = got[d]))
  }
  const now = prodNowIso_()
  await supabase.from('prod_tph_calls').upsert(
    dates.map((d) => ({ date: d, calls_json: JSON.stringify(by[d] || {}), computed_at: now })),
    { onConflict: 'date' }
  )
  return dates.length
}

/**
 * tphBuildCases_ verbatim: per channel the matching source (Freshchat tail for chats,
 * the ticket store + activities for ticket channels, agg_inflow_hourly for calls),
 * then the rebuilt row merged via tphMergeRebuilt_. Never touches 'tl' or 'auto' rows.
 */
async function tphBuildCases_(store: TphStore, dates: string[], activityRowsIn: unknown[][] | null, part: 'tickets' | 'chats') {
  if (!dates.length) return {}
  const bizTz = 'Asia/Kuwait'
  const dataTz = 'Asia/Kuwait'
  const channels = tphChannels_(store.cfg).filter((c) => tphCasesPart_(c, part))
  const hours = tphHours_(store.cfg)
  const low = (v: unknown) => String(v || '').trim().toLowerCase()
  const statuses = ([] as unknown[]).concat((prodSetting_(store.cfg, 'tph_ticket_statuses') || []) as unknown[]).map(low) as string[]
  const tch = channels.filter((c) => tphCasesPart_(c, 'tickets') && c.groups.length)
  const sorted = dates.slice().sort()
  const since = dqAddDays_(sorted[0], -1)
  const upto = dqAddDays_(sorted[sorted.length - 1], 1)
  let chats: unknown[][] | null = null
  let chatErr = ''
  if (channels.some((c) => c.kind === 'chat')) {
    try {
      const supabase = await createAuthClient()
      const histFrom = tphHourMs_(sorted[0], 0, bizTz) - TPH_HISTORY_DAYS * 86400000
      const { data } = await supabase.from('freshchat').select('cols').gte('ts_ms', histFrom).limit(50000)
      chats = (data || []).map((r: { cols: unknown[] }) => r.cols)
      if (!chats.length) chatErr = `Freshchat tab has no chats since ${dqAddDays_(sorted[0], -TPH_HISTORY_DAYS)}`
    } catch (e) {
      chatErr = `Freshchat tab could not be read: ${e instanceof Error ? e.message : String(e)}`
    }
  }
  const tickets: { ticket_id: unknown; status: unknown; group_name: unknown; created_at: unknown; resolved_at: unknown; closed_at: unknown }[] = []
  const storeDates: Record<string, boolean> = {}
  let act: ReturnType<typeof tphActIndex_> | null = null
  if (tch.length) {
    const activityRows = activityRowsIn || (await tphActivityTail_(store, sorted[0], TPH_HISTORY_DAYS))
    act = tphActIndex_(activityRows, 'Asia/Kuwait')
    const groups: Record<string, boolean> = {}
    const actIds: Record<string, boolean> = {}
    tch.forEach((c) => c.groups.forEach((g) => (groups[low(g)] = true)))
    const actIdx = act as NonNullable<typeof act>
    Object.keys(actIdx.byId).forEach((id) => {
      if (actIdx.byId[id].some((h: { group: string }) => groups[h.group])) actIds[id] = true
    })
    const supabase = await createAuthClient()
    const { data: tRows } = await supabase
      .from('tickets')
      .select('ticket_id, status, group_name, created_at, resolved_at, closed_at')
      .limit(100000)
    ;(tRows || []).forEach((o: { ticket_id: unknown; status: unknown; group_name: unknown; created_at: unknown; resolved_at: unknown; closed_at: unknown }) => {
      const c = String(o.created_at).slice(0, 10)
      if (!c || c > upto) return false
      if (c >= since) storeDates[c] = true
      let id = ''
      if (!groups[low(o.group_name)] && !actIds[(id = tphTid_(o.ticket_id))]) return false
      const done = [String(o.resolved_at || ''), String(o.closed_at || '')].filter(Boolean).sort()[0] || ''
      if (done && done.slice(0, 10) < since && !actIds[id || tphTid_(o.ticket_id)]) return false
      tickets.push(o)
      return false
    })
  }
  let calls: Record<string, unknown>[] | null = null
  if (channels.some((c) => c.key === TPH_CALLS)) {
    calls = []
    const supabase = await createAuthClient()
    const years = sorted.map((d) => d.slice(0, 4)).filter((y, i, a) => a.indexOf(y) === i)
    for (const y of years) {
      const { data } = await supabase.from('agg_inflow_hourly').select('*').eq('year', Number(y)).limit(50000)
      calls = calls.concat((data || []) as Record<string, unknown>[])
    }
  }
  const out: Record<string, { cells: Record<string, unknown>; reasons: Record<string, string> }> = {}
  sorted.forEach((d) => {
    const cells: Record<string, unknown> = {}
    const reasons: Record<string, string> = {}
    channels.forEach((c) => {
      let got: { cells: Record<number, { stock: number; new: number }> | null; reason: string }
      if (c.kind === 'chat')
        got = chats && chats.length ? tphChatCases_(chats, d, hours, dataTz, bizTz) : { cells: null, reason: chatErr || 'Freshchat tab is empty' }
      else if (c.key === TPH_CALLS) got = tphCallCases_(calls || [], d, hours)
      else if (c.groups.length)
        got = tphTicketCases_(tickets, act as never, d, hours, { groups: c.groups.map(low), statuses, dataTz, bizTz, storeHasDate: !!storeDates[d] })
      else got = { cells: null, reason: 'No Freshdesk groups set for this channel: enter its cases by hand' }
      if (got.reason) reasons[c.key] = got.reason
      if (got.cells) Object.keys(got.cells).forEach((h) => (cells[`${h}|${c.key}`] = (got.cells as never)[h]))
    })
    out[d] = { cells, reasons }
  })
  const keys = channels.map((c) => c.key)
  const now = prodNowIso_()
  const supabase = await createAuthClient()
  for (const d of sorted) {
    const prev = store.cases.filter((r) => r.date === d && r.source === 'rebuilt')[0]
    const have = tphJson_(prev?.cases_json, {})
    await supabase.from('prod_tph_cases').upsert(
      { date: d, source: 'rebuilt', cases_json: JSON.stringify(tphMergeRebuilt_(have, out[d], keys)), by: 'system', at: now },
      { onConflict: 'date,source' }
    )
  }
  return out
}

export async function tphRunStep_(
  store: TphStore,
  d: string,
  step: string,
  by: string
): Promise<Record<string, never> & { step: string; date: string; ms: number; touchCells?: number; casesRebuilt?: number; casesReasons?: Record<string, string> }> {
  const t = Date.now()
  const out: Record<string, unknown> = { step, date: d }
  let job = ''
  let n = 0
  try {
    if (step === 'touches') {
      job = 'prod_tph_touches'
      await tphBuildTouches_(store, [d], await tphActivityTail_(store, d, 1))
      const row = store.touches.filter((r) => r.date === d)[0]
      n = (out.touchCells = Object.keys(tphJson_(row?.touches_json, {}) as object).length) as number
    } else if (step === 'calls') {
      job = 'prod_tph_calls'
      n = await tphBuildCallMinutes_(store, [d])
    } else if (step === 'cases_chats' || step === 'cases_tickets') {
      job = 'prod_tph_cases_rebuilt'
      const got = (await tphBuildCases_(store, [d], null, step === 'cases_tickets' ? 'tickets' : 'chats'))[d] || {
        cells: {},
        reasons: {},
      }
      n = (out.casesRebuilt = Object.keys(got.cells).length) as number
      out.casesReasons = got.reasons
    } else {
      throw new Error(`Unknown TPH step ${step}.`)
    }
  } catch (e) {
    if (job) await dqLogRun_(job, t, 'error', { error: `${step} ${d}: ${e instanceof Error ? e.message : String(e)}` })
    throw e
  }
  out.ms = Date.now() - t
  await dqLogRun_(job, t, 'ok', { rowsOut: n, note: `TPH ${step} ${d} by ${by} in ${out.ms} ms` })
  return out as never
}
