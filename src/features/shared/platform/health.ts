/**
 * Ecosystem health — port of original_deprecated/Health.js.
 *
 * Every scheduled job and sync leaves a heartbeat in the `health` table: one row
 * per heartbeat key, upserted, so it stays small. The same row carries its
 * expected window (expect_every_min, grace_min) which an admin may edit;
 * HB_PLAN holds the defaults.
 *
 * Writing a heartbeat never changes what a job does: beats are queued in memory
 * (hbBeat) and written once per request (hbFlush), every failure is swallowed.
 *
 * State of a heartbeat row:
 *   ok   ran within expect_every_min and its last run had no error
 *   warn late (past the window, within grace) or a partial / warning run
 *   down last run failed, or nothing since expect + grace
 *   idle switched off (active = FALSE), or no run yet and its first deadline
 *        has not passed (counted from when the row was seeded)
 * A system's node is the worst of its rows; its link to the Hub is the worst of
 * the rows marked link = TRUE. A system with no rows is idle (not built).
 *
 * CacheService -> in-memory Map TTL (hb last-write stamps + 60 s health cache);
 * the script lock is n/a on Postgres (per-job upsert keeps cross-writer safety).
 */

import 'server-only'

import { db, readRows, cacheGet, cachePut, cacheRemove } from './repo'

const HEALTH_TABLE = 'health'
export const HEALTH_HEADERS = [
  'job', 'system', 'link', 'label', 'expect_every_min', 'grace_min', 'active', 'last_run_at', 'last_status',
  'last_note', 'last_ok_at', 'last_error_at', 'last_error', 'seeded_at',
]
export const HB_SYSTEMS = ['hub', 'quality', 'productivity', 'queue', 'people', 'operations', 'fcr', 'desk']
const HB_CACHE_KEY = 'eco_health_v2'
const HB_CACHE_S = 60
/** High-frequency jobs rewrite an unchanged heartbeat at most this often; status changes write at once. */
export const HB_MIN_GAP_MIN = 10

/** Defaults for each heartbeat (HB_PLAN verbatim — 23 rows). link = this run moves data between the system and the Hub. */
export const HB_PLAN = [
  // Hub
  { job: 'roster_sync', system: 'hub', link: false, label: 'Roster sync from the HCT (daily)', every: 1440, grace: 180 },
  { job: 'year_rollover', system: 'hub', link: false, label: 'Year stores check (nightly)', every: 1440, grace: 180 },
  // Queue & Workforce
  { job: 'freshdesk_sync', system: 'queue', link: true, label: 'Freshdesk ticket sync (every 15 min)', every: 20, grace: 25 },
  { job: 'daily_report', system: 'queue', link: true, label: 'Daily report intake (Freshchat, Maqsam)', every: 120, grace: 120 },
  { job: 'inflow', system: 'queue', link: true, label: 'Inflow analytics (hourly)', every: 75, grace: 60 },
  { job: 'queue_aggregates', system: 'queue', link: true, label: 'Queue and aging rebuild (every 15 min)', every: 20, grace: 25 },
  { job: 'queue_snapshot', system: 'queue', link: false, label: 'Queue snapshots (4 a day)', every: 720, grace: 90 },
  { job: 'checkin_tick', system: 'queue', link: false, label: 'Check-in tick (every 15 min)', every: 20, grace: 25 },
  // Productivity
  { job: 'prod_snapshot', system: 'productivity', link: true, label: 'Agents Activity snapshot into the interval store (daily ~08:30)', every: 1440, grace: 180 },
  { job: 'prod_flags', system: 'productivity', link: false, label: 'Status flags: detect, auto-accept due ones (daily ~08:30)', every: 1440, grace: 180 },
  { job: 'productivity', system: 'productivity', link: true, label: 'Productivity raw and effective layers (daily ~08:30)', every: 1440, grace: 180 },
  // People & Performance
  { job: 'agent_aggregates', system: 'people', link: true, label: 'Agent performance build (nightly)', every: 1440, grace: 180 },
  { job: 'scorecard', system: 'people', link: true, label: 'Scorecard build (nightly)', every: 1440, grace: 180 },
  { job: 'missed_1on1_check', system: 'people', link: false, label: 'Missed 1:1 check (22:30)', every: 1440, grace: 180 },
  { job: 'oo_reminders', system: 'people', link: false, label: '1:1 reminder emails (every minute)', every: 20, grace: 40 },
  { job: 'task_reminders', system: 'people', link: false, label: 'TL task reminder emails (10:00)', every: 1440, grace: 180 },
  { job: 'meeting_reminders', system: 'people', link: false, label: 'Meeting & BR action reminders (10:30)', every: 1440, grace: 180 },
  { job: 'fc_messages', system: 'queue', link: true, label: 'Freshchat chat messages into the sheet (daily ~05:00, Hub)', every: 1440, grace: 180 },
  { job: 'tl_queue_metrics', system: 'people', link: true, label: 'TL shifts, queue-hour calls / texting, team scores (hourly, Queue app)', every: 60, grace: 60 },
  // TL Desk (Desk app)
  { job: 'mail_desk', system: 'desk', link: true, label: 'Mail desk: response-tracked mails and approval requests from Gmail (every 10 min, Desk app)', every: 10, grace: 20 },
  // Quality
  { job: 'qa_queue_import', system: 'quality', link: true, label: 'QA audit queue: own build when qa_engine_live, else import from the old app (daily 10:30)', every: 1440, grace: 180 },
  { job: 'qa_history_import', system: 'quality', link: true, label: 'Audit history from the Voice and Texting QA forms, then queue reconcile (daily 11:30)', every: 1440, grace: 180 },
  { job: 'qa_ctl_reminders', system: 'quality', link: false, label: 'CTL pop-ups and reminders (daily)', every: 1440, grace: 180 },
]

/** Systems that exist. A system not listed here is idle ("not built"). */
export const HB_BUILT = ['hub', 'quality', 'productivity', 'queue', 'people', 'operations', 'desk']
/** Built systems with no scheduled job to watch: healthy by definition, with this note. */
export const HB_NO_JOBS: Record<string, string> = { operations: 'No scheduled jobs: trackers are read live when opened' }
export const HB_IDLE_NOTE: Record<string, string> = { fcr: 'Not built yet: sources pending' }
export const HB_RANK: Record<string, number> = { idle: 0, ok: 1, warn: 2, down: 3 }

interface HbPlan {
  job: string
  system: string
  link: boolean
  label: string
  every: number
  grace: number
}

export function hbPlanFor(job: string): HbPlan | null {
  for (const p of HB_PLAN) if (p.job === job) return p
  return null
}

/** Normalises a run status to ok / warn / error. 'partial' and 'skipped' count as warn (hbStatus_). */
export function hbStatus(s: unknown): 'ok' | 'warn' | 'error' {
  const v = String(s || '').toLowerCase()
  if (v === 'ok') return 'ok'
  if (v === 'error' || v === 'failed' || v === 'down') return 'error'
  return 'warn'
}

// ---------------------------------------------------------------- heartbeat queue

interface QueuedBeat {
  status: 'ok' | 'warn' | 'error'
  note: string
  at: Date
}

const HB_QUEUE: Record<string, QueuedBeat> = {}

/**
 * Queues a heartbeat for this request (hbBeat_). Within one request the worst
 * status wins and notes are joined, so a later "ok" never hides an earlier failure.
 */
export function hbBeat(job: string, status: unknown, note?: unknown): void {
  try {
    const st = hbStatus(status)
    const at = new Date()
    const prev = HB_QUEUE[job]
    const order = { ok: 0, warn: 1, error: 2 }
    if (prev) {
      if (order[st] >= order[prev.status]) prev.status = st
      if (note && prev.note.indexOf(String(note)) === -1) {
        prev.note = prev.note ? prev.note + '; ' + note : String(note)
      }
      prev.at = at
    } else {
      HB_QUEUE[job] = { status: st, note: note ? String(note) : '', at }
    }
  } catch {
    /* a heartbeat must never break the job */
  }
}

/** Test/route hook: the queued beats not yet flushed. */
export function hbPending(): Record<string, QueuedBeat> {
  return HB_QUEUE
}

/** Test hook: drop the queue and the last-write stamps. */
export function hbReset(): void {
  Object.keys(HB_QUEUE).forEach((k) => delete HB_QUEUE[k])
  // hb_last_<job> lives in the script cache on the GAS side; the oracle resets it
  // per call, so the module-map stand-in must reset here too or a later test's
  // same-status beat is skipped within HB_MIN_GAP_MIN (frozen clock => gap never passes).
  Object.keys(HB_LAST_WRITE).forEach((k) => delete HB_LAST_WRITE[k])
  cacheRemove(HB_CACHE_KEY)
}

/** Runs fn as job `job`: beats ok / error, flushes, and rethrows so the job still reports a failure (hbRun_). */
export async function hbRun<T>(job: string, fn: () => Promise<T> | T, noteOf?: (r: T) => string | undefined): Promise<T> {
  try {
    const r = await fn()
    let note = ''
    try {
      note = noteOf ? noteOf(r) || '' : ''
    } catch {
      /* ignore */
    }
    // A skipped run (not due, switched off) is a healthy run.
    const skipped = (r as { skipped?: string } | null | undefined)?.skipped
    hbBeat(job, 'ok', note || (skipped ? 'Skipped: ' + skipped : ''))
    return r
  } catch (e) {
    hbBeat(job, 'error', (e as Error)?.message ? (e as Error).message : String(e))
    throw e
  } finally {
    await hbFlush()
  }
}

export function hbTime(v: unknown): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v as string)
  return isNaN(d.getTime()) ? null : d
}

export function hbRowFromPlan(p: HbPlan, now: Date): Record<string, unknown> {
  return {
    job: p.job, system: p.system, link: !!p.link, label: p.label, expect_every_min: p.every, grace_min: p.grace,
    active: true, last_run_at: null, last_status: '', last_note: '', last_ok_at: null, last_error_at: null, last_error: '',
    seeded_at: now.toISOString(),
  }
}

/** Adds a row for every planned heartbeat the table lacks (hbEnsureTab_). Safe to re-run. */
export async function hbEnsureTab(): Promise<{ added: number }> {
  const have: Record<string, boolean> = {}
  try {
    ;(await readRows(HEALTH_TABLE)).forEach((r) => {
      have[String(r.job)] = true
    })
  } catch {
    /* no table yet */
  }
  const now = new Date()
  const add = HB_PLAN.filter((p) => !have[p.job]).map((p) => hbRowFromPlan(p, now))
  if (add.length) await db().from(HEALTH_TABLE).insert(add)
  return { added: add.length }
}

// In-memory replacement for the script cache's 'hb_last_<job>' stamps (HB_MIN_GAP_MIN).
const HB_LAST_WRITE: Record<string, string> = {}

/**
 * Writes the queued heartbeats (hbFlush_): unchanged status written recently is
 * skipped; each job's row is updated in place, planned-but-missing rows appended.
 * Window columns (expect_every_min, grace_min) stay editable — never overwritten.
 * Never throws.
 */
export async function hbFlush(): Promise<number> {
  let jobs = Object.keys(HB_QUEUE)
  if (!jobs.length) return 0
  const queued = { ...HB_QUEUE }
  Object.keys(HB_QUEUE).forEach((k) => delete HB_QUEUE[k])
  try {
    jobs = jobs.filter((j) => {
      const prev = HB_LAST_WRITE[j]
      const q = queued[j]
      if (prev) {
        const [pStatus, pAt] = prev.split('|')
        if (pStatus === q.status && q.at.getTime() - Number(pAt) < HB_MIN_GAP_MIN * 60000) return false
      }
      return true
    })
    if (!jobs.length) return 0
    let existing: Record<string, unknown>[] = []
    try {
      existing = await readRows(HEALTH_TABLE)
    } catch {
      /* no table yet: all jobs append below */
    }
    const index: Record<string, Record<string, unknown>> = {}
    existing.forEach((r) => {
      index[String(r.job)] = r
    })
    const appends: Record<string, unknown>[] = []
    for (const j of jobs) {
      const q = queued[j]
      const plan = hbPlanFor(j)
      const row = index[j]
      if (!row) {
        const p = plan || { job: j, system: 'hub', link: false, label: j, every: 1440, grace: 180 }
        const o = hbRowFromPlan(p, q.at)
        /* Legacy hbFlush_ writes the beat fields onto the appended row too —
           without them the first-ever beat is silently dropped. */
        o.last_run_at = q.at.toISOString()
        o.last_status = q.status
        o.last_note = q.note.slice(0, 500)
        if (q.status === 'ok') o.last_ok_at = q.at.toISOString()
        if (q.status === 'error') {
          o.last_error_at = q.at.toISOString()
          o.last_error = q.note.slice(0, 500)
        }
        appends.push(o)
        continue
      }
      const patch: Record<string, unknown> = {}
      if (plan) {
        patch.system = plan.system
        patch.link = !!plan.link
        patch.label = plan.label
      }
      patch.last_run_at = q.at.toISOString()
      patch.last_status = q.status
      patch.last_note = q.note.slice(0, 500)
      if (q.status === 'ok') patch.last_ok_at = q.at.toISOString()
      if (q.status === 'error') {
        patch.last_error_at = q.at.toISOString()
        patch.last_error = q.note.slice(0, 500)
      }
      await db().from(HEALTH_TABLE).update(patch).eq('job', j)
    }
    if (appends.length) await db().from(HEALTH_TABLE).insert(appends)
    jobs.forEach((j) => {
      HB_LAST_WRITE[j] = queued[j].status + '|' + queued[j].at.getTime()
    })
    cacheRemove(HB_CACHE_KEY)
    return jobs.length
  } catch (e) {
    console.log('Health: heartbeat write failed: ' + ((e as Error)?.message || e))
    return 0
  }
}

/** A Health row with the plan's label (the table keeps the windows) — hbWithPlan_. */
export function hbWithPlan(r: Record<string, unknown>, plan: HbPlan): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  Object.keys(r).forEach((k) => {
    o[k] = r[k]
  })
  o.label = plan.label
  if (o.expect_every_min === '' || o.expect_every_min === undefined || o.expect_every_min === null) {
    o.expect_every_min = plan.every
  }
  if (o.grace_min === '' || o.grace_min === undefined || o.grace_min === null) {
    o.grace_min = plan.grace
  }
  return o
}

export interface RowState {
  state: 'idle' | 'ok' | 'warn' | 'down'
  note: string
  awaiting?: boolean
}

/** State of one Health row at `now` (hbRowState_). */
export function hbRowState(r: Record<string, unknown>, now: number): RowState {
  const label = String(r.label || r.job)
  const active = !(r.active === false || String(r.active).toUpperCase() === 'FALSE')
  if (!active) return { state: 'idle', note: label + ': switched off' }
  const every = Number(r.expect_every_min) || 1440
  let grace = Number(r.grace_min)
  if (!isFinite(grace) || grace < 0) grace = 0
  const lastRun = hbTime(r.last_run_at)
  if (!lastRun) {
    const seeded = hbTime(r.seeded_at)
    if (seeded && now - seeded.getTime() <= (every + grace) * 60000) {
      return { state: 'idle', note: label + ': awaiting first run', awaiting: true }
    }
    return {
      state: 'down',
      note: label + ': no run recorded since ' + (seeded ? seeded.toISOString().slice(0, 10) : 'setup'),
    }
  }
  const ageMin = (now - lastRun.getTime()) / 60000
  const status = hbStatus(r.last_status)
  const lastNote = String(r.last_note || '')
  if (ageMin > every + grace) return { state: 'down', note: label + ': nothing for ' + hbHuman(ageMin) }
  if (status === 'error') return { state: 'down', note: label + ' failed' + (lastNote ? ': ' + lastNote : '') }
  if (ageMin > every) return { state: 'warn', note: label + ': late, last run ' + hbHuman(ageMin) + ' ago' }
  if (status === 'warn') return { state: 'warn', note: label + (lastNote ? ': ' + lastNote : ': partial run') }
  return { state: 'ok', note: '' }
}

export function hbHuman(min: number): string {
  if (min < 90) return Math.max(1, Math.round(min)) + ' min'
  if (min < 48 * 60) return Math.round(min / 60) + ' h'
  return Math.round(min / 1440) + ' d'
}

interface CombinePart {
  state: 'idle' | 'ok' | 'warn' | 'down'
  note?: string
  at?: Date | null
  link?: boolean
  awaiting?: boolean
}

interface Combined {
  state: 'idle' | 'ok' | 'warn' | 'down'
  at: string | null
  note?: string
}

/** Worst of several {state, note, at}; idle only when every part is idle (hbCombine_). */
export function hbCombine(parts: CombinePart[], emptyNote?: string): Combined {
  if (!parts.length) return { state: 'idle', at: null, note: emptyNote }
  let worst = parts[0]
  let lastAt: Date | null = null
  for (const p of parts) {
    if (HB_RANK[p.state] > HB_RANK[worst.state]) worst = p
    if (p.at && (!lastAt || p.at.getTime() > lastAt.getTime())) lastAt = p.at
  }
  const out: Combined = { state: worst.state, at: lastAt ? lastAt.toISOString() : null }
  if (worst.state === 'idle' && parts.every((p) => p.state !== 'idle' || p.awaiting)) {
    out.note = 'Awaiting first run'
    return out
  }
  const bad = parts.filter((p) => p.state === worst.state && p.note).map((p) => p.note as string)
  if (worst.state !== 'ok' && bad.length) {
    out.note = bad.slice(0, 2).join('; ') + (bad.length > 2 ? ' (+' + (bad.length - 2) + ' more)' : '')
  }
  return out
}

export interface HealthEvent {
  at: string
  system: string
  state: string
  text: string
}

export interface EcosystemHealth {
  nodes: Record<string, { state: string; lastRun: string | null; note?: string }>
  links: Record<string, { state: string; lastSync: string | null; note?: string }>
  events: HealthEvent[]
  asOf: string
}

/** Pure (hbComputeHealth_): node, link and event states from Health rows. */
export function hbComputeHealth(rows: Record<string, unknown>[], nowMs?: number): EcosystemHealth {
  const now = nowMs || Date.now()
  const nodes: EcosystemHealth['nodes'] = {}
  const links: EcosystemHealth['links'] = {}
  const events: HealthEvent[] = []
  const by: Record<string, CombinePart[]> = {}
  HB_SYSTEMS.forEach((s) => {
    by[s] = []
  })
  rows.forEach((r) => {
    const plan = hbPlanFor(String(r.job))
    const sys = plan ? plan.system : String(r.system || 'hub').toLowerCase()
    if (!by[sys]) return
    const st = hbRowState(plan ? hbWithPlan(r, plan) : r, now)
    const at = hbTime(r.last_run_at)
    const isLink = plan ? !!plan.link : r.link === true || String(r.link).toUpperCase() === 'TRUE'
    by[sys].push({ state: st.state, note: st.note, at, link: isLink, awaiting: !!st.awaiting })
    const label = plan ? plan.label : String(r.label || r.job)
    if (at) {
      const s = hbStatus(r.last_status)
      const why = String(r.last_note || (s === 'error' ? r.last_error || '' : ''))
      events.push({
        at: at.toISOString(),
        system: sys,
        state: s === 'error' ? 'down' : s,
        text:
          label +
          (s === 'ok' ? ' ran' : s === 'error' ? ' failed' : ' ran with a warning') +
          (why && s !== 'ok' ? ': ' + why.slice(0, 160) : ''),
      })
    }
    const errAt = hbTime(r.last_error_at)
    if (errAt && (!at || errAt.getTime() !== at.getTime())) {
      events.push({
        at: errAt.toISOString(),
        system: sys,
        state: 'down',
        text: label + ' failed' + (r.last_error ? ': ' + String(r.last_error).slice(0, 160) : ''),
      })
    }
    if (st.state === 'down' && !(at && hbStatus(r.last_status) === 'error')) {
      events.push({ at: new Date(now).toISOString(), system: sys, state: 'down', text: st.note })
    }
  })
  HB_SYSTEMS.forEach((s) => {
    const built = HB_BUILT.indexOf(s) !== -1
    let parts = by[s]
    if (!built) parts = []
    else if (!parts.length) {
      parts = HB_NO_JOBS[s]
        ? [{ state: 'ok' as const, note: '', at: null, link: true }]
        : [{ state: 'idle' as const, note: '', at: null, link: true, awaiting: true }]
    }
    const empty = built ? HB_NO_JOBS[s] || 'Awaiting first run' : HB_IDLE_NOTE[s] || 'Not built yet'
    const n = hbCombine(parts, empty)
    nodes[s] = { state: n.state, lastRun: n.at }
    if (n.note || HB_NO_JOBS[s]) nodes[s].note = n.note || HB_NO_JOBS[s]
    if (s === 'hub') return
    const lp = parts.filter((p) => p.link)
    let l = hbCombine(lp, !built ? empty : HB_NO_JOBS[s] || 'Awaiting first sync')
    if (built && !lp.length) {
      l = { state: n.state === 'idle' ? 'idle' : 'ok', at: n.at, note: 'No separate sync: this system reads the Hub directly' }
    }
    links[s] = { state: l.state, lastSync: l.at }
    if (l.note || HB_NO_JOBS[s]) links[s].note = l.note || HB_NO_JOBS[s]
  })
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return { nodes, links, events: events.slice(0, 15), asOf: new Date(now).toISOString() }
}

/**
 * Runs that happened before heartbeats existed, from records the jobs already
 * keep (hbEvidence_): the refresh_log tail, today's queue snapshots, and any
 * dq_last_* config keys standing in for the legacy script properties. Never throws.
 */
export async function hbEvidence(): Promise<Record<string, { at: Date; status: string; note: string }>> {
  const ev: Record<string, { at: Date; status: string; note: string }> = {}
  const put = (job: string, at: unknown, status?: string, note?: string) => {
    const d = hbTime(at)
    if (!d) return
    if (!ev[job] || ev[job].at < d) ev[job] = { at: d, status: status || 'ok', note: note || '' }
  }
  try {
    const { configAll } = await import('./settings')
    const all = await configAll()
    Object.keys(all).forEach((k) => {
      const up = k.toUpperCase()
      if (up.indexOf('DQ_LAST_') === 0) put(up.slice(8).toLowerCase(), all[k], 'ok')
    })
  } catch {
    /* no config */
  }
  try {
    const rows = await readRows('refresh_log', { orderBy: 'finished_at', ascending: false, limit: 400 })
    rows.forEach((r) => {
      const st = String(r.status || '')
      put(
        String(r.job),
        r.finished_at || r.started_at,
        st === 'error' ? 'error' : st === 'ok' ? 'ok' : 'warn',
        r.error ? String(r.error).slice(0, 160) : ''
      )
    })
  } catch {
    /* no log */
  }
  try {
    const rows = await readRows('agg_snapshots_today')
    rows.forEach((r) => {
      put('queue_snapshot', r.captured_at, 'ok')
    })
  } catch {
    /* no snapshots */
  }
  // The check-in tick runs in the same 15-minute job as the queue rebuild.
  if (ev.queue_aggregates && !ev.checkin_tick) ev.checkin_tick = ev.queue_aggregates
  return ev
}

/** Fills rows that have no heartbeat yet from earlier evidence; adds planned rows the tab lacks (hbWithEvidence_). Pure. */
export function hbWithEvidence(
  rows: Record<string, unknown>[],
  ev: Record<string, { at: Date; status: string; note: string }>
): Record<string, unknown>[] {
  const have: Record<string, boolean> = {}
  const out = rows.map((r) => {
    have[String(r.job)] = true
    const e = ev[String(r.job)]
    if (hbTime(r.last_run_at) || !e) return r
    const o: Record<string, unknown> = {}
    Object.keys(r).forEach((k) => {
      o[k] = r[k]
    })
    o.last_run_at = e.at
    o.last_status = e.status
    o.last_note = e.note || 'From the run log (before heartbeats)'
    return o
  })
  HB_PLAN.forEach((p) => {
    if (have[p.job]) return
    const e = ev[p.job]
    const o = hbRowFromPlan(p, new Date())
    if (e) {
      o.last_run_at = e.at
      o.last_status = e.status
      o.last_note = e.note || 'From the run log (before heartbeats)'
    }
    out.push(o)
  })
  return out
}

/** The ecosystem health, cached ~60 s (hbEcosystemHealth_). Never throws: a missing table means every system is idle. */
export async function ecosystemHealth(): Promise<EcosystemHealth> {
  try {
    const hit = cacheGet(HB_CACHE_KEY)
    if (hit) return JSON.parse(hit) as EcosystemHealth
  } catch {
    /* recompute */
  }
  let rows: Record<string, unknown>[] = []
  try {
    rows = await readRows(HEALTH_TABLE)
  } catch {
    /* no Health table */
  }
  const ev = await hbEvidence()
  const out = hbComputeHealth(hbWithEvidence(rows, ev), Date.now())
  try {
    cachePut(HB_CACHE_KEY, JSON.stringify(out), HB_CACHE_S)
  } catch {
    /* too big or no cache */
  }
  return out
}

/** Hub home (admin, TL) equivalent of getEcosystemHealth — the route does requireRole. */
export { ecosystemHealth as getEcosystemHealth }

/** setupHealth equivalent: creates the heartbeat rows. Admin-gated by the caller. */
export async function setupHealth(): Promise<string> {
  const r = await hbEnsureTab()
  cacheRemove(HB_CACHE_KEY)
  const msg =
    'Health tab ready: ' + r.added + ' heartbeat row(s) added. Edit expect_every_min / grace_min there to change a window.'
  console.log(msg)
  return msg
}
