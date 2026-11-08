/**
 * Queue & Workforce API fragments — the server side of QueueCore.js and
 * TlSnapshots.js on Postgres.
 *
 *   getQueueHealthPage     QueueCore.js getQueueHealthPage() verbatim; the sheet
 *                          stores become readStore reads (missingOk -> [] /
 *                          'unavailable' markers — never invented data).
 *   aging flags            dqOpenAgingFlags_ read + the flag/resolve writes on
 *                          dq_aging_flags. The legacy create/resolve page fns
 *                          lived in AgingHelp.js (absent from the bundle), so the
 *                          writes keep to DQ_FLAGS_HEADERS with repo stamping.
 *   check-ins              dqSlotsToday_/dqSubmissionsFor_ read + one submission
 *                          write per (slot_date, slot) on queue_submissions
 *                          (DQ_SUBMISSIONS_HEADERS).
 *   TL performance         the TlSnapshots.js readers (tlsShifts_/tlsOnShift_/
 *                          tlsOnQueue_/tlsMailDue_) over the four tlp_* tables.
 *                          The page fn itself lived in TlPerformance.js /
 *                          TlQueue.js (absent): raw rows per table + the reader
 *                          outputs are exposed instead.
 *
 * Table names follow migrations/003: legacy `aging_flags` -> dq_aging_flags,
 * `queue_status_submissions` -> queue_submissions.
 */

import 'server-only'

import {
  appendRow,
  updateRow,
  findRow,
  db,
  newId,
  isTrue,
} from '@/features/shared/platform/repo'
import { configAll } from '@/features/shared/platform/settings'
import { requireRole } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { dqCachedLive, dqLastRun, readStore } from '@/features/shared/platform/stores'
import { InputError } from '@/features/shared/lib/api-error'
import { DATE_KEY_RE, inDateRange, monthRange } from '@/features/shared/lib/fragments'
import {
  dqAgingFlagOut_,
  dqBandInfo_,
  dqCheckpoints_,
  dqOpenAgingFlags_,
  dqQueueView_,
  dqSlotState_,
  dqSlotsToday_,
  dqSortQueues_,
  dqSubmissionsFor_,
  dqTodaySnapshots_,
  tlsMailDue_,
  tlsOnQueue_,
  tlsOnShift_,
  tlsShifts_,
  type DqAgingFlagOut,
} from './index'
import { dqDateKey_, dqSetting_, normEmail_, type Cfg } from '@/features/shared/lib/adapters'

/** Table names in migrations/003 (legacy sheet names -> Postgres). */
export const DQ_AGING_FLAGS_TABLE = 'dq_aging_flags'
export const DQ_QUEUE_SUBMISSIONS_TABLE = 'queue_submissions'

// ---------------------------------------------------------------- queue health page

/**
 * getQueueHealthPage() verbatim (QueueCore.js:256-266). Store seams: today's
 * snapshots and the queue board come from the agg_* tables; a missing snapshot
 * store yields { latest: null, prev: {}, series: [] } plus a `snapshots:
 * 'unavailable'` marker instead of invented data.
 */
export async function getQueueHealthPage(): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const now = new Date()
  const cfg = (await configAll()) as Cfg
  const [snapStore, subStore] = await Promise.all([readStore('agg_snapshots_today'), readStore(DQ_QUEUE_SUBMISSIONS_TABLE)])
  const snaps = dqTodaySnapshots_(now, cfg, snapStore.rows)
  const queues = dqSortQueues_(
    (await dqCachedLive('agg_queue_now')).map(
      (q) =>
        dqQueueView_(q, snaps.prev[String(q.queue)] as number | undefined, cfg) as Record<
          string,
          unknown
        > & { ours: unknown; open: number }
    )
  )
  return {
    now: now.toISOString(),
    dataAsOf: await dqLastRun('queue_aggregates'),
    syncedAt: (await dqLastRun('freshdesk_sync')) || '',
    bands: dqBandInfo_(cfg),
    queues,
    sinceSlot: snaps.latest,
    series: snaps.series,
    slots: dqSlotsToday_(now, cfg, subStore.exists ? subStore.rows : null),
    excludedGroups: dqSetting_(cfg, 'inflow_excluded_groups'),
    excludedText: dqSetting_(cfg, 'queue_excluded_text'),
    // Store availability markers (not part of the legacy payload — the legacy
    // sheet readers silently returned [] when a store existed but was empty).
    snapshots: snapStore.exists ? 'ok' : 'unavailable',
    submissions: subStore.exists ? 'ok' : 'unavailable',
  }
}

// ---------------------------------------------------------------- aging flags

export type DqAgingFlagJoined = DqAgingFlagOut & { aging?: Record<string, unknown> }

/**
 * GET /api/queue/aging-flags: dqOpenAgingFlags_ on the stores. When the aging
 * board store exists the flags are filtered to tickets still on the board and
 * joined to their aging row; when it does not, the open flags are returned
 * unfiltered ("flags only") with `aging: 'unavailable'`.
 */
export async function getOpenAgingFlags(): Promise<{ flags: DqAgingFlagJoined[]; aging: 'ok' | 'unavailable'; joined: boolean }> {
  await requireRole(['admin', 'tl'])
  const [flagStore, agingStore] = await Promise.all([readStore(DQ_AGING_FLAGS_TABLE), readStore('aging_open_tickets')])
  if (!agingStore.exists) {
    // Aging board store absent: flags only, no board filter, no join.
    const flags = flagStore.rows.filter((f) => !f.resolved_at).map(dqAgingFlagOut_)
    return { flags, aging: 'unavailable', joined: false }
  }
  const byTicket: Record<string, Record<string, unknown>> = {}
  agingStore.rows.forEach((r) => {
    byTicket[String(r.ticket_id)] = r
  })
  const flags = dqOpenAgingFlags_(flagStore.rows, agingStore.rows).map((f) => ({
    ...f,
    aging: byTicket[f.ticketId],
  }))
  return { flags, aging: 'ok', joined: true }
}

/** Validated flag-create payload (the AgingHelp.js create fn is absent — the shape is DQ_FLAGS_HEADERS). */
export function agingFlagInput(body: Record<string, unknown>): { ticket_id: string; note: string; tl_email: string } {
  const ticket_id = String(body.ticket_id ?? body.ticketId ?? '').trim()
  if (!ticket_id) throw new InputError('A flag needs a ticket id.')
  return {
    ticket_id,
    note: String(body.note ?? ''),
    tl_email: normEmail_(body.tl_email ?? body.tlEmail),
  }
}

/** Validated flag-resolve payload. */
export function agingResolveInput(body: Record<string, unknown>): { flag_id: string; resolved_note: string } {
  const flag_id = String(body.flag_id ?? body.flagId ?? '').trim()
  if (!flag_id) throw new InputError('Give the flag to resolve.')
  return { flag_id, resolved_note: String(body.resolved_note ?? body.resolvedNote ?? '') }
}

/** POST create: one open flag on a ticket, stamped like every repo write. */
export async function flagAgingTicket(body: Record<string, unknown>, actor: string): Promise<Record<string, unknown>> {
  await assertWritable()
  const input = agingFlagInput(body)
  return appendRow(
    DQ_AGING_FLAGS_TABLE,
    { flag_id: newId('af'), ticket_id: input.ticket_id, note: input.note, tl_email: input.tl_email || actor },
    actor
  )
}

/** POST resolve: stamps resolved_at / resolved_by / resolved_note on an open flag. */
export async function resolveAgingFlag(body: Record<string, unknown>, actor: string): Promise<Record<string, unknown>> {
  await assertWritable()
  const input = agingResolveInput(body)
  const current = await findRow(DQ_AGING_FLAGS_TABLE, 'flag_id', input.flag_id)
  if (!current) throw new InputError('That aging flag does not exist.', 404)
  if (current.resolved_at) throw new InputError('That aging flag is already resolved.', 409)
  const updated = await updateRow(
    DQ_AGING_FLAGS_TABLE,
    'flag_id',
    input.flag_id,
    {
      resolved_at: new Date().toISOString(),
      resolved_by: actor,
      resolved_note: input.resolved_note,
    },
    { actor, stampUpdates: false } // dq_aging_flags has no updated_* columns (DQ_FLAGS_HEADERS)
  )
  return updated || current
}

// ---------------------------------------------------------------- check-ins

export interface CheckinSlot {
  slot: string
  name: string
  at: string
  dueAt: string
  state: string
  submittedBy: string
  submittedAt: string
}

/**
 * The dqSlotsToday_ shape for an arbitrary business date (the checkins GET):
 * slot states with submitters. submissions is dqSubmissionsFor_-normalized.
 */
export function dqSlotsForDate_(
  date: string,
  now: Date | number,
  cfg: Cfg,
  submissionRows: Record<string, unknown>[] | null
): CheckinSlot[] {
  const subs = dqSubmissionsFor_(submissionRows, [date])
  const by: Record<string, Record<string, unknown>> = {}
  subs.forEach((s) => {
    by[String(s.slot)] = s
  })
  return dqCheckpoints_(date, cfg).map((cp) => {
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

/** GET /api/queue/checkins?date=: the day's slots + stored submissions. */
export async function getQueueCheckins(date: string | null): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const cfg = (await configAll()) as Cfg
  const day = date || dqDateKey_(new Date(), cfg)
  if (!DATE_KEY_RE.test(day)) throw new InputError('Give the date as yyyy-MM-dd.')
  const store = await readStore(DQ_QUEUE_SUBMISSIONS_TABLE)
  const rows = store.exists ? store.rows : null
  return {
    date: day,
    slots: dqSlotsForDate_(day, new Date(), cfg, rows),
    submissions: dqSubmissionsFor_(rows, [day]),
    store: store.exists ? 'ok' : 'unavailable',
  }
}

function checkinJson(v: unknown, name: string): unknown {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'object') return v
  try {
    return JSON.parse(String(v))
  } catch {
    throw new InputError(name + ' must be valid JSON.')
  }
}

/**
 * Validated check-in payload (DQ_SUBMISSIONS_HEADERS, minus the stamped cols).
 * The legacy write fn lived in Queue.js/QueuePages.js (absent); the slot check
 * reuses dqCheckpoints_ like dqSlotIn_ — an unconfigured slot is 'Unknown slot'.
 */
export function checkinInput(body: Record<string, unknown>, cfg: Cfg): Record<string, unknown> {
  const slot_date = String(body.slot_date ?? body.date ?? '').slice(0, 10)
  if (!DATE_KEY_RE.test(slot_date)) throw new InputError('A check-in needs a slot date (yyyy-MM-dd).')
  const slot = String(body.slot ?? '')
  const known = dqCheckpoints_(slot_date, cfg).some((cp) => cp.slot === slot)
  if (!known) throw new InputError('Unknown slot ' + slot)
  return {
    slot_date,
    slot,
    snapshot_key: String(body.snapshot_key ?? body.snapshotKey ?? ''),
    status: String(body.status ?? ''),
    queues_json: checkinJson(body.queues_json ?? body.queuesJson, 'queues_json'),
    corrections_json: checkinJson(body.corrections_json ?? body.correctionsJson, 'corrections_json'),
    correction_reason: String(body.correction_reason ?? body.correctionReason ?? ''),
    general_note: String(body.general_note ?? body.generalNote ?? ''),
    help_needed: isTrue(body.help_needed ?? body.helpNeeded),
    help_note: String(body.help_note ?? body.helpNote ?? ''),
  }
}

/**
 * POST /api/queue/checkins: one submission per (slot_date, slot). A resubmission
 * updates the stored row in place (updated_by/at stamped); a new one gets
 * submission_id newId('qs') and the submitted_* stamps.
 */
export async function submitQueueCheckin(body: Record<string, unknown>, actor: string): Promise<Record<string, unknown>> {
  await assertWritable()
  const cfg = (await configAll()) as Cfg
  const input = checkinInput(body, cfg)
  const { data: existing, error } = await db()
    .from(DQ_QUEUE_SUBMISSIONS_TABLE)
    .select('*')
    .eq('slot_date', input.slot_date)
    .eq('slot', input.slot)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) {
    const updated = await updateRow(
      DQ_QUEUE_SUBMISSIONS_TABLE,
      'submission_id',
      existing.submission_id,
      input,
      { actor, stampUpdates: true }
    )
    return updated || { ...existing, ...input }
  }
  return appendRow(DQ_QUEUE_SUBMISSIONS_TABLE, { submission_id: newId('qs'), ...input }, actor)
}

// ---------------------------------------------------------------- TL performance (TlSnapshots.js readers)

export { monthRange }

/**
 * GET /api/tl/performance: the TlSnapshots.js snapshot rows for one TL and month.
 * The page-level fn (TlPerformance.js / TlQueue.js jobTlQueueMetrics) is absent
 * from the bundle, so this exposes the raw rows per table plus the reader
 * outputs the pages compute (tlsShifts_ -> onShift/onQueue/mailDue at `now`).
 */
export async function getTlPerformance(tlEmail: string, month: string): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const { from, to } = monthRange(month)
  const tl = normEmail_(tlEmail)
  const [teamStore, areaStore, dailyStore, shiftStore] = await Promise.all([
    readStore('tlp_team'),
    readStore('tlp_area_metrics'),
    readStore('tlp_queue_daily'),
    readStore('tlp_shifts'),
  ])
  const team =
    teamStore.rows.filter((r) => normEmail_(r.tl_email) === tl && String(r.month).slice(0, 7) === month)[0] || null
  const areaMetrics = areaStore.rows.filter(
    (r) =>
      normEmail_(r.tl_email) === tl &&
      String(r.from || '').slice(0, 10) <= to &&
      String(r.to || '').slice(0, 10) >= from
  )
  const queueDaily = dailyStore.rows
    .filter((r) => normEmail_(r.tl_email) === tl && inDateRange(r.date, from, to))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const shifts = tlsShifts_(shiftStore.rows.filter((r) => normEmail_(r.tl_email) === tl), from, to)
  const nowMs = Date.now()
  return {
    tlEmail: tl,
    month,
    from,
    to,
    team,
    areaMetrics,
    queueDaily,
    shifts,
    onShiftNow: tlsOnShift_(shifts, nowMs),
    onQueueNow: tlsOnQueue_(shifts, nowMs),
    mailDue: tlsMailDue_(shifts, nowMs),
    stores: {
      tlp_team: teamStore.exists ? 'ok' : 'unavailable',
      tlp_area_metrics: areaStore.exists ? 'ok' : 'unavailable',
      tlp_queue_daily: dailyStore.exists ? 'ok' : 'unavailable',
      tlp_shifts: shiftStore.exists ? 'ok' : 'unavailable',
    },
  }
}
