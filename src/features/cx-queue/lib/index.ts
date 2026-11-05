/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/**
 * QueueCore.js + TlSnapshots.js pure parts ported 1:1 — the shared queue/aging/check-in
 * readers and the TL snapshot rules. Store reads (tables, the data spreadsheet, Config)
 * arrive as injected rows/cfg; names keep the trailing underscore.
 */

import {
  dqAddDays_,
  dqDateKey_,
  dqKeyPart_,
  dqSetting_,
  dqWallToUtc_,
  formatDate_,
  getConfig_,
  normEmail_,
  type Cfg,
  type SheetBookLike,
} from '@/features/shared/lib/adapters'

// ---------------------------------------------------------------- QueueCore.js

// Live Postgres table names (migration 003 owns the stores; the legacy sheet
// tabs were `aging_flags` / `queue_status_submissions`).
export const DQ_FLAGS_TABLE = 'dq_aging_flags'
export const DQ_FLAGS_HEADERS = [
  'flag_id', 'ticket_id', 'note', 'tl_email', 'resolved_at', 'resolved_by', 'resolved_note',
  'submitted_by', 'submitted_at',
]
export const DQ_SUBMISSIONS_TABLE = 'queue_submissions'
export const DQ_SUBMISSIONS_HEADERS = [
  'submission_id', 'slot_date', 'slot', 'snapshot_key', 'status', 'queues_json',
  'corrections_json', 'correction_reason', 'general_note', 'help_needed', 'help_note',
  'submitted_by', 'submitted_at', 'updated_by', 'updated_at',
]
export const DQ_CHANNELS = ['call', 'chat', 'escalation']
export const FD_TICKET_HEADERS = [
  'ticket_id', 'status', 'group_name', 'responder_id', 'requester_id', 'channel', 'country',
  'contact_type_1', 'created_at', 'updated_at', 'resolved_at', 'closed_at',
  'status_code', 'group_id', 'source', 'contact_type_2', 'contact_type_3', 'priority', 'is_escalated',
  'first_responded_at', 'status_updated_at', 'due_by', 'fr_due_by', 'synced_at',
]

export function dqNum_(v: unknown): number {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

/** dqPeopleIndex_: Freshdesk user id -> agent, and agent email -> TL, from Headcount. */
export function dqPeopleIndex_(
  headcount: { fdId?: unknown; email: string; name?: string; fdName?: string; tlEmail?: string; tlName?: string }[],
  cfg: Cfg
): {
  byFdId: Record<string, { email: string; name: string; tlEmail?: string; tlName?: string }>
  byEmail: Record<string, { email: string; name: string; tlEmail?: string; tlName?: string }>
  cxIds: Record<string, boolean>
} {
  const byFdId: Record<string, { email: string; name: string; tlEmail?: string; tlName?: string }> = {}
  const byEmail: Record<string, { email: string; name: string; tlEmail?: string; tlName?: string }> = {}
  headcount.forEach((h) => {
    const p = { email: h.email, name: h.name || h.fdName || h.email, tlEmail: h.tlEmail, tlName: h.tlName }
    if (h.fdId) byFdId[String(h.fdId)] = p
    byEmail[h.email] = p
  })
  const cxIds: Record<string, boolean> = {}
  headcount.forEach((h) => {
    if (h.fdId) cxIds[String(h.fdId)] = true
  })
  ;((dqSetting_(cfg, 'cx_freshdesk_ids_extra') as unknown[]) || []).forEach((id) => {
    cxIds[String(id)] = true
  })
  return { byFdId, byEmail, cxIds }
}

/** dqWithCurrentTl_: aging rows re-stamped with tl_email / tl_name from the roster as it is now. */
export function dqWithCurrentTl_(
  rows: Record<string, unknown>[],
  rosterRows: Record<string, unknown>[] | null
): Record<string, unknown>[] {
  if (rosterRows === null) return rows // no Roster tab
  const tlOf: Record<string, string> = {}
  const nameOf: Record<string, string> = {}
  rosterRows.forEach((r) => {
    const e = normEmail_(r.email)
    if (!e) return
    tlOf[e] = normEmail_(r.tl_email)
    nameOf[e] = String(r.name || '')
  })
  return rows.map((r) => {
    const a = normEmail_(r.agent_email)
    if (!a || !(a in tlOf) || tlOf[a] === normEmail_(r.tl_email)) return r
    const c: Record<string, unknown> = {}
    Object.keys(r).forEach((k) => {
      c[k] = r[k]
    })
    c.tl_email = tlOf[a]
    c.tl_name = nameOf[tlOf[a]] || ''
    return c
  })
}

export interface DqAgingFlagOut {
  flagId: string
  ticketId: string
  note: string
  tlEmail: string
  by: string
  at: string
}

/**
 * dqOpenAgingFlags_: open flags whose ticket is still on the aging board.
 * flagRows = the dq_aging_flags rows (null = no store, []); agingRows = the
 * aging rows already read (the onBoard set).
 */
export function dqOpenAgingFlags_(
  flagRows: Record<string, unknown>[] | null,
  agingRows: Record<string, unknown>[]
): DqAgingFlagOut[] {
  if (flagRows === null) return []
  const onBoard: Record<string, boolean> = {}
  ;(agingRows || []).forEach((r) => {
    onBoard[String(r.ticket_id)] = true
  })
  return flagRows
    .filter((f) => !f.resolved_at && onBoard[String(f.ticket_id)])
    .map((f) => ({
      flagId: String(f.flag_id),
      ticketId: String(f.ticket_id),
      note: String(f.note || ''),
      tlEmail: normEmail_(f.tl_email),
      by: normEmail_(f.submitted_by),
      at: String(f.submitted_at || ''),
    }))
}

/** The client shape of one open flag (the dqOpenAgingFlags_ mapper, without the board filter). */
export function dqAgingFlagOut_(f: Record<string, unknown>): DqAgingFlagOut {
  return {
    flagId: String(f.flag_id),
    ticketId: String(f.ticket_id),
    note: String(f.note || ''),
    tlEmail: normEmail_(f.tl_email),
    by: normEmail_(f.submitted_by),
    at: String(f.submitted_at || ''),
  }
}

/** dqSubmissionsFor_: submissions of the given slot_dates (readTable_ output injected). */
export function dqSubmissionsFor_(
  submissionRows: Record<string, unknown>[] | null,
  dateKeys: string[]
): Record<string, unknown>[] {
  if (submissionRows === null) return [] // no submissions tab
  return submissionRows
    .map((r) => {
      const c = { ...r }
      c.slot_date = dqKeyPart_('slot_date', c.slot_date).slice(0, 10)
      c.slot = String(c.slot)
      return c
    })
    .filter((r) => dateKeys.indexOf(String(r.slot_date)) !== -1)
}

/** dqSlotState_: done / upcoming / due / missed for one checkpoint. */
export function dqSlotState_(
  cp: { opensAt: Date; dueAt: Date },
  sub: unknown,
  now: Date | number
): 'done' | 'upcoming' | 'due' | 'missed' {
  if (sub) return 'done'
  const t = now instanceof Date ? now.getTime() : now
  if (t < cp.opensAt.getTime()) return 'upcoming'
  if (t <= cp.dueAt.getTime()) return 'due'
  return 'missed'
}

/**
 * dqCheckpoints_: the check-in slots of one business date with their instants.
 * at: the slot; readAfter: earliest snapshot read; opensAt / dueAt: form window.
 */
export function dqCheckpoints_(
  dateKey: string,
  cfg: Cfg
): { slot: string; name: string; date: string; at: Date; readAfter: Date; opensAt: Date; dueAt: Date; key: string }[] {
  const tz = String(dqSetting_(cfg, 'business_tz'))
  const slots = dqSetting_(cfg, 'checkin_slots') as unknown[]
  const names = (dqSetting_(cfg, 'checkin_slot_names') || {}) as Record<string, string>
  const delay = Number(dqSetting_(cfg, 'checkin_read_delay_min'))
  const openBefore = Number(dqSetting_(cfg, 'checkin_open_before_min'))
  const dueAfter = Number(dqSetting_(cfg, 'checkin_due_after_min'))
  const p = dateKey.split('-')
  return slots.map((slot) => {
    const hm = String(slot).split(':')
    const at = dqWallToUtc_(+p[0], +p[1], +p[2], +hm[0], +hm[1], 0, tz)
    return {
      slot: String(slot),
      name: names[String(slot)] || String(slot),
      date: dateKey,
      at,
      readAfter: new Date(at.getTime() + delay * 60000),
      opensAt: new Date(at.getTime() - openBefore * 60000),
      dueAt: new Date(at.getTime() + dueAfter * 60000),
      key: dateKey + '|' + slot,
    }
  })
}

/** dqSlotsToday_: today's slot states with submitters (submissions injected). */
export function dqSlotsToday_(
  now: Date | number,
  cfg: Cfg,
  submissionRows: Record<string, unknown>[] | null
): { slot: string; name: string; at: string; dueAt: string; state: string; submittedBy: string; submittedAt: string }[] {
  const today = dqDateKey_(now instanceof Date ? now : new Date(now), cfg)
  const subs = dqSubmissionsFor_(submissionRows, [today])
  const by: Record<string, Record<string, unknown>> = {}
  subs.forEach((s) => {
    by[String(s.slot)] = s
  })
  return dqCheckpoints_(today, cfg).map((cp) => {
    const s = by[cp.slot]
    return {
      slot: cp.slot,
      name: cp.name,
      at: cp.at.toISOString(),
      dueAt: cp.dueAt.toISOString(),
      state: dqSlotState_(cp, s, now),
      submittedBy: s ? String(s.submitted_by) : '',
      submittedAt: s ? String(s.submitted_at) : '',
    }
  })
}

/** dqBandInfo_. */
export function dqBandInfo_(cfg: Cfg): { edges: unknown; labels: string[] } {
  const edges = dqSetting_(cfg, 'aging_bands_h')
  return { edges, labels: dqBandLabels_(edges as number[]) }
}

/** dqWeekStart_: Sunday that starts the week containing key (week starts Sunday). */
export function dqWeekStart_(key: string): string {
  const p = key.split('-')
  const dow = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()
  return dqAddDays_(key, -dow)
}

/** dqBandLabels_: "4-12 h", "12-24 h", "1-2 d", ..., "10 d and over". */
export function dqBandLabels_(edges: number[]): string[] {
  const inDays = (h: number) => h >= 24 && h % 24 === 0
  const out = ['Under ' + edges[0] + ' h']
  for (let i = 1; i < edges.length; i++) {
    const a = edges[i - 1]
    const b = edges[i]
    out.push(inDays(a) && inDays(b) ? a / 24 + '-' + b / 24 + ' d' : a + '-' + b + ' h')
  }
  const top = edges[edges.length - 1]
  out.push((inDays(top) ? top / 24 + ' d' : top + ' h') + ' and over')
  return out
}

export function dqHuman_(h: number): string {
  if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min'
  if (h < 24) return Math.floor(h) + ' h'
  return Math.floor(h / 24) + ' d ' + Math.floor(h % 24) + ' h'
}

/** dqReadSource_: columns [firstCol, firstCol+nCols) below the header of one tab. */
export function dqReadSource_(
  ss: SheetBookLike,
  tab: string,
  firstCol: number,
  nCols: number
): unknown[][] {
  const sh = ss.getSheetByName(tab)
  if (!sh || sh.getLastRow() < 2) return []
  return sh.getRange(2, firstCol, sh.getLastRow() - 1, nCols).getValues()
}

/** dqJson_: parse stored JSON; objects pass through; fallback on blank/invalid. */
export function dqJson_<T>(s: unknown, fallback: T): T {
  if (s && typeof s === 'object') return s as T
  try {
    return s ? JSON.parse(String(s)) : fallback
  } catch {
    return fallback
  }
}

/** dqBandCounts_: bands_json, else the old b0..b4 columns, padded to the band count. */
export function dqBandCounts_(q: Record<string, unknown>, cfg: Cfg): number[] {
  const n = (dqSetting_(cfg, 'aging_bands_h') as unknown[]).length + 1
  let arr = dqJson_<unknown>(q.bands_json, null)
  if (!Array.isArray(arr)) arr = [q.b0, q.b1, q.b2, q.b3, q.b4]
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(dqNum_((arr as unknown[])[i]))
  return out
}

/** dqSortQueues_: our CX queues first, then other teams; busiest first within each. */
export function dqSortQueues_<T extends { ours: unknown; open: number }>(views: T[]): T[] {
  return views.sort((a, b) => (Number(b.ours) - Number(a.ours)) || b.open - a.open)
}

/** dqQueueView_ verbatim: a stored agg_queue_now row -> the board shape. */
export function dqQueueView_(q: Record<string, unknown>, prevOpen: number | null | undefined, cfg: Cfg): Record<string, unknown> {
  return {
    queue: String(q.queue),
    kind: String(q.kind),
    ours: String(q.kind) === 'chat' || dqNameHasText_(q.queue, dqSetting_(cfg, 'our_queue_text')),
    open: dqNum_(q.open),
    actionable: dqNum_(q.actionable),
    unassigned: dqNum_(q.unassigned),
    oldestH: dqNum_(q.oldest_h),
    bands: dqBandCounts_(q, cfg),
    overTop: dqNum_(q.over_top),
    createdToday: dqNum_(q.created_today),
    resolvedToday: dqNum_(q.resolved_today),
    delta: prevOpen === undefined ? null : dqNum_(q.open) - (prevOpen as number),
    byStatus: dqJson_(q.by_status_json, {}) || {},
    sourceAsOf: String(q.source_as_of || ''),
    stale: q.stale === true || q.stale === 'TRUE' || q.stale === 'true',
  }
}

/** dqTodaySnapshots_: open per queue at the latest snapshot today + per-slot totals. */
export function dqTodaySnapshots_(
  now: Date | number,
  cfg: Cfg,
  snapshotRows: Record<string, unknown>[]
): { latest: string | null; prev: Record<string, number>; series: { slot: unknown; open: number; overTop: number }[] } {
  const today = dqDateKey_(now instanceof Date ? now : new Date(now), cfg)
  const rows = snapshotRows.filter((r) => r.slot_date === today)
  const bySlot: Record<string, Record<string, unknown>[]> = {}
  rows.forEach((r) => {
    ;(bySlot[String(r.slot)] = bySlot[String(r.slot)] || []).push(r)
  })
  const slots = Object.keys(bySlot).sort()
  const latest = slots[slots.length - 1]
  const prev: Record<string, number> = {}
  ;(latest ? bySlot[latest] : []).forEach((r) => {
    prev[String(r.queue)] = dqNum_(r.open)
  })
  const series = slots.map((s) => ({
    slot: s,
    open: bySlot[s].reduce((a, r) => a + dqNum_(r.open), 0),
    overTop: bySlot[s].reduce((a, r) => a + dqNum_(r.over_top), 0),
  }))
  return { latest: latest || null, prev, series }
}

/** dqAgingBand_: aging band index for an age in hours: edges [4,12,24,48] -> 0 .. 4. */
export function dqAgingBand_(hours: number, edges: number[]): number {
  let b = 0
  for (let i = 0; i < edges.length; i++) if (hours >= edges[i]) b = i + 1
  return b
}

/** dqSlotIn_: "09:30" Kuwait on dateKey, shown in another zone (data_tz default). */
export function dqSlotIn_(dateKey: string, slot: string, tz: string | undefined, cfg: Cfg): string {
  const cp = dqCheckpoints_(dateKey, cfg).filter((c) => c.slot === slot)[0]
  if (!cp) throw new Error('Unknown slot ' + slot)
  return formatDate_(cp.at, tz || String(dqSetting_(cfg, 'data_tz')), 'HH:mm')
}

/** dqGroupKey_: case, dashes (incl. unicode), spaces around "-", repeats ignored. */
export function dqGroupKey_(name: unknown): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[‐-―]/g, '-') // U+2010..U+2015 unicode dashes -> '-'
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function dqInList_(name: unknown, list: unknown[] | null | undefined): boolean {
  const k = dqGroupKey_(name)
  return (list || []).some((v) => dqGroupKey_(v) === k)
}

/** dqNameHasText_: the group name contains any of the words (same tidy-up as dqInList_). */
export function dqNameHasText_(name: unknown, words: unknown): boolean {
  const k = dqGroupKey_(name)
  return (Array.isArray(words) ? words : String(words || '').split(',')).some((w) => {
    const t = dqGroupKey_(w)
    return t !== '' && k.indexOf(t) !== -1
  })
}

// ---------------------------------------------------------------- TlSnapshots.js

export const TLS_HEADERS: Record<string, string[]> = {
  tlp_shifts: ['key', 'date', 'tl_email', 'shift_start', 'shift_end', 'queue_json', 'updated_at'],
  tlp_queue_daily: [
    'date', 'tl_email', 'windows', 'queue_min', 'calls_in', 'calls_serviced', 'calls_abandoned',
    'calls_other', 'answer_rate', 'text_touches', 'text_tickets', 'resp_count', 'resp_avg_min',
    'resp_missing', 'text_source', 'computed_at',
  ],
  tlp_team: [
    'tl_email', 'month', 'quality', 'fcr', 'productivity', 'agents', 'updated_at', 'kpi_score',
    'kpi_prod', 'kpi_qual', 'kpi_fcr', 'kpi_behavior', 'kpi_agents', 'ol_agents',
    'ineligible_agents', 'red_zone', 'action_plan', 'probation_agents', 'partial_agents',
  ],
  tlp_area_metrics: ['key', 'tl_email', 'area', 'from', 'to', 'pct', 'met', 'total', 'rule', 'updated_at'],
}

export interface TlsShift {
  tl: string
  date: string
  startMs: number
  endMs: number
  queue: { startMs: number; endMs: number }[]
}

/** tlsShifts_: tlp_shifts rows between two Kuwait dates, mapped by tlsShiftOf_. */
export function tlsShifts_(rows: Record<string, unknown>[], fromKey: string, toKey: string): TlsShift[] {
  return rows
    .filter((r) => String(r.date) >= fromKey && String(r.date) <= toKey)
    .map(tlsShiftOf_)
}

export function tlsShiftOf_(r: Record<string, unknown>): TlsShift {
  let q: unknown[] = []
  try {
    q = JSON.parse(String(r.queue_json || '[]'))
  } catch {
    q = []
  }
  return {
    tl: normEmail_(r.tl_email),
    date: String(r.date),
    startMs: Number(r.shift_start),
    endMs: Number(r.shift_end),
    queue: (q as [unknown, unknown][]).map((w) => ({ startMs: Number(w[0]), endMs: Number(w[1]) })),
  }
}

/** tlsOnShift_: team leads whose SHIFT covers ms (start inclusive, end exclusive). */
export function tlsOnShift_(shifts: TlsShift[], ms: number): string[] {
  const out: string[] = []
  shifts.forEach((s) => {
    if (ms >= s.startMs && ms < s.endMs && out.indexOf(s.tl) === -1) out.push(s.tl)
  })
  return out
}

/** tlsOnQueue_: team leads on QUEUE-MANAGEMENT hours at ms. */
export function tlsOnQueue_(shifts: TlsShift[], ms: number): string[] {
  const out: string[] = []
  shifts.forEach((s) => {
    if (s.queue.some((w) => ms >= w.startMs && ms < w.endMs) && out.indexOf(s.tl) === -1)
      out.push(s.tl)
  })
  return out
}

/**
 * tlsMailDue_ verbatim: who must answer a mail received at ms, and by when (end of shift).
 * Returns { expected, dueMs (NaN when the schedule has nothing), nextShift }.
 */
export function tlsMailDue_(
  shifts: TlsShift[],
  ms: number
): { expected: string[]; dueMs: number; nextShift: boolean } {
  const on = tlsOnQueue_(shifts, ms)
  const endOf = (tls: string[], atMs: number): number => {
    const ends = shifts
      .filter((s) => tls.indexOf(s.tl) !== -1 && atMs >= s.startMs && atMs < s.endMs)
      .map((s) => s.endMs)
    return ends.length ? Math.max.apply(null, ends) : NaN
  }
  if (on.length) return { expected: on, dueMs: endOf(on, ms), nextShift: false }
  let next = Infinity
  shifts.forEach((s) => {
    s.queue.forEach((w) => {
      if (w.startMs > ms && w.startMs < next) next = w.startMs
    })
  })
  if (next === Infinity) return { expected: [], dueMs: NaN, nextShift: true }
  const tls = tlsOnQueue_(shifts, next)
  return { expected: tls, dueMs: endOf(tls, next), nextShift: true }
}

/** TLQ_SETTINGS defaults verbatim. */
export const TLQ_SETTINGS: Record<string, { value: unknown; description?: string }> = {
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

/** tlqSetting_: Config value, else the TLQ_SETTINGS default, else ''. */
export function tlqSetting_(cfg: Cfg, key: string): unknown {
  const d = TLQ_SETTINGS[key]
  return getConfig_(cfg, key, d ? d.value : '')
}

/** tlqCol_: first header (lower case, spaces/underscores ignored) among the candidates. */
export function tlqCol_(header: unknown[], names: string[]): number {
  const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[\s_]+/g, '')
  const h = header.map(norm)
  for (let i = 0; i < names.length; i++) {
    const j = h.indexOf(norm(names[i]))
    if (j !== -1) return j
  }
  return -1
}

// ---------------------------------------------------------------- Aggregates.js (hub)
// Verbatim ports of the pure builders; the I/O callers live in lib/server.ts
// and lib/jobs.ts. Header constants keep the legacy names.

export const DQ_AGING_HEADERS = ['ticket_id', 'queue', 'group_name', 'status', 'actionable', 'country', 'channel', 'contact_type_1',
  'created_at', 'age_h', 'band', 'agent_email', 'agent_name', 'tl_email', 'tl_name', 'refreshed_at']
// bands_json: open count per aging band (aging_bands_h edges + 1). Tabs made before it keep unused b0..b4 columns.
export const DQ_QUEUE_NOW_HEADERS = ['queue', 'kind', 'open', 'actionable', 'unassigned', 'oldest_h',
  'over_top', 'created_today', 'resolved_today', 'as_of', 'source_as_of', 'stale', 'by_status_json', 'bands_json']
export const DQ_INFLOW_HEADERS = ['date', 'channel', 'country', 'inflow', 'updated_at']
export const DQ_INFLOW_ROLLUP_HEADERS = ['period', 'channel', 'country', 'inflow', 'days', 'partial', 'updated_at']
export const DQ_INFLOW_HOURLY_HEADERS = ['date', 'hour', 'channel', 'country', 'inflow']
export const DQ_AGENT_PERF_HEADERS = ['email', 'name', 'tl_email', 'tl_name', 'period', 'from_date', 'to_date', 'days', 'overall_pct',
  'inbound_pct', 'texting_pct', 'wa_pct', 'inbound_achieved', 'inbound_missed', 'texting_achieved', 'wa_achieved',
  'productive_min', 'idle_min', 'audits', 'avg_score']
export const DQ_AGENT_DAILY_HEADERS = ['date', 'email', 'overall_pct', 'inbound_achieved', 'texting_achieved', 'wa_achieved']
export const DQ_SNAPSHOT_HEADERS = ['snapshot_key', 'slot_date', 'slot', 'captured_at', 'data_as_of', 'late', 'queue',
  'open', 'actionable', 'unassigned', 'oldest_h', 'over_top', 'created_today', 'resolved_today',
  'stale', 'by_status_json', 'bands_json']

/** dqAgingOpts_ verbatim as a pure read over the injected cfg map. */
export function dqAgingOpts_(cfg: Cfg): Record<string, unknown> {
  return {
    bizTz: String(dqSetting_(cfg, 'business_tz')), dataTz: String(dqSetting_(cfg, 'data_tz')),
    edges: dqSetting_(cfg, 'aging_bands_h'), open: dqSetting_(cfg, 'open_statuses'), actionable: dqSetting_(cfg, 'actionable_statuses'),
    excluded: dqSetting_(cfg, 'inflow_excluded_groups'), excludedText: dqSetting_(cfg, 'queue_excluded_text'), queueMap: dqSetting_(cfg, 'queue_map') || {},
    chatMaxAgeH: dqSetting_(cfg, 'chat_open_max_age_h'), staleAfterMin: dqSetting_(cfg, 'daily_report_stale_after_min'),
  }
}

/** dqStatusList_ verbatim: status list setting -> trimmed lower-case labels. */
export function dqStatusList_(v: unknown): string[] {
  const list = Array.isArray(v) ? v : String(v || '').split(',')
  return list.map((s) => String(s).trim().toLowerCase()).filter(String)
}

export function dqEmptyQueue_(name: string, kind: string, nBands: number): Record<string, unknown> {
  const bands: number[] = []
  for (let i = 0; i < (nBands || 5); i++) bands.push(0)
  return { queue: name, kind, open: 0, actionable: 0, unassigned: 0, oldest_h: 0, bands_json: bands,
    over_top: 0, created_today: 0, resolved_today: 0, as_of: '', source_as_of: '', stale: false, by_status_json: {} }
}

/**
 * dqBuildAging_ verbatim: ticket rows -> open-ticket aging rows + per-queue health.
 * people = dqPeopleIndex_() output or null.
 */
export function dqBuildAging_(
  tickets: Record<string, unknown>[],
  now: Date,
  opts: Record<string, any>,
  people: { byFdId: Record<string, { email?: string; name?: string; tlEmail?: string; tlName?: string }> } | null
): { aging: Record<string, unknown>[]; queues: Record<string, unknown>[]; dropped: Record<string, unknown> } {
  const today = dqDateKey_(now, opts.bizTz)
  const tp = today.split('-'), np = dqAddDays_(today, 1).split('-')
  const dayStart = dqWallToUtc_(+tp[0], +tp[1], +tp[2], 0, 0, 0, opts.bizTz).getTime()
  const dayEnd = dqWallToUtc_(+np[0], +np[1], +np[2], 0, 0, 0, opts.bizTz).getTime()
  const isToday = (d: Date) => { const t = d.getTime(); return t >= dayStart && t < dayEnd }
  const exMemo: Record<string, boolean> = {}
  const isExcluded = (g: string) => (g in exMemo ? exMemo[g] : (exMemo[g] = dqInList_(g, opts.excluded) || dqNameHasText_(g, opts.excludedText)))
  const top = opts.edges.length
  const queues: Record<string, Record<string, unknown>> = {}
  const aging: Record<string, unknown>[] = []
  const openL = dqStatusList_(opts.open), actL = dqStatusList_(opts.actionable)
  const dropped: Record<string, unknown> = { excludedGroup: 0, notOpenStatus: {}, noCreatedAt: 0, noCreatedSample: '' }
  const q = (name: string) => (queues[name] = queues[name] || dqEmptyQueue_(name, 'ticket', top + 1))
  tickets.forEach((t) => {
    const group = String(t.group_name || '')
    if (isExcluded(group)) { (dropped.excludedGroup as number)++; return }
    const name = (opts.queueMap as Record<string, string>)[group] || group || '(no group)'
    const created = dqParseTsPort_(t.created_at, opts.dataTz)
    const resolved = dqParseTsPort_(t.resolved_at, opts.dataTz)
    if (created && isToday(created)) (q(name).created_today as number)++
    if (resolved && isToday(resolved)) (q(name).resolved_today as number)++
    const st = String(t.status)
    if (openL.indexOf(st.trim().toLowerCase()) === -1) {
      const m = dropped.notOpenStatus as Record<string, number>
      m[st] = (m[st] || 0) + 1
      return
    }
    if (!created) { (dropped.noCreatedAt as number)++; if (!dropped.noCreatedSample) dropped.noCreatedSample = String(t.created_at); return }
    const ageH = Math.max(0, (now.getTime() - created.getTime()) / 3600000)
    const band = dqAgingBand_(ageH, opts.edges)
    const row = q(name)
    ;(row.open as number)++
    const bs = row.by_status_json as Record<string, number>
    bs[st] = (bs[st] || 0) + 1
    const act = actL.indexOf(st.trim().toLowerCase()) !== -1
    if (act) (row.actionable as number)++
    if (!t.responder_id) (row.unassigned as number)++
    ;(row.bands_json as number[])[band]++
    if (band === top) (row.over_top as number)++
    if (ageH > (row.oldest_h as number)) row.oldest_h = Math.round(ageH * 10) / 10
    const p = (people && people.byFdId[String(t.responder_id)]) || {}
    aging.push({
      ticket_id: String(t.ticket_id), queue: name, group_name: group, status: String(t.status), actionable: act,
      country: String(t.country || ''), channel: String(t.channel || ''), contact_type_1: String(t.contact_type_1 || ''),
      created_at: created.toISOString(), age_h: Math.round(ageH * 10) / 10, band,
      agent_email: p.email || '', agent_name: p.name || (t.responder_id ? 'Agent ' + t.responder_id : ''),
      tl_email: p.tlEmail || '', tl_name: p.tlName || '', refreshed_at: now.toISOString(),
    })
  })
  aging.sort((a, b) => (b.age_h as number) - (a.age_h as number))
  const rows = Object.keys(queues).map((k) => { queues[k].as_of = now.toISOString(); return queues[k] })
    .filter((r) => r.open || r.created_today || r.resolved_today)
  return { aging, queues: rows, dropped }
}

// dqParseTs_ is imported lazily to keep the type surface simple; it is the shared adapter.
import { dqParseTs_ } from '@/features/shared/lib/adapters'
const dqParseTsPort_ = dqParseTs_

/**
 * dqBuildChatQueue_ verbatim: Freshchat rows (A..G) -> one 'Chats' queue row.
 */
export function dqBuildChatQueue_(chatRows: unknown[][], now: Date, opts: Record<string, any>): Record<string, unknown> {
  const today = dqDateKey_(now, opts.bizTz)
  const row = dqEmptyQueue_('Chats', 'chat', opts.edges.length + 1)
  const maxAgeH = Number(opts.chatMaxAgeH) || 48
  let newest: Date | null = null
  let tooOld = 0
  const seen: Record<string, boolean> = {}
  chatRows.forEach((r) => {
    const upd = dqParseTsPort_(r[3], opts.dataTz)
    if (upd && upd <= now && (!newest || upd > newest)) newest = upd
    const id = String(r[6] || r[2] || '')
    if (id && seen[id]) return
    if (id) seen[id] = true
    const init = dqParseTsPort_(r[0], opts.dataTz)
    const res = dqParseTsPort_(r[4], opts.dataTz)
    if (init && dqDateKey_(init, opts.bizTz) === today) (row.created_today as number)++
    if (res && dqDateKey_(res, opts.bizTz) === today) (row.resolved_today as number)++
    if (!init || res || /RESOLV|CLOS/i.test(String(r[1]))) return
    const ageH = Math.max(0, (now.getTime() - init.getTime()) / 3600000)
    if (ageH > maxAgeH) { tooOld++; return }
    const band = dqAgingBand_(ageH, opts.edges)
    const st = String(r[1] || '(no status)')
    const bs = row.by_status_json as Record<string, number>
    bs[st] = (bs[st] || 0) + 1
    ;(row.open as number)++
    ;(row.actionable as number)++
    ;(row.bands_json as number[])[band]++
    if (band === opts.edges.length) (row.over_top as number)++
    if (ageH > (row.oldest_h as number)) row.oldest_h = Math.round(ageH * 10) / 10
  })
  if (tooOld) (row.by_status_json as Record<string, number>)['Older than ' + maxAgeH + ' h (not counted)'] = tooOld
  row.as_of = now.toISOString()
  row.source_as_of = newest ? (newest as Date).toISOString() : ''
  row.stale = !newest || now.getTime() - (newest as Date).getTime() > (Number(opts.staleAfterMin) || 90) * 60000
  return row
}

/** dqCountry_ verbatim. */
export function dqCountry_(v: unknown): string {
  const s = String(v || '').trim()
  return !s || s === 'NA' || s === '#N/A' ? '(unknown)' : s
}

/** dqChatCountry_ verbatim. */
export function dqChatCountry_(channelName: unknown, map: unknown): string {
  const s = String(channelName || '').toLowerCase()
  const keys = Object.keys((map as Record<string, string>) || {})
  for (let i = 0; i < keys.length; i++) if (s.indexOf(keys[i]) !== -1) return (map as Record<string, string>)[keys[i]]
  return '(unknown)'
}

/**
 * dqCountInflow_ verbatim: inbound calls + chats + internal escalations per
 * business date and per hour between fromKey and toKey.
 */
export function dqCountInflow_(
  input: { tickets?: Record<string, unknown>[]; chats?: unknown[][]; calls?: unknown[][] },
  o: Record<string, any>
): { daily: Record<string, number>; hourly: Record<string, number>; ranges: Record<string, { from: string; to: string }> } {
  const daily: Record<string, number> = {}, hourly: Record<string, number> = {}, ranges: Record<string, { from: string; to: string }> = {}
  const add = (channel: string, at: Date | null, country: string) => {
    if (!at) return
    const key = dqDateKey_(at, o.bizTz)
    if (key < o.fromKey || key > o.toKey) return
    const r = (ranges[channel] = ranges[channel] || { from: key, to: key })
    if (key < r.from) r.from = key
    if (key > r.to) r.to = key
    const hour = Number(formatDate_(at, o.bizTz, 'H'))
    const dk = key + '|' + channel + '|' + country
    daily[dk] = (daily[dk] || 0) + 1
    const hk = key + '|' + hour + '|' + channel + '|' + country
    hourly[hk] = (hourly[hk] || 0) + 1
  }
  ;(input.tickets || []).forEach((t) => {
    if (String(t.channel) !== o.escChannel) return
    if (dqInList_(t.group_name, o.excluded)) return
    if (t.requester_id && o.cxIds[String(t.requester_id)]) return
    if (o.escStatuses.indexOf(String(t.status)) === -1 && !(o.escSeen && o.escSeen[String(t.ticket_id)])) return
    add('escalation', dqParseTsPort_(t.created_at, o.dataTz), dqCountry_(t.country))
  })
  const seenChat: Record<string, boolean> = {}
  ;(input.chats || []).forEach((r) => {
    const id = String(r[6] || r[2] || '')
    if (id) { if (seenChat[id]) return; seenChat[id] = true }
    add('chat', dqParseTsPort_(r[0], o.dataTz), dqChatCountry_(r[5], o.chatCountryMap))
  })
  const seenCall: Record<string, boolean> = {}
  ;(input.calls || []).forEach((r) => {
    if (String(r[3] || '').toLowerCase() !== 'inbound') return
    const id = String(r[0] || '')
    if (id) { if (seenCall[id]) return; seenCall[id] = true }
    add('call', dqParseTsPort_(r[1], o.dataTz), dqCountry_(r[4]))
  })
  ranges.escalation = { from: o.fromKey, to: o.toKey }
  return { daily, hourly, ranges }
}

/** dqRollupInflow_ verbatim: daily rows -> week (Sunday start) / month rollups. */
export function dqRollupInflow_(dailyRows: Record<string, unknown>[], grain: 'week' | 'month', todayKey: string): Record<string, unknown>[] {
  const out: Record<string, { period: string; channel: unknown; country: unknown; inflow: number; days: Record<string, boolean>; partial: boolean }> = {}
  let firstDay: string | null = null
  dailyRows.forEach((r) => { if (!firstDay || String(r.date) < firstDay) firstDay = String(r.date) })
  dailyRows.forEach((r) => {
    const period = grain === 'week' ? dqWeekStart_(String(r.date)) : String(r.date).slice(0, 7)
    const k = period + '|' + r.channel + '|' + r.country
    const o = (out[k] = out[k] || { period, channel: r.channel, country: r.country, inflow: 0, days: {}, partial: false })
    o.inflow += Number(r.inflow) || 0
    o.days[String(r.date)] = true
  })
  const curPeriod = grain === 'week' ? dqWeekStart_(todayKey) : todayKey.slice(0, 7)
  const firstPeriod = firstDay ? (grain === 'week' ? dqWeekStart_(firstDay) : (firstDay as string).slice(0, 7)) : ''
  return Object.keys(out).sort().map((k) => {
    const o = out[k]
    const startsLate = grain === 'week' ? (firstDay as string) > o.period : (firstDay as string) > o.period + '-01'
    return { period: o.period, channel: o.channel, country: o.country, inflow: o.inflow, days: Object.keys(o.days).length,
      partial: o.period === curPeriod || (o.period === firstPeriod && startsLate), updated_at: new Date().toISOString() }
  })
}

export function dqRatio_(a: number, b: number): number | null {
  return b > 0 ? a / b : null
}

/** dqAgentPerf_ verbatim: prod_daily_layers-style rows -> per-agent period rows + 30-day daily rows. */
export function dqAgentPerf_(
  prodRows: Record<string, unknown>[],
  peopleByEmail: Record<string, { name?: string; tlEmail?: string; tlName?: string }>,
  todayKey: string
): { perf: Record<string, unknown>[]; daily: Record<string, unknown>[] } {
  const yesterday = dqAddDays_(todayKey, -1)
  const monthStart = yesterday.slice(0, 7) + '-01'
  const periods = [
    { period: '7d', from: dqAddDays_(todayKey, -7), to: yesterday },
    { period: 'prev7d', from: dqAddDays_(todayKey, -14), to: dqAddDays_(todayKey, -8) },
    { period: 'mtd', from: monthStart, to: yesterday },
  ]
  const acc: Record<string, any> = {}
  const daily: Record<string, unknown>[] = []
  const dailyFrom = dqAddDays_(todayKey, -30)
  prodRows.forEach((r) => {
    const email = String(r.email || '').toLowerCase()
    if (!email || !r.date) return
    const n = (k: string) => Number((r as Record<string, unknown>)[k]) || 0
    if (String(r.date) >= dailyFrom && String(r.date) <= yesterday) {
      daily.push({ date: r.date, email, overall_pct: r.overallProdPct === '' ? '' : Number(r.overallProdPct),
        inbound_achieved: n('inboundAchieved'), texting_achieved: n('textingAchieved'), wa_achieved: n('waAchieved') })
    }
    periods.forEach((p) => {
      if (String(r.date) < p.from || String(r.date) > p.to) return
      const k = email + '|' + p.period
      const a = (acc[k] = acc[k] || { email, name: (r as Record<string, unknown>).agentName, p, days: {}, s: {} })
      a.days[String(r.date)] = true
      ;['productiveMinResolution', 'productiveMinAux', 'inboundAchieved', 'inboundTarget', 'inboundMissed', 'textingAchieved',
        'textingTarget', 'waAchieved', 'waTarget', 'idleMin', 'totalAudits'].forEach((f) => { a.s[f] = (a.s[f] || 0) + n(f) })
      if (n('totalAudits') > 0 && r.avgScore !== '' && r.avgScore !== null) a.s.scoreSum = (a.s.scoreSum || 0) + Number(r.avgScore) * n('totalAudits')
    })
  })
  const perf = Object.keys(acc).map((k) => {
    const a = acc[k], s = a.s, who = peopleByEmail[a.email] || {}
    return {
      email: a.email, name: who.name || String(a.name || a.email), tl_email: who.tlEmail || '', tl_name: who.tlName || '',
      period: a.p.period, from_date: a.p.from, to_date: a.p.to, days: Object.keys(a.days).length,
      overall_pct: dqRatio_(s.productiveMinResolution, s.productiveMinAux), inbound_pct: dqRatio_(s.inboundAchieved, s.inboundTarget),
      texting_pct: dqRatio_(s.textingAchieved, s.textingTarget), wa_pct: dqRatio_(s.waAchieved, s.waTarget),
      inbound_achieved: s.inboundAchieved, inbound_missed: s.inboundMissed, texting_achieved: s.textingAchieved,
      wa_achieved: s.waAchieved, productive_min: Math.round(s.productiveMinAux), idle_min: Math.round(s.idleMin),
      audits: s.totalAudits, avg_score: dqRatio_(s.scoreSum || 0, s.totalAudits),
    }
  })
  return { perf, daily }
}

/**
 * dqTickState_ verbatim: what this tick's sync and aggregates did, for dqCheckinTick_.
 */
export function dqTickState_(sync: Record<string, unknown> | null, agg: Record<string, unknown> | null): Record<string, unknown> {
  const syncOk = !!sync && !sync.skipped
  return {
    fresh: syncOk && !!agg,
    reason: !sync ? 'Freshdesk sync failed' : sync.skipped ? 'Freshdesk sync skipped: ' + sync.skipped : !agg ? 'queue aggregates failed' : '',
    aggAt: agg ? agg.builtAt : null,
  }
}

// ---------------------------------------------------------------- QueuePages.js (queue app)

export const DQ_AGING_FIELDS = ['ticket_id', 'queue', 'status', 'actionable', 'country', 'age_h', 'band', 'agent_name', 'tl_name', 'mine', 'contact_type_1']
export const DQ_AGING_LIST_CAP = 1500

/**
 * dqValidateCheckin_ verbatim (QueuePages.js): validates a check-in payload.
 * auto: { queue -> open } (the numbers shown to the TL). Throws on bad input.
 */
export function dqValidateCheckin_(
  payload: Record<string, any>,
  auto: Record<string, number> | null,
  cfg: Cfg
): Record<string, unknown> {
  payload = payload || {}
  const slots = dqSetting_(cfg, 'checkin_slots') as unknown[]
  if (slots.indexOf(String(payload.slot)) === -1) throw new Error('Unknown check-in slot.')
  const qs = payload.queues
  if (!qs || !qs.length) throw new Error('A check-in needs at least one queue.')
  const corrections: Record<string, { auto: number; corrected: number }> = {}
  const clean = (qs as Record<string, unknown>[]).map((q) => {
    const name = String(q.queue || '').trim()
    if (!name) throw new Error('A queue row has no name.')
    const agents = Number(q.agents)
    if (q.agents === '' || q.agents === null || q.agents === undefined || !isFinite(agents) || agents < 0 || Math.floor(agents) !== agents || agents > 200) {
      throw new Error(name + ': enter how many agents are on it (a whole number).')
    }
    const status = String(q.status || '').replace(/\s+/g, ' ').trim()
    if (!status) throw new Error(name + ': choose how it is going.')
    if (status.length > 120) throw new Error(name + ': keep the status under 120 characters.')
    const note = String(q.note || '').trim().slice(0, 1000)
    if (status !== 'On track' && !note) throw new Error(name + ': say what is driving it, so the next shift can plan for it.')
    const out: Record<string, unknown> = { queue: name, agents, status, note }
    if (q.openCorrected !== null && q.openCorrected !== undefined && q.openCorrected !== '') {
      const oc = Number(q.openCorrected)
      if (!isFinite(oc) || oc < 0 || Math.floor(oc) !== oc) throw new Error(name + ': the corrected open count must be a whole number.')
      if (auto && auto[name] !== undefined && oc !== Number(auto[name])) {
        out.openCorrected = oc
        corrections[name] = { auto: Number(auto[name]), corrected: oc }
      }
    }
    return out
  })
  const reason = String(payload.correctionReason || '').trim().slice(0, 500)
  if (Object.keys(corrections).length && !reason) throw new Error('You changed an open count from Freshdesk. Say why.')
  const help = payload.helpNeeded === true
  const helpNote = String(payload.helpNote || '').trim().slice(0, 1000)
  if (help && !helpNote) throw new Error('Say what help you need.')
  return { slot: String(payload.slot), queues: clean, corrections, correctionReason: reason,
    generalNote: String(payload.generalNote || '').trim().slice(0, 2000), helpNeeded: help, helpNote }
}
