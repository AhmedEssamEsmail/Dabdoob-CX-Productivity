/**
 * TlQueue.js (Queue_deprecated) ported: the scheduled TL queue-metrics job.
 * Maqsam call classes, texting/response times inside scheduled queue windows,
 * team KPI averages, Freshdesk area SLAs and the tlp_* / kpi_ol_cases rewrites.
 *
 * Datastore changes, following the WP-51 migration conventions
 * (desk-operations.ts):
 *   - the scheduler timeline is read from sched_plan (the saved plan the
 *     scheduler port persists) instead of calling schBuildFull_ each run;
 *   - Maqsam calls come from the maqsam_calls mirror (API sync, 7-cell
 *     D..J layout incl. fractional-day handling time) instead of the
 *     daily-report 'Maqsam' tab — dedupe is by dedupe_key, the mirror's
 *     row identity;
 *   - timestamptz columns take ISO strings (the sheet stored epoch-ms),
 *     tlp_queue_daily.windows stores the integer range count (the sheet
 *     stored the "09:30-17:00" range text), jsonb takes parsed values and
 *     '' lands as null on numeric columns;
 *   - tlp_team upserts key on (tl_email, month), the 014 unique — the
 *     sheet keyed on tl_email alone;
 *   - the operational_loss tracker migrated to storage_mode 'native'
 *     (WP-51): its live rows are read from tracker_records and rebuilt into
 *     the sheet-shaped grid tlqReadOlRows_ parses — the configured OL sheet
 *     is read only while the tracker stays external (the frozen copy).
 *
 * Texting stays verbatim: the Freshchat messages sheet (fc_messages_ss_id)
 * when it reads and parses, else the Freshdesk Activities log + tickets
 * first_responded_at — with the fd_activities mirror (the migrated copy of
 * the same tab) standing in when the Activities sheet cannot be read. A
 * missing workbook or credential lands in the run note ('Freshchat messages
 * sheet not read', 'Texting not read') and text_source '' — never fabricated
 * numbers.
 */

import 'server-only'

import { db, appendRow, readAllPaged, newId } from '@/features/shared/platform/repo'
import { configAll } from '@/features/shared/platform/settings'
import { isCxAgent_, requireJobCaller, requireRole } from '@/features/shared/platform/identity'
import { readStore } from '@/features/shared/platform/stores'
import { described } from '@/features/shared/lib/errors'
import { hbRun } from '@/features/shared/platform/health'
import { fetchWorkbookTabs, sheetBook } from '@/features/shared/jobs/sheets'
import { fdActivityCells_, maqsamCells_ } from '@/features/shared/jobs/mirror-cells'
import { dqMarkRun_ } from './jobs'
import type { TlsShift } from './index'
import { dqInList_, FD_TICKET_HEADERS } from './index'
import {
  dqAddDays_,
  dqParseTs_,
  dqSetting_,
  getConfig_,
  normEmail_,
  prodReadCols_,
  pwDirectory_,
  pwKwDate_,
  pwKwTime_,
  pwToday_,
  type Cfg,
  type Directory,
  type SheetBookLike,
} from '@/features/shared/lib/adapters'
import { SCH_TABLES } from './scheduler'
import { pwScoreMonths_, pwScoreOut_ } from '@/features/cx-people/lib/scorecard'
import { scIo_, scWho_ } from '@/features/cx-people/lib/scorecard-server'
import {
  kpiHiringDates_,
  kpiLeaveDates_,
  kpiLeaveIneligible_,
  kpiPayout_,
  kpiProbationMonth_,
  type KpiPayoutResult,
} from '@/features/cx-people/lib/kpi'

type Row = Record<string, unknown>

// =====================================================================
// Settings (TLQ_SETTINGS verbatim — TlSnapshots.js:79)
// =====================================================================

export const TLQ_SETTINGS: Record<string, { value: unknown }> = {
  tlp_call_serviced_states: { value: ['answered', 'completed'] },
  tlp_call_abandoned_states: { value: ['abandoned', 'missed', 'no-answer'] },
  tlp_texting_groups: { value: ['FreshChat'] },
  fc_messages_ss_id: { value: '1ZxDxS13pu0xXS3aPBfXxajtodwKIndaF0NOjZv6xacM' },
  fc_messages_tab: { value: 'Freshchat Messages (auto)' },
  fc_messages_tz: { value: 'Africa/Cairo' },
  tlp_area_sources: {
    value: {
      Refunds: { groups: ['Refunds - CX Group'], rule: 'due_by' },
      Returns: { contactTypes: ['return'], countries: ['KSA', 'Saudi'], excludeText: ['ajex'], rule: 'days', days: 4 },
      Complaints: { contactTypes: ['complain'], rule: 'same_day' },
    },
  },
  ol_sheet_id: { value: '12jVdX8CziY9sS_AVd1kZJEnRp82I3YFLXSCUuu_e5Uc' },
  ol_tab: { value: 'Sheet1' },
}

/** tlqSetting_: the stored config value, else the TLQ_SETTINGS default, else ''. */
export function tlqSetting_(cfg: Cfg, key: string): unknown {
  const d = TLQ_SETTINGS[key]
  return getConfig_(cfg, key, d ? d.value : '')
}

// =====================================================================
// Pure rules
// =====================================================================

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

/** tlqCol_ verbatim (TlSnapshots.js:101): index of the first header among the candidates. */
export function tlqCol_(header: unknown[], names: string[]): number {
  const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[\s_]+/g, '')
  const h = (header || []).map(norm)
  for (let i = 0; i < names.length; i++) {
    const j = h.indexOf(norm(names[i]))
    if (j !== -1) return j
  }
  return -1
}

export const TLQ_FC_COLS: Record<string, string[]> = {
  conv: ['conversation_id', 'conversation id', 'conversationid', 'conv_id'],
  time: ['created_time', 'message_time', 'created_at', 'sent_at', 'message created time', 'timestamp', 'time'],
  actor: ['actor_type', 'message_actor_type', 'sender_type', 'user_type', 'from_type', 'message_sender_type', 'actor'],
}

/**
 * tlqParseFcMessages_ verbatim: parses the Freshchat messages sheet defensively.
 * values: [header, ...rows]. Actor: 'agent' when the type says agent; 'customer' for
 * user / customer / contact / visitor; bots and system messages are ignored.
 */
export function tlqParseFcMessages_(values: unknown[][], tz: string, fromMs: number, toMs: number): { ok: boolean; header: string[]; missing: string[]; msgs: { conv: string; ms: number; actor: string }[] } {
  const header = (values[0] || []).map(String)
  const idx: Record<string, number> = {}
  const missing: string[] = []
  Object.keys(TLQ_FC_COLS).forEach((k) => {
    idx[k] = tlqCol_(header, TLQ_FC_COLS[k])
    if (idx[k] === -1) missing.push(k)
  })
  if (missing.length) return { ok: false, header, missing, msgs: [] }
  const msgs: { conv: string; ms: number; actor: string }[] = []
  for (let i = 1; i < values.length; i++) {
    const r = values[i]
    const t = dqParseTs_(r[idx.time], tz)
    if (!t || t.getTime() < fromMs || t.getTime() >= toMs || !r[idx.conv]) continue
    const a = String(r[idx.actor] || '').toLowerCase()
    const actor = /agent/.test(a) ? 'agent' : /user|customer|contact|visitor/.test(a) ? 'customer' : ''
    if (actor) msgs.push({ conv: String(r[idx.conv]), ms: t.getTime(), actor })
  }
  return { ok: true, header, missing: [], msgs }
}

/**
 * tlqReadCalls_' mirror equivalent: inbound calls from the maqsam_calls mirror —
 * [0] start ISO, [3] agent email, [4] state, [5] direction, [6] handling time in
 * fractional days (vendor-apis.ts maqsamCallToCols). Legacy deduped on the sheet's
 * call id; the mirror's dedupe_key is the row identity the same call lands under.
 */
export function tlqCallsFromMirrorRows_(rows: Row[], fromMs: number, toMs: number): { ms: number; state: string; handlingSec: number }[] {
  const seen: Record<string, boolean> = {}
  const out: { ms: number; state: string; handlingSec: number }[] = []
  ;(rows || []).forEach((r) => {
    const c = (Array.isArray(r.cols) ? r.cols : []) as unknown[]
    if (String(c[5] || '').toLowerCase() !== 'inbound') return
    const id = String(r.dedupe_key || '')
    if (id) {
      if (seen[id]) return
      seen[id] = true
    }
    const t = dqParseTs_(c[0], 'Africa/Cairo')
    if (!t || t.getTime() < fromMs || t.getTime() >= toMs) return
    out.push({ ms: t.getTime(), state: String(c[4] || ''), handlingSec: (Number(c[6]) || 0) * 86400 })
  })
  return out
}

/** The FD-Activities touches leg of tlqReadTexting_ verbatim: cols A..J after the header. */
export function tlqTextTouches_(rows: unknown[][], groups: unknown, tz: string, fromMs: number, toMs: number): { ms: number; ticketId: string }[] {
  const touches: { ms: number; ticketId: string }[] = []
  ;(rows || []).forEach((r) => {
    if (!r[1] || !dqInList_(r[8], groups as unknown[])) return
    const pt = String(r[3] || '').trim().toLowerCase()
    if (pt === 'contact' || pt === 'customer' || pt === 'requester') return
    const t = dqParseTs_(r[0], tz)
    if (t && t.getTime() >= fromMs && t.getTime() < toMs) touches.push({ ms: t.getTime(), ticketId: String(r[1]) })
  })
  return touches
}

/** The tickets first-response pairs leg of tlqReadTexting_ verbatim (dqReadLean_ pick + map + window filter). */
export function tlqTextPairs_(tickets: Row[], groups: unknown, fromMs: number, toMs: number): { startMs: number; endMs: number }[] {
  const since = new Date(fromMs - 86400000).toISOString().slice(0, 10)
  return (tickets || [])
    .filter((t) => String(t.created_at).slice(0, 10) >= since && dqInList_(t.group_name, groups as unknown[]))
    .map((t) => ({ startMs: Date.parse(String(t.created_at)), endMs: t.first_responded_at ? Date.parse(String(t.first_responded_at)) : NaN }))
    .filter((p) => p.startMs >= fromMs && p.startMs < toMs)
}

/** tlp_shifts row for one TlsShift, sheet-shaped (epoch-ms like the sheet wrote). */
export function tlqShiftRows_(shifts: TlsShift[], stamp: string): Row[] {
  return shifts.map((s) => ({
    key: s.date + '|' + s.tl, date: s.date, tl_email: s.tl,
    shift_start: s.startMs, shift_end: s.endMs,
    queue_json: JSON.stringify(s.queue.map((w) => [w.startMs, w.endMs])), updated_at: stamp,
  }))
}

/** tlp_queue_daily rows for the covered stat days, sheet-shaped (TlQueue.js:322-329). */
export function tlqStatRows_(stats: Record<string, Record<string, unknown>>, covered: Record<string, boolean>, textSource: string, stamp: string): Row[] {
  return Object.keys(stats)
    .filter((k) => covered[k.split('|')[1]])
    .map((k) => {
      const s = stats[k]
      const p = k.split('|')
      return {
        date: p[1], tl_email: p[0], windows: (s.windows as string[]).join(', '), queue_min: s.queue_min, calls_in: s.calls_in,
        calls_serviced: s.calls_serviced, calls_abandoned: s.calls_abandoned, calls_other: s.calls_other,
        answer_rate: s.answer_rate === null ? '' : s.answer_rate, text_touches: s.text_touches, text_tickets: s.text_tickets,
        resp_count: s.resp_count, resp_avg_min: s.resp_avg_min === null ? '' : s.resp_avg_min, resp_missing: s.resp_missing,
        text_source: textSource, computed_at: stamp,
      }
    })
}

/** tlqOlRows_ verbatim: current-month kpi_ol_cases — existing agents reset to 0, then current counts. */
export function tlqOlRows_(month: string, byEmail: Record<string, number>, existing: Row[], stamp: string): Row[] {
  const out: Record<string, number> = {}
  ;(existing || []).forEach((r) => {
    if (String(r.month).slice(0, 7) === month) out[normEmail_(r.email)] = 0
  })
  Object.keys(byEmail).forEach((e) => {
    out[e] = byEmail[e]
  })
  return Object.keys(out).map((e) => ({ key: month + '|' + e, month, email: e, cases: out[e], updated_at: stamp }))
}

/**
 * tlqReadOl_ verbatim with the sheet values injected: OL rows whose "Date of Loss" is in
 * the month, attributed by "Responsible Person" (name matched to the Roster, lower-cased).
 */
export function tlqReadOlRows_(values: unknown[][], month: string, dir: Directory): { byEmail: Record<string, number>; unmatched: string[] } {
  const head = values[0] || []
  const cDate = tlqCol_(head, ['Date of Loss'])
  const cWho = tlqCol_(head, ['Responsible Person'])
  if (cDate === -1 || cWho === -1) throw new Error('header has no "Date of Loss" / "Responsible Person": ' + head.join(' | '))
  const byName: Record<string, string> = {}
  Object.keys(dir.by).forEach((e) => {
    byName[String(dir.by[e].name).replace(/\s+/g, ' ').trim().toLowerCase()] = e
  })
  const byEmail: Record<string, number> = {}
  const unmatched: Record<string, boolean> = {}
  values.slice(1).forEach((r) => {
    const d = r[cDate] instanceof Date ? pwKwDate_((r[cDate] as Date).getTime()) : String(r[cDate] || '').slice(0, 10)
    const who = String(r[cWho] || '').replace(/\s+/g, ' ').trim()
    if (d.slice(0, 7) !== month || !who) return
    const e = byName[who.toLowerCase()] || (who.indexOf('@') !== -1 ? normEmail_(who) : '')
    if (e) byEmail[e] = (byEmail[e] || 0) + 1
    else unmatched[who] = true
  })
  return { byEmail, unmatched: Object.keys(unmatched) }
}

/** tlqExclusions_ verbatim: hand-excluded tickets (not removed) as 'area|ticket_id'. */
export function tlqExclusions_(rows: Row[]): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  ;(rows || []).forEach((r) => {
    if (!r.removed_at && r.ticket_id) out[String(r.area) + '|' + String(r.ticket_id).trim()] = true
  })
  return out
}

/**
 * tlqTeamRows_ verbatim: per TL, the team's raw averages and its KPI payout (mean of the
 * agents' totals) with the breakdown. month is the scorecard month object (rows per agent).
 */
export function tlqTeamRows_(
  dir: Directory,
  month: Parameters<typeof pwScoreOut_>[0],
  olByEmail: Record<string, number>,
  leaves: Record<string, string[]>,
  hiring: Record<string, unknown>,
  today: string,
  stamp: string
): Row[] {
  const mean = (v: unknown[]): unknown => {
    const vals = v.filter((x) => x !== null && x !== undefined && x !== '' && isFinite(Number(x)))
    return vals.length ? Math.round((vals.reduce((a: number, b) => a + Number(b), 0) / vals.length) * 10) / 10 : ''
  }
  return dir.tls().map((tl) => {
    const agents = dir.agentsOf(tl.email).filter((a) => isCxAgent_(a))
    const outs: Record<string, unknown>[] = []
    const kpis: KpiPayoutResult[] = []
    agents.forEach((a) => {
      const o = pwScoreOut_(month, a.email)
      if (!o) return
      outs.push(o)
      kpis.push(
        kpiPayout_({
          prod: o.prod, qual: o.qual, fcr: o.fcr, behaviorKnown: o.behaviorKnown, behaviorCases: o.behaviorCases,
          olCases: olByEmail[a.email] || 0, leaveIneligible: kpiLeaveIneligible_(leaves[a.email] || [], today),
          probationMonth: kpiProbationMonth_(hiring[a.email], month.month),
        })
      )
    })
    const scored = kpis.filter((k) => k.total !== null)
    const flag = (f: string) => kpis.filter((k) => k.flags.some((x) => x.indexOf(f) !== -1)).length
    return {
      tl_email: tl.email, month: month.month,
      quality: mean(outs.map((o) => o.qual)), fcr: mean(outs.map((o) => o.fcr)),
      productivity: mean(outs.map((o) => o.prod)), agents: agents.length,
      kpi_score: mean(scored.map((k) => k.total)), kpi_prod: mean(scored.map((k) => k.points.prod)),
      kpi_qual: mean(scored.map((k) => k.points.qual)), kpi_fcr: mean(scored.map((k) => k.points.fcr)),
      kpi_behavior: mean(scored.map((k) => k.points.behavior)),
      kpi_agents: scored.length, ol_agents: kpis.filter((k) => k.olDeduction).length,
      ineligible_agents: kpis.filter((k) => k.ineligible).length, red_zone: flag('red_zone'), action_plan: flag('action_plan'),
      probation_agents: kpis.filter((k) => k.probationMonth).length, partial_agents: kpis.filter((k) => k.incomplete).length,
      updated_at: stamp,
    }
  })
}

/**
 * tlqAreaRows_ verbatim with the reads injected: one row per (TL owning the area, area) —
 * % within the rule over the last 7 days. tickets are the dqReadLean_ picked rows
 * (created_at >= today-8); excluded the tlqExclusions_ set.
 */
export function tlqAreaRows_(sources: Record<string, unknown>, owners: Record<string, unknown>, tickets: Row[], excluded: Record<string, boolean>, today: string, stamp: string, nowMs: number): Row[] {
  const areas = Object.keys(sources)
  if (!areas.length) return []
  const from = dqAddDays_(today, -7)
  const rows: Row[] = []
  areas.forEach((area) => {
    const src = sources[area] as Record<string, unknown>
    const mine = (tickets || [])
      .filter((t) => tlqTicketMatches_(t, src) && !excluded[area + '|' + String(t.ticket_id)] && pwKwDate_(t.created_at) >= from)
      .map((t) => ({
        createdMs: Date.parse(String(t.created_at)),
        resolvedMs: t.resolved_at ? Date.parse(String(t.resolved_at)) : NaN,
        dueMs: t.due_by ? Date.parse(String(t.due_by)) : NaN,
      }))
    const r = tlqAreaSla_(mine, src as { rule: string; days?: number }, nowMs)
    Object.keys(owners).forEach((tl) => {
      if (([] as unknown[]).concat(owners[tl] as never[]).indexOf(area) === -1) return
      rows.push({
        key: normEmail_(tl) + '|' + area, tl_email: normEmail_(tl), area, from, to: today,
        pct: r.pct === null ? '' : r.pct, met: r.met, total: r.total,
        rule: String(src.rule || 'due_by') + (src.rule === 'days' ? ' ' + String(src.days) : ''), updated_at: stamp,
      })
    })
  })
  return rows
}

/**
 * Postgres shape for a verbatim (sheet-shaped) write row — the same conventions the
 * WP-51 migration transforms (desk-operations.ts) applied: epoch-ms -> ISO for the
 * timestamptz columns, the range text -> a count for the integer `windows`, '' -> null
 * on the numeric columns and queue_json parsed for jsonb.
 */
export function tlqDbRow_(table: string, r: Row): Row {
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : v)
  const out: Row = { ...r }
  if (table === 'tlp_shifts') {
    out.shift_start = num(r.shift_start) === null ? null : new Date(Number(r.shift_start)).toISOString()
    out.shift_end = num(r.shift_end) === null ? null : new Date(Number(r.shift_end)).toISOString()
    try {
      out.queue_json = typeof r.queue_json === 'string' ? JSON.parse(r.queue_json || '[]') : r.queue_json
    } catch {
      out.queue_json = null
    }
  } else if (table === 'tlp_queue_daily') {
    const w = String(r.windows ?? '').trim()
    out.windows = w ? w.split(',').map((p) => p.trim()).filter(Boolean).length : null // csvWindowCount_
    out.answer_rate = num(r.answer_rate)
    out.resp_avg_min = num(r.resp_avg_min)
  } else if (table === 'tlp_team') {
    ;['quality', 'fcr', 'productivity', 'kpi_score', 'kpi_prod', 'kpi_qual', 'kpi_fcr', 'kpi_behavior'].forEach((k) => {
      out[k] = num(out[k])
    })
  } else if (table === 'tlp_area_metrics') {
    out.pct = num(r.pct)
  }
  return out
}

// =====================================================================
// Readers (only in the job) and the io seam
// =====================================================================

export interface TlqTexting {
  source: string
  touches: { ms: number; ticketId: string }[]
  pairs: { startMs: number; endMs: number }[]
}

/** The reads/writes tlqBuild_ needs, injected for tests (the fakes pattern). */
export interface TlqIo {
  cfg: Cfg
  dir: Directory
  /** sched_plan rows for the given 'yyyy-MM' months (the saved scheduler timeline). */
  schedPlanRows(months: string[]): Promise<Row[]>
  /** maqsam_calls mirror rows overlapping [fromMs, toMs) (ts_ms windowed ±1 day). */
  maqsamRows(fromMs: number, toMs: number): Promise<Row[]>
  /** fd_activities mirror rows overlapping fromMs (ts_ms windowed ±1 day); cols = Activities A..J. */
  fdActivityRows(fromMs: number): Promise<Row[]>
  /** tracker_records rows for one tracker, row_n order (the native OL store). */
  trackerRecords(trackerId: string): Promise<Row[]>
  /** A prefetched workbook (fetchWorkbookTabs -> SheetBookLike); unfetched tabs read null. */
  book(id: string, tabs: string[]): Promise<SheetBookLike>
  /** dqReadLean_('tickets', ..., created_at >= since) picked rows. */
  ticketsSince(since: string): Promise<Row[]>
  /** dqReadObjects_(name, null, {missingOk:true}) rows. */
  storeRows(name: string): Promise<Row[]>
  /** pwScoreMonths_(today). */
  scores(today: string): Promise<Record<string, unknown>>
  /** dqUpsertIn_ — the production seam maps rows through tlqDbRow_ first. */
  upsert(table: string, keyFields: string[], rows: Row[]): Promise<void>
  nowMs(): number
}

/** The production TlqIo: Supabase tables, readStore stores and Sheets API workbooks. */
async function tlqIo_(): Promise<TlqIo> {
  const cfg = (await configAll()) as Cfg
  const dir = pwDirectory_((await readStore('roster')).rows, cfg.admin_emails)
  const books: Record<string, SheetBookLike> = {}
  return {
    cfg,
    dir,
    schedPlanRows: async (months) => {
      const { data, error } = await db().from(SCH_TABLES.plan).select('*').in('month', months)
      if (error) throw described(error, { table: SCH_TABLES.plan })
      return (data || []) as Row[]
    },
    maqsamRows: async (fromMs, toMs) => {
      const rows = (await readAllPaged('maqsam_calls', {
        columns: 'dedupe_key,ts_ms,started_at,ended_at,duration,agent_email,state,direction,handling',
        build: (q) => q.gte('ts_ms', fromMs - 86400000).lt('ts_ms', toMs + 86400000),
      })) as Row[]
      return rows.map((r) => ({ dedupe_key: r.dedupe_key, ts_ms: r.ts_ms, cols: maqsamCells_(r) }))
    },
    fdActivityRows: async (fromMs) => {
      const rows = (await readAllPaged('fd_activities', {
        columns: 'dedupe_key,ts_ms,performed_at,ticket_id,performer_name,performer_type,activity_type,field_changed,new_value,old_value,group_name',
        build: (q) => q.gte('ts_ms', fromMs - 86400000),
      })) as Row[]
      return rows.map((r) => ({ dedupe_key: r.dedupe_key, ts_ms: r.ts_ms, cols: fdActivityCells_(r) }))
    },
    trackerRecords: async (trackerId) => {
      const { data, error } = await db().from('tracker_records').select('*').eq('tracker_id', trackerId).order('row_n', { ascending: true })
      if (error) throw described(error, { table: 'tracker_records' })
      return (data || []) as Row[]
    },
    book: async (id, tabs) => {
      if (!books[id]) {
        const cells = await fetchWorkbookTabs(id, tabs)
        const sb = sheetBook(cells, id)
        // An empty grid is how fetchWorkbookTabs reports a missing tab — read it
        // like openSpreadsheet_ did: getSheetByName -> null ('no tab' note).
        books[id] = {
          getId: () => id,
          getSheetByName: (n) => (cells[n] && cells[n].length ? sb.getSheetByName(n) : null),
        }
      }
      return books[id]
    },
    ticketsSince: async (since) => {
      const { data, error } = await db().from('tickets').select(FD_TICKET_HEADERS.join(',')).gte('created_at', since)
      if (error) throw described(error, { table: 'tickets' })
      return (data || []) as unknown as Row[]
    },
    storeRows: async (name) => (await readStore(name)).rows,
    scores: async (today) => pwScoreMonths_(await scIo_(cfg), scWho_(dir), today) as Record<string, unknown>,
    upsert: async (table, keyFields, rows) => {
      if (!rows.length) return
      const { error } = await db()
        .from(table)
        .upsert(rows.map((r) => tlqDbRow_(table, r)), { onConflict: keyFields.join(',') })
      if (error) throw described(error, { table })
    },
    nowMs: () => Date.now(),
  }
}

/** tlqShifts_: shifts for `dates` from the saved sched_plan rows (the timeline equivalent). */
async function tlqShiftsDb_(io: TlqIo, dates: string[]): Promise<TlsShift[]> {
  const months = Array.from(new Set(dates.map((d) => d.slice(0, 7))))
  return tlqShiftsFromTimeline_(await io.schedPlanRows(months), dates)
}

/** tlqReadTexting_ verbatim: the Freshchat messages sheet when usable, else Freshdesk. */
export async function tlqReadTexting_(io: TlqIo, fromMs: number, toMs: number, notes: string[]): Promise<TlqTexting> {
  const cfg = io.cfg
  const ssId = String(tlqSetting_(cfg, 'fc_messages_ss_id') || '')
  if (ssId) {
    try {
      const sh = (await io.book(ssId, [String(tlqSetting_(cfg, 'fc_messages_tab'))])).getSheetByName(String(tlqSetting_(cfg, 'fc_messages_tab')))
      if (!sh) throw new Error('no tab "' + String(tlqSetting_(cfg, 'fc_messages_tab')) + '"')
      const last = sh.getLastRow()
      const width = sh.getLastColumn ? sh.getLastColumn() : 0
      const header = sh.getRange(1, 1, 1, width).getValues()
      // shortcut: reads the newest 40,000 rows (a few days of chats); move to a dated cursor if two days ever exceed that.
      const from = Math.max(2, last - 40000 + 1)
      const body = last >= 2 ? sh.getRange(from, 1, last - from + 1, width).getValues() : []
      const p = tlqParseFcMessages_(header.concat(body), String(tlqSetting_(cfg, 'fc_messages_tz')), fromMs, toMs)
      if (p.ok) {
        const pairs = tlqMessagePairs_(p.msgs)
        notes.push('Texting from Freshchat messages (' + p.msgs.length + ' messages).')
        return { source: 'freshchat', touches: pairs.touches, pairs: pairs.pairs }
      }
      notes.push('Freshchat messages sheet not usable, missing ' + p.missing.join(', ') + '. Its header: ' + p.header.join(' | '))
    } catch (e) {
      notes.push('Freshchat messages sheet not read: ' + (e as Error).message)
    }
  }
  const groups = tlqSetting_(cfg, 'tlp_texting_groups')
  const tz = String(dqSetting_(cfg, 'activity_local_tz'))
  let rows: unknown[][] = []
  try {
    rows = prodReadCols_(await io.book(String(dqSetting_(cfg, 'fd_activity_ss_id')), ['Activities']), 'Activities', 1, 10, 1)
  } catch (e) {
    // The fd_activities mirror is the migrated copy of the same tab — the
    // same A..J layout feeds the same parse (a real source, not a stand-in).
    notes.push('Freshdesk Activities sheet not read: ' + (e as Error).message)
    rows = (await io.fdActivityRows(fromMs)).map((r) => (Array.isArray(r.cols) ? r.cols : []))
  }
  const touches = tlqTextTouches_(rows, groups, tz, fromMs, toMs)
  const since = new Date(fromMs - 86400000).toISOString().slice(0, 10)
  const pairs = tlqTextPairs_(await io.ticketsSince(since), groups, fromMs, toMs)
  return { source: 'freshdesk', touches, pairs }
}

/**
 * nativeIo.lines shape for the OL tracker: [record_id, submitted_by, submitted_at, ...field
 * headers] then one row per record (row_n order). Date-typed field cells holding an ISO
 * instant become Dates so tlqReadOlRows_ takes its pwKwDate_ branch — the same Kuwait
 * date the sheet's real Date cell produced. Plain text ('yyyy-MM-dd' or a formatted
 * 'd/M/yyyy') stays text, exactly like a text cell in the sheet.
 */
export function tlqOlGridFromRecords_(
  tracker: Row,
  fields: { id: string; header: string; type: string }[],
  records: Row[]
): unknown[][] {
  const idH = String(tracker.record_id_header || 'record_id')
  const byH = String(tracker.submitted_by_header || 'submitted_by')
  const atH = String(tracker.submitted_at_header || 'submitted_at')
  const head: unknown[] = [idH, byH, atH].concat(fields.map((f) => f.header))
  const cell = (f: { id: string; type: string }, v: unknown): unknown => {
    if (v === null || v === undefined) return ''
    if (f.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v)
    return v
  }
  return [head].concat(
    records.map((r) =>
      [r.record_id, r.submitted_by, r.submitted_at ? new Date(String(r.submitted_at)) : '']
        .concat(fields.map((f) => cell(f, ((r.values || {}) as Row)[f.id])))
    )
  )
}

/**
 * tlqReadOl_ verbatim: the OL sheet values for the month, attributed to roster emails.
 * WP-51 flipped the operational_loss tracker to storage_mode 'native' — new rows land
 * in tracker_records and the configured sheet is the frozen pre-migration copy. The
 * live store wins when native (tlqOlGridFromRecords_ rebuilds the sheet-shaped grid);
 * an external/absent registry row keeps the sheet read.
 */
async function tlqReadOlDb_(io: TlqIo, month: string, dir: Directory): Promise<{ byEmail: Record<string, number>; unmatched: string[] }> {
  const cfg = io.cfg
  const t = (await io.storeRows('trackers')).filter((r) => String(r.tracker_id) === 'operational_loss')[0]
  if (t && String(t.storage_mode) === 'native') {
    const fields = (await io.storeRows('tracker_fields'))
      .filter((r) => String(r.tracker_id) === 'operational_loss' && r.active !== false && String(r.active).toLowerCase() !== 'false')
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((r) => ({ id: String(r.field_id), header: String(r.column_header || r.label), type: String(r.type || '') }))
    const values = tlqOlGridFromRecords_(t, fields, await io.trackerRecords('operational_loss'))
    return tlqReadOlRows_(values, month, dir)
  }
  const tab = String(tlqSetting_(cfg, 'ol_tab'))
  const sh = (await io.book(String(tlqSetting_(cfg, 'ol_sheet_id')), [tab])).getSheetByName(tab)
  if (!sh) throw new Error('no tab "' + tab + '"')
  const values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn ? sh.getLastColumn() : 1).getValues()
  return tlqReadOlRows_(values, month, dir)
}

/** tlqAreaRows_' reads: sources + owners + the lean ticket pick + the exclusions set. */
async function tlqAreaRowsDb_(io: TlqIo, today: string, stamp: string): Promise<Row[]> {
  const cfg = io.cfg
  const sources = (tlqSetting_(cfg, 'tlp_area_sources') || {}) as Record<string, unknown>
  const owners = (getConfig_(cfg, 'tlp_tl_areas', {}) || {}) as Record<string, unknown>
  if (!Object.keys(sources).length) return []
  const since = dqAddDays_(dqAddDays_(today, -7), -1)
  const tickets = await io.ticketsSince(since)
  const excluded = tlqExclusions_(await io.storeRows('tlp_ticket_exclusions'))
  return tlqAreaRows_(sources, owners, tickets, excluded, today, stamp, io.nowMs())
}

// =====================================================================
// The job
// =====================================================================

/** tlqBuild_ verbatim: builds every TL snapshot and returns the health-board note. */
export async function tlqBuild_(statDates?: string[] | null, io?: TlqIo): Promise<string> {
  const real = io || (await tlqIo_())
  const cfg = real.cfg
  const dir = real.dir
  const today = pwToday_(real.nowMs())
  statDates = statDates || [dqAddDays_(today, -1), today]
  const notes: string[] = []
  const stamp = new Date(real.nowMs()).toISOString()

  // 1. Shifts, today-14 .. today+2 plus the stat dates (mail deadlines look back 7 days, ahead to the next shift).
  const shiftDates: string[] = []
  for (let i = -14; i <= 2; i++) shiftDates.push(dqAddDays_(today, i))
  statDates.forEach((d) => {
    if (shiftDates.indexOf(d) === -1) shiftDates.push(d)
  })
  const shifts = await tlqShiftsDb_(real, shiftDates)
  const shiftRows = tlqShiftRows_(shifts, stamp)

  // 2. Queue-hour stats for the stat dates (a date the sources do not cover is left as it was).
  const statShifts = shifts.filter((s) => (statDates as string[]).indexOf(s.date) !== -1 && s.queue.length)
  let statRows: Row[] = []
  if (statShifts.length) {
    const fromMs = Math.min.apply(null, statShifts.map((s) => s.startMs))
    const toMs = Math.max.apply(null, statShifts.map((s) => s.endMs))
    const read = async <T>(label: string, fn: () => Promise<T>, dflt: T): Promise<T> => {
      try {
        return await fn()
      } catch (e) {
        notes.push(label + ' not read: ' + (e as Error).message)
        return dflt
      }
    }
    const calls = await read('Maqsam', async () => tlqCallsFromMirrorRows_(await real.maqsamRows(fromMs, toMs), fromMs, toMs), [] as { ms: number; state: string; handlingSec: number }[])
    const text = await read('Texting', async () => tlqReadTexting_(real, fromMs, toMs, notes), { source: '', touches: [], pairs: [] } as TlqTexting)
    const covered: Record<string, boolean> = {}
    ;[...calls, ...text.touches].forEach((x) => {
      covered[pwKwDate_(x.ms)] = true
    })
    const stats = tlqQueueStats_(statShifts, calls, text.touches, text.pairs, {
      serviced: tlqSetting_(cfg, 'tlp_call_serviced_states') as string[],
      abandoned: tlqSetting_(cfg, 'tlp_call_abandoned_states') as string[],
    })
    statRows = tlqStatRows_(stats, covered, text.source, stamp)
  }

  // 3. Team scores and team KPI payout per TL, this month (KpiPayout.js).
  let teamRows: Row[] = []
  let olRows: Row[] | undefined
  try {
    const scores = await real.scores(today)
    const month = String((scores.current as { month: unknown }).month)
    let ol = { byEmail: {} as Record<string, number>, unmatched: [] as string[] }
    let olRead = false
    try {
      ol = await tlqReadOlDb_(real, month, dir)
      olRead = true
      if (ol.unmatched.length) notes.push('OL names not on the Roster: ' + ol.unmatched.slice(0, 8).join(', '))
    } catch (e) {
      notes.push('Operational loss sheet not read: ' + (e as Error).message)
    }
    olRows = olRead ? tlqOlRows_(month, ol.byEmail, await real.storeRows('kpi_ol_cases'), stamp) : []
    teamRows = tlqTeamRows_(dir, scores.current as Parameters<typeof pwScoreOut_>[0], ol.byEmail, kpiLeaveDates_(await real.storeRows('kpi_leave_log')), kpiHiringDates_(await real.storeRows('roster')), today, stamp)
  } catch (e) {
    notes.push('Scorecard not read: ' + (e as Error).message)
  }

  // 4. Freshdesk SLA per responsibility area with a rule.
  let areaRows: Row[] = []
  try {
    areaRows = await tlqAreaRowsDb_(real, today, stamp)
  } catch (e) {
    notes.push('Area SLA not read: ' + (e as Error).message)
  }

  // 5. The single-writer block of TlQueue.js:350 (withLock_): the five upserts, in order.
  await real.upsert('tlp_shifts', ['key'], shiftRows)
  await real.upsert('tlp_queue_daily', ['date', 'tl_email'], statRows)
  // The DB unique is (tl_email, month) — the sheet keyed on tl_email alone.
  await real.upsert('tlp_team', ['tl_email', 'month'], teamRows)
  await real.upsert('kpi_ol_cases', ['key'], olRows || [])
  await real.upsert('tlp_area_metrics', ['key'], areaRows)

  const note =
    shiftRows.length + ' TL shifts, ' + statRows.length + ' TL-days of queue numbers, ' + teamRows.length + ' teams, ' +
    areaRows.length + ' area SLAs. ' + notes.join(' ')
  await appendRow(
    'refresh_log',
    {
      job: 'tl_queue_metrics', started_at: stamp, finished_at: new Date().toISOString(),
      rows_in: shifts.length, rows_out: shiftRows.length + statRows.length + teamRows.length + (olRows || []).length + areaRows.length,
      status: 'ok', error: '', note, log_id: newId('rl'), type: 'job',
    },
    'system:job'
  )
  return note
}

/** jobTlQueueMetrics verbatim (TlQueue.js:467): the hourly rebuild — hbRun_ + dqMarkRun_, {note}. */
export async function jobTlQueueMetrics(): Promise<Record<string, unknown>> {
  await requireJobCaller()
  return hbRun(
    'tl_queue_metrics',
    async () => {
      const n = await tlqBuild_()
      await dqMarkRun_('tl_queue_metrics')
      return { note: n }
    },
    (r) => r.note
  )
}

/**
 * rebuildTlQueueMetrics verbatim (TlQueue.js:474): rebuild queue numbers for the last
 * N days (default 14) in 7-day chunks, newest first. Admin-only like the editor entry.
 */
export async function rebuildTlQueueMetrics(days?: number): Promise<string> {
  await requireRole(['admin'])
  const n = Math.max(1, Math.min(62, Number(days) || 14))
  const today = pwToday_()
  const out: string[] = []
  for (let i = n - 1; i >= 0; i -= 7) {
    const chunk: string[] = []
    for (let j = i; j > i - 7 && j >= 0; j--) chunk.push(dqAddDays_(today, -j))
    out.push(await tlqBuild_(chunk))
  }
  return out.join('\n')
}

/** rebuildTlQueueMetrics legacy entry (the ?dates= rebuild the cron route calls). */
export async function rebuildTlQueueMetricsEntry(range: string | string[]): Promise<Record<string, unknown>> {
  const dates = Array.isArray(range) ? range : [String(range)]
  return { note: await tlqBuild_(dates) }
}

/** installTlQueueTrigger: schedules live in vercel.json/pg_cron — kept as a parity probe. */
export async function installTlQueueTrigger(): Promise<Record<string, unknown>> {
  return { note: 'Scheduled jobs are declared in vercel.json; nothing to install in the app.' }
}
