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
import { dqDateKey_, dqParseTs_, normEmail_, pwKwDate_, pwKwTime_, type Cfg } from '@/features/shared/lib/adapters'
import { dqInList_ } from './index'
import { SCH_TABLES } from './scheduler'

/** tlqAt_ verbatim: Kuwait wall-clock hour on a date key -> ms. */
export function tlqAt_(dateKey: string, hour: number): number {
  return Date.parse(dateKey + 'T00:00:00+03:00') + Math.round(hour * 60) * 60000
}

/**
 * tlqShiftsFromTimeline_ verbatim: scheduler timeline rows -> TlsShift[]. The plan works
 * in whole-hour slots with the first slot rounded up (09:30 -> 10:00), so a queue
 * segment at the row's first slot starts at the true shift start, and every segment
 * ends by the true shift end. segments_json / tl_email are the sched_plan column names.
 */
export function tlqShiftsFromTimeline_(rows: Record<string, unknown>[], dates: string[]): TlsShift[] {
  const want: Record<string, boolean> = {}
  ;(dates || []).forEach((d) => { want[d] = true })
  const out: TlsShift[] = []
  ;(rows || []).forEach((r) => {
    const date = String(r.date || '').slice(0, 10)
    const segs = (Array.isArray(r.segments_json) ? r.segments_json : r.segments) as Record<string, unknown>[] | undefined
    if (!want[date] || !segs || !segs.length || !(Number(r.to) > Number(r.from))) return
    const first = Math.min.apply(null, segs.map((s) => Number(s.from)))
    const queue: { startMs: number; endMs: number }[] = []
    segs.forEach((s) => {
      if (String(s.kind) !== 'queue') return
      const from = Number(s.from) === first ? Math.min(Number(s.from), Number(r.from)) : Number(s.from)
      const to = Math.min(Number(s.to), Number(r.to))
      if (to > from) queue.push({ startMs: tlqAt_(date, from), endMs: tlqAt_(date, to) })
    })
    out.push({ tl: normEmail_(r.tl ?? r.tl_email), date, startMs: tlqAt_(date, Number(r.from)), endMs: tlqAt_(date, Number(r.to)), queue })
  })
  return out
}

/** tlqCallClass_ verbatim: 'out' (Out Of Hours, left out) | 'serviced' | 'abandoned' | 'other'. */
export function tlqCallClass_(state: unknown, handlingSec: unknown, states: { serviced: string[]; abandoned: string[] }): string {
  const s = String(state || '').trim().toLowerCase()
  if (/out\s*of\s*hours/.test(s)) return 'out'
  if ((states.serviced || []).indexOf(s) !== -1 || Number(handlingSec) > 0) return 'serviced'
  if ((states.abandoned || []).indexOf(s) !== -1) return 'abandoned'
  return 'other'
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

/**
 * tlqMessagePairs_ verbatim: chat messages -> touches (agent messages) and response
 * pairs. A pair starts at the first customer message after the last agent message and
 * ends at the next agent message (endMs NaN when none yet).
 */
export function tlqMessagePairs_(msgs: { conv: string; ms: number; actor: string }[]): { touches: { ms: number; ticketId: string }[]; pairs: { startMs: number; endMs: number }[] } {
  const byConv: Record<string, { conv: string; ms: number; actor: string }[]> = {}
  msgs.forEach((m) => {
    ;(byConv[m.conv] = byConv[m.conv] || []).push(m)
  })
  const touches: { ms: number; ticketId: string }[] = []
  const pairs: { startMs: number; endMs: number }[] = []
  Object.keys(byConv).forEach((c) => {
    let pending: number | null = null
    byConv[c]
      .sort((a, b) => a.ms - b.ms)
      .forEach((m) => {
        if (m.actor === 'agent') {
          touches.push({ ms: m.ms, ticketId: c })
          if (pending !== null) {
            pairs.push({ startMs: pending, endMs: m.ms })
            pending = null
          }
        } else if (m.actor === 'customer' && pending === null) pending = m.ms
      })
    if (pending !== null) pairs.push({ startMs: pending, endMs: NaN })
  })
  return { touches, pairs }
}

/**
 * tlqQueueStats_ verbatim: per TL per day inside their queue windows.
 * calls: [{ ms, state, handlingSec }] (inbound); touches: [{ ms, ticketId }];
 * pairs: [{ startMs, endMs }]. Overlapping TLs both count shared hours.
 */
export function tlqQueueStats_(
  shifts: TlsShift[],
  calls: { ms: number; state: string; handlingSec: number }[],
  touches: { ms: number; ticketId: string }[],
  pairs: { startMs: number; endMs: number }[],
  states: { serviced: string[]; abandoned: string[] }
): Record<string, Record<string, unknown>> {
  const by: Record<string, Record<string, unknown>> = {}
  const dayWindows: Record<string, { startMs: number; endMs: number }[]> = {}
  shifts.forEach((s) => {
    ;(dayWindows[s.date] = dayWindows[s.date] || []).push.apply(dayWindows[s.date], s.queue)
  })
  shifts.forEach((s) => {
    if (!s.queue.length) return
    const st = (by[s.tl + '|' + s.date] = {
      queue_min: 0, windows: [] as string[], calls_in: 0, calls_serviced: 0, calls_abandoned: 0, calls_other: 0,
      text_touches: 0, ids: {} as Record<string, boolean>, resp_count: 0, resp_sum: 0, resp_missing: 0,
    })
    s.queue.forEach((w) => {
      st.queue_min = (st.queue_min as number) + Math.round((w.endMs - w.startMs) / 60000)
      ;(st.windows as string[]).push(pwKwTime_(w.startMs) + '-' + pwKwTime_(w.endMs))
      const inW = (ms: number) => ms >= w.startMs && ms < w.endMs
      ;(calls || []).forEach((c) => {
        if (!inW(c.ms)) return
        const cls = tlqCallClass_(c.state, c.handlingSec, states)
        if (cls === 'out') return
        st.calls_in = (st.calls_in as number) + 1
        ;(st as unknown as Record<string, number>)['calls_' + cls]++
      })
      ;(touches || []).forEach((t) => {
        if (inW(t.ms)) { st.text_touches = (st.text_touches as number) + 1; (st.ids as Record<string, boolean>)[t.ticketId] = true }
      })
      ;(pairs || []).forEach((p) => {
        if (!inW(p.startMs)) return
        if (isFinite(p.endMs) && p.endMs >= p.startMs) {
          st.resp_count = (st.resp_count as number) + 1
          st.resp_sum = (st.resp_sum as number) + tlqWorkingMinutes_(p.startMs, p.endMs, dayWindows[s.date])
        } else st.resp_missing = (st.resp_missing as number) + 1
      })
    })
  })
  Object.keys(by).forEach((k) => {
    const s = by[k]
    const decided = (s.calls_serviced as number) + (s.calls_abandoned as number)
    s.answer_rate = decided ? Math.round(((s.calls_serviced as number) / decided) * 1000) / 10 : null
    s.text_tickets = Object.keys(s.ids as Record<string, boolean>).length
    s.resp_avg_min = (s.resp_count as number) ? Math.round(((s.resp_sum as number) / (s.resp_count as number)) * 10) / 10 : null
    delete s.ids
    delete s.resp_sum
  })
  return by
}

/**
 * tlqAreaSla_ verbatim: % of tickets within the area's rule, among the decided ones.
 * tickets: [{ createdMs, resolvedMs, dueMs }] (NaN when missing).
 */
export function tlqAreaSla_(tickets: { createdMs: number; resolvedMs: number; dueMs: number }[], rule: { rule: string; days?: number }, nowMs: number): { met: number; total: number; pct: number | null } {
  let met = 0
  let total = 0
  tickets.forEach((t) => {
    const limit =
      rule.rule === 'same_day' ? tlqAt_(pwKwDate_(t.createdMs), 24)
      : rule.rule === 'days' ? t.createdMs + (Number(rule.days) || 1) * 86400000
      : t.dueMs
    if (!isFinite(limit)) return
    if (isFinite(t.resolvedMs)) {
      total++
      if (t.resolvedMs <= limit) met++
    } else if (nowMs > limit) total++
  })
  return { met, total, pct: total ? Math.round((met / total) * 1000) / 10 : null }
}

/** tlqTicketMatches_ verbatim: does a Tickets row belong to an area source? Pure. */
export function tlqTicketMatches_(t: Record<string, unknown>, src: Record<string, unknown>): boolean {
  const low = (v: unknown) => String(v || '').toLowerCase()
  const types = [t.contact_type_1, t.contact_type_2, t.contact_type_3].map(low)
  const has = (list: unknown, vals: string[]) =>
    ([] as unknown[]).concat(list as never[]).some((w) => {
      const wl = low(w)
      return vals.some((v) => v.indexOf(wl) !== -1)
    })
  if (src.groups && (src.groups as unknown[]).length && !dqInList_(t.group_name, src.groups as unknown[])) return false
  if (src.contactTypes && (src.contactTypes as unknown[]).length && !has(src.contactTypes, types)) return false
  if (src.countries && (src.countries as unknown[]).length && !has(src.countries, [low(t.country)])) return false
  if (src.excludeText && (src.excludeText as unknown[]).length && has(src.excludeText, types.concat([low(t.group_name), low(t.channel), low(t.source)]))) return false
  return true
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
  // Calls from the maqsam mirror: [callId, start, state, direction, country, handlingSec]
  // (jobs.ts mapping). Legacy keeps inbound rows raw and classifies inside tlqQueueStats_.
  let calls: { ms: number; state: string; handlingSec: number }[] = []
  try {
    const callsRows = (await readStore('maqsam_calls')).rows
    calls = callsRows.map((r) => {
      const c = (Array.isArray(r.cols) ? r.cols : []) as unknown[]
      const t = dqParseTs_(c[0], String(cfg.fc_messages_tz || 'Africa/Cairo'))
      if (String(c[3] || '').toLowerCase() !== 'inbound') return null
      return { ms: t ? t.getTime() : NaN, state: String(c[2] || ''), handlingSec: Number(c[5]) || 0 }
    }).filter((c): c is { ms: number; state: string; handlingSec: number } => !!c && isFinite(c.ms))
  } catch { /* no mirror */ }
  const statShifts = shifts.filter((s) => dates.indexOf(s.date) !== -1 && s.queue.length)
  const stats = tlqQueueStats_(statShifts, calls, [], [], {
    serviced: (cfg.tlp_call_serviced_states as string[]) || ['answered', 'completed'],
    abandoned: (cfg.tlp_call_abandoned_states as string[]) || ['abandoned', 'missed', 'no-answer'],
  })
  const dailyRows = Object.keys(stats).map((k) => {
    const [tl, date] = k.split('|')
    const st = stats[k]
    return { date, tl_email: tl, windows: (st.windows as string[]).length, queue_min: st.queue_min, calls_in: st.calls_in,
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
