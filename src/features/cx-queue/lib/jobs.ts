/**
 * Hub pipeline jobs — ports of Command_Center_V2_deprecated Queue.js
 * (dqCheckinTick_ / dqRemindMissedCheckins_) and Aggregates.js
 * (buildQueueAggregates_ / buildInflowAggregates_ / buildAgentAggregates_ /
 * jobDataTick / jobNightlyAggregates / refreshQueueNow internals).
 * Sheet stores become Postgres tables; the inflow hourly/queue snapshot stores
 * keep the legacy per-year layout via a `year` column.
 */

import 'server-only'

import { appendRow, db, cachePut } from '@/features/shared/platform/repo'
import { configAll, remindersOn } from '@/features/shared/platform/settings'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { dqCachedLive, dqLastRun, readStore } from '@/features/shared/platform/stores'
import { raisePopup } from '@/features/shared/platform/popups'
import { sendMail, escapeHtml } from '@/features/shared/platform/mail'
import { hbBeat, hbFlush } from '@/features/shared/platform/health'
import { described } from '@/features/shared/lib/errors'
import {
  dqAgingOpts_, dqAgentPerf_, dqBuildAging_, dqBuildChatQueue_, dqCheckpoints_, dqCountInflow_,
  dqPeopleIndex_, dqRollupInflow_, dqSubmissionsFor_, dqTickState_,
  DQ_SNAPSHOT_HEADERS,
} from './index'
import { dqAddDays_, dqDateKey_, dqRosterPeople_, dqSetting_, normEmail_, type Cfg } from '@/features/shared/lib/adapters'
import { dqSyncedTo_, fdSyncIncremental_, hasFreshdeskKey } from '@/features/shared/jobs/freshdesk'
import { DQ_QUEUE_SUBMISSIONS_TABLE } from './server'

export { dqSyncedTo_ }
export async function dqSyncedToIso(): Promise<string> {
  const d = await dqSyncedTo_()
  return d ? d.toISOString() : ''
}

async function cfg_(): Promise<Cfg> {
  return (await configAll()) as Cfg
}

/** dqLogRun_ seam -> refresh_log. */
export async function dqLogRun_(job: string, started: number, status: string, info: Record<string, unknown>): Promise<void> {
  await appendRow('refresh_log', {
    job, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(),
    rows_in: Number(info.rowsIn || 0), rows_out: Number(info.rowsOut || 0),
    source_cursor: info.cursor ? String(info.cursor) : '', status, error: String(info.error || ''),
    note: String(info.note || ''), log_id: '', type: 'job',
  }, 'system:job')
}

/** dqStep_ verbatim: run one job step, beat its heartbeat, log its failure, return null on error. */
async function dqStep_<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await fn()
    const sk = (r as { skipped?: unknown } | null | undefined)?.skipped
    hbBeat(name, 'ok', sk ? 'Skipped: ' + String(sk) : '')
    return r
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await dqLogRun_(name, Date.now(), 'error', { error: msg })
    hbBeat(name, 'error', msg)
    return null
  }
}

/** dqMarkRun_ verbatim: 'job last finished ok' stamp for dqLastRun_. */
export async function dqMarkRun_(job: string): Promise<void> {
  cachePut('dq_last_run_' + job, new Date().toISOString(), 60 * 60 * 24 * 30)
}

/** dqRewrite_ verbatim: replace all rows of a store table. */
async function dqRewrite_(table: string, rows: Record<string, unknown>[]): Promise<void> {
  const { error: delErr } = await db().from(table).delete().not('id', 'is', null)
  if (delErr) throw described(delErr, { table })
  if (!rows.length) return
  const { error } = await db().from(table).insert(rows)
  if (error) throw described(error, { table })
}

async function rosterPeople_(): Promise<ReturnType<typeof dqPeopleIndex_>> {
  const { data } = await db().from('roster').select('*')
  const roster = dqRosterPeople_((data as Record<string, unknown>[] | null) || null)
  const headcount = (roster || []).map((p) => ({ email: p.email, name: p.name, fdId: p.fdId, fdName: p.fdName, tlEmail: p.tlEmail, tlName: p.tlName }))
  return dqPeopleIndex_(headcount, await cfg_())
}

// ---------------------------------------------------------------- buildQueueAggregates_ (Aggregates.js:155)

export async function buildQueueAggregates_(now?: Date): Promise<Record<string, unknown>> {
  now = now || new Date()
  const started = Date.now()
  const cfg = await cfg_()
  const opts = dqAgingOpts_(cfg)
  // Lean read: every row needs status, group and the two dates; open rows outside the
  // excluded groups are the only ones whose full fields matter (the board).
  const { data: tickets, error } = await db()
    .from('tickets')
    .select('ticket_id,status,group_name,responder_id,created_at,resolved_at,country,channel,contact_type_1')
  if (error) throw described(error, { table: 'tickets' })
  const res = dqBuildAging_(tickets as Record<string, unknown>[], now, opts, await rosterPeople_())
  const syncedTo = await dqSyncedTo_()
  res.queues.forEach((r) => {
    r.source_as_of = syncedTo ? syncedTo.toISOString() : ''
  })
  try {
    const chats = (await readStore('freshchat')).rows.map((r) => (Array.isArray(r.cols) ? r.cols : []) as unknown[])
    if (chats.length) {
      const chatRow = dqBuildChatQueue_(chats, now, opts)
      res.queues.push(chatRow)
      const cr = chatRow as unknown as Record<string, unknown>
      hbBeat('daily_report', cr.stale ? 'warn' : 'ok', cr.stale ? 'Freshchat tab not updated since ' + String(cr.source_as_of || 'unknown') : '')
    } else hbBeat('daily_report', 'warn', 'Freshchat tab is empty')
  } catch (e) {
    /* Freshchat store absent: the board just has no chat row. */
    hbBeat('daily_report', 'error', 'Freshchat read failed: ' + (e instanceof Error ? e.message : String(e)))
  }
  await dqRewrite_('aging_open_tickets', res.aging)
  await dqRewrite_('agg_queue_now', res.queues)
  await dqMarkRun_('queue_aggregates')
  await dqLogRun_('queue_aggregates', started, 'ok', { rowsIn: (tickets || []).length, rowsOut: res.aging.length })
  const out = res as unknown as Record<string, unknown>
  out.builtAt = now
  const byStatus: Record<string, number> = {}
  ;(tickets || []).forEach((t) => {
    const s = String((t as Record<string, unknown>).status)
    byStatus[s] = (byStatus[s] || 0) + 1
  })
  out.byStatus = byStatus
  out.ticketsRead = (tickets || []).length
  return out
}

// ---------------------------------------------------------------- buildInflowAggregates_ (Aggregates.js:284)

export async function buildInflowAggregates_(opts?: { hourly?: boolean }): Promise<Record<string, unknown>> {
  opts = opts || {}
  const started = Date.now()
  const now = new Date()
  const cfg = await cfg_()
  const bizTz = String(dqSetting_(cfg, 'business_tz'))
  const today = dqDateKey_(now, bizTz)
  const fromKey = dqAddDays_(today, -Number(dqSetting_(cfg, 'inflow_lookback_days')))
  const people = await rosterPeople_()
  const since = dqAddDays_(fromKey, -1)
  const sinceMs = Date.parse(since)
  let chats: unknown[][] = []
  let calls: unknown[][] = []
  try {
    const { data: chatRows, error: chatErr } = await db().from('freshchat').select('cols')
    if (!chatErr) chats = ((chatRows || []) as Record<string, unknown>[]).map((r) => (Array.isArray(r.cols) ? r.cols : []) as unknown[])
  } catch (e) {
    hbBeat('daily_report', 'error', 'Freshchat read failed: ' + (e instanceof Error ? e.message : String(e)))
  }
  try {
    const { data: callRows, error: callErr } = await db().from('maqsam_calls').select('cols,dedupe_key,ts_ms').gte('ts_ms', sinceMs)
    if (!callErr) {
      calls = ((callRows || []) as Record<string, unknown>[]).map((r) => {
        const c = (Array.isArray(r.cols) ? r.cols : []) as unknown[]
        // Mirror cols are D..K; the legacy Maqsam read maps them back to [id, start, state, direction, country].
        return [r.dedupe_key || c[0] || '', c[0], c[2], c[3], c[7]]
      })
    }
  } catch (e) {
    hbBeat('daily_report', 'error', 'Maqsam read failed: ' + (e instanceof Error ? e.message : String(e)))
  }
  const escChannel = String(dqSetting_(cfg, 'inflow_escalation_channel'))
  const { data: tickets } = await db()
    .from('tickets')
    .select('ticket_id,channel,group_name,requester_id,status,created_at,country')
    .eq('channel', escChannel)
    .gte('created_at', since)
  const { fdSeenEscalations_ } = await import('@/features/shared/jobs/freshdesk')
  const counts = dqCountInflow_(
    { tickets: (tickets as Record<string, unknown>[]) || [], chats, calls },
    {
      fromKey, toKey: today, bizTz, dataTz: String(dqSetting_(cfg, 'data_tz')),
      excluded: dqSetting_(cfg, 'inflow_excluded_groups'), escChannel,
      escStatuses: dqSetting_(cfg, 'inflow_escalation_statuses') as string[], escSeen: await fdSeenEscalations_(),
      cxIds: people.cxIds, chatCountryMap: dqSetting_(cfg, 'chat_country_map'),
    }
  )
  // Upsert the window; stale keys inside a covered source range go to 0.
  const stamp = now.toISOString()
  const rangeFrom = Object.keys(counts.ranges).reduce((m, k) => (counts.ranges[k].from < m ? counts.ranges[k].from : m), fromKey)
  const { data: existing } = await db().from('agg_inflow_daily').select('*').gte('date', rangeFrom)
  const rows: Record<string, Record<string, unknown>> = {}
  ;(existing || []).forEach((r0) => {
    const r = r0 as Record<string, unknown>
    const rg = counts.ranges[String(r.channel)]
    if (rg && String(r.date) >= rg.from && String(r.date) <= rg.to) {
      rows[String(r.date) + '|' + r.channel + '|' + r.country] = { date: r.date, channel: r.channel, country: r.country, inflow: 0, updated_at: stamp }
    }
  })
  Object.keys(counts.daily).forEach((k) => {
    const p = k.split('|')
    rows[k] = { date: p[0], channel: p[1], country: p[2], inflow: counts.daily[k], updated_at: stamp }
  })
  const upserts = Object.keys(rows).map((k) => rows[k])
  if (upserts.length) {
    const { error } = await db().from('agg_inflow_daily').upsert(upserts, { onConflict: 'date,channel,country' })
    if (error) throw described(error, { table: 'agg_inflow_daily' })
  }
  if (opts.hourly) {
    const byYear: Record<string, Record<string, unknown>[]> = {}
    Object.keys(counts.hourly).forEach((k) => {
      const p = k.split('|')
      ;(byYear[p[0].slice(0, 4)] = byYear[p[0].slice(0, 4)] || []).push({ date: p[0], hour: Number(p[1]), channel: p[2], country: p[3], inflow: counts.hourly[k], year: Number(p[0].slice(0, 4)) })
    })
    for (const y of Object.keys(byYear)) {
      const { error } = await db().from('agg_inflow_hourly').upsert(byYear[y], { onConflict: 'date,hour,channel,country,year' })
      if (error) throw described(error, { table: 'agg_inflow_hourly' })
    }
  }
  const { data: all } = await db().from('agg_inflow_daily').select('*')
  await dqRewrite_('agg_inflow_weekly', dqRollupInflow_((all as Record<string, unknown>[]) || [], 'week', today))
  await dqRewrite_('agg_inflow_monthly', dqRollupInflow_((all as Record<string, unknown>[]) || [], 'month', today))
  await dqMarkRun_('inflow')
  await dqLogRun_('inflow', started, 'ok', { rowsIn: ((tickets || []).length) + chats.length + calls.length, rowsOut: upserts.length })
  return counts as unknown as Record<string, unknown>
}

// ---------------------------------------------------------------- buildAgentAggregates_ (Aggregates.js:392)

export async function buildAgentAggregates_(): Promise<void> {
  const started = Date.now()
  const cfg = await cfg_()
  const today = dqDateKey_(new Date(), cfg)
  const { data } = await db().from('prod_daily_layers').select('*')
  const rows = (data as Record<string, unknown>[]) || []
  if (Number(today.slice(5, 7)) <= 2) {
    // Last year's rows share the same store; nothing extra to read in Postgres.
  }
  const res = dqAgentPerf_(rows, (await rosterPeople_()).byEmail, today)
  await dqRewrite_('agg_agent_perf', res.perf)
  await dqRewrite_('agg_agent_daily', res.daily)
  await dqMarkRun_('agent_aggregates')
  await dqLogRun_('agent_aggregates', started, 'ok', { rowsIn: rows.length, rowsOut: res.perf.length })
}

// ---------------------------------------------------------------- Queue.js check-in tick

/** dqActiveTlEmails_ verbatim: active TL emails on the roster. */
async function dqActiveTlEmails_(): Promise<string[]> {
  const { data } = await db().from('roster').select('email,name,role,active')
  const out: string[] = []
  ;(data || []).forEach((r) => {
    const row = r as Record<string, unknown>
    const active = row.active === '' || row.active === true || String(row.active).toLowerCase() === 'true'
    const e = normEmail_(row.email)
    if (active && String(row.role) === 'tl' && e && out.indexOf(e) === -1) out.push(e)
  })
  return out
}

/** dqRemindMissedCheckins_ verbatim. */
export async function dqRemindMissedCheckins_(now: Date, cps: ReturnType<typeof dqCheckpoints_>): Promise<void> {
  const on = await remindersOn()
  const cfg = await cfg_()
  const owners = (dqSetting_(cfg, 'checkin_owner_emails') || {}) as Record<string, string[]>
  const due = cps.filter((cp) => now > cp.dueAt && now.getTime() - cp.dueAt.getTime() < 12 * 3600000)
  if (!due.length) return
  const dueDates = due.map((c) => c.date)
  const { data: subRows, error: subErr } = await db().from(DQ_QUEUE_SUBMISSIONS_TABLE).select('*').in('slot_date', dueDates)
  const subs = dqSubmissionsFor_(subErr ? null : ((subRows || []) as Record<string, unknown>[]), dueDates)
  const done: Record<string, boolean> = {}
  subs.forEach((s) => {
    done[String(s.slot_date) + '|' + s.slot] = true
  })
  const missed = due.filter((cp) => !done[cp.key])
  if (!missed.length) return
  let tls: string[] | null = null
  const sent: Record<string, boolean> = {}
  const { data: popups } = await db().from('popups').select('ref,recipient').eq('kind', 'queue_checkin_missed')
  ;(popups || []).forEach((r) => {
    const p = r as Record<string, unknown>
    sent[String(p.ref) + '|' + normEmail_(p.recipient)] = true
  })
  for (const cp of missed) {
    let list = owners[cp.slot]
    if (!list || !list.length) list = tls = tls || (await dqActiveTlEmails_())
    for (const email of list) {
      if (sent[cp.key + '|' + normEmail_(email)]) continue
      sent[cp.key + '|' + normEmail_(email)] = true
      const title = 'The ' + cp.slot + ' queue check-in was not submitted'
      await raisePopup(
        { recipient: email, kind: 'queue_checkin_missed', ref: cp.key, title,
          body: cp.name + ' check-in for ' + cp.date + ' is past due. Submit it from Check-ins.', link: '#/checkins' },
        'system:job'
      )
      if (on) await sendMail(
        { to: email, subject: title,
          htmlBody: '<p>The ' + escapeHtml(cp.name) + ' check-in (' + cp.slot + ' Kuwait, ' + cp.date + ') has not been submitted. Open Dabdoob CX, Check-ins, and submit it.</p>' },
        'system:job'
      )
    }
  }
}

/**
 * dqCheckinTick_ verbatim: capture each due slot's snapshot (idempotent), keep
 * agg_snapshots_today live, raise missed-check-in reminders.
 */
export async function dqCheckinTick_(now: Date | null, tick: Record<string, unknown> | null): Promise<number> {
  now = now || new Date()
  const cfg = await cfg_()
  const tz = String(dqSetting_(cfg, 'business_tz'))
  const today = dqDateKey_(now, tz)
  const cps = dqCheckpoints_(dqAddDays_(today, -1), cfg).concat(dqCheckpoints_(today, cfg))
  const year = Number(today.slice(0, 4))
  const have: Record<string, boolean> = {}
  const { data: snapKeys } = await db().from('queue_snapshots').select('snapshot_key').eq('year', year)
  ;(snapKeys || []).forEach((r) => {
    have[String((r as Record<string, unknown>).snapshot_key)] = true
  })
  let live: Record<string, unknown>[] | null = null
  let captured = 0
  let todays = (((await db().from('queue_snapshots').select('*').eq('year', year).eq('slot_date', today).order('snapshot_key', { ascending: false }).limit(400)).data) || []) as Record<string, unknown>[]
  const syncedTo = await dqSyncedTo_()
  for (const cp of cps) {
    if (now < cp.readAfter || have[cp.key]) continue
    if (now.getTime() - cp.at.getTime() > 6 * 3600000) continue
    if (tick && (!tick.fresh || (tick.aggAt && new Date(String(tick.aggAt)) < cp.readAfter))) {
      hbBeat('queue_snapshot', 'warn', 'Check-in ' + cp.key + ' not captured yet: ' + String(tick.reason || 'aggregates built before the read time'))
      continue
    }
    live = live || (await dqCachedLive('agg_queue_now'))
    const asOf = syncedTo || new Date(now.getTime() - Number(dqSetting_(cfg, 'checkin_read_delay_min')) * 60000)
    const rows = live.map((q) => ({
      snapshot_key: cp.key, slot_date: cp.date, slot: cp.slot, captured_at: now.toISOString(), data_as_of: asOf.toISOString(),
      late: now.getTime() > cp.at.getTime() + 3600000, queue: q.queue, open: q.open, actionable: q.actionable,
      unassigned: q.unassigned, oldest_h: q.oldest_h, bands_json: q.bands_json,
      over_top: q.over_top, created_today: q.created_today, resolved_today: q.resolved_today,
      stale: q.stale, by_status_json: q.by_status_json, year: Number(cp.date.slice(0, 4)),
    }))
    if (rows.length) {
      const { error } = await db().from('queue_snapshots').upsert(rows, { onConflict: 'snapshot_key,queue' })
      if (error) throw described(error, { table: 'queue_snapshots' })
      captured++
      hbBeat('queue_snapshot', 'ok', 'Captured ' + cp.key)
      if (cp.date === today) todays = todays.concat(rows)
    }
  }
  await dqRewrite_('agg_snapshots_today', todays)
  await dqRemindMissedCheckins_(now, cps)
  return captured
}

// ---------------------------------------------------------------- job entry points (Aggregates.js)

/** jobDataTick verbatim: Freshdesk delta -> queue + aging -> inflow (hourly) -> check-in snapshots. */
export async function jobDataTick(): Promise<Record<string, unknown>> {
  await requireJobCaller()
  try {
    const now = new Date()
    const sync = await dqStep_('freshdesk_sync', async () => {
      if (!hasFreshdeskKey()) {
        await dqLogRun_('freshdesk_sync', Date.now(), 'skipped', { note: 'FRESHDESK_API_KEY is not set; ticket state left as-is.' })
        return { skipped: 'FRESHDESK_API_KEY is not set' }
      }
      return fdSyncIncremental_(150000)
    })
    const agg = await dqStep_('queue_aggregates', () => buildQueueAggregates_(new Date()))
    const last = await dqLastRun('inflow')
    if (!last || now.getTime() - new Date(last).getTime() > 55 * 60000) {
      await dqStep_('inflow', () => buildInflowAggregates_({}))
    }
    const captured = await dqStep_('checkin_tick', () => dqCheckinTick_(new Date(), dqTickState_(sync, agg as Record<string, unknown> | null)))
    return { sync, agg: agg ? { aging: (agg as Record<string, unknown[]>).aging.length, queues: (agg as Record<string, unknown[]>).queues.length } : null, captured }
  } finally {
    await hbFlush()
  }
}

/** The refreshQueueNow internals (Aggregates.js:466): sync -> aggregates -> checkin capture. */
export async function refreshQueueNowJob(): Promise<{ sync: unknown; agg: Record<string, unknown> | null; tick: Record<string, unknown> }> {
  const sync = await dqStep_('freshdesk_sync', async () => {
    if (!hasFreshdeskKey()) return { skipped: 'FRESHDESK_API_KEY is not set' }
    return fdSyncIncremental_(90000)
  })
  const agg = await dqStep_('queue_aggregates', () => buildQueueAggregates_(new Date()))
  const tick = dqTickState_(sync, agg as Record<string, unknown> | null)
  await dqStep_('checkin_tick', () => dqCheckinTick_(new Date(), tick))
  await hbFlush()
  return { sync, agg: agg as Record<string, unknown> | null, tick }
}

/** jobNightlyAggregates verbatim: agent aggregates -> inflow incl. hourly -> year rollover. */
export async function jobNightlyAggregates(): Promise<Record<string, unknown>> {
  await requireJobCaller()
  const cfg = await cfg_()
  try {
    await dqStep_('agent_aggregates', buildAgentAggregates_)
    await dqStep_('inflow', () => buildInflowAggregates_({ hourly: true }))
    await dqStep_('year_rollover', async () => {
      const today = dqDateKey_(new Date(), cfg)
      if (today.slice(5) >= '12-15') {
        // Postgres stores are not per-year spreadsheets: nothing to provision.
        // The `year` columns keep the legacy partitioning semantics.
      }
      return null
    })
    return { ok: true }
  } finally {
    await hbFlush()
  }
}

export { DQ_SNAPSHOT_HEADERS }
