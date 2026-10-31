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
} from '../prod/adapters'

// ---------------------------------------------------------------- QueueCore.js

export const DQ_FLAGS_TABLE = 'aging_flags'
export const DQ_FLAGS_HEADERS = [
  'flag_id', 'ticket_id', 'note', 'tl_email', 'resolved_at', 'resolved_by', 'resolved_note',
  'submitted_by', 'submitted_at',
]
export const DQ_SUBMISSIONS_TABLE = 'queue_status_submissions'
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
