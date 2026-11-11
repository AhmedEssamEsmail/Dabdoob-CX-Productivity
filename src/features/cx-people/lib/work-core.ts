/**
 * WorkCore.js + PeopleCore.js read-side helpers (the "shared by every app"
 * half): pwRows_/pwRowsAll_, pwTaskContext_, pwTasksOut_, pwNextMeetings_.
 *
 * The write side (actions/tasks/meetings engines) lands in the cx-people
 * module shard; these are the cross-app readers Home/TL-queue already need.
 *
 * Datastore change: pwRows_ reads Postgres via repo.ts — a missing table is []
 * exactly like a missing tab (tableExists_). The per-execution calendar memo
 * GAS kept inside pwWorkingHours_ becomes an explicit per-owner prefetch in
 * pwTaskContext_ (ctx.calFor slices it by date window, so the pure math in
 * scorecard/pwWorkingHours_ runs verbatim).
 */

import 'server-only'

import {
  d0num_,
  pwActionOut_,
  pwFit_,
  pwFreeHours_,
  pwIsOpenStatus_,
  pwLatestPercent_,
  pwRound1_,
  pwUpdateOut_,
  pwWorkingHours_,
} from './scorecard'
import { pwDirectory, type Directory } from '@/features/shared/platform/identity'
import { getWorkingCalendar, type WorkingDay } from '@/features/shared/platform/calendar'
import { readStore, type StoreRead } from '@/features/shared/platform/stores'
import { configAll } from '@/features/shared/platform/settings'
import {
  normEmail_,
  type Cfg,
  pwAddDays_,
  pwDateOnly_,
  pwIso_,
  pwKwDate_,
  pwMs_,
  pwToday_,
  PW_DAY_MS,
} from '@/features/shared/lib/adapters'

// ---------------------------------------------------------------- reading tables (PeopleCore)

/** Concurrent same-table reads share one fetch; the promise drops on settle (no completed-result caching). */
const pwRowsInflight_ = new Map<string, Promise<StoreRead>>()

/** pwRows_: rows of a table; [] when it does not exist. `one_on_one_logs` hides soft-deleted rows. */
export async function pwRows_(name: string, where?: (r: Record<string, unknown>) => boolean): Promise<Record<string, unknown>[]> {
  let p = pwRowsInflight_.get(name)
  if (!p) {
    p = readStore(name)
    pwRowsInflight_.set(name, p)
    const drop = () => pwRowsInflight_.delete(name)
    p.then(drop, drop)
  }
  const { rows, exists } = await p
  if (!exists) return []
  let out = rows.slice()
  if (name === 'one_on_one_logs') out = out.filter((r) => !r.deleted_at)
  return where ? out.filter(where) : out
}

/** pwRowsAll_: every row, deleted ones included (admin lists, restore). */
export async function pwRowsAll_(name: string, where?: (r: Record<string, unknown>) => boolean): Promise<Record<string, unknown>[]> {
  const { rows, exists } = await readStore(name)
  if (!exists) return []
  return where ? rows.filter(where) : rows
}

// ---------------------------------------------------------------- task context (WorkCore)

export interface TaskContext {
  dir: Directory
  actions: Record<string, unknown>[]
  details: Record<string, unknown>[]
  updates: Record<string, unknown>[]
  planned: Record<string, unknown>[]
  now: number
  cfg: Cfg
  /** Prefetched per-owner calendar sliced to [fromDate, toDate] (getWorkingCalendar_ output). */
  calFor: (owner: string, fromDate: string, toDate: string) => WorkingDay[]
  /** pwWorkingDaysBetween_: working days for `email` strictly after `from`, up to and including `to`. */
  workdaysBetween: (owner: string, from: string, to: string) => number
}

/**
 * pwTaskContext_: loads the task tables once, then prefetches one working
 * calendar per owner covering [min task start, max(task end, today)] — the
 * same days getWorkingCalendar_ would return per query, read once per person
 * instead of once per task window.
 */
export async function pwTaskContext_(): Promise<TaskContext> {
  const [dir, actions, details, updates, planned, cfg] = await Promise.all([
    pwDirectory(),
    pwRows_('actions', (a) => a.track_as_task === true || String(a.track_as_task).toLowerCase() === 'true'),
    pwRows_('action_task_details'),
    pwRows_('action_updates'),
    pwRows_('action_planned_milestones'),
    configAll(),
  ])
  // Legacy readTable_ returned sheet append order; readAllPaged now returns
  // pk-asc. The store's implicit serial id carries the append order where it
  // exists; rows without one keep the read order (stable sort).
  actions.sort((x, y) => {
    const xi = Number(x.id)
    const yi = Number(y.id)
    if (!Number.isFinite(xi) || !Number.isFinite(yi)) return 0
    return xi - yi
  })
  const now = Date.now()
  const today = pwToday_(now)
  const detailBy = new Set(details.map((d) => String(d.action_id)))
  const owners: Record<string, { from: string; to: string }> = {}
  actions.forEach((a) => {
    if (!detailBy.has(String(a.action_id))) return
    const d = details.find((x) => String(x.action_id) === String(a.action_id))!
    const owner = normEmail_(a.owner_email)
    if (!owner) return
    const from = pwKwDate_(pwMs_(d.start_at)) || today
    const to = pwKwDate_(pwMs_(d.deadline_at)) || today
    const cur = owners[owner]
    owners[owner] = {
      from: cur && cur.from < from ? cur.from : from,
      to: cur && cur.to > to ? cur.to : to,
    }
  })
  const calIndex: Record<string, WorkingDay[]> = {}
  await Promise.all(
    Object.keys(owners).map(async (owner) => {
      const o = owners[owner]
      const to = o.to > today ? o.to : today
      try {
        calIndex[owner] = await getWorkingCalendar(owner, o.from, to)
      } catch {
        calIndex[owner] = []
      }
    }),
  )
  const calFor = (owner: string, fromDate: string, toDate: string): WorkingDay[] =>
    (calIndex[owner] || []).filter((d) => d.date >= fromDate && d.date <= toDate)
  const workdaysBetween = (owner: string, from: string, to: string): number => {
    if (!(to > from)) return 0
    return calFor(owner, pwAddDays_(from, 1), to).filter((d) => d.working).length
  }
  return { dir, actions, details, updates, planned, now, cfg, calFor, workdaysBetween }
}

/** pwTasksOut_: the client shape of every task in ctx, with hours, fit and risk computed live. */
export function pwTasksOut_(ctx: TaskContext): Record<string, unknown>[] {
  const detailBy: Record<string, Record<string, unknown>> = {}
  ctx.details.forEach((d) => {
    detailBy[String(d.action_id)] = d
  })
  const updatesBy: Record<string, Record<string, unknown>[]> = {}
  ctx.updates.forEach((u) => {
    const k = String(u.action_id)
    ;(updatesBy[k] = updatesBy[k] || []).push(u)
  })
  Object.keys(updatesBy).forEach((k) => {
    updatesBy[k].sort((a, b) => pwMs_(a.submitted_at) - pwMs_(b.submitted_at))
  })

  const base = ctx.actions
    .filter((a) => detailBy[String(a.action_id)])
    .map((a) => {
      const d = detailBy[String(a.action_id)]
      const ups = updatesBy[String(a.action_id)] || []
      const est = Number(d.est_hours) || 0
      const pct = pwLatestPercent_(ups)
      return {
        a,
        d,
        ups,
        est,
        pct,
        startMs: pwMs_(d.start_at),
        endMs: pwMs_(d.deadline_at),
        owner: normEmail_(a.owner_email),
        open: pwIsOpenStatus_(String(a.status || 'open')),
      }
    })

  const openByOwner: Record<string, typeof base> = {}
  base.forEach((o) => {
    if (o.open) (openByOwner[o.owner] = openByOwner[o.owner] || []).push(o)
  })
  const plannedBy: Record<string, Record<string, unknown>[]> = {}
  ctx.planned.forEach((p) => {
    const k = String(p.action_id)
    ;(plannedBy[k] = plannedBy[k] || []).push(p)
  })

  return base.map((t) => {
    const others = (openByOwner[t.owner] || [])
      .filter((o) => o !== t && o.open && o.owner === t.owner && o.startMs < t.endMs && o.endMs > t.startMs)
      .map((o) => ({ startMs: o.startMs, endMs: o.endMs, remaining: o.est * (1 - o.pct / 100) }))
    const calFor = (fromDate: string, toDate: string) => ctx.calFor(t.owner, fromDate, toDate)
    const wh = pwWorkingHours_(calFor(pwKwDate_(t.startMs), pwKwDate_(t.endMs)), ctx.cfg, t.owner, t.startMs, t.endMs)
    const free = pwFreeHours_(calFor, ctx.cfg, t.owner, t.startMs, t.endMs, others)
    const elapsed = pwWorkingHours_(
      calFor(pwKwDate_(t.startMs), pwKwDate_(Math.min(ctx.now, t.endMs))),
      ctx.cfg,
      t.owner,
      t.startMs,
      Math.min(ctx.now, t.endMs),
    ).hours
    const status = String(t.a.status || 'open')
    const lastUpdate = t.ups.length ? t.ups[t.ups.length - 1] : null
    const lastUpdateMs = lastUpdate ? pwMs_(lastUpdate.submitted_at) : NaN
    const overdue = t.open && ctx.now > t.endMs
    const fit = pwFit_(t.est, free)
    const reasons: string[] = []
    if (overdue) reasons.push('Past the deadline')
    if (t.open && fit === 'does_not_fit') reasons.push('Estimate does not fit the free hours')
    if (t.open && String(t.d.rag_self) === 'off_track') reasons.push('Owner says off track')
    const since = lastUpdate ? pwKwDate_(lastUpdateMs) : pwKwDate_(t.startMs)
    if (t.open && ctx.now > t.startMs && ctx.workdaysBetween(t.owner, since, pwToday_(ctx.now)) >= 3)
      reasons.push('No update in 3 working days')
    const plannedRows = plannedBy[String(t.a.action_id)] || []
    const out = pwActionOut_(t.a, ctx.dir) as Record<string, unknown>
    out.priority = String(t.d.priority || 'P2')
    out.startAt = pwIso_(t.d.start_at)
    out.deadlineAt = pwIso_(t.d.deadline_at)
    out.estHours = t.est
    out.hours = {
      available: pwRound1_(wh.hours),
      free: pwRound1_(free),
      elapsed: pwRound1_(elapsed),
      atAssignment: d0num_(t.d.available_hours),
      estimated: wh.estimated,
    }
    out.fitStatus = fit
    out.progressState =
      status === 'open' ? (String(t.d.progress_state) === 'in_progress' || t.ups.length ? 'in_progress' : 'not_started') : status
    out.blockedReason = String(t.d.blocked_reason || '')
    out.ragSelf = String(t.d.rag_self || '')
    out.percent = t.pct
    out.deliveredAt = pwIso_(t.d.delivered_at)
    out.deliveryRef = String(t.d.delivery_ref || '')
    out.actualHours = t.d.actual_hours === '' ? null : Number(t.d.actual_hours)
    out.sourceLabel = String(t.d.source_label || '')
    out.assignedAnyway = t.d.assigned_anyway === true || String(t.d.assigned_anyway).toLowerCase() === 'true'
    out.expectation = String(t.d.expectation || '')
    out.outcomeRating = String(t.d.outcome_rating || '')
    out.outcomeNote = String(t.d.outcome_note || '')
    out.ratedBy = t.d.rated_by ? ctx.dir.name(String(t.d.rated_by)) : ''
    out.ratedAt = pwIso_(t.d.rated_at)
    out.milestones = t.ups.map((u) => pwUpdateOut_(u, ctx.dir))
    out.planned = plannedRows.map((p) => ({
      milestoneId: String(p.milestone_id),
      label: String(p.label),
      targetDate: pwDateOnly_(p.target_date),
      doneByUpdateId: String(p.done_by_update_id || ''),
    }))
    out.lastUpdateAt = lastUpdate ? pwIso_(lastUpdate.submitted_at) : ''
    out.overdue = overdue
    out.riskReasons = reasons
    out.atRisk = reasons.length > 0
    return out
  })
}

// ---------------------------------------------------------------- meetings (WorkCore)

/** pwNextMeetings_: the next instance date per series — an open draft in the future, else the last closed one's next_meeting_at. */
export async function pwNextMeetings_(nowMs: number): Promise<{ series: Record<string, unknown>; at: string }[]> {
  const [meetings, series] = await Promise.all([pwRows_('meetings'), pwRows_('meeting_series')])
  const out: { series: Record<string, unknown>; at: string }[] = []
  series.forEach((s) => {
    if (s.active === false || String(s.active).toLowerCase() === 'false') return
    const mine = meetings.filter((m) => String(m.series_id) === String(s.series_id))
    const draft = mine
      .filter((m) => String(m.status) !== 'closed' && pwMs_(m.held_at) >= nowMs - PW_DAY_MS)
      .sort((a, b) => pwMs_(a.held_at) - pwMs_(b.held_at))[0]
    const last = mine
      .filter((m) => String(m.status) === 'closed')
      .sort((a, b) => pwMs_(b.held_at) - pwMs_(a.held_at))[0]
    const at = draft ? draft.held_at : last && last.next_meeting_at ? last.next_meeting_at : ''
    if (at && pwMs_(at) >= nowMs - PW_DAY_MS) out.push({ series: s, at: pwIso_(at) })
  })
  return out
}
