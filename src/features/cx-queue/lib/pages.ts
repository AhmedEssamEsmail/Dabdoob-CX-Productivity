/**
 * QueuePages.js + AgingHelp.js (Queue_deprecated) ported to the Postgres seams:
 *   getAgingPage / getAnalyticsPage / getCheckinsPage / submitCheckin /
 *   refreshQueueViaHub -> refreshQueueNow / agingFlagTicket / agingResolveFlag.
 * Live-tab reads become dqCachedLive; sheet writes become repo writes on the
 * migration-003 tables (dq_aging_flags, queue_submissions).
 */

import 'server-only'

import { appendRow, updateRow, findRow, db, newId, cacheGet, cachePut, cacheRemove } from '@/features/shared/platform/repo'
import { configAll, getConfig } from '@/features/shared/platform/settings'
import { requireRole } from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { dqCachedLive, dqLastRun, readStore } from '@/features/shared/platform/stores'
import { raisePopup, resolvePopups } from '@/features/shared/platform/popups'
import { sendMail, escapeHtml } from '@/features/shared/platform/mail'
import { InputError } from '@/features/shared/lib/api-error'
import {
  dqAgingBand_, dqBandCounts_, dqBandInfo_, dqCheckpoints_, dqHuman_, dqJson_, dqNum_,
  dqOpenAgingFlags_, dqQueueView_, dqSlotIn_, dqSlotState_, dqSubmissionsFor_,
  dqValidateCheckin_, dqWeekStart_, dqWithCurrentTl_, DQ_AGING_FIELDS, DQ_AGING_LIST_CAP, DQ_CHANNELS,
} from './index'
import { dqAddDays_, dqDateKey_, dqSetting_, formatDate_, normEmail_, type Cfg } from '@/features/shared/lib/adapters'
import { DQ_AGING_FLAGS_TABLE, DQ_QUEUE_SUBMISSIONS_TABLE } from './server'

async function cfg_(): Promise<Cfg> {
  return (await configAll()) as Cfg
}

async function rosterRows_(): Promise<Record<string, unknown>[] | null> {
  const { data, error } = await db().from('roster').select('*')
  if (error) return null
  return data as Record<string, unknown>[]
}

// ---------------------------------------------------------------- getAgingPage (QueuePages.js:43)

/** Agents see their own tickets; TLs and admin see all, the TL's own team first. */
export async function getAgingPage(): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl', 'agent'])
  const cfg = await cfg_()
  let rows = dqWithCurrentTl_(await dqCachedLive('aging_open_tickets'), await rosterRows_())
  if (user.role === 'agent') rows = rows.filter((r) => r.agent_email === user.email)
  const list = rows.slice(0, DQ_AGING_LIST_CAP).map((r) => {
    const mine = user.role === 'tl' ? r.tl_email === user.email : user.role === 'agent'
    return [String(r.ticket_id), String(r.queue), String(r.status), r.actionable === true || r.actionable === 'TRUE' || r.actionable === 'true',
      String(r.country), dqNum_(r.age_h), dqNum_(r.band), String(r.agent_name), String(r.tl_name), mine, String(r.contact_type_1)]
  })
  let queues = (await dqCachedLive('agg_queue_now'))
    .filter((q) => q.kind === 'ticket')
    .map((q) => dqQueueView_(q, undefined, cfg))
  if (user.role === 'agent') {
    const mineQ: Record<string, Record<string, unknown>> = {}
    rows.forEach((r) => {
      const q = (mineQ[String(r.queue)] = mineQ[String(r.queue)] || { queue: r.queue, kind: 'ticket', open: 0, actionable: 0, unassigned: 0, oldestH: 0, bands: dqBandCounts_({}, cfg), overTop: 0, createdToday: 0, resolvedToday: 0, delta: null, byStatus: {}, sourceAsOf: '', stale: false })
      const bs = q.byStatus as Record<string, number>
      bs[String(r.status)] = (bs[String(r.status)] || 0) + 1
      ;(q.open as number)++
      ;(q.bands as number[])[dqNum_(r.band)]++
      q.oldestH = Math.max(q.oldestH as number, dqNum_(r.age_h))
    })
    queues = Object.keys(mineQ).map((k) => mineQ[k])
  }
  const flagStore = await readStore(DQ_AGING_FLAGS_TABLE)
  const flags = dqOpenAgingFlags_(flagStore.exists ? flagStore.rows : null, rows).filter(
    (f) => user.role !== 'agent' || f.by === user.email
  )
  return {
    now: new Date().toISOString(), dataAsOf: await dqLastRun('queue_aggregates'), syncedAt: (await dqLastRun('freshdesk_sync')) || '',
    bands: dqBandInfo_(cfg), fields: DQ_AGING_FIELDS, flags, you: user.email,
    tickets: list, total: rows.length, capped: rows.length > DQ_AGING_LIST_CAP, queues, scope: user.role,
    ticketUrl: 'https://' + String(dqSetting_(cfg, 'freshdesk_domain')) + '/a/tickets/', excludedGroups: dqSetting_(cfg, 'inflow_excluded_groups'),
  }
}

// ---------------------------------------------------------------- getAnalyticsPage (QueuePages.js:73)

/** Day (last 120 days), week (last 26) and month (last 13) inflow, one call. */
export async function getAnalyticsPage(): Promise<Record<string, unknown>> {
  await requireRole(['admin', 'tl'])
  const cfg = await cfg_()
  const today = dqDateKey_(new Date(), cfg)
  const countries: Record<string, boolean> = {}
  const pack = (rows: Record<string, unknown>[], keyField: string, from: string) => {
    const out: unknown[][] = [], partial: Record<string, boolean> = {}, periods: Record<string, boolean> = {}
    rows.forEach((r) => {
      const p = String(r[keyField])
      if (p < from) return
      periods[p] = true
      if (r.partial === true || r.partial === 'true' || r.partial === 'TRUE') partial[p] = true
      countries[String(r.country)] = true
      out.push([p, DQ_CHANNELS.indexOf(String(r.channel)), String(r.country), dqNum_(r.inflow)])
    })
    return { periods: Object.keys(periods).sort(), partial: Object.keys(partial), rows: out }
  }
  const day = pack(await dqCachedLive('agg_inflow_daily'), 'date', dqAddDays_(today, -119))
  day.partial = day.periods.indexOf(today) !== -1 ? [today] : []
  return {
    today, dataAsOf: await dqLastRun('inflow'), channels: DQ_CHANNELS,
    day,
    week: pack(await dqCachedLive('agg_inflow_weekly'), 'period', dqWeekStart_(dqAddDays_(today, -7 * 25))),
    month: pack(await dqCachedLive('agg_inflow_monthly'), 'period', dqAddDays_(today, -366).slice(0, 7)),
    countries: Object.keys(countries).sort(), excludedGroups: dqSetting_(cfg, 'inflow_excluded_groups'),
  }
}

// ---------------------------------------------------------------- getCheckinsPage (QueuePages.js:105)

/** One call for the Check-ins page: today's slots, the slot to fill, pre-fill, earlier answers. */
export async function getCheckinsPage(slotArg?: string | null): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  const cfg = await cfg_()
  const now = new Date()
  const tz = String(dqSetting_(cfg, 'business_tz'))
  const today = dqDateKey_(now, tz)
  const cps = dqCheckpoints_(today, cfg)
  const subStore = await readStore(DQ_QUEUE_SUBMISSIONS_TABLE)
  const subs = dqSubmissionsFor_(subStore.exists ? subStore.rows : null, [today])
  const bySlot: Record<string, Record<string, unknown>> = {}
  subs.forEach((s) => {
    bySlot[String(s.slot)] = s
  })
  const slots = cps.map((cp) => {
    const s = bySlot[cp.slot]
    return {
      slot: cp.slot, name: cp.name, at: cp.at.toISOString(), opensAt: cp.opensAt.toISOString(),
      dueAt: cp.dueAt.toISOString(), readAfter: cp.readAfter.toISOString(), cairo: dqSlotIn_(today, cp.slot, String(dqSetting_(cfg, 'data_tz')), cfg),
      state: dqSlotState_(cp, s, now),
      submittedBy: s ? String(s.updated_by || s.submitted_by) : '', submittedAt: s ? String(s.updated_at || s.submitted_at) : '',
    }
  })
  let current: (typeof slots)[number] | null = null
  for (let i = slots.length - 1; i >= 0; i--) if (now >= cps[i].opensAt) { current = slots[i]; break }
  if (!current) current = slots[0]
  const picked = slotArg ? slots.filter((sl, k) => sl.slot === String(slotArg) && now >= cps[k].opensAt)[0] : null
  if (picked) current = picked

  const snaps = (await dqCachedLive('agg_snapshots_today')).filter((r) => r.slot_date === today)
  const snapFor = (slot: string) => snaps.filter((r) => r.slot === slot)
  const frozen = snapFor(current.slot)
  const live = await dqCachedLive('agg_queue_now')
  const source = frozen.length ? frozen : live
  const liveBy: Record<string, Record<string, unknown>> = {}
  live.forEach((q) => { liveBy[String(q.queue)] = q })
  let prev: string | null = null
  for (let j = slots.indexOf(current) - 1; j >= 0 && !prev; j--) if (snapFor(slots[j].slot).length) prev = slots[j].slot
  const prevRows = prev ? snapFor(prev) : []
  const prevBy: Record<string, number> = {}
  prevRows.forEach((r) => { prevBy[String(r.queue)] = Number(r.open) })

  const existing = bySlot[current.slot]
  let carriedFrom: string | null = null
  let base: Record<string, unknown> | null | undefined = existing
  if (!base) {
    for (let k = slots.indexOf(current) - 1; k >= 0 && !base; k--) if (bySlot[slots[k].slot]) { base = bySlot[slots[k].slot]; carriedFrom = slots[k].slot }
  }
  const existingQueues = base ? dqJson_<{ queue: string; agents?: number; status?: string; note?: string; openCorrected?: number }[]>(base.queues_json, []) : []
  const exBy: Record<string, (typeof existingQueues)[number]> = {}
  existingQueues.forEach((q) => { exBy[q.queue] = q })
  const edges = dqSetting_(cfg, 'aging_bands_h') as number[]
  const prefill = source.map((q) => {
    const ex = exBy[String(q.queue)] || {}
    return {
      queue: String(q.queue), open: Number(q.open) || 0, oldestH: Number(q.oldest_h) || 0,
      oldestBand: dqAgingBand_(Number(q.oldest_h) || 0, edges),
      unassigned: Number(q.unassigned) || 0,
      byStatus: dqJson_(q.by_status_json, {}) || {}, stale: q.stale === true || String(q.stale).toLowerCase() === 'true',
      delta: prev && prevBy[String(q.queue)] !== undefined ? (Number(q.open) || 0) - prevBy[String(q.queue)] : null,
      agents: ex.agents !== undefined ? ex.agents : null, status: ex.status || '', note: ex.note || '',
      openCorrected: existing && ex.openCorrected !== undefined ? ex.openCorrected : null,
      sourceAsOf: String(q.source_as_of || (liveBy[String(q.queue)] || {}).source_as_of || ''),
      kind: String(q.kind || (liveBy[String(q.queue)] || {}).kind || 'ticket'),
    }
  }).sort((a, b) => b.open - a.open)

  const yesterday = dqAddDays_(today, -1)
  const lastYesterday = dqSubmissionsFor_(subStore.exists ? subStore.rows : null, [yesterday]).sort((a, b) => (String(a.slot) < String(b.slot) ? 1 : -1))[0]
  const earlierRows = subs.filter((s) => s.slot !== current.slot).sort((a, b) => (String(a.slot) < String(b.slot) ? -1 : 1))
  if (lastYesterday) earlierRows.unshift(lastYesterday)
  const earlier = earlierRows.map((s) => ({
    slot: s.slot, date: s.slot_date, by: String(s.updated_by || s.submitted_by), at: String(s.updated_at || s.submitted_at),
    queues: dqJson_(s.queues_json, []), generalNote: String(s.general_note || ''),
    helpNeeded: String(s.help_needed) === 'true' || s.help_needed === true, helpNote: String(s.help_note || ''),
    late: String(s.status) === 'late',
  }))
  return {
    today, now: now.toISOString(), slots, current: current.slot,
    frozen: frozen.length > 0, dataAsOf: frozen.length ? String(frozen[0].data_as_of) : await dqLastRun('queue_aggregates'),
    previousSlot: prev, prefill, carriedFrom, earlier, you: user.email,
    existing: existing ? { generalNote: String(existing.general_note || ''), helpNeeded: String(existing.help_needed) === 'true' || existing.help_needed === true,
      helpNote: String(existing.help_note || ''), correctionReason: String(existing.correction_reason || '') } : null,
  }
}

// ---------------------------------------------------------------- submitCheckin (QueuePages.js:233)

/** Submits (or corrects) today's check-in for a slot. The submitter is stamped by the repo. */
export async function submitCheckin(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const cfg = await cfg_()
  const now = new Date()
  const today = dqDateKey_(now, String(dqSetting_(cfg, 'business_tz')))
  const cp = dqCheckpoints_(today, cfg).filter((c) => c.slot === String((payload || {}).slot))[0]
  if (!cp) throw new InputError('Unknown check-in slot.')
  if (now < cp.opensAt) throw new InputError('The ' + cp.slot + ' check-in opens at ' + formatDate_(cp.opensAt, String(dqSetting_(cfg, 'business_tz')), 'HH:mm') + '.')
  const snaps = (await dqCachedLive('agg_snapshots_today')).filter((r) => r.snapshot_key === cp.key)
  const auto: Record<string, number> = {}
  ;(snaps.length ? snaps : await dqCachedLive('agg_queue_now')).forEach((r) => {
    auto[String(r.queue)] = Number(r.open) || 0
  })
  const rec = dqValidateCheckin_(payload, auto, cfg)
  const row: Record<string, unknown> = {
    slot_date: today, slot: rec.slot, snapshot_key: snaps.length ? cp.key : '', status: now > cp.dueAt ? 'late' : 'submitted',
    queues_json: rec.queues, corrections_json: rec.corrections, correction_reason: rec.correctionReason,
    general_note: rec.generalNote, help_needed: rec.helpNeeded, help_note: rec.helpNote,
  }
  const existing = dqSubmissionsFor_((await readStore(DQ_QUEUE_SUBMISSIONS_TABLE)).rows, [today]).filter((s) => s.slot === rec.slot)[0]
  let saved: Record<string, unknown> | null
  if (existing) {
    saved = await updateRow(DQ_QUEUE_SUBMISSIONS_TABLE, 'submission_id', existing.submission_id, row, { actor: user.email })
  } else {
    row.submission_id = newId('qs')
    saved = await appendRow(DQ_QUEUE_SUBMISSIONS_TABLE, row, user.email)
  }
  await resolvePopups('queue_checkin_missed', cp.key, user.email)
  if (rec.helpNeeded) {
    const adminTo = String((await getConfig('admin_emails', '')) || '').split(',')[0]
    await sendMail(
      { to: adminTo, subject: 'Help needed at the ' + cp.slot + ' check-in',
        htmlBody: '<p>' + escapeHtml(user.name) + ' asked for help at the ' + cp.slot + ' check-in:</p><p>' + escapeHtml(String(rec.helpNote)) + '</p>' },
      user.email
    )
  }
  return { slot: rec.slot, status: row.status, submittedBy: String((saved || {}).updated_by || (saved || {}).submitted_by), submittedAt: String((saved || {}).updated_at || (saved || {}).submitted_at) }
}

// ---------------------------------------------------------------- refreshQueueViaHub -> refreshQueueNow (Aggregates.js:443)

const DQ_REFRESH_THROTTLE_S = 120

/**
 * "Refresh now" on Queue health and Aging (TL, admin): Freshdesk delta, queue
 * and aging rebuild, check-in capture (idempotent). The Hub round-trip is gone —
 * this app hosts the sync — the 120 s throttle and the payload are verbatim.
 */
export async function refreshQueueNow(): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const { refreshQueueNowJob, dqSyncedToIso } = await import('./jobs')
  const syncedTo = async () => {
    const c = await dqSyncedToIso()
    return c || ''
  }
  const chatsNote = ' Chats come from the daily report and are not refreshed here.'
  const busy = async (last: { at?: number; by?: string; name?: string; running?: boolean } | null) => {
    const l = last || { at: Date.now(), running: true }
    const waitS = Math.ceil((Number(l.at) + DQ_REFRESH_THROTTLE_S * 1000 - Date.now()) / 1000)
    const who = l.by === user.email ? 'You' : l.name || l.by || 'Someone'
    const at = formatDate_(new Date(Number(l.at)), String(dqSetting_(await cfg_(), 'business_tz')), 'HH:mm')
    return { refreshed: false, retryInS: Math.max(1, waitS), as_of: await dqLastRun('queue_aggregates'), synced_to: await syncedTo(),
      message: (l.running ? who + ' started a refresh at ' + at + '; it is still running.' : who + ' refreshed at ' + at + '.') +
        ' Try again in ' + Math.max(1, waitS) + ' s.' }
  }
  const readLast = () => {
    try {
      return JSON.parse(cacheGet('dq_refresh_now') || 'null')
    } catch {
      return null
    }
  }
  const last = readLast()
  if (last && Number(last.at) + DQ_REFRESH_THROTTLE_S * 1000 > Date.now()) return busy(last)
  cachePut('dq_refresh_now', JSON.stringify({ at: Date.now(), by: user.email, name: user.name, running: true }), DQ_REFRESH_THROTTLE_S)
  const out = await refreshQueueNowJob()
  if (!out.agg) cacheRemove('dq_refresh_now')
  else cachePut('dq_refresh_now', JSON.stringify({ at: Date.now(), by: user.email, name: user.name }), DQ_REFRESH_THROTTLE_S)
  return {
    refreshed: !!out.agg, retryInS: out.agg ? DQ_REFRESH_THROTTLE_S : 0,
    message: (out.tick.reason ? String(out.tick.reason) + '.' : (out.sync && (out.sync as Record<string, unknown>).done === false ? 'Freshdesk has more changes; the rest arrive on the next 15-minute run.' : '')) + chatsNote,
    as_of: await dqLastRun('queue_aggregates'), synced_to: await syncedTo(),
  }
}

// ---------------------------------------------------------------- AgingHelp.js

/** agingFlagTicket verbatim (AgingHelp.js:10): agent/TL flags an aged ticket with a note. */
export async function agingFlagTicket(ticketId: unknown, note: unknown): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl', 'agent'])
  await assertWritable()
  const id = String(ticketId || '').trim()
  const text = String(note || '').trim().slice(0, 1000)
  if (!text) throw new InputError('Say what is blocking it and what help you need.')
  const row = dqWithCurrentTl_(await dqCachedLive('aging_open_tickets'), await rosterRows_()).filter(
    (r) => String(r.ticket_id) === id
  )[0]
  if (!row) throw new InputError('Ticket ' + id + ' is not on the aging board any more.', 404)
  if (user.role === 'agent' && normEmail_(row.agent_email) !== user.email) {
    throw new InputError('You can ask for help only on your own tickets.', 403)
  }
  const tl = normEmail_(row.tl_email) || user.tlEmail || ''
  const { data: openRows, error } = await db()
    .from(DQ_AGING_FLAGS_TABLE)
    .select('*')
    .eq('ticket_id', id)
    .is('resolved_at', null)
    .limit(1)
  if (error) throw new Error(error.message)
  const open = (openRows || [])[0]
  const saved = open
    ? await updateRow(DQ_AGING_FLAGS_TABLE, 'flag_id', open.flag_id, { note: text, tl_email: tl }, { actor: user.email, stampUpdates: false })
    : await appendRow(DQ_AGING_FLAGS_TABLE, { flag_id: newId('flag'), ticket_id: id, note: text, tl_email: tl, resolved_at: null, resolved_by: '', resolved_note: '' }, user.email)
  if (tl && tl !== user.email) {
    await raisePopup(
      { recipient: tl, kind: 'aging_help', ref: String((saved || open).flag_id),
        title: user.name + ' needs help with ticket #' + id,
        body: text + ' (' + String(row.queue) + ', ' + String(row.status) + ', open ' + dqHuman_(dqNum_(row.age_h)) + ')',
        link: '#/aging?ticket=' + id },
      user.email
    )
  }
  return { flagId: String((saved || open).flag_id), ticketId: id, note: text, tlEmail: tl, by: user.email, at: String((saved || open).submitted_at || '') }
}

/** agingResolveFlag verbatim (AgingHelp.js:35): TL or admin marks the flag handled. */
export async function agingResolveFlag(flagId: unknown, note: unknown): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const f = await findRow(DQ_AGING_FLAGS_TABLE, 'flag_id', String(flagId))
  if (!f) throw new InputError('That help request no longer exists.', 404)
  if (user.role === 'tl' && normEmail_(f.tl_email) !== user.email) {
    throw new InputError("Only the ticket's team lead or an admin can close this.", 403)
  }
  await updateRow(
    DQ_AGING_FLAGS_TABLE,
    'flag_id',
    String(flagId),
    { resolved_at: new Date().toISOString(), resolved_by: user.email, resolved_note: String(note || '').slice(0, 500) },
    { actor: user.email, stampUpdates: false }
  )
  await resolvePopups('aging_help', String(flagId), user.email)
  return { flagId: String(flagId) }
}
