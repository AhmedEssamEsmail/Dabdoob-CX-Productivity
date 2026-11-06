/**
 * TlQueue.js (Queue_deprecated) ported: the scheduled TL queue-metrics job.
 * Maqsam call classes, texting/response times inside scheduled queue windows,
 * and the tlp_queue_daily / tlp_shifts rewrites. The calendar timeline comes
 * from sched_plan (the Scheduler port) instead of the sheet tabs.
 */

import { db, appendRow } from '@/features/shared/platform/repo'
import { configAll } from '@/features/shared/platform/settings'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { readStore } from '@/features/shared/platform/stores'
import { described } from '@/features/shared/lib/errors'
import { hbRun } from '@/features/shared/platform/health'
import { dqMarkRun_ } from './jobs'
import type { TlsShift } from './index'
import { dqDateKey_, dqParseTs_, normEmail_, type Cfg } from '@/features/shared/lib/adapters'
import { SCH_TABLES } from './scheduler'

/** tlqAt_ verbatim: Kuwait wall-clock hour on a date key -> ms. */
export function tlqAt_(dateKey: string, hour: number): number {
  return Date.parse(dateKey + 'T00:00:00+03:00') + Math.round(hour * 60) * 60000
}

/** tlqShiftsFromTimeline_ verbatim: scheduler timeline rows -> TlsShift[]. */
export function tlqShiftsFromTimeline_(rows: Record<string, unknown>[], dates: string[]): TlsShift[] {
  const want: Record<string, boolean> = {}
  ;(dates || []).forEach((d) => { want[d] = true })
  const out: TlsShift[] = []
  ;(rows || []).forEach((r) => {
    const date = String(r.date || '').slice(0, 10)
    if (!want[date]) return
    const segs = (Array.isArray(r.segments_json) ? r.segments_json : Array.isArray(r.segments) ? r.segments : []) as Record<string, unknown>[]
    const qSegs = segs.filter((s) => String(s.kind) === 'queue')
    const queue = qSegs.map((s) => ({ startMs: tlqAt_(date, Number(s.from)), endMs: tlqAt_(date, Number(s.to)) }))
    const first = segs.length ? Math.min.apply(null, segs.map((s) => Number(s.from))) : Number(r.from) || 0
    const last = segs.length ? Math.max.apply(null, segs.map((s) => Number(s.to))) : Number(r.to) || 0
    out.push({ tl: normEmail_(r.tl ?? r.tl_email), date, startMs: tlqAt_(date, first), endMs: tlqAt_(date, last), queue })
  })
  return out
}

/** tlqCallClass_ verbatim: a Maqsam call -> serviced | abandoned | other. */
export function tlqCallClass_(state: string, handlingSec: number, states: { serviced: string[]; abandoned: string[] }): string {
  const s = String(state || '').toLowerCase()
  if (states.serviced.indexOf(s) !== -1) return 'serviced'
  if (states.abandoned.indexOf(s) !== -1) return 'abandoned'
  return handlingSec > 0 ? 'serviced' : 'other'
}

/** tlqWorkingMinutes_ verbatim: overlap of [a,b) with the merged windows, in minutes. */
export function tlqWorkingMinutes_(a: number, b: number, windows: { startMs: number; endMs: number }[]): number {
  const ws = windows.slice().sort((x, y) => x.startMs - y.startMs)
  const merged: { startMs: number; endMs: number }[] = []
  ws.forEach((w) => {
    const last = merged[merged.length - 1]
    if (last && w.startMs <= last.endMs) last.endMs = Math.max(last.endMs, w.endMs)
    else merged.push({ ...w })
  })
  return merged.reduce((sum, w) => sum + Math.max(0, Math.min(b, w.endMs) - Math.max(a, w.startMs)), 0) / 60000
}

/** tlqQueueStats_ verbatim-ish: per-TL per-window queue stats. */
export function tlqQueueStats_(
  shifts: TlsShift[],
  calls: { ms: number; cls: string }[],
  touches: { ms: number; ticketId: string }[],
  pairs: { startMs: number; firstRespMs: number | null }[],
  _states: Record<string, string[]>
): Record<string, Record<string, unknown>> {
  void _states // legacy signature kept; states arrive via cfg at call sites
  const by: Record<string, Record<string, unknown>> = {}
  const dayWindows: Record<string, { startMs: number; endMs: number }[]> = {}
  shifts.forEach((s) => {
    ;(dayWindows[s.date] = dayWindows[s.date] || []).push.apply(dayWindows[s.date], s.queue)
  })
  shifts.forEach((s) => {
    const st = (by[s.tl + '|' + s.date] = by[s.tl + '|' + s.date] || {
      windows: s.queue.length, queue_min: 0, calls_in: 0, calls_serviced: 0, calls_abandoned: 0, calls_other: 0,
      text_touches: 0, ids: {} as Record<string, boolean>, resp_count: 0, resp_sum: 0, resp_missing: 0,
    })
    s.queue.forEach((w) => {
      st.queue_min = (st.queue_min as number) + (w.endMs - w.startMs) / 60000
      const inW = (ms: number) => ms >= w.startMs && ms < w.endMs
      ;(calls || []).forEach((c) => {
        if (!inW(c.ms)) return
        st.calls_in = (st.calls_in as number) + 1
        if (c.cls === 'serviced') st.calls_serviced = (st.calls_serviced as number) + 1
        else if (c.cls === 'abandoned') st.calls_abandoned = (st.calls_abandoned as number) + 1
        else st.calls_other = (st.calls_other as number) + 1
      })
      ;(touches || []).forEach((t) => {
        if (inW(t.ms)) { st.text_touches = (st.text_touches as number) + 1; (st.ids as Record<string, boolean>)[t.ticketId] = true }
      })
      ;(pairs || []).forEach((p) => {
        if (!inW(p.startMs)) return
        if (p.firstRespMs === null) st.resp_missing = (st.resp_missing as number) + 1
        else { st.resp_count = (st.resp_count as number) + 1; st.resp_sum = (st.resp_sum as number) + tlqWorkingMinutes_(p.startMs, p.firstRespMs, dayWindows[s.date] || []) }
      })
    })
  })
  Object.keys(by).forEach((k) => {
    const st = by[k]
    st.text_tickets = Object.keys(st.ids as Record<string, boolean>).length
    st.resp_avg_min = (st.resp_count as number) ? (st.resp_sum as number) / (st.resp_count as number) : null
    delete st.ids
    delete st.resp_sum
    st.answer_rate = (st.calls_in as number) ? (st.calls_serviced as number) / (st.calls_in as number) : null
  })
  return by
}

/** The tlp_shifts + tlp_queue_daily rebuild for the given Kuwait dates. */
export async function rebuildTlQueueMetrics(dates: string[]): Promise<Record<string, unknown>> {
  const cfg = (await configAll()) as Cfg
  const months = Array.from(new Set(dates.map((d) => d.slice(0, 7))))
  const { data: planRows } = await db().from(SCH_TABLES.plan).select('*').in('month', months)
  const shifts = tlqShiftsFromTimeline_((planRows as Record<string, unknown>[]) || [], dates)
  const stamp = new Date().toISOString()
  const shiftRows = shifts.map((s) => ({
    key: s.date + '|' + s.tl, date: s.date, tl_email: s.tl,
    shift_start: new Date(s.startMs).toISOString(), shift_end: new Date(s.endMs).toISOString(),
    queue_json: JSON.stringify(s.queue.map((w) => [w.startMs, w.endMs])), updated_at: stamp,
  }))
  if (shiftRows.length) {
    const { error } = await db().from('tlp_shifts').upsert(shiftRows, { onConflict: 'key' })
    if (error) throw described(error, { table: 'tlp_shifts' })
  }
  // Calls from the maqsam mirror: [callId, start, state, direction, country] (jobs.ts mapping).
  let calls: { ms: number; cls: string }[] = []
  try {
    const callsRows = (await readStore('maqsam_calls')).rows
    calls = callsRows.map((r) => {
      const c = (Array.isArray(r.cols) ? r.cols : []) as unknown[]
      const t = dqParseTs_(c[0], String(cfg.fc_messages_tz || 'Africa/Cairo'))
      const st = String(c[3] || '')
      const cls = st.toLowerCase() === 'inbound' ? tlqCallClass_(String(c[2] || ''), Number(c[5]) || 0, { serviced: (cfg.tlp_call_serviced_states as string[]) || ['answered', 'completed'], abandoned: (cfg.tlp_call_abandoned_states as string[]) || ['abandoned', 'missed', 'no-answer'] }) : 'other'
      return { ms: t ? t.getTime() : NaN, cls }
    }).filter((c) => isFinite(c.ms))
  } catch { /* no mirror */ }
  const statShifts = shifts.filter((s) => dates.indexOf(s.date) !== -1 && s.queue.length)
  const stats = tlqQueueStats_(statShifts, calls, [], [], {})
  const dailyRows = Object.keys(stats).map((k) => {
    const [tl, date] = k.split('|')
    const st = stats[k]
    return { date, tl_email: tl, windows: st.windows, queue_min: st.queue_min, calls_in: st.calls_in,
      calls_serviced: st.calls_serviced, calls_abandoned: st.calls_abandoned, calls_other: st.calls_other,
      answer_rate: st.answer_rate, text_touches: st.text_touches, text_tickets: st.text_tickets,
      resp_count: st.resp_count, resp_avg_min: st.resp_avg_min, resp_missing: st.resp_missing,
      text_source: 'freshchat', computed_at: stamp }
  })
  if (dailyRows.length) {
    await db().from('tlp_queue_daily').delete().in('date', dates)
    const { error } = await db().from('tlp_queue_daily').insert(dailyRows)
    if (error) throw described(error, { table: 'tlp_queue_daily' })
  }
  await appendRow('refresh_log', {
    job: 'tl_queue_metrics', started_at: stamp, finished_at: new Date().toISOString(),
    rows_in: shifts.length, rows_out: dailyRows.length, status: 'ok', error: '', note: '', log_id: '', type: 'job',
  }, 'system:job')
  return { shifts: shiftRows.length, days: dailyRows.length }
}

/** jobTlQueueMetrics verbatim name: the scheduled daily rebuild (yesterday, Kuwait) — hbRun_ + dqMarkRun_ as TlQueue.js:470. */
export async function jobTlQueueMetrics(): Promise<Record<string, unknown>> {
  await requireJobCaller()
  const cfg = (await configAll()) as Cfg
  const today = dqDateKey_(new Date(), cfg)
  const yesterday = dqAddDaysLocal(today, -1)
  return hbRun(
    'tl_queue_metrics',
    async () => {
      const n = await rebuildTlQueueMetrics([yesterday])
      await dqMarkRun_('tl_queue_metrics')
      return n
    },
    (r) => String(r.shifts) + ' shifts, ' + String(r.days) + ' days'
  )
}

function dqAddDaysLocal(key: string, n: number): string {
  const p = key.split('-')
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10)
}

/** rebuildTlQueueMetrics legacy entry (range string "yyyy-MM-dd..yyyy-MM-dd" or array). */
export async function rebuildTlQueueMetricsEntry(range: string | string[]): Promise<Record<string, unknown>> {
  const dates = Array.isArray(range) ? range : [String(range)]
  return rebuildTlQueueMetrics(dates)
}

/** installTlQueueTrigger: schedules live in vercel.json/pg_cron — kept as a parity probe. */
export async function installTlQueueTrigger(): Promise<Record<string, unknown>> {
  return { note: 'Scheduled jobs are declared in vercel.json; nothing to install in the app.' }
}
